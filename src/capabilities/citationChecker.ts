import { AIProvider, CitationCheckRequest, CitationCheckResult } from '../types';

const SYSTEM_PROMPT = `你是一位严谨的事实核查编辑，负责检查文章的引用完整性和表述客观性。
请严格按照 JSON 格式返回结果，格式如下：
{
  "missingSources": [
    { "sentence": string, "claim": string, "suggestion": string, "impact": "low"|"medium"|"high" }
  ],
  "exaggerations": [
    { "sentence": string, "original": string, "alternative": string, "reason": string }
  ],
  "overallScore": number,
  "recommendations": string[],
  "userFriendlyReport": string
}
要求：overallScore 为 0-100 的整数分数，userFriendlyReport 是给普通用户看的整体报告，要用 emoji 和通俗语言，包含评分、问题列表和改进建议。`;

export class CitationChecker {
  constructor(private provider: AIProvider) {}

  async check(req: CitationCheckRequest): Promise<CitationCheckResult> {
    const strictnessMap = {
      lenient: '宽松（只标明显问题）',
      moderate: '适中（平衡严谨与可读性）',
      strict: '严格（任何可能的问题都标注）',
    };

    const userPrompt = `请检查以下文章的引用来源和表述客观性：

文章内容：
"""
${req.text}
"""

严格程度：${strictnessMap[req.strictness || 'moderate']}

请检查：
1. 哪些论断缺少数据来源或参考文献支撑（missingSources）
2. 哪些地方存在夸大、绝对化或不严谨的表述（exaggerations）
3. 给出整体评分和改进建议`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.2, responseFormat: 'json' }
    );

    return this.parseResponse(response);
  }

  private parseResponse(text: string): CitationCheckResult {
    try {
      return JSON.parse(text) as CitationCheckResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as CitationCheckResult;
      }
      throw new Error('无法解析引用检查结果');
    }
  }
}
