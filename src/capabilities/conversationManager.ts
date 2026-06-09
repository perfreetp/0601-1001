import {
  AIProvider,
  ConversationMessage,
  ArticleVersion,
  ConversationContinueRequest,
  ConversationResult,
  VersionComparison,
  BranchComparison,
  RouteComparison,
  RouteVersionInfo,
} from '../types';
import { assertNonEmptyString, SDKError, ERROR_CODES } from '../errors';

const MAIN_BRANCH = 'main';

interface SessionState {
  conversationId: string;
  messages: ConversationMessage[];
  versions: ArticleVersion[];
  currentContent: string;
  branchVersionCounters: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

const SYSTEM_PROMPT = `你是一位专业的写作助手，正在帮助用户改稿和完善文章。
请严格按照 JSON 格式返回结果：
{
  "response": string,
  "revisedContent": string,
  "userFriendlyChanges": string[]
}
要求：
- response：你对用户的文字回复，简要说明做了哪些改动
- revisedContent：完整的改写后文章全文（必须是完整正文，不能是摘要或片段）
- userFriendlyChanges：给用户看的修改说明列表，每条一条，用 emoji 开头，语言通俗易懂`;

export class ConversationManager {
  private sessions: Map<string, SessionState> = new Map();

  constructor(private provider: AIProvider) {}

  startConversation(initialContent?: string): ConversationResult {
    const conversationId = this.generateId();
    const now = Date.now();
    const content = initialContent || '';
    const version: ArticleVersion = {
      version: 1,
      content,
      timestamp: now,
      description: content ? '初始版本' : '新建会话',
      changes: content ? ['✅ 导入初始稿件'] : ['✅ 创建新会话'],
      branchId: MAIN_BRANCH,
      parentVersion: undefined,
    };

    const state: SessionState = {
      conversationId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT, timestamp: now },
      ],
      versions: [version],
      currentContent: content,
      branchVersionCounters: { [MAIN_BRANCH]: 1 },
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(conversationId, state);

    return {
      conversationId,
      response: '会话已创建，我来帮你一起打磨这篇文章吧！',
      revisedContent: content,
      userFriendlyChanges: ['✅ 会话已创建', `📄 初始版本已保存（${MAIN_BRANCH} 分支 / v1）`],
      currentVersion: 1,
      versions: [version],
    };
  }

  async continueConversation(req: ConversationContinueRequest): Promise<ConversationResult> {
    assertNonEmptyString(
      req.conversationId,
      ERROR_CODES.EMPTY_CONVERSATION_ID,
      '会话 ID 不能为空，请传入有效的 conversationId'
    );
    assertNonEmptyString(
      req.instruction,
      ERROR_CODES.EMPTY_INSTRUCTION,
      '改稿指令不能为空，请传入有效的 instruction'
    );

    const state = this.sessions.get(req.conversationId);
    if (!state) {
      throw new SDKError(
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        `会话 ${req.conversationId} 不存在，请先调用 startConversation 创建会话`
      );
    }

    const now = Date.now();
    const branchId = req.branchId?.trim() || MAIN_BRANCH;
    if (branchId.trim().length === 0) {
      throw new SDKError(
        ERROR_CODES.INVALID_BRANCH_ID,
        '分支 ID 不能为空字符串，请传入有效的 branchId 或留空使用 main 分支'
      );
    }

    let baseVersionNum = req.baseVersion;
    if (baseVersionNum === undefined) {
      const branchVersions = state.versions.filter(v => v.branchId === branchId);
      baseVersionNum = branchVersions.length > 0
        ? Math.max(...branchVersions.map(v => v.version))
        : 1;
    }
    const baseVersion = state.versions.find(v => v.version === baseVersionNum);
    if (!baseVersion) {
      throw new SDKError(
        ERROR_CODES.VERSION_NOT_FOUND,
        `基准版本 v${baseVersionNum} 不存在，当前会话共有 ${state.versions.length} 个版本`
      );
    }

    if (!state.branchVersionCounters[branchId]) {
      state.branchVersionCounters[branchId] = 0;
    }
    const newVersionNum = state.versions.length + 1;
    state.branchVersionCounters[branchId] = Math.max(state.branchVersionCounters[branchId] + 1, 1);

    const baseContent = req.currentContent && req.currentContent.trim().length > 0
      ? req.currentContent
      : baseVersion.content;

    const branchInfo = branchId === MAIN_BRANCH
      ? '在主线继续改稿'
      : `从 v${baseVersionNum} 创建/继续分支「${branchId}」`;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: `【${branchInfo}】\n改稿指令：${req.instruction}\n\n当前文章内容（基准版本 v${baseVersionNum}）：\n"""\n${baseContent}\n"""`,
      timestamp: now,
    };
    state.messages.push(userMessage);

    const chatMessages = state.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.provider.chat(chatMessages, { temperature: 0.7, responseFormat: 'json' });
    const parsed = this.parseResponse(response, baseContent);

    const assistantMessage: ConversationMessage = {
      role: 'assistant',
      content: parsed.response,
      timestamp: now,
      metadata: { changes: parsed.userFriendlyChanges, branchId, baseVersion: baseVersionNum },
    };
    state.messages.push(assistantMessage);

    const revisedContent = parsed.revisedContent && parsed.revisedContent.trim().length > 0
      ? parsed.revisedContent
      : baseContent;

    const newVersion: ArticleVersion = {
      version: newVersionNum,
      content: revisedContent,
      timestamp: now,
      description: `[${branchId}] ${req.instruction.substring(0, 40)}`,
      changes: parsed.userFriendlyChanges,
      branchId,
      parentVersion: baseVersionNum,
    };
    state.versions.push(newVersion);
    state.currentContent = revisedContent;
    state.updatedAt = now;

    return {
      conversationId: state.conversationId,
      response: parsed.response,
      revisedContent,
      userFriendlyChanges: parsed.userFriendlyChanges,
      currentVersion: newVersionNum,
      versions: state.versions,
    };
  }

  getVersions(conversationId: string, branchId?: string): ArticleVersion[] {
    assertNonEmptyString(
      conversationId,
      ERROR_CODES.EMPTY_CONVERSATION_ID,
      '会话 ID 不能为空'
    );
    const state = this.sessions.get(conversationId);
    if (!state) {
      throw new SDKError(
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        `会话 ${conversationId} 不存在`
      );
    }
    if (branchId) {
      return state.versions.filter(v => v.branchId === branchId);
    }
    return state.versions;
  }

  listBranches(conversationId: string): { branchId: string; versionCount: number; latestVersion: number; baseVersion?: number }[] {
    assertNonEmptyString(conversationId, ERROR_CODES.EMPTY_CONVERSATION_ID, '会话 ID 不能为空');
    const state = this.sessions.get(conversationId);
    if (!state) {
      throw new SDKError(ERROR_CODES.CONVERSATION_NOT_FOUND, `会话 ${conversationId} 不存在`);
    }
    const branchMap = new Map<string, ArticleVersion[]>();
    state.versions.forEach(v => {
      if (!branchMap.has(v.branchId)) branchMap.set(v.branchId, []);
      branchMap.get(v.branchId)!.push(v);
    });
    const result: { branchId: string; versionCount: number; latestVersion: number; baseVersion?: number }[] = [];
    branchMap.forEach((versions, bid) => {
      const sorted = [...versions].sort((a, b) => a.version - b.version);
      result.push({
        branchId: bid,
        versionCount: versions.length,
        latestVersion: Math.max(...versions.map(v => v.version)),
        baseVersion: sorted[0]?.parentVersion,
      });
    });
    return result.sort((a, b) => a.branchId.localeCompare(b.branchId));
  }

  compareVersions(conversationId: string, fromVersion: number, toVersion: number): VersionComparison {
    assertNonEmptyString(
      conversationId,
      ERROR_CODES.EMPTY_CONVERSATION_ID,
      '会话 ID 不能为空'
    );
    const state = this.sessions.get(conversationId);
    if (!state) {
      throw new SDKError(
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        `会话 ${conversationId} 不存在`
      );
    }

    const from = state.versions.find(v => v.version === fromVersion);
    const to = state.versions.find(v => v.version === toVersion);

    if (!from || !to) {
      throw new SDKError(
        ERROR_CODES.VERSION_NOT_FOUND,
        `版本不存在：v${fromVersion} 或 v${toVersion}，当前会话共有 ${state.versions.length} 个版本`
      );
    }

    const fromLines = from.content.split('\n');
    const toLines = to.content.split('\n');
    const changes: VersionComparison['changes'] = [];

    const maxLen = Math.max(fromLines.length, toLines.length);
    for (let i = 0; i < maxLen; i++) {
      const a = fromLines[i];
      const b = toLines[i];
      if (a === undefined && b !== undefined) {
        changes.push({ type: 'added', modified: b, explanation: `第 ${i + 1} 行新增内容` });
      } else if (a !== undefined && b === undefined) {
        changes.push({ type: 'removed', original: a, explanation: `第 ${i + 1} 行已删除` });
      } else if (a !== b) {
        changes.push({ type: 'modified', original: a, modified: b, explanation: `第 ${i + 1} 行内容修改` });
      }
    }

    const summary = `从 v${fromVersion}（${from.branchId}）到 v${toVersion}（${to.branchId}）：共 ${changes.length} 处变更（新增 ${changes.filter(c => c.type === 'added').length}，删除 ${changes.filter(c => c.type === 'removed').length}，修改 ${changes.filter(c => c.type === 'modified').length}）`;

    return { fromVersion, toVersion, changes, summary };
  }

  compareBranches(conversationId: string, branchIds?: string[]): BranchComparison {
    assertNonEmptyString(conversationId, ERROR_CODES.EMPTY_CONVERSATION_ID, '会话 ID 不能为空');
    const state = this.sessions.get(conversationId);
    if (!state) {
      throw new SDKError(ERROR_CODES.CONVERSATION_NOT_FOUND, `会话 ${conversationId} 不存在`);
    }

    const branches = this.listBranches(conversationId).filter(
      b => !branchIds || branchIds.includes(b.branchId)
    );
    if (branches.length < 2) {
      throw new SDKError(
        ERROR_CODES.BRANCH_NOT_FOUND,
        `需要至少 2 个分支才能对比，当前找到 ${branches.length} 个分支`
      );
    }

    const baseVersionNums = branches.map(b => b.baseVersion).filter((n): n is number => n !== undefined);
    const commonBase = baseVersionNums.length > 0 ? Math.min(...baseVersionNums) : 1;

    const branchInfos = branches.map(b => {
      const versions = state.versions.filter(v => v.branchId === b.branchId);
      const last = versions[versions.length - 1];
      const first = versions[0];
      return {
        branchId: b.branchId,
        versionCount: b.versionCount,
        latestVersion: b.latestVersion,
        baseVersion: first.parentVersion || commonBase,
        changes: last.changes,
        description: `分支 ${b.branchId} 共 ${b.versionCount} 个版本，基于 v${first.parentVersion || commonBase} 创建，最新改动：${last.changes[0] || '未记录'}`,
      };
    });

    const differences: string[] = [];
    const contents = new Map(branchInfos.map(b => [b.branchId, state.versions.find(v => v.version === b.latestVersion)?.content || '']));
    const firstContent = contents.get(branchInfos[0].branchId) || '';
    branchInfos.slice(1).forEach(b => {
      const c = contents.get(b.branchId) || '';
      if (c === firstContent) {
        differences.push(`${branchInfos[0].branchId} 与 ${b.branchId} 内容一致`);
      } else {
        const diff = Math.abs(c.length - firstContent.length);
        differences.push(`${branchInfos[0].branchId} 与 ${b.branchId} 内容存在差异（字数差约 ${diff} 字），建议使用 compareVersions 逐行对比`);
      }
    });

    const userFriendlySummary = [
      `🌿 分支对比：共 ${branches.length} 个分支，共同基准版本 v${commonBase}`,
      ...branchInfos.map(b => `   · ${b.branchId}：${b.versionCount} 个版本，最新 v${b.latestVersion}，基于 v${b.baseVersion} 创建`),
      ...differences.map(d => `   ${d}`),
    ].join('\n');

    return {
      conversationId,
      branches: branchInfos,
      commonBase,
      differences,
      userFriendlySummary,
    };
  }

  getHistory(conversationId: string): ConversationMessage[] {
    assertNonEmptyString(
      conversationId,
      ERROR_CODES.EMPTY_CONVERSATION_ID,
      '会话 ID 不能为空'
    );
    const state = this.sessions.get(conversationId);
    if (!state) {
      throw new SDKError(
        ERROR_CODES.CONVERSATION_NOT_FOUND,
        `会话 ${conversationId} 不存在`
      );
    }
    return state.messages;
  }

  deleteConversation(conversationId: string): boolean {
    if (!conversationId || conversationId.trim().length === 0) return false;
    return this.sessions.delete(conversationId);
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private parseResponse(
    text: string,
    fallbackContent: string
  ): { response: string; revisedContent: string; userFriendlyChanges: string[] } {
    try {
      const obj = JSON.parse(text) as {
        response?: string;
        revisedContent?: string;
        userFriendlyChanges?: string[];
      };
      return {
        response: obj.response || '已完成修改',
        revisedContent: obj.revisedContent || fallbackContent,
        userFriendlyChanges: Array.isArray(obj.userFriendlyChanges) ? obj.userFriendlyChanges : [],
      };
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const obj = JSON.parse(jsonMatch[0]);
          return {
            response: obj.response || '已完成修改',
            revisedContent: obj.revisedContent || fallbackContent,
            userFriendlyChanges: Array.isArray(obj.userFriendlyChanges) ? obj.userFriendlyChanges : [],
          };
        } catch {
          // fall through
        }
      }
      return {
        response: text,
        revisedContent: fallbackContent,
        userFriendlyChanges: [],
      };
    }
  }

  compareRoutes(conversationId: string, baseVersion?: number): RouteComparison {
    assertNonEmptyString(
      conversationId,
      ERROR_CODES.EMPTY_CONVERSATION_ID,
      '会话 ID 不能为空'
    );
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new SDKError(ERROR_CODES.CONVERSATION_NOT_FOUND, `会话 ${conversationId} 不存在`);
    }

    const baseVer = baseVersion ?? 1;
    const base = session.versions.find(v => v.version === baseVer);
    if (!base) {
      throw new SDKError(ERROR_CODES.VERSION_NOT_FOUND, `基准版本 v${baseVer} 不存在`);
    }

    const branchIds = Array.from(new Set(session.versions.map(v => v.branchId)));
    const routes: RouteVersionInfo[] = branchIds.map(branchId => {
      const branchVersions = session.versions
        .filter(v => v.branchId === branchId && v.version > baseVer)
        .sort((a, b) => a.version - b.version);
      const latest = branchVersions.length > 0
        ? branchVersions[branchVersions.length - 1]
        : base;
      const keyChanges = latest === base ? [] : latest.changes;
      const { added, removed, overview } = this.calcDiff(base.content, latest.content);
      return {
        branchId,
        version: latest.version,
        content: latest.content,
        summary: this.buildSummary(latest.content, branchId),
        wordCount: this.countWords(latest.content),
        keyChanges: keyChanges.length > 0 ? keyChanges : ['与基准版本内容一致'],
        diffFromBase: {
          charsAdded: added,
          charsRemoved: removed,
          overview,
        },
      };
    });

    const crossRouteDiffs: RouteComparison['crossRouteDiffs'] = [];
    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        const a = routes[i];
        const b = routes[j];
        const { added, removed, overview } = this.calcDiff(a.content, b.content);
        crossRouteDiffs.push({
          fromBranch: a.branchId,
          toBranch: b.branchId,
          charsAdded: added,
          charsRemoved: removed,
          overview,
          keyDifferences: this.extractKeyDiffBetween(a, b),
        });
      }
    }

    const baseSummary = this.buildSummary(base.content, '基准');
    const routeSummaries = routes.map(r =>
      `• ${r.branchId}（v${r.version}）：${r.diffFromBase.overview}，共 ${r.wordCount} 字，主要改动 ${r.keyChanges.length} 处`
    ).join('\n');
    const crossSummaries = crossRouteDiffs.map(d =>
      `· ${d.fromBranch} ↔ ${d.toBranch}：${d.keyDifferences[0] || d.overview}`
    ).join('\n');
    const userFriendlySummary = `📋 多版本路线对比结果

🗂 基准版本：v${baseVer}，共 ${this.countWords(base.content)} 字，摘要：${baseSummary}

🚀 各路线最新版：
${routeSummaries}

🔀 路线间差异：
${crossSummaries || '（仅有单一路线，无横向对比）'}

💡 选择建议：若面向大众传播推荐营销分支；若面向学术发表推荐学术分支；若日常使用选主线即可。`;

    return {
      conversationId,
      baseVersion: baseVer,
      baseContent: base.content,
      baseSummary,
      routes,
      crossRouteDiffs,
      userFriendlySummary,
    };
  }

  private calcDiff(a: string, b: string): { added: number; removed: number; overview: string } {
    const added = Math.max(0, b.length - a.length);
    const removed = Math.max(0, a.length - b.length);
    let overview: string;
    if (added === 0 && removed === 0) {
      overview = '与基准完全相同';
    } else if (added > removed) {
      overview = `新增约 ${added} 字，删减约 ${removed} 字，整体篇幅扩充`;
    } else if (removed > added) {
      overview = `新增约 ${added} 字，删减约 ${removed} 字，整体篇幅精简`;
    } else {
      overview = `新增约 ${added} 字，删减约 ${removed} 字，整体篇幅相当但内容有改写`;
    }
    return { added, removed, overview };
  }

  private buildSummary(content: string, label: string): string {
    const cleaned = content.replace(/\n+/g, ' ').trim();
    if (cleaned.length <= 40) return cleaned || `（${label}版本内容）`;
    return cleaned.substring(0, 40) + '…';
  }

  private countWords(content: string): number {
    const chinese = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const english = (content.match(/[A-Za-z]+/g) || []).length;
    return chinese + english;
  }

  private extractKeyDiffBetween(a: RouteVersionInfo, b: RouteVersionInfo): string[] {
    const diffs: string[] = [];
    const tagA = a.content.match(/【([\u4e00-\u9fa5A-Za-z]+)润色】/)?.[1] || '';
    const tagB = b.content.match(/【([\u4e00-\u9fa5A-Za-z]+)润色】/)?.[1] || '';
    if (tagA && tagB && tagA !== tagB) {
      diffs.push(`${a.branchId}走「${tagA}」路线，${b.branchId}走「${tagB}」路线`);
    }
    if (a.wordCount !== b.wordCount) {
      diffs.push(`篇幅差异：${a.wordCount} 字 vs ${b.wordCount} 字（${b.branchId}${b.wordCount > a.wordCount ? '更长' : '更短'}）`);
    }
    if (/参考文献/.test(b.content) && !/参考文献/.test(a.content)) {
      diffs.push(`${b.branchId}包含规范引用和参考文献，${a.branchId}未涉及`);
    }
    if (/行动号召|CTA|卖点|痛点/.test(b.content) && !/行动号召|CTA|卖点|痛点/.test(a.content)) {
      diffs.push(`${b.branchId}侧重营销卖点和行动号召，${a.branchId}未涉及`);
    }
    if (/三步法|劳逸结合|通用/.test(b.content) && !/三步法|劳逸结合|通用/.test(a.content)) {
      diffs.push(`${b.branchId}侧重可落地操作方法，${a.branchId}未涉及`);
    }
    if (diffs.length === 0) {
      diffs.push(`两条路线整体方向相近，细节改动各有侧重`);
    }
    return diffs;
  }
}
