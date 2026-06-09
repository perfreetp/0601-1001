import { AIProvider, OutlineGenerationRequest, OutlineGenerationResult, Tone, ArticleLength } from '../types';

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
要求：chapters 数量必须与用户要求一致，每章 keyPoints 3-5 个，introduction 100-200 字，conclusion 80-150 字。`;

export class OutlineGenerator {
  constructor(private provider: AIProvider) {}

  async generate(req: OutlineGenerationRequest): Promise<OutlineGenerationResult> {
    const userPrompt = `请为以下主题生成文章大纲：

主题：${req.topic}
章节数：${req.chapterCount} 章
语气风格：${TONE_DESCRIPTIONS[req.tone || 'objective']}
篇幅要求：${LENGTH_DESCRIPTIONS[req.length || 'medium']}
${req.audience ? `目标读者：${req.audience}` : ''}
${req.keywords?.length ? `需要融入的关键词：${req.keywords.join('、')}` : ''}
${req.context ? `补充背景：${req.context}` : ''}

请设计一个逻辑清晰、引人入胜的文章大纲。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.8, responseFormat: 'json' }
    );

    return this.parseResponse(response);
  }

  private parseResponse(text: string): OutlineGenerationResult {
    try {
      return JSON.parse(text) as OutlineGenerationResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as OutlineGenerationResult;
      }
      throw new Error('无法解析大纲生成结果');
    }
  }
}
