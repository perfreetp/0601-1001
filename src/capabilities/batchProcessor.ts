import {
  AIProvider,
  BatchTask,
  BatchTaskResult,
  BatchRunResult,
  TopicAnalysisResult,
  OutlineGenerationResult,
  TitleGenerationResult,
  BatchTaskType,
} from '../types';
import { SDKError, ERROR_CODES, assertNonEmptyArray } from '../errors';
import { TopicAnalyzer } from './topicAnalyzer';
import { OutlineGenerator } from './outlineGenerator';
import { TitleGenerator } from './titleGenerator';

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getUserFriendlyError(err: unknown): string {
  if (err instanceof SDKError) {
    return err.message;
  }
  if (err instanceof Error) {
    return `处理失败：${err.message}`;
  }
  return '处理失败：未知错误';
}

export class BatchProcessor {
  private topicAnalyzer: TopicAnalyzer;
  private outlineGenerator: OutlineGenerator;
  private titleGenerator: TitleGenerator;

  constructor(provider: AIProvider) {
    this.topicAnalyzer = new TopicAnalyzer(provider);
    this.outlineGenerator = new OutlineGenerator(provider);
    this.titleGenerator = new TitleGenerator(provider);
  }

  async run(tasks: BatchTask[]): Promise<BatchRunResult> {
    assertNonEmptyArray(
      tasks,
      ERROR_CODES.EMPTY_BATCH_TASKS,
      '批量任务列表不能为空，请传入至少一个任务'
    );

    const results: BatchTaskResult[] = [];

    for (const task of tasks) {
      const taskId = task.id || generateId();
      const type = task.type;
      try {
        const result = await this.executeTask(task);
        results.push({
          id: taskId,
          type,
          status: 'success',
          result,
        });
      } catch (err) {
        const sdkErr = err instanceof SDKError ? err : new SDKError('UNKNOWN_ERROR', String(err));
        results.push({
          id: taskId,
          type,
          status: 'failed',
          errorCode: sdkErr.code,
          errorMessage: sdkErr.message,
          userFriendlyError: getUserFriendlyError(err),
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return {
      total: results.length,
      successCount,
      failedCount,
      results,
      summary: this.buildSummary(successCount, failedCount, results),
    };
  }

  private async executeTask(task: BatchTask): Promise<TopicAnalysisResult | OutlineGenerationResult | TitleGenerationResult> {
    switch (task.type) {
      case 'topic':
        return this.topicAnalyzer.analyze(task.request);
      case 'outline':
        return this.outlineGenerator.generate(task.request);
      case 'title':
        return this.titleGenerator.generate(task.request);
      default:
        throw new SDKError(
          'UNKNOWN_TASK_TYPE',
          `未知的批量任务类型: ${(task as { type: string }).type}`
        );
    }
  }

  private buildSummary(successCount: number, failedCount: number, results: BatchTaskResult[]): string {
    const typeCount: Record<BatchTaskType, number> = { topic: 0, outline: 0, title: 0 };
    results.forEach(r => { typeCount[r.type]++; });
    const parts: string[] = [];
    parts.push(`共处理 ${results.length} 个任务：`);
    parts.push(`✅ 成功 ${successCount} 个`);
    if (failedCount > 0) {
      parts.push(`❌ 失败 ${failedCount} 个`);
      const failed = results.filter(r => r.status === 'failed');
      failed.slice(0, 3).forEach(r => {
        parts.push(`   · 任务 ${r.id}（${r.type}）：${r.userFriendlyError}`);
      });
      if (failed.length > 3) {
        parts.push(`   · 另有 ${failed.length - 3} 个任务失败，请查看 results 详情`);
      }
    }
    parts.push(`📊 按类型：主题分析 ${typeCount.topic}，大纲生成 ${typeCount.outline}，标题生成 ${typeCount.title}`);
    return parts.join('\n');
  }
}
