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
      lastUserMessage.includes('当前文章内容')
    ) {
      const original = extractArticleContent(lastUserMessage);
      const revised = original
        ? original + '\n\n——【AI 改稿补充】——\n为了让内容更有说服力，我增加了一个真实案例：某团队通过实施上述方法，三个月内效率提升了 40%。同时优化了段落间的过渡，使逻辑更流畅。'
        : '这是 AI 改写后的文章内容，结构更清晰，逻辑更连贯，并且增加了具体案例来增强说服力。';

      return JSON.stringify({
        response: '好的，我已帮您优化了文章。主要调整包括：优化了第三段的逻辑结构，新增了一个实际案例来增强说服力，调整了若干语句的表达方式使其更通顺。',
        revisedContent: revised,
        userFriendlyChanges: [
          '📝 优化了第三段的逻辑结构，使论证更清晰',
          '📌 新增了一个实际案例，增强内容说服力',
          '✏️ 调整了若干语句的表达方式，使其更通顺',
        ],
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
