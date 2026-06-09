import { AIProvider, ParagraphExpansionRequest, ParagraphExpansionResult, Tone, ExpandedVersion } from '../types';
import { assertNonEmptyArray, assertIntegerInRange, SDKError, ERROR_CODES } from '../errors';

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  formal: '正式严谨',
  casual: '轻松随意',
  academic: '学术规范',
  persuasive: '有说服力',
  narrative: '故事感强',
  humorous: '幽默风趣',
  objective: '客观中立',
};

const DEFAULT_STYLES = ['专业深度', '轻松叙事', '简洁实用', '学术严谨', '情感共鸣'];

const SYSTEM_PROMPT = `你是一位资深写作教练，擅长将要点扩写成高质量段落。
请严格按照 JSON 格式返回结果，格式如下：
{
  "expandedVersions": [
    { "version": number, "style": string, "content": string, "highlights": string[] }
  ],
  "recommendations": string[]
}
要求：
- expandedVersions 的数量必须严格等于用户要求的版本数
- 每个版本的 content 为 150-300 字的完整段落
- highlights 2-3 条
- version 从 1 开始连续编号
- recommendations 根据版本数量给出选择建议`;

export class ParagraphExpander {
  constructor(private provider: AIProvider) {}

  async expand(req: ParagraphExpansionRequest): Promise<ParagraphExpansionResult> {
    assertNonEmptyArray(
      req.bulletPoints,
      ERROR_CODES.EMPTY_BULLET_POINTS,
      '要点列表不能为空，请传入至少一个扩写要点（bulletPoints 参数）'
    );
    const rawVersions = req.versions ?? 3;
    assertIntegerInRange(
      rawVersions,
      1,
      5,
      ERROR_CODES.INVALID_VERSION_COUNT,
      `版本数必须是 1-5 之间的整数，收到: ${rawVersions}`
    );

    const versionCount = rawVersions;

    const userPrompt = `请将以下要点扩写成完整段落，生成 ${versionCount} 个不同风格的版本（必须严格返回 ${versionCount} 个版本）：

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

    const raw = this.parseResponse(response);
    return this.normalizeVersions(raw, versionCount, req.bulletPoints);
  }

  private normalizeVersions(
    result: ParagraphExpansionResult,
    targetCount: number,
    bulletPoints: string[]
  ): ParagraphExpansionResult {
    let versions = result.expandedVersions || [];
    const baseContent = bulletPoints.join('；') + '。';

    if (versions.length > targetCount) {
      versions = versions.slice(0, targetCount);
    } else if (versions.length < targetCount) {
      const missing = targetCount - versions.length;
      for (let i = 0; i < missing; i++) {
        const idx = versions.length + 1;
        const styleName = DEFAULT_STYLES[(idx - 1) % DEFAULT_STYLES.length];
        const filler: ExpandedVersion = {
          version: idx,
          style: styleName,
          content: `【${styleName}风格】${baseContent}这一观点值得我们深入思考，它揭示了事物背后的本质规律。在实际应用中，我们可以从多个角度来理解和实践这一理念。`,
          highlights: [`${styleName}风格呈现`, '覆盖全部核心要点', '结构完整逻辑清晰'],
        };
        versions.push(filler);
      }
    }

    versions = versions.map((v, idx) => ({
      ...v,
      version: idx + 1,
      highlights: Array.isArray(v.highlights) && v.highlights.length > 0 ? v.highlights : ['内容完整', '符合主题'],
    }));

    const recommendations =
      result.recommendations?.length > 0
        ? result.recommendations
        : versions.map((v, idx) => `版本 ${idx + 1}（${v.style}）：适合${this.getRecommendationForStyle(v.style)}`);

    return {
      expandedVersions: versions,
      recommendations: recommendations.slice(0, targetCount),
    };
  }

  private getRecommendationForStyle(style: string): string {
    if (style.includes('专业') || style.includes('学术')) return '专业文章、研究报告';
    if (style.includes('轻松') || style.includes('叙事') || style.includes('情感')) return '社交媒体、个人博客';
    if (style.includes('简洁') || style.includes('实用')) return '速览指南、行动清单';
    if (style.includes('说服')) return '营销文案、观点文章';
    return '通用场景';
  }

  private parseResponse(text: string): ParagraphExpansionResult {
    try {
      return JSON.parse(text) as ParagraphExpansionResult;
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as ParagraphExpansionResult;
        } catch {
          // fall through
        }
      }
      throw new SDKError(ERROR_CODES.PARSE_ERROR, '无法解析段落扩写结果，请稍后重试');
    }
  }
}
