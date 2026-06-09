import { AIProvider, TitleGenerationRequest, TitleGenerationResult, TitleStyle, Tone, TitleOption } from '../types';
import { assertNonEmptyString, assertIntegerInRange, assertNonEmptyArray, SDKError, ERROR_CODES } from '../errors';

const STYLE_DESCRIPTIONS: Record<TitleStyle, string> = {
  catchy: '吸睛爆款型，带有悬念或情绪钩子',
  formal: '正式规范型，适合专业场合',
  question: '提问型，引发读者思考',
  howto: '方法教程型，明确告知收益',
  list: '清单列表型，用数字增加具体感',
  story: '故事叙事型，带有个人或案例色彩',
  news: '新闻资讯型，客观陈述事实',
};

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  formal: '正式严谨',
  casual: '轻松随意',
  academic: '学术规范',
  persuasive: '有说服力',
  narrative: '故事感强',
  humorous: '幽默风趣',
  objective: '客观中立',
};

const ALL_STYLES: TitleStyle[] = ['catchy', 'formal', 'question', 'howto', 'list', 'story', 'news'];

const SYSTEM_PROMPT = `你是一位资深的内容运营和标题专家，深谙传播心理学。
请严格按照 JSON 格式返回结果，格式如下：
{
  "titles": [
    { "title": string, "style": string, "highlights": string[], "explanation": string, "suitabilityScore": number }
  ],
  "recommendation": string,
  "bestPractice": string
}
要求：
- titles 数量必须严格等于用户要求的数量
- style 必须使用用户指定的风格之一
- 每个标题给出 2-3 个设计亮点 highlights
- explanation 解释为什么这样设计
- suitabilityScore 为 0-100 的整数`;

export class TitleGenerator {
  constructor(private provider: AIProvider) {}

  async generate(req: TitleGenerationRequest): Promise<TitleGenerationResult> {
    assertNonEmptyString(
      req.topic,
      ERROR_CODES.EMPTY_TOPIC,
      '主题不能为空，请传入有效的主题（topic 参数）'
    );

    const rawCount = req.count ?? 5;
    assertIntegerInRange(
      rawCount,
      1,
      10,
      ERROR_CODES.INVALID_TITLE_COUNT,
      `标题数量必须是 1-10 之间的整数，收到: ${rawCount}`
    );

    let styles = req.styles && req.styles.length > 0 ? req.styles : ALL_STYLES;
    const invalidStyles = styles.filter(s => !(s in STYLE_DESCRIPTIONS));
    if (invalidStyles.length > 0) {
      throw new SDKError(
        ERROR_CODES.INVALID_STYLES,
        `存在不支持的标题风格: ${invalidStyles.join('、')}，支持的风格: ${ALL_STYLES.join('、')}`,
        { invalidStyles, supportedStyles: ALL_STYLES }
      );
    }
    assertNonEmptyArray(styles, ERROR_CODES.INVALID_STYLES, '标题风格列表不能为空');

    const count = rawCount;
    const styleDescriptions = styles.map(s => `- ${s}（${STYLE_DESCRIPTIONS[s]}）`).join('\n');

    const userPrompt = `请为以下内容生成 ${count} 个标题（必须严格返回 ${count} 个）：

主题：${req.topic}
${req.tone ? `整体语气：${TONE_DESCRIPTIONS[req.tone]}` : ''}
${req.keywords?.length ? `必须包含的关键词：${req.keywords.join('、')}` : ''}
${req.context ? `补充背景：${req.context}` : ''}

只能使用以下风格（可重复使用以满足数量要求）：
${styleDescriptions}

每个标题必须在 style 字段中明确标注使用了哪种风格，且必须是上面列出的风格之一。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.95, responseFormat: 'json' }
    );

    const raw = this.parseResponse(response);
    return this.normalizeTitles(raw, count, styles, req.topic);
  }

  private normalizeTitles(
    result: TitleGenerationResult,
    targetCount: number,
    allowedStyles: TitleStyle[],
    topic: string
  ): TitleGenerationResult {
    let titles = (result.titles || []).filter(t => {
      if (t && typeof t.title === 'string' && t.title.trim().length > 0) {
        const styleIsValid = allowedStyles.includes(t.style as TitleStyle);
        if (!styleIsValid && allowedStyles.length > 0) {
          t.style = allowedStyles[0];
        }
        return true;
      }
      return false;
    });

    if (titles.length > targetCount) {
      titles = titles.slice(0, targetCount);
    } else if (titles.length < targetCount) {
      const missing = targetCount - titles.length;
      for (let i = 0; i < missing; i++) {
        const idx = titles.length + 1;
        const style = allowedStyles[(idx - 1) % allowedStyles.length];
        const filler: TitleOption = {
          title: this.generateFallbackTitle(topic, style, idx),
          style,
          highlights: ['直击主题', '清晰明了', '符合' + STYLE_DESCRIPTIONS[style].split('，')[0]],
          explanation: `采用${STYLE_DESCRIPTIONS[style].split('，')[0]}设计，围绕「${topic}」核心主题展开。`,
          suitabilityScore: 75,
        };
        titles.push(filler);
      }
    }

    titles = titles.map((t, idx) => {
      const style = allowedStyles.includes(t.style as TitleStyle)
        ? (t.style as TitleStyle)
        : allowedStyles[idx % allowedStyles.length];
      return {
        ...t,
        style,
        suitabilityScore: Math.max(0, Math.min(100, t.suitabilityScore || 75)),
        highlights: Array.isArray(t.highlights) && t.highlights.length > 0 ? t.highlights : ['符合主题', '表达清晰'],
      };
    });

    return {
      titles,
      recommendation:
        result.recommendation ||
        `综合考虑传播性和内容匹配度，优先推荐第 1 个标题。`,
      bestPractice:
        result.bestPractice ||
        '好标题的三个标准：1. 读者一眼知道对自己有什么用；2. 有具体数字或细节增加可信度；3. 制造一点悬念或情绪钩子。',
    };
  }

  private generateFallbackTitle(topic: string, style: TitleStyle, idx: number): string {
    switch (style) {
      case 'catchy':
        return `别再错过了：关于${topic}的${idx}个关键真相`;
      case 'formal':
        return `${topic}：基于实践的系统性分析`;
      case 'question':
        return `为什么${topic}如此重要？答案可能出乎你意料`;
      case 'howto':
        return `如何掌握${topic}：一份实用的进阶指南`;
      case 'list':
        return `${topic}的${idx}个核心要点，你知道几个？`;
      case 'story':
        return `我是如何通过${topic}改变现状的`;
      case 'news':
        return `关于${topic}的最新观察与思考`;
      default:
        return `${topic}全面解析`;
    }
  }

  private parseResponse(text: string): TitleGenerationResult {
    try {
      return JSON.parse(text) as TitleGenerationResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as TitleGenerationResult;
        } catch {
          // fall through
        }
      }
      throw new SDKError(ERROR_CODES.PARSE_ERROR, '无法解析标题生成结果，请稍后重试');
    }
  }
}
