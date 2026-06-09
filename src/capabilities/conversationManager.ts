import {
  AIProvider,
  ConversationMessage,
  ArticleVersion,
  ConversationContinueRequest,
  ConversationResult,
  VersionComparison,
} from '../types';
import { assertNonEmptyString, SDKError, ERROR_CODES } from '../errors';

interface SessionState {
  conversationId: string;
  messages: ConversationMessage[];
  versions: ArticleVersion[];
  currentContent: string;
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
    };

    const state: SessionState = {
      conversationId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT, timestamp: now },
      ],
      versions: [version],
      currentContent: content,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(conversationId, state);

    return {
      conversationId,
      response: '会话已创建，我来帮你一起打磨这篇文章吧！',
      revisedContent: content,
      userFriendlyChanges: ['✅ 会话已创建', '📄 初始版本已保存（v1）'],
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
    const baseContent = req.currentContent && req.currentContent.trim().length > 0
      ? req.currentContent
      : state.currentContent;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: `${req.instruction}\n\n当前文章内容：\n"""\n${baseContent}\n"""`,
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
      metadata: { changes: parsed.userFriendlyChanges },
    };
    state.messages.push(assistantMessage);

    const revisedContent = parsed.revisedContent && parsed.revisedContent.trim().length > 0
      ? parsed.revisedContent
      : baseContent;

    const newVersion: ArticleVersion = {
      version: state.versions.length + 1,
      content: revisedContent,
      timestamp: now,
      description: req.instruction.substring(0, 50),
      changes: parsed.userFriendlyChanges,
    };
    state.versions.push(newVersion);
    state.currentContent = revisedContent;
    state.updatedAt = now;

    return {
      conversationId: state.conversationId,
      response: parsed.response,
      revisedContent,
      userFriendlyChanges: parsed.userFriendlyChanges,
      currentVersion: newVersion.version,
      versions: state.versions,
    };
  }

  getVersions(conversationId: string): ArticleVersion[] {
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
    return state.versions;
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

    const summary = `从 v${fromVersion} 到 v${toVersion}：共 ${changes.length} 处变更（新增 ${changes.filter(c => c.type === 'added').length}，删除 ${changes.filter(c => c.type === 'removed').length}，修改 ${changes.filter(c => c.type === 'modified').length}）`;

    return { fromVersion, toVersion, changes, summary };
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
}
