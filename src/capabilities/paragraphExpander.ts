import { AIProvider, ParagraphExpansionRequest, ParagraphExpansionResult, Tone } from '../types';

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  formal: '正式严谨',
  casual: '轻松随意',
  academic: '学术规范',
  persuasive: '有说服力',
  narrative: '故事感强',
  humorous: '幽默风趣',
  objective: '客观中立',
};

const SYSTEM_PROMPT = `你是一位资深写作教练，擅长将要点扩写成高质量段落。
请严格按照 JSON 格式返回结果，格式如下：
{
  "expandedVersions": [
    { "version": number, "style": string, "content": string, "highlights": string[] }
  ],
  "recommendations": string[]
}
要求：每个版本的内容为 150-300 字的完整段落，highlights 2-3 条，recommendations 根据版本数量给出选择建议。`;

export class ParagraphExpander {
  constructor(private provider: AIProvider) {}

  async expand(req: ParagraphExpansionRequest): Promise<ParagraphExpansionResult> {
    const versionCount = Math.max(1, Math.min(5, req.versions || 3));
    const userPrompt = `请将以下要点扩写成完整段落，生成 ${versionCount} 个不同风格的版本：

要点：
${req.bulletPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${req.tone ? `整体语气倾向：${TONE_DESCRIPTIONS[req.tone]}` : ''}
${req.focusPoint ? `重点突出：${req.focusPoint}` : ''}
${req.context ? `上下文背景：${req.context}` : ''}

每个版本风格要有明显差异（如专业深度、轻松叙事、简洁实用等）。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.9, responseFormat: 'json' }
    );

    return this.parseResponse(response);
  }

  private parseResponse(text: string): ParagraphExpansionResult {
    try {
      return JSON.parse(text) as ParagraphExpansionResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ParagraphExpansionResult;
      }
      throw new Error('无法解析段落扩写结果');
    }
  }
}
