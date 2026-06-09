import { AIProvider, PolishRequest, PolishResult, Tone } from '../types';

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  formal: '正式严谨',
  casual: '轻松随意',
  academic: '学术规范',
  persuasive: '有说服力',
  narrative: '故事感强',
  humorous: '幽默风趣',
  objective: '客观中立',
};

const SYSTEM_PROMPT = `你是一位专业的文字编辑，擅长润色和修改文章。
请严格按照 JSON 格式返回结果，格式如下：
{
  "polishedText": string,
  "issues": [
    { "type": "typo"|"repetition"|"tone"|"logic"|"style", "severity": "low"|"medium"|"high", "original": string, "suggestion": string, "reason": string, "position": { "start": number, "end": number } }
  ],
  "summary": { "typoCount": number, "repetitionCount": number, "toneAdjustments": number, "logicFixes": number, "totalImprovements": number },
  "userFriendlyChanges": string[]
}
要求：userFriendlyChanges 是给普通用户看的修改说明，使用 emoji 和通俗易懂的语言，不要用专业术语。issues 中的 position 为可选字段。`;

export class Polisher {
  constructor(private provider: AIProvider) {}

  async polish(req: PolishRequest): Promise<PolishResult> {
    const options = req.options || {};
    const enabledOptions = [
      options.fixTypos !== false && '修正错别字和标点错误',
      options.removeRepetition !== false && '去除冗余和重复表达',
      options.adjustTone && options.targetTone && `调整语气为「${TONE_DESCRIPTIONS[options.targetTone]}」`,
      options.fixLogicJumps !== false && '修正逻辑跳跃和衔接不畅',
    ].filter(Boolean).join('、');

    const userPrompt = `请润色以下文本：

原文：
"""
${req.text}
"""

润色选项：${enabledOptions || '综合润色'}
${req.context ? `上下文：${req.context}` : ''}

请仔细修改，并列出所有发现的问题和修改建议。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, responseFormat: 'json' }
    );

    return this.parseResponse(response);
  }

  private parseResponse(text: string): PolishResult {
    try {
      return JSON.parse(text) as PolishResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as PolishResult;
      }
      throw new Error('无法解析润色结果');
    }
  }
}
