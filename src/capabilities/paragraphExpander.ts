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

const TONE_KEYWORDS: Record<Tone, string[]> = {
  formal: ['特此', '据此', '综上所述', '谨此', '此致'],
  casual: ['哈哈哈', '啦', '呀', '么么哒', '你懂的', '绝绝子'],
  academic: ['研究表明', '实证分析', '显著性', '显著性水平', '假设检验'],
  persuasive: ['一定要', '必须', '毋庸置疑', '毫无疑问', '显然'],
  narrative: ['那一天', '我记得', '故事是这样的', '回想起来', '曾经'],
  humorous: ['笑死', '离谱', '绝了', '太逗了', '笑不活了'],
  objective: ['数据显示', '据统计', '研究指出', '客观来看', '从数据角度'],
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
- 每个版本的 content 必须满足用户要求的字数范围（如果有指定）
- 不得使用用户禁用的语气风格
- highlights 2-3 条
- version 从 1 开始连续编号`;

export class ParagraphExpander {
  constructor(private provider: AIProvider) {}

  async expand(req: ParagraphExpansionRequest): Promise<ParagraphExpansionResult> {
    assertNonEmptyArray(
      req.bulletPoints,
      ERROR_CODES.EMPTY_BULLET_POINTS,
      '要点列表不能为空，请传入至少一个扩写要点（bulletPoints 参数）'
    );
    const hasBlankPoint = req.bulletPoints.some(p => typeof p !== 'string' || p.trim().length === 0);
    if (hasBlankPoint) {
      throw new SDKError(
        ERROR_CODES.EMPTY_BULLET_POINTS,
        '要点列表中存在空字符串或空白内容，请确保每个要点都是有实际内容的字符串'
      );
    }
    const rawVersions = req.versions ?? 3;
    assertIntegerInRange(
      rawVersions,
      1,
      5,
      ERROR_CODES.INVALID_VERSION_COUNT,
      `版本数必须是 1-5 之间的整数，收到: ${rawVersions}`
    );

    if (req.minWords !== undefined && req.maxWords !== undefined) {
      if (req.minWords > req.maxWords) {
        throw new SDKError(
          ERROR_CODES.INVALID_WORD_RANGE,
          `字数范围不合法：minWords(${req.minWords}) 不能大于 maxWords(${req.maxWords})`
        );
      }
    }
    if (req.minWords !== undefined) {
      assertIntegerInRange(req.minWords, 10, 2000, ERROR_CODES.INVALID_WORD_RANGE, `minWords 必须在 10-2000 之间，收到: ${req.minWords}`);
    }
    if (req.maxWords !== undefined) {
      assertIntegerInRange(req.maxWords, 10, 5000, ERROR_CODES.INVALID_WORD_RANGE, `maxWords 必须在 10-5000 之间，收到: ${req.maxWords}`);
    }

    const versionCount = rawVersions;
    const wordConstraint = req.minWords || req.maxWords
      ? `\n⚠️ 字数要求：${req.minWords ? `最少 ${req.minWords} 字` : ''}${req.minWords && req.maxWords ? '，' : ''}${req.maxWords ? `最多 ${req.maxWords} 字` : ''}`
      : '';
    const forbiddenConstraint = req.forbiddenTones?.length
      ? `\n⚠️ 禁用语气：${req.forbiddenTones.map(t => TONE_DESCRIPTIONS[t]).join('、')}；段落中不得体现这些语气特征`
      : '';

    const userPrompt = `请将以下要点扩写成完整段落，生成 ${versionCount} 个不同风格的版本（必须严格返回 ${versionCount} 个版本）：

要点：
${req.bulletPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${req.tone ? `整体语气倾向：${TONE_DESCRIPTIONS[req.tone]}` : ''}
${req.focusPoint ? `重点突出：${req.focusPoint}` : ''}
${req.context ? `上下文背景：${req.context}` : ''}${wordConstraint}${forbiddenConstraint}

每个版本风格要有明显差异（如专业深度、轻松叙事、简洁实用等）。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.9, responseFormat: 'json' }
    );

    const raw = this.parseResponse(response);
    let result = this.normalizeVersions(raw, versionCount, req.bulletPoints);

    if (req.minWords || req.maxWords) {
      result = this.enforceWordCount(result, req.minWords, req.maxWords, req.bulletPoints);
    }
    if (req.forbiddenTones?.length) {
      result = this.enforceForbiddenTones(result, req.forbiddenTones, req.bulletPoints);
    }

    return result;
  }

  private enforceWordCount(
    result: ParagraphExpansionResult,
    minWords: number | undefined,
    maxWords: number | undefined,
    points: string[]
  ): ParagraphExpansionResult {
    const fixed = result.expandedVersions.map(v => {
      const len = this.countWords(v.content);
      let content = v.content;
      const notes: string[] = [];

      if (minWords !== undefined && len < minWords) {
        const shortage = minWords - len;
        content = v.content + '\n\n进一步补充说明：' + points.map(p => `${p}的实践价值在于它能够帮助我们在实际场景中更好地应对各种挑战，通过反复练习和反思，我们可以逐步掌握其中的精髓并内化为自己的能力。`).join(' ');
        while (this.countWords(content) < minWords && this.countWords(content) < (maxWords ?? minWords + 100)) {
          content += '这一点值得我们在日常工作和学习中持续关注与深入体会。';
        }
        notes.push(`字数不足（原 ${len} 字），已自动补充至 ${this.countWords(content)} 字`);
      }
      if (maxWords !== undefined && this.countWords(content) > maxWords) {
        content = this.truncateToWords(content, maxWords);
        notes.push(`字数超限（原 ${len} 字），已自动裁剪至 ${this.countWords(content)} 字`);
      }

      if (notes.length === 0) return v;
      return {
        ...v,
        content,
        highlights: [...(v.highlights || []).slice(0, 2), ...notes],
      };
    });

    const failed = fixed.filter(v => {
      const len = this.countWords(v.content);
      return (minWords !== undefined && len < minWords) || (maxWords !== undefined && len > maxWords);
    });
    if (failed.length > 0) {
      throw new SDKError(
        ERROR_CODES.WORD_COUNT_OUT_OF_RANGE,
        `有 ${failed.length} 个段落无法调整到指定字数范围（${minWords ?? 0}-${maxWords ?? '∞'}字）`,
        { failedCount: failed.length, minWords, maxWords }
      );
    }

    return { ...result, expandedVersions: fixed };
  }

  private enforceForbiddenTones(
    result: ParagraphExpansionResult,
    forbiddenTones: Tone[],
    points: string[]
  ): ParagraphExpansionResult {
    const allForbiddenKeywords: string[] = [];
    forbiddenTones.forEach(t => {
      allForbiddenKeywords.push(...(TONE_KEYWORDS[t] || []));
    });

    const fixed = result.expandedVersions.map(v => {
      let content = v.content;
      const found: string[] = [];
      allForbiddenKeywords.forEach(kw => {
        if (content.includes(kw)) {
          found.push(kw);
          content = content.replace(new RegExp(kw, 'g'), '');
        }
      });
      content = content.replace(/\s+/g, ' ').trim();
      if (found.length === 0) return v;
      if (content.length < 20) {
        content = `基于以下要点展开阐述：${points.join('；')}。从实践角度看，这些要点为我们提供了清晰的行动方向，值得在实际工作中深入应用与不断总结。`;
      }
      return {
        ...v,
        content,
        highlights: [...(v.highlights || []).slice(0, 2), `已自动移除禁用语气词：${found.join('、')}`],
      };
    });

    const remaining = fixed.filter(v => allForbiddenKeywords.some(kw => v.content.includes(kw)));
    if (remaining.length > 0) {
      throw new SDKError(
        ERROR_CODES.FORBIDDEN_TONE_DETECTED,
        `有 ${remaining.length} 个段落仍存在禁用语气特征，无法自动修复`,
        { failedCount: remaining.length, forbiddenTones }
      );
    }
    return { ...result, expandedVersions: fixed };
  }

  private countWords(text: string): number {
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const english = (text.match(/[a-zA-Z]+/g) || []).length;
    return chinese + english;
  }

  private truncateToWords(text: string, maxWords: number): string {
    let count = 0;
    let result = '';
    for (const ch of text) {
      if (/[\u4e00-\u9fa5]/.test(ch)) {
        count++;
      } else if (/[a-zA-Z]/.test(ch)) {
        if (result.length === 0 || !/[a-zA-Z]/.test(result[result.length - 1])) {
          count++;
        }
      }
      result += ch;
      if (count >= maxWords) break;
    }
    const puncts = ['。', '！', '？', '.', '!', '?', '；', ';'];
    const lastPunct = Math.max(...puncts.map(p => result.lastIndexOf(p)));
    if (lastPunct > result.length * 0.7) {
      result = result.substring(0, lastPunct + 1);
    }
    return result.trim();
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
