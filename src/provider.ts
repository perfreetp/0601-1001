import { AIProvider, AIChatMessage, SDKConfig, TitleStyle } from './types';

const STYLE_TEMPLATES: Record<TitleStyle, (topic: string, idx: number) => string> = {
  catchy: (t, i) => `别再错过了：关于${t}的${i}个关键真相`,
  formal: (t) => `${t}：基于实践的系统性分析`,
  question: (t) => `为什么${t}如此重要？答案可能出乎你意料`,
  howto: (t) => `如何掌握${t}：一份实用的进阶指南`,
  list: (t, i) => `${t}的${i}个核心要点，你知道几个？`,
  story: (t) => `我是如何通过${t}改变现状的`,
  news: (t) => `关于${t}的最新观察与思考`,
};

const STYLE_NAMES_CN: Record<TitleStyle, string> = {
  catchy: '吸睛爆款型',
  formal: '正式规范型',
  question: '提问思考型',
  howto: '方法教程型',
  list: '清单列表型',
  story: '故事叙事型',
  news: '新闻资讯型',
};

const PARAGRAPH_STYLES = ['专业深度', '轻松叙事', '简洁实用', '学术严谨', '情感共鸣'];

function extractNumber(pattern: RegExp, text: string, fallback: number): number {
  const m = text.match(pattern);
  if (m && m[1]) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n)) return n;
  }
  return fallback;
}

function extractTopic(text: string): string {
  const m = text.match(/主题[：:]\s*([^\n]+)/);
  return m && m[1] ? m[1].trim() : '本文主题';
}

function extractStyles(text: string): TitleStyle[] {
  const all: TitleStyle[] = ['catchy', 'formal', 'question', 'howto', 'list', 'story', 'news'];
  const found: TitleStyle[] = [];
  all.forEach(s => {
    if (text.includes(s)) found.push(s);
  });
  return found.length > 0 ? found : all;
}

function extractBulletPoints(text: string): string[] {
  const matches = text.match(/^\s*\d+\.\s*(.+)$/gm);
  if (matches && matches.length > 0) {
    return matches.map(m => m.replace(/^\s*\d+\.\s*/, '').trim());
  }
  return ['核心观点'];
}

function extractArticleContent(text: string): string {
  const m = text.match(/当前文章内容：\s*\n"""\n([\s\S]*?)\n"""/);
  if (m && m[1]) return m[1];
  return '';
}

function generateChapters(count: number, topic: string) {
  const templates = [
    { title: '认识' },
    { title: '核心原理：' },
    { title: '实践方法：' },
    { title: '常见误区：' },
    { title: '进阶技巧：' },
    { title: '案例分析：' },
    { title: '工具推荐：' },
    { title: '总结与行动：' },
  ];
  const chapters = [];
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    chapters.push({
      index: i + 1,
      title: `${t.title}${topic}的第${i + 1}个关键维度`,
      purpose: `帮助读者深入理解${topic}的第${i + 1}个方面`,
      keyPoints: [`要点 ${i + 1}-1`, `要点 ${i + 1}-2`, `要点 ${i + 1}-3`],
      estimatedLength: '1000字',
    });
  }
  return chapters;
}

function generateExpandedVersions(count: number, points: string[]) {
  const versions = [];
  const baseContent = points.join('；') + '。';
  for (let i = 0; i < count; i++) {
    const style = PARAGRAPH_STYLES[i % PARAGRAPH_STYLES.length];
    versions.push({
      version: i + 1,
      style,
      content: `【${style}风格】${baseContent}这一观点值得我们深入思考，它揭示了事物背后的本质规律。在实际应用中，我们可以从多个角度来理解和实践这一理念，从而获得更深刻的认识和更好的结果。版本 ${i + 1} 特别强调了从${style}角度来阐述这一内容，以满足不同读者的阅读偏好。`,
      highlights: [`${style}风格呈现`, '覆盖全部核心要点', '结构完整逻辑清晰'],
    });
  }
  return versions;
}

function generateTitles(count: number, styles: TitleStyle[], topic: string) {
  const titles = [];
  for (let i = 0; i < count; i++) {
    const style = styles[i % styles.length];
    const template = STYLE_TEMPLATES[style];
    titles.push({
      title: template(topic, i + 1),
      style,
      highlights: [`${STYLE_NAMES_CN[style]}设计`, '直击主题核心', '读者友好表达'],
      explanation: `采用${STYLE_NAMES_CN[style]}的设计思路，围绕「${topic}」展开，能够有效吸引目标读者注意力。`,
      suitabilityScore: 75 + ((i * 3) % 20),
    });
  }
  return titles;
}

export class MockAIProvider implements AIProvider {
  async chat(messages: AIChatMessage[], options?: { temperature?: number; responseFormat?: 'json' | 'text' }): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';

    // 强特征优先："当前文章内容"是会话改稿独有，先匹配避免被润色/引用等关键词截胡
    if (lastUserMessage.includes('当前文章内容')) {
      const original = extractArticleContent(lastUserMessage);
      const isMarketing = /营销|推广|转化|卖点|吸睛|爆款|文案风格/.test(lastUserMessage);
      const isAcademic = /学术|论文|研究|严谨|引用|数据/.test(lastUserMessage);

      let revised = '';
      let response = '';
      let changes: string[] = [];

      if (isMarketing) {
        revised = (original || '初稿') + '\n\n——【营销风格润色】——\n💡 核心卖点升级：时间管理不再是枯燥的技能，而是让你每天多出 2 小时的效率神器！\n🎯 用户痛点直击：还在为每天加班到深夜而焦虑？这套方法已帮助 10000+ 职场人实现工作生活平衡。\n📣 行动号召：现在就开始实践，30 天见证显著改变！';
        response = '已为您切换到营销风格文案。主要强化了卖点包装、痛点直击和行动号召，更适合投放推广场景。';
        changes = [
          '🎯 增加了用户痛点直击描述',
          '💡 突出了核心卖点和收益感',
          '📣 补充了行动号召（CTA）语句',
          '📈 加入了社会证明（数据佐证）',
        ];
      } else if (isAcademic) {
        revised = (original || '初稿') + '\n\n——【学术风格润色】——\n根据 Chen et al. (2023) 的实证研究，注意力管理策略与工作绩效之间存在显著正相关（r = 0.62, p < 0.01）。如表 1 所示，采用结构化时间管理方法的被试组，其任务完成率相较对照组提升 34.7%（标准差 = 8.2%）。上述结果与 Smith & Jones (2022) 的元分析结论一致，支持了注意力资源有限性理论的核心假设。未来研究可进一步探讨个体差异变量的调节效应。\n\n参考文献：\nChen, Y., et al. (2023). Attention Management and Job Performance. Journal of Organizational Psychology, 45(2), 112-138.\nSmith, A. B., & Jones, C. D. (2022). A meta-analysis of time management interventions.';
        response = '已为您切换到学术风格表达。补充了实证数据、统计显著性说明、规范引用和参考文献，符合学术写作标准。';
        changes = [
          '📊 补充了实证研究数据与统计显著性',
          '📚 增加了规范的文内引用',
          '📝 补充了参考文献列表（APA 格式）',
          '🔬 语言调整为客观严谨的学术表达',
        ];
      } else {
        revised = (original || '初稿') + '\n\n——【主线通用润色】——\n为了便于实际落地，这里补充一个可执行的三步法：第一步，每晚睡前花 10 分钟列出第二天最重要的 3 件事；第二步，上午用整块时间优先处理这 3 件事；第三步，下班前花 5 分钟复盘完成情况。坚持两周后，你会发现重要事项的完成率有明显提升。同时也要注意劳逸结合，适当的休息反而有助于长期保持高效状态。';
        response = '已完成主线润色。优化了逻辑衔接，补充了可落地的三步法，并增加了劳逸结合的提醒，适合通用阅读场景。';
        changes = [
          '📝 优化了段落间的逻辑衔接',
          '✅ 补充了可执行的三步操作法',
          '😌 增加了劳逸结合的平衡建议',
          '🔗 语言调整为清晰自然的通用表达',
        ];
      }

      return JSON.stringify({
        response,
        revisedContent: revised,
        userFriendlyChanges: changes,
      });
    }

    if (lastUserMessage.includes('主题分析') || lastUserMessage.includes('受众') || (lastUserMessage.includes('topic') && lastUserMessage.includes('关键词'))) {
      const topic = extractTopic(lastUserMessage);
      return JSON.stringify({
        audiences: [
          { name: '职场新人', description: '刚进入职场的年轻人', characteristics: ['学习意愿强', '时间充裕'], painPoints: ['缺乏经验', '容易焦虑'] },
          { name: '资深从业者', description: '有多年经验的专业人士', characteristics: ['注重效率', '有付费能力'], painPoints: ['时间紧张', '晋升瓶颈'] },
        ],
        angles: [
          { title: `从心理学角度看${topic}`, description: '结合心理学理论展开', uniqueness: '科学视角', suitability: '适合深度内容' },
          { title: `真实案例：${topic}实践复盘`, description: '第一人称叙事分享', uniqueness: '真实感强', suitability: '适合社交媒体' },
        ],
        keywords: {
          primary: [topic, `${topic}方法`, `${topic}技巧`],
          secondary: [`${topic}入门`, `${topic}实践`, `${topic}指南`],
          longTail: [`如何学习${topic}`, `${topic}常见问题`, `${topic}最佳实践`],
        },
        summary: `「${topic}」主题受众广泛，建议结合科学视角和真实案例增强说服力。`,
      });
    }

    if (lastUserMessage.includes('大纲') || lastUserMessage.includes('outline') || lastUserMessage.includes('章节数')) {
      const chapterCount = extractNumber(/章节数[：:]\s*(\d+)/, lastUserMessage, 5);
      const topic = extractTopic(lastUserMessage);
      const chapters = generateChapters(chapterCount, topic);
      return JSON.stringify({
        title: `${topic}：从入门到精通的${chapterCount}个步骤`,
        introduction: `在当今快速变化的时代，${topic}已经成为一项不可或缺的能力。本文将通过 ${chapterCount} 个章节，系统地介绍${topic}的核心内容和实践方法。`,
        chapters,
        conclusion: `${topic}的学习是一个持续迭代的过程，希望本文的${chapterCount}个章节能为你提供清晰的指引。`,
        totalEstimatedWords: chapterCount * 1000,
        structureNote: `采用循序渐进的 ${chapterCount} 章结构，从理论到实践层层递进，适合系统性学习。`,
      });
    }

    if (lastUserMessage.includes('扩写') || lastUserMessage.includes('expand') || lastUserMessage.includes('段落') || lastUserMessage.includes('要点')) {
      const versions = extractNumber(/生成\s*(\d+)\s*个/, lastUserMessage, 3);
      const points = extractBulletPoints(lastUserMessage);
      const expanded = generateExpandedVersions(versions, points);
      return JSON.stringify({
        expandedVersions: expanded,
        recommendations: expanded.map((v, i) => `版本 ${i + 1}（${v.style}）：适合不同的使用场景和读者群体`),
      });
    }

    if (lastUserMessage.includes('润色') || lastUserMessage.includes('polish') || lastUserMessage.includes('错别字')) {
      return JSON.stringify({
        polishedText: '高效工作的核心不在于做更多的事，而在于做正确的事。许多人误以为忙碌就是有成效的，实际上许多看似忙碌的行为，本质上是在回避那些真正困难但重要的任务。',
        issues: [
          { type: 'typo' as const, severity: 'medium' as const, original: 'productive', suggestion: '有成效的', reason: '中英文混用不规范', position: { start: 24, end: 34 } },
          { type: 'logic' as const, severity: 'high' as const, original: '大部分忙碌只是在逃避', suggestion: '许多看似忙碌的行为，本质上是在回避', reason: '原句过于绝对' },
        ],
        summary: { typoCount: 1, repetitionCount: 0, toneAdjustments: 0, logicFixes: 1, totalImprovements: 2 },
        userFriendlyChanges: [
          '✏️ 修正了 1 处中英文混用',
          '🔍 优化了 1 处逻辑表达，使其更严谨',
        ],
      });
    }

    if (lastUserMessage.includes('标题') || lastUserMessage.includes('title') || lastUserMessage.includes('起名')) {
      const count = extractNumber(/生成\s*(\d+)\s*个/, lastUserMessage, 5);
      const styles = extractStyles(lastUserMessage);
      const topic = extractTopic(lastUserMessage);
      const titles = generateTitles(count, styles, topic);
      return JSON.stringify({
        titles,
        recommendation: `综合考虑，优先推荐第 1 个标题（${titles[0]?.style || 'catchy'}风格），它在传播性和主题契合度上表现最佳。`,
        bestPractice: '好标题三要素：1) 明确读者收益；2) 有具体数字或细节；3) 适度制造悬念或情绪钩子。',
      });
    }

    if (lastUserMessage.includes('引用') || lastUserMessage.includes('citation') || lastUserMessage.includes('来源') || lastUserMessage.includes('夸大')) {
      return JSON.stringify({
        missingSources: [
          { sentence: '研究表明，该方法能显著提升效率。', claim: '显著提升效率', suggestion: '建议引用具体研究来源', impact: 'high' as const },
        ],
        exaggerations: [
          { sentence: '这个方法能彻底改变你的人生。', original: '彻底改变你的人生', alternative: '可能对你的工作方式产生积极影响', reason: '表述过于夸张' },
        ],
        overallScore: 70,
        recommendations: ['补充数据来源', '降低绝对化表述'],
        userFriendlyReport: '📊 引用完整性评分：70/100\n\n🔍 发现缺少来源的表述\n⚠️ 发现夸大表述\n💡 建议：补充来源并适当降低夸张程度',
      });
    }

    if (
      lastUserMessage.includes('继续') ||
      lastUserMessage.includes('改稿') ||
      lastUserMessage.includes('优化') ||
      lastUserMessage.includes('润色') ||
      lastUserMessage.includes('改成') ||
      lastUserMessage.includes('风格') ||
      lastUserMessage.includes('当前文章内容')
    ) {
      const original = extractArticleContent(lastUserMessage);
      const isMarketing = /营销|推广|转化|卖点|吸睛|爆款|文案风格/.test(lastUserMessage);
      const isAcademic = /学术|论文|研究|严谨|引用|数据/.test(lastUserMessage);
      const isMain = !isMarketing && !isAcademic;

      let revised = '';
      let response = '';
      let changes: string[] = [];

      if (isMarketing) {
        revised = (original || '初稿') + '\n\n——【营销风格润色】——\n💡 核心卖点升级：时间管理不再是枯燥的技能，而是让你每天多出 2 小时的效率神器！\n🎯 用户痛点直击：还在为每天加班到深夜而焦虑？这套方法已帮助 10000+ 职场人实现工作生活平衡。\n📣 行动号召：现在就开始实践，30 天见证显著改变！';
        response = '已为您切换到营销风格文案。主要强化了卖点包装、痛点直击和行动号召，更适合投放推广场景。';
        changes = [
          '🎯 增加了用户痛点直击描述',
          '💡 突出了核心卖点和收益感',
          '📣 补充了行动号召（CTA）语句',
          '📈 加入了社会证明（数据佐证）',
        ];
      } else if (isAcademic) {
        revised = (original || '初稿') + '\n\n——【学术风格润色】——\n根据 Chen et al. (2023) 的实证研究，注意力管理策略与工作绩效之间存在显著正相关（r = 0.62, p < 0.01）。如表 1 所示，采用结构化时间管理方法的被试组，其任务完成率相较对照组提升 34.7%（标准差 = 8.2%）。上述结果与 Smith & Jones (2022) 的元分析结论一致，支持了注意力资源有限性理论的核心假设。未来研究可进一步探讨个体差异变量的调节效应。\n\n参考文献：\nChen, Y., et al. (2023). Attention Management and Job Performance. Journal of Organizational Psychology, 45(2), 112-138.\nSmith, A. B., & Jones, C. D. (2022). A meta-analysis of time management interventions.';
        response = '已为您切换到学术风格表达。补充了实证数据、统计显著性说明、规范引用和参考文献，符合学术写作标准。';
        changes = [
          '📊 补充了实证研究数据与统计显著性',
          '📚 增加了规范的文内引用',
          '📝 补充了参考文献列表（APA 格式）',
          '🔬 语言调整为客观严谨的学术表达',
        ];
      } else {
        revised = (original || '初稿') + '\n\n——【主线通用润色】——\n为了便于实际落地，这里补充一个可执行的三步法：第一步，每晚睡前花 10 分钟列出第二天最重要的 3 件事；第二步，上午用整块时间优先处理这 3 件事；第三步，下班前花 5 分钟复盘完成情况。坚持两周后，你会发现重要事项的完成率有明显提升。同时也要注意劳逸结合，适当的休息反而有助于长期保持高效状态。';
        response = '已完成主线润色。优化了逻辑衔接，补充了可落地的三步法，并增加了劳逸结合的提醒，适合通用阅读场景。';
        changes = [
          '📝 优化了段落间的逻辑衔接',
          '✅ 补充了可执行的三步操作法',
          '� 增加了劳逸结合的平衡建议',
          '🔗 语言调整为清晰自然的通用表达',
        ];
      }

      return JSON.stringify({
        response,
        revisedContent: revised,
        userFriendlyChanges: changes,
      });
    }

    return JSON.stringify({ message: 'Mock response for: ' + lastUserMessage.substring(0, 50) });
  }
}

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private timeout: number;

  constructor(config: SDKConfig) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4';
    this.timeout = config.timeout || 30000;
  }

  async chat(messages: AIChatMessage[], options?: { temperature?: number; responseFormat?: 'json' | 'text' }): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        messages: messages,
        temperature: options?.temperature ?? 0.7,
      };
      if (options?.responseFormat === 'json') {
        body.response_format = { type: 'json_object' };
      }
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`AI API error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json() as { choices: { message: { content: string } }[] };
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

export function createProvider(config: SDKConfig): AIProvider {
  if (config.provider === 'mock' || !config.provider) {
    return new MockAIProvider();
  }
  if (config.provider === 'openai') {
    return new OpenAIProvider(config);
  }
  return new MockAIProvider();
}
