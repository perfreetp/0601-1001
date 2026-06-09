import {
  AIProvider,
  ConversationMessage,
  ArticleVersion,
  ConversationContinueRequest,
  ConversationResult,
  VersionComparison,
} from '../types';

interface SessionState {
  conversationId: string;
  messages: ConversationMessage[];
  versions: ArticleVersion[];
  currentContent: string;
  createdAt: number;
  updatedAt: number;
}

const SYSTEM_PROMPT = `你是一位专业的写作助手，正在帮助用户改稿和完善文章。
回复要专业、具体、有建设性。如果涉及对文章的修改，请给出清晰的修改说明。
请严格按照 JSON 格式返回结果：
{
  "response": string,
  "userFriendlyChanges": string[],
  "currentVersion": number,
  "versions": []
}
userFriendlyChanges 是给用户看的修改说明，每条一条，用 emoji 开头，语言通俗易懂。`;

export class ConversationManager {
  private sessions: Map<string, SessionState> = new Map();

  constructor(private provider: AIProvider) {}

  startConversation(initialContent?: string): ConversationResult {
    const conversationId = this.generateId();
    const now = Date.now();
    const version: ArticleVersion = {
      version: 1,
      content: initialContent || '',
      timestamp: now,
      description: initialContent ? '初始版本' : '新建会话',
      changes: initialContent ? ['导入初始稿件'] : ['创建新会话'],
    };

    const state: SessionState = {
      conversationId,
      messages: [
        { role: 'system', content: '你是一位专业的写作助手，正在帮助用户改稿。', timestamp: now },
      ],
      versions: [version],
      currentContent: initialContent || '',
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(conversationId, state);

    return {
      conversationId,
      response: '会话已创建，我来帮你一起打磨这篇文章吧！',
      userFriendlyChanges: ['✅ 会话已创建', '📄 初始版本已保存（v1）'],
      currentVersion: 1,
      versions: [version],
    };
  }

  async continueConversation(req: ConversationContinueRequest): Promise<ConversationResult> {
    const state = this.sessions.get(req.conversationId);
    if (!state) {
      throw new Error(`会话 ${req.conversationId} 不存在，请先创建会话`);
    }

    const now = Date.now();
    const userMessage: ConversationMessage = {
      role: 'user',
      content: req.instruction + (req.currentContent ? `\n\n当前文章内容：\n"""\n${req.currentContent}\n"""` : ''),
      timestamp: now,
    };
    state.messages.push(userMessage);

    const chatMessages = state.messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.provider.chat(chatMessages, { temperature: 0.7, responseFormat: 'json' });
    const parsed = this.parseResponse(response);

    const assistantMessage: ConversationMessage = {
      role: 'assistant',
      content: parsed.response,
      timestamp: now,
      metadata: { changes: parsed.userFriendlyChanges },
    };
    state.messages.push(assistantMessage);

    const newVersion: ArticleVersion = {
      version: state.versions.length + 1,
      content: req.currentContent || state.currentContent,
      timestamp: now,
      description: req.instruction.substring(0, 50),
      changes: parsed.userFriendlyChanges,
    };
    state.versions.push(newVersion);
    state.currentContent = req.currentContent || state.currentContent;
    state.updatedAt = now;

    return {
      conversationId: state.conversationId,
      response: parsed.response,
      userFriendlyChanges: parsed.userFriendlyChanges,
      currentVersion: newVersion.version,
      versions: state.versions,
    };
  }

  getVersions(conversationId: string): ArticleVersion[] {
    const state = this.sessions.get(conversationId);
    if (!state) {
      throw new Error(`会话 ${conversationId} 不存在`);
    }
    return state.versions;
  }

  compareVersions(conversationId: string, fromVersion: number, toVersion: number): VersionComparison {
    const state = this.sessions.get(conversationId);
    if (!state) {
      throw new Error(`会话 ${conversationId} 不存在`);
    }

    const from = state.versions.find(v => v.version === fromVersion);
    const to = state.versions.find(v => v.version === toVersion);

    if (!from || !to) {
      throw new Error(`版本不存在：v${fromVersion} 或 v${toVersion}`);
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

    const summary = `从 v${fromVersion} 到 v${toVersion}：共 ${changes.length} 处变更（新增 ${changes.filter(c => c.type === 'added').length}，删除 ${changes.filter(c => c.type === 'removed').length}，修改 ${changes.filter(c => c.type === 'modified').length}）`;

    return { fromVersion, toVersion, changes, summary };
  }

  getHistory(conversationId: string): ConversationMessage[] {
    const state = this.sessions.get(conversationId);
    if (!state) {
      throw new Error(`会话 ${conversationId} 不存在`);
    }
    return state.messages;
  }

  deleteConversation(conversationId: string): boolean {
    return this.sessions.delete(conversationId);
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private parseResponse(text: string): { response: string; userFriendlyChanges: string[]; currentVersion?: number } {
    try {
      const obj = JSON.parse(text) as { response: string; userFriendlyChanges: string[]; currentVersion?: number };
      return {
        response: obj.response || text,
        userFriendlyChanges: obj.userFriendlyChanges || [],
        currentVersion: obj.currentVersion,
      };
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const obj = JSON.parse(jsonMatch[0]);
          return {
            response: obj.response || text,
            userFriendlyChanges: obj.userFriendlyChanges || [],
            currentVersion: obj.currentVersion,
          };
        } catch {
          // fall through
        }
      }
      return { response: text, userFriendlyChanges: [] };
    }
  }
}
