import {
  AIProvider,
  BatchTask,
  BatchTaskResult,
  BatchRunResult,
  TopicAnalysisResult,
  OutlineGenerationResult,
  TitleGenerationResult,
  BatchTaskType,
  TopicPipelineRequest,
  TopicPipelineResult,
  PipelineRunResult,
  PipelineStep,
  PipelineStepResult,
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

  async runThemed(pipelines: TopicPipelineRequest[]): Promise<PipelineRunResult> {
    assertNonEmptyArray(
      pipelines,
      ERROR_CODES.EMPTY_BATCH_TASKS,
      '主题批量列表不能为空，请传入至少一个主题'
    );

    const topics: TopicPipelineResult[] = [];
    for (const req of pipelines) {
      topics.push(await this.runSinglePipeline(req));
    }

    const successCount = topics.filter(t => t.status === 'success').length;
    const partialCount = topics.filter(t => t.status === 'partial').length;
    const failedCount = topics.filter(t => t.status === 'failed').length;

    return {
      total: topics.length,
      successCount,
      partialCount,
      failedCount,
      topics,
      summary: this.buildPipelineSummary(topics, successCount, partialCount, failedCount),
      userFriendlyReport: this.buildPipelineFriendlyReport(topics, successCount, partialCount, failedCount),
    };
  }

  private async runSinglePipeline(req: TopicPipelineRequest): Promise<TopicPipelineResult> {
    const steps: PipelineStep[] = req.runSteps && req.runSteps.length > 0 ? req.runSteps : ['topic', 'outline', 'title'];
    const results: Record<PipelineStep, PipelineStepResult> = {
      topic: { step: 'topic', status: 'skipped', skippedReason: '未请求该步骤' },
      outline: { step: 'outline', status: 'skipped', skippedReason: '未请求该步骤' },
      title: { step: 'title', status: 'skipped', skippedReason: '未请求该步骤' },
    };
    let topicAnalysis: TopicAnalysisResult | undefined;
    let outline: OutlineGenerationResult | undefined;
    let titles: TitleGenerationResult | undefined;

    const ordered: PipelineStep[] = steps.includes('topic') ? ['topic'] : [];
    if (steps.includes('outline')) ordered.push('outline');
    if (steps.includes('title')) ordered.push('title');

    for (const step of ordered) {
      if (step === 'outline' && topicAnalysis === undefined && ordered.includes('topic')) {
        results.outline = { step: 'outline', status: 'skipped', skippedReason: '前置步骤 topic 失败，已跳过' };
        continue;
      }
      if (step === 'title' && ordered.includes('outline') && outline === undefined && ordered.includes('outline')) {
        results.title = { step: 'title', status: 'skipped', skippedReason: '前置步骤 outline 失败，已跳过' };
        continue;
      }

      try {
        if (step === 'topic') {
          const r = await this.topicAnalyzer.analyze({ topic: req.topic, context: req.context });
          topicAnalysis = r;
          results.topic = { step: 'topic', status: 'success', result: r };
        } else if (step === 'outline') {
          const kw = topicAnalysis?.keywords ? [...topicAnalysis.keywords.primary, ...topicAnalysis.keywords.secondary] : req.keywords;
          const chapterCount = req.chapterCount ?? 5;
          const r = await this.outlineGenerator.generate({
            topic: req.topic,
            context: req.context,
            keywords: kw,
            tone: req.tone,
            length: req.length,
            chapterCount,
          });
          outline = r;
          results.outline = { step: 'outline', status: 'success', result: r };
        } else if (step === 'title') {
          const kw = topicAnalysis?.keywords ? [...topicAnalysis.keywords.primary, ...topicAnalysis.keywords.secondary] : req.keywords;
          const r = await this.titleGenerator.generate({
            topic: req.topic,
            context: req.context,
            keywords: kw,
            count: req.titleCount,
            styles: req.titleStyles,
            tone: req.tone,
          });
          titles = r;
          results.title = { step: 'title', status: 'success', result: r };
        }
      } catch (err) {
        const sdkErr = err instanceof SDKError ? err : new SDKError('UNKNOWN_ERROR', String(err));
        results[step] = {
          step,
          status: 'failed',
          errorCode: sdkErr.code,
          errorMessage: sdkErr.message,
        };
      }
    }

    const stepResults = ordered.map(s => results[s]);
    const successCount = stepResults.filter(r => r.status === 'success').length;
    const failedCount = stepResults.filter(r => r.status === 'failed').length;
    let status: TopicPipelineResult['status'] = 'success';
    if (failedCount > 0 && successCount > 0) status = 'partial';
    else if (failedCount > 0 && successCount === 0) status = 'failed';

    const firstFailed = stepResults.find(r => r.status === 'failed');
    const skippedByDep = stepResults.find(r => r.status === 'skipped' && /跳过/.test(r.skippedReason || ''));
    const summary = successCount === ordered.length
      ? `主题「${req.topic}」三步全部完成`
      : `主题「${req.topic}」完成 ${successCount}/${ordered.length} 步${firstFailed ? `，失败环节：${firstFailed.step}` : ''}${skippedByDep ? `，${skippedByDep.step} 因依赖失败已跳过` : ''}`;
    const userFriendlyStatus = status === 'success'
      ? `✅ 主题「${req.topic}」：全部 ${ordered.length} 步完成`
      : status === 'partial'
        ? `⚠️ 主题「${req.topic}」：${successCount}/${ordered.length} 步成功，部分失败或跳过`
        : `❌ 主题「${req.topic}」：全部步骤失败`;

    return {
      topic: req.topic,
      status,
      steps,
      results,
      topicAnalysis,
      outline,
      titles,
      summary,
      userFriendlyStatus,
    };
  }

  private buildPipelineSummary(topics: TopicPipelineResult[], s: number, p: number, f: number): string {
    const perTopic = topics.map(t => `· ${t.userFriendlyStatus}`).join('\n');
    return `共处理 ${topics.length} 个主题：成功 ${s} 个，部分成功 ${p} 个，失败 ${f} 个。\n` + perTopic;
  }

  private buildPipelineFriendlyReport(topics: TopicPipelineResult[], s: number, p: number, f: number): string {
    const perTopic = topics.map(t => {
      const details = t.steps.map(step => {
        const r = t.results[step];
        if (r.status === 'success') return `  ✅ ${step}：成功`;
        if (r.status === 'failed') return `  ❌ ${step}：失败（${r.errorMessage}）`;
        return `  ⏭ ${step}：跳过（${r.skippedReason}）`;
      }).join('\n');
      return `${t.userFriendlyStatus}\n${details}`;
    }).join('\n\n');
    return `📋 主题批量处理总览：共 ${topics.length} 个，成功 ${s}，部分成功 ${p}，失败 ${f}\n\n${perTopic}`;
  }
}
