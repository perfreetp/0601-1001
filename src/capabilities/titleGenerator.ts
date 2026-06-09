import { AIProvider, TitleGenerationRequest, TitleGenerationResult, TitleStyle, Tone } from '../types';

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

const SYSTEM_PROMPT = `你是一位资深的内容运营和标题专家，深谙传播心理学。
请严格按照 JSON 格式返回结果，格式如下：
{
  "titles": [
    { "title": string, "style": string, "highlights": string[], "explanation": string, "suitabilityScore": number }
  ],
  "recommendation": string,
  "bestPractice": string
}
要求：每个标题给出 2-3 个设计亮点 highlights，explanation 解释为什么这样设计，suitabilityScore 为 0-100 的整数。`;

export class TitleGenerator {
  constructor(private provider: AIProvider) {}

  async generate(req: TitleGenerationRequest): Promise<TitleGenerationResult> {
    const styles = req.styles && req.styles.length > 0
      ? req.styles
      : ['catchy', 'howto', 'question', 'list', 'story'] as TitleStyle[];
    const count = Math.max(1, Math.min(10, req.count || 5));

    const styleDescriptions = styles.map(s => `- ${s}（${STYLE_DESCRIPTIONS[s]}）`).join('\n');

    const userPrompt = `请为以下内容生成 ${count} 个不同风格的标题：

主题：${req.topic}
${req.tone ? `整体语气：${TONE_DESCRIPTIONS[req.tone]}` : ''}
${req.keywords?.length ? `必须包含的关键词：${req.keywords.join('、')}` : ''}
${req.context ? `补充背景：${req.context}` : ''}

请覆盖以下风格：
${styleDescriptions}

每个标题要说明亮点、设计解释和适用度评分。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.95, responseFormat: 'json' }
    );

    return this.parseResponse(response);
  }

  private parseResponse(text: string): TitleGenerationResult {
    try {
      return JSON.parse(text) as TitleGenerationResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TitleGenerationResult;
      }
      throw new Error('无法解析标题生成结果');
    }
  }
}
