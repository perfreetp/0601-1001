import { AIProvider, OutlineGenerationRequest, OutlineGenerationResult, Tone, ArticleLength, OutlineChapter } from '../types';
import { assertNonEmptyString, assertIntegerInRange, SDKError, ERROR_CODES } from '../errors';

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  formal: '正式严谨，适合专业出版物和学术场景',
  casual: '轻松随意，像朋友聊天一样',
  academic: '学术化，引用规范，论述严谨',
  persuasive: '有说服力，引导读者认同观点',
  narrative: '叙事性，用故事感驱动内容',
  humorous: '幽默风趣，能让读者会心一笑',
  objective: '客观中立，事实陈述为主',
};

const LENGTH_DESCRIPTIONS: Record<ArticleLength, string> = {
  short: '每章 400-600 字，全文约 2000-3000 字',
  medium: '每章 800-1200 字，全文约 4000-6000 字',
  long: '每章 1500-2000 字，全文约 7000-10000 字',
  detailed: '每章 2000 字以上，内容详尽，适合深度长文',
};

const SYSTEM_PROMPT = `你是一位资深的内容架构师，擅长设计高质量的文章大纲。
请严格按照 JSON 格式返回结果，格式如下：
{
  "title": string,
  "introduction": string,
  "chapters": [{ "index": number, "title": string, "purpose": string, "keyPoints": string[], "estimatedLength": string }],
  "conclusion": string,
  "totalEstimatedWords": number,
  "structureNote": string
}
要求：chapters 数量必须严格等于用户要求的章节数，每章 keyPoints 3-5 个，introduction 100-200 字，conclusion 80-150 字。index 必须从 1 开始连续递增。`;

const ESTIMATED_LENGTH_MAP: Record<ArticleLength, string> = {
  short: '500字',
  medium: '1000字',
  long: '1800字',
  detailed: '2500字',
};

export class OutlineGenerator {
  constructor(private provider: AIProvider) {}

  async generate(req: OutlineGenerationRequest): Promise<OutlineGenerationResult> {
    assertNonEmptyString(
      req.topic,
      ERROR_CODES.EMPTY_TOPIC,
      '主题不能为空，请传入有效的写作主题（topic 参数）'
    );
    assertIntegerInRange(
      req.chapterCount,
      1,
      20,
      ERROR_CODES.INVALID_CHAPTER_COUNT,
      `章节数必须是 1-20 之间的整数，收到: ${req.chapterCount}`
    );

    const targetCount = req.chapterCount;
    const length = req.length || 'medium';

    const userPrompt = `请为以下主题生成文章大纲：

主题：${req.topic}
章节数：${targetCount} 章（必须严格返回 ${targetCount} 章，不多不少）
语气风格：${TONE_DESCRIPTIONS[req.tone || 'objective']}
篇幅要求：${LENGTH_DESCRIPTIONS[length]}
${req.audience ? `目标读者：${req.audience}` : ''}
${req.keywords?.length ? `需要融入的关键词：${req.keywords.join('、')}` : ''}
${req.context ? `补充背景：${req.context}` : ''}

请设计一个逻辑清晰、引人入胜的文章大纲，章节数量必须严格为 ${targetCount} 章。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.8, responseFormat: 'json' }
    );

    const raw = this.parseResponse(response);
    return this.normalizeChapters(raw, targetCount, length);
  }

  private normalizeChapters(
    result: OutlineGenerationResult,
    targetCount: number,
    length: ArticleLength
  ): OutlineGenerationResult {
    let chapters = result.chapters || [];

    if (chapters.length === targetCount) {
      chapters = chapters.map((ch, idx) => ({
        ...ch,
        index: idx + 1,
        keyPoints: Array.isArray(ch.keyPoints) && ch.keyPoints.length > 0 ? ch.keyPoints : ['核心要点'],
        estimatedLength: ch.estimatedLength || ESTIMATED_LENGTH_MAP[length],
      }));
    } else if (chapters.length > targetCount) {
      chapters = chapters.slice(0, targetCount).map((ch, idx) => ({
        ...ch,
        index: idx + 1,
        keyPoints: Array.isArray(ch.keyPoints) && ch.keyPoints.length > 0 ? ch.keyPoints : ['核心要点'],
        estimatedLength: ch.estimatedLength || ESTIMATED_LENGTH_MAP[length],
      }));
    } else {
      const missing = targetCount - chapters.length;
      const topic = result.title || '补充章节';
      for (let i = 0; i < missing; i++) {
        const idx = chapters.length + 1;
        const filler: OutlineChapter = {
          index: idx,
          title: `${topic} - 补充章节 ${idx}`,
          purpose: '完善文章结构，覆盖更多相关内容',
          keyPoints: ['要点 1', '要点 2', '要点 3'],
          estimatedLength: ESTIMATED_LENGTH_MAP[length],
        };
        chapters.push(filler);
      }
    }

    const totalWords = chapters.reduce((acc) => {
      const match = (chapters[0]?.estimatedLength || '1000字').match(/(\d+)/);
      return acc + (match ? parseInt(match[1], 10) : 1000);
    }, 0);

    return {
      ...result,
      chapters,
      totalEstimatedWords: result.totalEstimatedWords || totalWords,
    };
  }

  private parseResponse(text: string): OutlineGenerationResult {
    try {
      return JSON.parse(text) as OutlineGenerationResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as OutlineGenerationResult;
        } catch {
          // fall through
        }
      }
      throw new SDKError(ERROR_CODES.PARSE_ERROR, '无法解析大纲生成结果，请稍后重试');
    }
  }
}
