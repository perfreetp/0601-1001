import { AIProvider, AIChatMessage, SDKConfig } from './types';

const MOCK_RESPONSES: Record<string, string> = {
  topicAnalysis: JSON.stringify({
    audiences: [
      {
        name: '职场新人',
        description: '刚进入职场 1-3 年的年轻人，正在寻找职业发展方向',
        characteristics: ['学习意愿强', '时间充裕', '预算有限'],
        painPoints: ['缺乏经验', '不知如何规划', '容易焦虑']
      },
      {
        name: '中层管理者',
        description: '有 5-10 年工作经验的团队负责人',
        characteristics: ['时间紧张', '注重效率', '有付费能力'],
        painPoints: ['晋升瓶颈', '团队管理难', '工作生活失衡']
      }
    ],
    angles: [
      {
        title: '从心理学角度看高效工作',
        description: '结合行为心理学理论，解释为什么某些方法更有效',
        uniqueness: '科学视角，增加内容权威性',
        suitability: '适合学术或专业类内容'
      },
      {
        title: '真实案例复盘：我如何在 30 天内改变工作习惯',
        description: '第一人称叙事，分享个人经历和具体做法',
        uniqueness: '真实感强，容易引起共鸣',
        suitability: '适合社交媒体和博客'
      }
    ],
    keywords: {
      primary: ['高效工作', '时间管理', '生产力'],
      secondary: ['工作方法', '习惯养成', '专注力'],
      longTail: ['如何提高工作效率', '上班族时间管理技巧', '专注力训练方法']
    },
    summary: '该主题受众广泛，可从专业或个人角度切入，建议围绕「实操性」和「真实感」展开。'
  }),
  outlineGeneration: JSON.stringify({
    title: '高效工作法：从混乱到有序的 7 个步骤',
    introduction: '在信息爆炸的时代，高效工作不再是选择，而是必需。本文将系统介绍一套可落地的高效工作方法。',
    chapters: [
      { index: 1, title: '认识你的时间陷阱', purpose: '帮助读者识别低效行为', keyPoints: ['常见的时间浪费场景', '如何记录和分析时间使用', '找出你的效率杀手'], estimatedLength: '800字' },
      { index: 2, title: '目标设定：从想要到做到', purpose: '建立清晰的目标体系', keyPoints: ['SMART 原则的正确用法', '拆解目标的实用方法', '如何保持长期动力'], estimatedLength: '1000字' },
      { index: 3, title: '优先级管理的核心法则', purpose: '学会做正确的事', keyPoints: ['四象限法的实践', '艾森豪威尔矩阵', '学会说不的艺术'], estimatedLength: '900字' },
      { index: 4, title: '专注力：深度工作的修炼', purpose: '提升单位时间产出', keyPoints: ['番茄工作法进阶', '创造沉浸式环境', '对抗干扰的技巧'], estimatedLength: '1100字' },
      { index: 5, title: '总结与行动清单', purpose: '推动读者付诸实践', keyPoints: ['核心要点回顾', '7天行动指南', '持续改进的建议'], estimatedLength: '600字' }
    ],
    conclusion: '高效不是一蹴而就的，关键在于持续行动和不断迭代。从今天开始，选择一个方法开始实践吧。',
    totalEstimatedWords: 4400,
    structureNote: '采用「发现问题-解决问题-实践落地」的经典结构，逻辑层层递进，适合中长篇深度文章。'
  }),
  paragraphExpansion: JSON.stringify({
    expandedVersions: [
      {
        version: 1,
        style: '专业深度',
        content: '根据斯坦福大学行为设计实验室的研究，习惯的形成平均需要 66 天，而非广为流传的 21 天。这一数据揭示了一个重要真相：真正的改变需要耐心和持续投入。那些期望在短时间内脱胎换骨的想法，往往源于对大脑神经可塑性的误解。神经通路的重塑是一个渐进过程，每一次重复都会在大脑中留下更深的痕迹。理解这一点，能帮我们在改变的路上放下焦虑，把注意力从「多快见效」转移到「每天进步」上。',
        highlights: ['引用权威研究数据', '解释背后的科学原理', '引导读者调整心态']
      },
      {
        version: 2,
        style: '轻松叙事',
        content: '说出来你可能不信，我之前也以为 21 天就能养成一个习惯。结果呢？健身卡办了三次，每次坚持不到两周就放弃了。后来我才知道，原来专家说平均需要 66 天才能真正形成习惯。66 天啊！那可是两个多月。不过想通之后反而轻松了——不再因为某天中断就自责，而是把它当作一场漫长的修行。现在我每天早起跑步，已经坚持快一年了，感觉真的变成了生活的一部分。',
        highlights: ['第一人称拉近距离', '真实经历引发共鸣', '降低读者心理门槛']
      },
      {
        version: 3,
        style: '简洁实用',
        content: '养成一个习惯大约需要 66 天。不是 21 天。接受这个事实，你就已经赢了一半。接下来只要记住三件事：第一，允许自己偶尔中断，一天不做没关系；第二，每次重复都算数，不要看不起微小的进步；第三，把难度降到最低，让开始这件事变得简单。坚持 66 天后，你会发现一切都自然而然了。',
        highlights: ['直接点出核心信息', '给出三条可执行建议', '语言简洁有力']
      }
    ],
    recommendations: ['如果是专业文章推荐版本 1', '社交媒体或个人博客推荐版本 2', '速览类内容或行动指南推荐版本 3']
  }),
  polish: JSON.stringify({
    polishedText: '高效工作的核心不在于做更多的事，而在于做正确的事。许多人误以为忙碌就是 productive，实际上大部分忙碌只是在逃避真正重要的任务。',
    issues: [
      { type: 'typo', severity: 'medium', original: 'productive', suggestion: '有成效的', reason: '中英文混用不规范，建议统一使用中文', position: { start: 24, end: 34 } },
      { type: 'logic', severity: 'high', original: '实际上大部分忙碌只是在逃避真正重要的任务', suggestion: '实际上，许多看似忙碌的行为，本质上是在回避那些真正困难但重要的任务', reason: '原句过于绝对，建议增加限定词使逻辑更严谨', position: { start: 40, end: 68 } },
      { type: 'repetition', severity: 'low', original: '做更多的事...做正确的事', suggestion: '保持不变', reason: '此处为有意的对比重复，修辞上有强调作用，建议保留', position: { start: 8, end: 22 } }
    ],
    summary: { typoCount: 1, repetitionCount: 1, toneAdjustments: 0, logicFixes: 1, totalImprovements: 3 },
    userFriendlyChanges: [
      '✏️ 修正了 1 处中英文混用：将 "productive" 改为中文 "有成效的"',
      '🔍 优化了 1 处逻辑表达：使表述更严谨，避免绝对化',
      '💡 识别到 1 处有意的修辞重复，已为您保留'
    ]
  }),
  titleGeneration: JSON.stringify({
    titles: [
      { title: '别再瞎忙了：高效人士的 5 个反常识习惯', style: 'catchy', highlights: ['制造悬念', '使用数字', '制造反差'], explanation: '"别再瞎忙了"直接点出痛点，"反常识"激发好奇心，数字让内容看起来具体可感。', suitabilityScore: 92 },
      { title: '如何在更短时间内完成更多有价值的工作', style: 'howto', highlights: ['清晰承诺价值', '明确目标读者', '实用导向'], explanation: '直接告诉读者能获得什么好处，适合工具类和教程类内容。', suitabilityScore: 85 },
      { title: '为什么你越努力越焦虑？答案可能出乎你的意料', style: 'question', highlights: ['戳中情绪', '激发好奇', '引发共鸣'], explanation: '用提问方式引发读者思考，适合需要深度讨论的主题。', suitabilityScore: 88 },
      { title: '高效工作方法论：基于认知科学的 7 条实践建议', style: 'formal', highlights: ['专业权威', '引用学科背书', '结构清晰'], explanation: '强调学术背景和方法论定位，适合面向专业读者的内容。', suitabilityScore: 80 },
      { title: '从月薪 5k 到 5w，我靠这 3 个习惯改变了人生', style: 'story', highlights: ['真实故事感', '具体数字对比', '明确结果承诺'], explanation: '用个人故事和具体数字建立代入感，适合社交媒体传播。', suitabilityScore: 90 }
    ],
    recommendation: '综合考虑传播性和内容匹配度，优先推荐第一个标题，它在痛点直击和好奇心激发上表现最佳。',
    bestPractice: '好标题的三个标准：1. 读者一眼知道对自己有什么用；2. 有具体数字或细节增加可信度；3. 制造一点悬念或情绪钩子。'
  }),
  citationCheck: JSON.stringify({
    missingSources: [
      { sentence: '研究表明，番茄工作法能提高 30% 的工作效率。', claim: '番茄工作法提高 30% 效率', suggestion: '建议引用具体研究来源，如某大学研究报告或权威书籍', impact: 'high' },
      { sentence: '大多数成功人士都有早起的习惯。', claim: '大多数成功人士早起', suggestion: '建议提供数据来源或具体案例支撑', impact: 'medium' }
    ],
    exaggerations: [
      { sentence: '这个方法能彻底改变你的人生。', original: '彻底改变你的人生', alternative: '这个方法可能对你的工作方式产生积极影响', reason: '"彻底改变人生"表述过于夸张，难以验证，建议降低预期，使表述更客观可信' },
      { sentence: '所有人都应该尝试这个技巧。', original: '所有人都应该', alternative: '大部分人可能会从这个技巧中受益', reason: '"所有人"过于绝对，不同人群适用性不同' }
    ],
    overallScore: 65,
    recommendations: ['为数据和研究结论补充来源', '降低绝对化和夸张表述', '可增加具体案例增强说服力'],
    userFriendlyReport: '📊 引用完整性评分：65/100\n\n🔍 发现 2 处可能缺少来源的表述：\n• "番茄工作法能提高 30% 效率" — 建议补充研究来源\n• "大多数成功人士早起" — 建议提供数据或案例\n\n⚠️ 发现 2 处可能夸大的表述：\n• "彻底改变你的人生" 过于绝对\n• "所有人都应该" 以偏概全\n\n💡 建议：补充来源并适当降低夸张程度，可显著提升文章可信度。'
  })
};

export class MockAIProvider implements AIProvider {
  async chat(messages: AIChatMessage[], options?: { temperature?: number; responseFormat?: 'json' | 'text' }): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 100));
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    if (lastUserMessage.includes('主题分析') || lastUserMessage.includes('topic') || lastUserMessage.includes('受众')) {
      return MOCK_RESPONSES.topicAnalysis;
    }
    if (lastUserMessage.includes('大纲') || lastUserMessage.includes('outline') || lastUserMessage.includes('章节')) {
      return MOCK_RESPONSES.outlineGeneration;
    }
    if (lastUserMessage.includes('扩写') || lastUserMessage.includes('expand') || lastUserMessage.includes('段落') || lastUserMessage.includes('要点')) {
      return MOCK_RESPONSES.paragraphExpansion;
    }
    if (lastUserMessage.includes('润色') || lastUserMessage.includes('polish') || lastUserMessage.includes('错别字') || lastUserMessage.includes('修改')) {
      return MOCK_RESPONSES.polish;
    }
    if (lastUserMessage.includes('标题') || lastUserMessage.includes('title') || lastUserMessage.includes('起名')) {
      return MOCK_RESPONSES.titleGeneration;
    }
    if (lastUserMessage.includes('引用') || lastUserMessage.includes('citation') || lastUserMessage.includes('来源') || lastUserMessage.includes('夸大')) {
      return MOCK_RESPONSES.citationCheck;
    }
    if (
      lastUserMessage.includes('继续') ||
      lastUserMessage.includes('continue') ||
      lastUserMessage.includes('改稿') ||
      lastUserMessage.includes('version') ||
      lastUserMessage.includes('版本') ||
      lastUserMessage.includes('优化') ||
      lastUserMessage.includes('修改') ||
      lastUserMessage.includes('当前文章内容')
    ) {
      return JSON.stringify({
        response: '好的，我继续帮您优化。我注意到第三段的逻辑可以再梳理一下，另外建议增加一个具体案例来增强说服力。以下是修改后的内容...',
        userFriendlyChanges: [
          '📝 优化了第三段的逻辑结构，使论证更清晰',
          '📌 新增了一个实际案例，增强内容说服力',
          '✏️ 调整了若干语句的表达方式，使其更通顺'
        ],
        currentVersion: 2,
        versions: []
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
