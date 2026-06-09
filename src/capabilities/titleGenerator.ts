import {
  AIProvider,
  TitleGenerationRequest,
  TitleGenerationResult,
  TitleStyle,
  Tone,
  TitleOption,
  TitleRiskTag,
  TitleChannel,
  TitleChannelFit,
  TitleQualityReview,
  TitleBatchQuality,
  TitleRanking,
} from '../types';
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

const EXAGGERATION_WORDS = [
  '彻底', '完全', '100%', '百分之百', '绝对', '最强', '无敌', '史上最',
  '爆', '炸', '疯传', '震惊', '颠覆', '革命性', '史无前例', '前无古人',
  '秒杀', '碾压', '吊打', '宇宙第一', '全球最佳', '完美', '终极',
];

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
- suitabilityScore 为 0-100 的整数
- 如果用户要求必须包含关键词，则每个标题都必须包含至少一个指定关键词
- 如果用户要求避免夸张表达，标题中不要使用"彻底"、"100%"、"绝对"、"最强"、"完美"等夸大词汇`;

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

    if (req.styles !== undefined) {
      if (!Array.isArray(req.styles) || req.styles.length === 0) {
        throw new SDKError(
          ERROR_CODES.INVALID_STYLES,
          '标题风格列表不能为空；如果希望使用全部默认风格请不要传入 styles 参数，或传入至少一个有效风格（catchy、formal、question、howto、list、story、news）'
        );
      }
    }
    if (req.mustIncludeKeywords) {
      if (!Array.isArray(req.keywords) || req.keywords.length === 0) {
        throw new SDKError(
          ERROR_CODES.KEYWORD_MISSING,
          '开启 mustIncludeKeywords 时，必须传入非空的 keywords 数组'
        );
      }
      const hasBlank = req.keywords.some(k => typeof k !== 'string' || k.trim().length === 0);
      if (hasBlank) {
        throw new SDKError(
          ERROR_CODES.KEYWORD_MISSING,
          'keywords 数组中存在空字符串或空白内容，请确保每个关键词都有实际内容'
        );
      }
    }
    let styles = req.styles ?? ALL_STYLES;
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
    const keywordConstraint = req.mustIncludeKeywords && req.keywords?.length
      ? `\n⚠️ 硬性要求：每个标题都必须包含以下至少一个关键词：${req.keywords.join('、')}`
      : '';
    const exaggerationConstraint = req.avoidExaggeration
      ? '\n⚠️ 硬性要求：标题必须避免夸张表达，严禁使用"彻底"、"100%"、"绝对"、"最强"、"完美"、"颠覆"等夸大词汇'
      : '';

    const userPrompt = `请为以下内容生成 ${count} 个标题（必须严格返回 ${count} 个）：

主题：${req.topic}
${req.tone ? `整体语气：${TONE_DESCRIPTIONS[req.tone]}` : ''}
${req.keywords?.length ? `参考关键词：${req.keywords.join('、')}` : ''}
${req.context ? `补充背景：${req.context}` : ''}${keywordConstraint}${exaggerationConstraint}

只能使用以下风格（可重复使用以满足数量要求）：
${styleDescriptions}

每个标题必须在 style 字段中明确标注使用了哪种风格，且必须是上面列出的风格之一。`;

    const response = await this.provider.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: req.avoidExaggeration ? 0.6 : 0.95, responseFormat: 'json' }
    );

    const raw = this.parseResponse(response);
    let result = this.normalizeTitles(raw, count, styles, req.topic);

    if (req.mustIncludeKeywords && req.keywords?.length) {
      result = this.enforceKeywords(result, req.keywords, req.topic, styles);
    }
    if (req.avoidExaggeration) {
      result = this.enforceNoExaggeration(result, req.topic, styles);
    }

    result.titles = result.titles.map(t => ({
      ...t,
      matchedKeywords: (req.keywords || []).filter(kw => t.title.includes(kw)),
    }));

    if (req.keywords && req.keywords.length > 0) {
      result = { ...result, keywordCoverage: this.buildKeywordCoverage(result.titles, req.keywords) };
    }

    result.titles = result.titles.map((t, idx) => ({
      ...t,
      quality: this.reviewTitleQuality(t, idx, result.titles, req.topic, req.keywords || []),
    }));
    result = { ...result, batchQuality: this.buildBatchQuality(result.titles, req.topic) };

    return result;
  }

  private enforceKeywords(
    result: TitleGenerationResult,
    keywords: string[],
    topic: string,
    allowedStyles: TitleStyle[]
  ): TitleGenerationResult {
    const coverageCount: Record<string, number> = {};
    keywords.forEach(kw => { coverageCount[kw] = 0; });
    result.titles.forEach(t => {
      keywords.forEach(kw => {
        if (t.title.includes(kw)) coverageCount[kw]++;
      });
    });

    const fixedTitles = result.titles.map((t) => {
      const alreadyHit = keywords.filter(kw => t.title.includes(kw));
      if (alreadyHit.length >= 1) {
        if (alreadyHit.length === 1) {
          const missed = keywords.filter(kw => !t.title.includes(kw));
          if (missed.length > 0) {
            missed.sort((a, b) => (coverageCount[a] || 0) - (coverageCount[b] || 0));
            const candidate = missed[0];
            if ((coverageCount[candidate] || 0) === 0) {
              const style = t.style;
              let newTitle = t.title;
              if (style === 'list' || style === 'howto') {
                newTitle = `${t.title}：${candidate}实战指南`;
              } else if (style === 'question') {
                newTitle = `${t.title.replace(/？$/, '')}？顺便聊聊${candidate}`;
              } else if (style === 'formal') {
                newTitle = `${topic}研究：以${alreadyHit[0]}与${candidate}为核心的分析框架`;
              } else {
                newTitle = `${t.title.replace(/（附.*?）$/, '')}（附${candidate}实战技巧）`;
              }
              if (newTitle !== t.title) {
                coverageCount[candidate] = (coverageCount[candidate] || 0) + 1;
                return {
                  ...t,
                  title: newTitle,
                  highlights: [...(t.highlights || []).slice(0, 2), `为提高覆盖率已植入关键词「${candidate}」`],
                };
              }
            }
          }
        }
        return t;
      }

      const missedSorted = keywords.slice().sort((a, b) => (coverageCount[a] || 0) - (coverageCount[b] || 0));
      const kw = missedSorted[0];
      const style = t.style;
      let newTitle = t.title;
      if (style === 'list' || style === 'howto') {
        newTitle = `${t.title}：${kw}实战指南`;
      } else if (style === 'question') {
        newTitle = `为什么${kw}如此重要？${t.title.replace(/^为什么.*？/, '').replace(/^为什么.*\?/, '')}`;
      } else if (style === 'formal') {
        newTitle = `${topic}研究：以${kw}为核心的分析框架`;
      } else {
        newTitle = `${t.title}（附${kw}实战技巧）`;
      }
      coverageCount[kw] = (coverageCount[kw] || 0) + 1;
      return {
        ...t,
        title: newTitle,
        highlights: [...(t.highlights || []).slice(0, 2), `已自动植入关键词「${kw}」`],
      };
    });

    const allPass = fixedTitles.every(t => keywords.some(kw => t.title.includes(kw)));
    if (!allPass) {
      const failed = fixedTitles.filter(t => !keywords.some(kw => t.title.includes(kw)));
      throw new SDKError(
        ERROR_CODES.KEYWORD_MISSING,
        `有 ${failed.length} 个标题无法自动植入指定关键词，请调整关键词或降低 mustIncludeKeywords 要求`,
        { failedCount: failed.length, keywords }
      );
    }
    return { ...result, titles: fixedTitles };
  }

  private enforceNoExaggeration(
    result: TitleGenerationResult,
    topic: string,
    allowedStyles: TitleStyle[]
  ): TitleGenerationResult {
    const fixedTitles = result.titles.map(t => {
      let title = t.title;
      const foundWords: string[] = [];
      EXAGGERATION_WORDS.forEach(word => {
        if (title.includes(word)) {
          foundWords.push(word);
          title = title
            .replace(new RegExp(word, 'g'), '')
            .replace(/\s+/g, ' ')
            .replace(/（\s*）/g, '')
            .replace(/\(\s*\)/g, '')
            .trim();
        }
      });
      if (foundWords.length === 0) return t;
      if (title.length < 4) {
        title = `${topic}的理性分析与实用建议`;
      }
      return {
        ...t,
        title,
        highlights: [...(t.highlights || []).slice(0, 2), `已自动移除夸张词汇：${foundWords.join('、')}`],
        suitabilityScore: Math.max(50, t.suitabilityScore - 10),
      };
    });

    const exaggerationRemaining = fixedTitles.filter(t =>
      EXAGGERATION_WORDS.some(w => t.title.includes(w))
    );
    if (exaggerationRemaining.length > 0) {
      throw new SDKError(
        ERROR_CODES.EXAGGERATION_DETECTED,
        `有 ${exaggerationRemaining.length} 个标题仍存在夸张表达，无法自动修复`,
        { failedCount: exaggerationRemaining.length }
      );
    }
    return { ...result, titles: fixedTitles };
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
          matchedKeywords: [],
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
        matchedKeywords: Array.isArray(t.matchedKeywords) ? t.matchedKeywords : [],
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
        return `关于${topic}的${idx}个关键要点`;
      case 'formal':
        return `${topic}：基于实践的系统性分析`;
      case 'question':
        return `为什么${topic}如此重要？一份客观分析`;
      case 'howto':
        return `如何掌握${topic}：一份实用的进阶指南`;
      case 'list':
        return `${topic}的${idx}个核心要点，你知道几个？`;
      case 'story':
        return `我是如何通过${topic}取得实际进展的`;
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

  private buildKeywordCoverage(titles: TitleOption[], keywords: string[]): NonNullable<TitleGenerationResult['keywordCoverage']> {
    const perTitleCoverage = titles.map((t, idx) => ({
      titleIndex: idx,
      matchedKeywords: t.matchedKeywords,
      hasAllRequired: t.matchedKeywords.length >= 1,
    }));
    const coveredKeywords = Array.from(new Set(titles.flatMap(t => t.matchedKeywords)));
    const missingKeywords = keywords.filter(kw => !coveredKeywords.includes(kw));
    const coverageRate = keywords.length > 0 ? coveredKeywords.length / keywords.length : 0;
    return {
      totalKeywords: keywords.length,
      coveredKeywords,
      missingKeywords,
      coverageRate: Math.round(coverageRate * 100) / 100,
      perTitleCoverage,
    };
  }

  private EXAGGERATION_WORDS = [
    '彻底', '完全', '100%', '百分之百', '绝对', '最强', '无敌', '史上最',
    '爆', '炸', '疯传', '震惊', '颠覆', '革命性', '史无前例', '前无古人',
    '秒杀', '碾压', '吊打', '宇宙第一', '全球最佳', '完美', '终极',
  ];

  private detectRisks(title: string, idx: number, allTitles: TitleOption[], topic: string): TitleQualityReview['riskDetails'] {
    const risks: TitleQualityReview['riskDetails'] = [];
    const lower = title;
    const hasExag = this.EXAGGERATION_WORDS.some(w => lower.includes(w));
    if (hasExag) {
      const found = this.EXAGGERATION_WORDS.filter(w => lower.includes(w));
      risks.push({ tag: 'exaggeration', description: `标题包含夸张词汇：${found.join('、')}`, severity: 'high' });
    }
    const dupIdx = allTitles.findIndex((t, i) => i !== idx && t.title === title);
    if (dupIdx >= 0) {
      risks.push({ tag: 'repetition', description: `与第 ${dupIdx + 1} 个标题完全重复`, severity: 'high' });
    } else {
      const similar = allTitles.filter((t, i) => i !== idx && t.title.substring(0, Math.min(10, t.title.length)) === title.substring(0, Math.min(10, title.length)));
      if (similar.length >= 1) {
        risks.push({ tag: 'repetition', description: `与其他 ${similar.length} 个标题开头高度雷同，缺乏区分度`, severity: 'medium' });
      }
    }
    const topicInTitle = title.includes(topic.substring(0, 2)) || title.includes(topic);
    if (!topicInTitle && topic.length > 1) {
      risks.push({ tag: 'off_topic', description: `标题未明显体现主题「${topic}」，可能偏离读者预期`, severity: 'medium' });
    }
    if (title.length > 35) {
      risks.push({ tag: 'too_long', description: `标题共 ${title.length} 字，超过大多数平台推荐的 20-25 字上限`, severity: 'medium' });
    } else if (title.length < 6) {
      risks.push({ tag: 'too_short', description: `标题仅 ${title.length} 字，信息量不足`, severity: 'medium' });
    }
    const emojiCount = (title.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
    if (emojiCount >= 3) {
      risks.push({ tag: 'emoji_overuse', description: `包含 ${emojiCount} 个 emoji，可能影响专业感`, severity: 'low' });
    }
    const hasBadPunct = /[，。！？]{2,}/.test(title);
    if (hasBadPunct) {
      risks.push({ tag: 'punctuation_issue', description: '存在连续标点，表达不够规范', severity: 'low' });
    }
    return risks;
  }

  private detectChannelFit(title: string, style: TitleStyle, risks: TitleQualityReview['riskDetails']): TitleChannelFit[] {
    const hasExag = risks.some(r => r.tag === 'exaggeration');
    const isLong = title.length > 25;
    const isShort = title.length <= 15;
    const isQuestion = style === 'question' || /？|\?/.test(title);
    const isList = style === 'list' || /\d+个|\d+条/.test(title);
    const isFormal = style === 'formal' || style === 'news';

    const all: { channel: TitleChannel; fitScore: number; reason: string }[] = [
      { channel: 'wechat', fitScore: 70, reason: '微信公众号标题 15-25 字为佳，适合带有悬念或情绪钩子' },
      { channel: 'weibo', fitScore: 65, reason: '微博标题偏短平快，支持话题标签和情绪表达' },
      { channel: 'zhihu', fitScore: 60, reason: '知乎适合提问型或干货型标题，越具体越好' },
      { channel: 'xiaohongshu', fitScore: 55, reason: '小红书适合清单、攻略、种草类标题，可适当使用 emoji' },
      { channel: 'douyin', fitScore: 55, reason: '抖音标题要短、有冲突感，配合视频封面' },
      { channel: 'official', fitScore: 60, reason: '官方渠道要求规范严谨，避免夸张和网络用语' },
      { channel: 'news_media', fitScore: 60, reason: '新闻媒体要求客观中立，适合陈述事实' },
      { channel: 'general', fitScore: 70, reason: '通用场景，适合大部分阅读类产品' },
    ];

    if (isQuestion) all.find(a => a.channel === 'zhihu')!.fitScore += 20;
    if (isList) {
      all.find(a => a.channel === 'xiaohongshu')!.fitScore += 15;
      all.find(a => a.channel === 'wechat')!.fitScore += 10;
    }
    if (isFormal) {
      all.find(a => a.channel === 'official')!.fitScore += 20;
      all.find(a => a.channel === 'news_media')!.fitScore += 15;
    }
    if (isShort) {
      all.find(a => a.channel === 'douyin')!.fitScore += 20;
      all.find(a => a.channel === 'weibo')!.fitScore += 15;
    }
    if (isLong) {
      all.find(a => a.channel === 'wechat')!.fitScore += 10;
      all.find(a => a.channel === 'douyin')!.fitScore -= 15;
    }
    if (hasExag) {
      all.find(a => a.channel === 'official')!.fitScore -= 30;
      all.find(a => a.channel === 'news_media')!.fitScore -= 25;
      all.find(a => a.channel === 'xiaohongshu')!.fitScore += 10;
    }

    return all
      .map(a => ({ ...a, fitScore: Math.max(0, Math.min(100, a.fitScore)) }))
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 3);
  }

  private calculateReadabilityScore(title: string): number {
    let score = 70;
    if (title.length >= 12 && title.length <= 25) score += 15;
    if (/\d/.test(title)) score += 5;
    if (/[，。！？、]/.test(title)) score += 5;
    if (/[a-zA-Z]{5,}/.test(title)) score -= 5;
    return Math.max(0, Math.min(100, score));
  }

  private reviewTitleQuality(t: TitleOption, idx: number, allTitles: TitleOption[], topic: string, keywords: string[]): TitleQualityReview {
    const riskDetails = this.detectRisks(t.title, idx, allTitles, topic);
    const riskTags = Array.from(new Set(riskDetails.map(r => r.tag)));
    const topChannels = this.detectChannelFit(t.title, t.style, riskDetails);
    const readabilityScore = this.calculateReadabilityScore(t.title);
    const keywordDiversityScore = t.matchedKeywords.length > 0
      ? Math.min(100, 40 + t.matchedKeywords.length * 20)
      : 30;
    const riskPenalty = riskDetails.reduce((acc, r) => acc + (r.severity === 'high' ? 15 : r.severity === 'medium' ? 8 : 3), 0);
    const overallScore = Math.max(0, Math.min(100, Math.round(
      (t.suitabilityScore * 0.4) + (readabilityScore * 0.2) + (keywordDiversityScore * 0.2) + (topChannels[0].fitScore * 0.2) - riskPenalty
    )));

    const improvementSuggestions: string[] = [];
    if (riskDetails.find(r => r.tag === 'exaggeration')) {
      improvementSuggestions.push('🚫 移除夸张词汇，改为更客观的表达');
    }
    if (riskDetails.find(r => r.tag === 'repetition')) {
      improvementSuggestions.push('🔄 调整标题开头或结构，避免与其他标题雷同');
    }
    if (riskDetails.find(r => r.tag === 'off_topic')) {
      improvementSuggestions.push(`🎯 建议在标题中直接出现主题词「${topic}」`);
    }
    if (riskDetails.find(r => r.tag === 'too_long')) {
      improvementSuggestions.push('✂️ 压缩至 25 字以内，保留最核心信息');
    }
    if (keywords.length > 0 && t.matchedKeywords.length === 0) {
      improvementSuggestions.push(`🔑 建议植入至少一个参考关键词（${keywords.join('/')}）`);
    }
    if (improvementSuggestions.length === 0) {
      improvementSuggestions.push('✅ 当前标题质量良好，可根据目标渠道微调风格');
    }

    return {
      overallScore,
      riskTags,
      riskDetails,
      topChannels,
      keywordDiversityScore,
      readabilityScore,
      improvementSuggestions,
    };
  }

  private buildBatchQuality(titles: TitleOption[], topic: string): TitleBatchQuality {
    const averageScore = Math.round(titles.reduce((acc, t) => acc + (t.quality?.overallScore || 0), 0) / titles.length);
    const uniqueStyles = new Set(titles.map(t => t.style)).size;
    const uniqueKeywords = new Set(titles.flatMap(t => t.matchedKeywords)).size;
    const diversityScore = Math.min(100, (uniqueStyles / 7) * 50 + (uniqueKeywords / Math.max(1, titles.length)) * 50);

    const riskMap: Record<string, number> = {};
    titles.forEach(t => {
      t.quality?.riskTags.forEach(tag => {
        riskMap[tag] = (riskMap[tag] || 0) + 1;
      });
    });
    const riskSummary = Object.entries(riskMap).map(([tag, count]) => ({ tag: tag as TitleRiskTag, count }));

    const ranked: TitleRanking[] = titles
      .map((t, idx) => ({
        titleIndex: idx,
        finalScore: t.quality?.overallScore ?? 0,
        rank: 0,
        reason: '',
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .map((r, i) => {
        const t = titles[r.titleIndex];
        const topChannel = t.quality?.topChannels?.[0];
        const topKw = t.matchedKeywords.length > 0 ? `命中关键词「${t.matchedKeywords.join('/')}」` : '未命中关键词';
        return {
          ...r,
          rank: i + 1,
          reason: `综合评分 ${r.finalScore}/100，${topChannel ? `最适合「${topChannel.channel}」渠道，` : ''}${topKw}，风格 ${t.style}`,
        };
      });

    const top = ranked[0];
    const topTitle = titles[top.titleIndex];
    const userFriendlySummary = `📊 整批 ${titles.length} 个标题质量报告
平均评分：${averageScore}/100，风格多样性：${Math.round(diversityScore)}/100
风险分布：${riskSummary.length > 0 ? riskSummary.map(r => `${r.tag}×${r.count}`).join('、') : '无明显风险'}
🏆 推荐首推：第 ${top.rank} 个标题（${topTitle.style}风格），评分 ${top.finalScore}/100
   ${top.reason}`;

    return {
      averageScore,
      diversityScore: Math.round(diversityScore),
      riskSummary,
      rankedTitles: ranked.sort((a, b) => a.titleIndex - b.titleIndex),
      topRecommendation: { titleIndex: top.titleIndex, reason: top.reason },
      userFriendlySummary,
    };
  }
}
