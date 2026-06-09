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
  FailureCategory,
  RetrySuggestion,
  ExecutionTraceEvent,
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
    const batchStart = Date.now();
    const executionTrace: ExecutionTraceEvent[] = [];
    const trace = (step: PipelineStep, event: ExecutionTraceEvent['event'], details?: string, durationMs?: number) => {
      executionTrace.push({ timestamp: Date.now(), step, event, details, durationMs });
    };

    let steps: PipelineStep[] = req.runSteps && req.runSteps.length > 0 ? req.runSteps : ['topic', 'outline', 'title'];
    const results: Record<PipelineStep, PipelineStepResult> = {
      topic: { step: 'topic', status: 'skipped', skippedReason: '未请求该步骤' },
      outline: { step: 'outline', status: 'skipped', skippedReason: '未请求该步骤' },
      title: { step: 'title', status: 'skipped', skippedReason: '未请求该步骤' },
    };
    let topicAnalysis: TopicAnalysisResult | undefined;
    let outline: OutlineGenerationResult | undefined;
    let titles: TitleGenerationResult | undefined;

    if (req.retryOnlyFailedSteps && req.previousState) {
      const prev = req.previousState;
      if (prev.topicAnalysis) { topicAnalysis = prev.topicAnalysis; results.topic = { ...prev.results.topic, status: 'success', result: prev.topicAnalysis }; trace('topic', 'success', '复用上次成功结果', 0); }
      if (prev.outline) { outline = prev.outline; results.outline = { ...prev.results.outline, status: 'success', result: prev.outline }; trace('outline', 'success', '复用上次成功结果', 0); }
      if (prev.titles) { titles = prev.titles; results.title = { ...prev.results.title, status: 'success', result: prev.titles }; trace('title', 'success', '复用上次成功结果', 0); }
      const failedSteps = (['topic', 'outline', 'title'] as PipelineStep[]).filter(s => prev.results[s].status === 'failed');
      if (failedSteps.length > 0) steps = failedSteps;
    }

    const ordered: PipelineStep[] = steps.includes('topic') ? ['topic'] : [];
    if (steps.includes('outline')) ordered.push('outline');
    if (steps.includes('title')) ordered.push('title');

    for (const step of ordered) {
      if (results[step].status === 'success') continue;
      if (step === 'outline' && topicAnalysis === undefined && ordered.includes('topic')) {
        results.outline = { step: 'outline', status: 'skipped', skippedReason: '前置步骤 topic 失败，已跳过' };
        trace('outline', 'skipped', '前置步骤 topic 失败，已跳过');
        continue;
      }
      if (step === 'title' && ordered.includes('outline') && outline === undefined && ordered.includes('outline')) {
        results.title = { step: 'title', status: 'skipped', skippedReason: '前置步骤 outline 失败，已跳过' };
        trace('title', 'skipped', '前置步骤 outline 失败，已跳过');
        continue;
      }

      const stepStart = Date.now();
      trace(step, 'start');
      try {
        if (step === 'topic') {
          const r = await this.topicAnalyzer.analyze({ topic: req.topic, context: req.context });
          topicAnalysis = r;
          const duration = Date.now() - stepStart;
          results.topic = { step: 'topic', status: 'success', result: r, durationMs: duration };
          trace('topic', 'success', undefined, duration);
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
          const duration = Date.now() - stepStart;
          results.outline = { step: 'outline', status: 'success', result: r, durationMs: duration };
          trace('outline', 'success', undefined, duration);
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
          const duration = Date.now() - stepStart;
          results.title = { step: 'title', status: 'success', result: r, durationMs: duration };
          trace('title', 'success', undefined, duration);
        }
      } catch (err) {
        const duration = Date.now() - stepStart;
        const sdkErr = err instanceof SDKError ? err : new SDKError('UNKNOWN_ERROR', String(err));
        const failureCategory = this.classifyFailure(sdkErr.code);
        const retrySuggestion = this.buildRetrySuggestion(step, sdkErr.code, sdkErr.message);
        results[step] = {
          step,
          status: 'failed',
          errorCode: sdkErr.code,
          errorMessage: sdkErr.message,
          durationMs: duration,
          failureCategory,
          retrySuggestion,
        };
        trace(step, 'failed', `${sdkErr.code}: ${sdkErr.message}`, duration);
      }
    }

    const allRequested: PipelineStep[] = ['topic', 'outline', 'title'];
    const stepResults = allRequested.filter(s => results[s].status !== 'skipped' || steps.includes(s)).map(s => results[s]);
    const successCount = stepResults.filter(r => r.status === 'success').length;
    const failedCount = stepResults.filter(r => r.status === 'failed').length;
    let status: TopicPipelineResult['status'] = 'success';
    if (failedCount > 0 && successCount > 0) status = 'partial';
    else if (failedCount > 0 && successCount === 0) status = 'failed';

    const retryableSteps = allRequested.filter(s => results[s].status === 'failed' && results[s].retrySuggestion?.shouldRetry) as PipelineStep[];

    const firstFailed = stepResults.find(r => r.status === 'failed');
    const skippedByDep = stepResults.find(r => r.status === 'skipped' && /跳过/.test(r.skippedReason || ''));
    const totalDurationMs = Date.now() - batchStart;
    const summary = successCount === ordered.length
      ? `主题「${req.topic}」三步全部完成`
      : `主题「${req.topic}」完成 ${successCount}/${ordered.length} 步${firstFailed ? `，失败环节：${firstFailed.step}` : ''}${skippedByDep ? `，${skippedByDep.step} 因依赖失败已跳过` : ''}`;
    const userFriendlyStatus = status === 'success'
      ? `✅ 主题「${req.topic}」：全部 ${ordered.length} 步完成（${totalDurationMs}ms）`
      : status === 'partial'
        ? `⚠️ 主题「${req.topic}」：${successCount}/${ordered.length} 步成功，部分失败或跳过，可重试步骤：${retryableSteps.join('、') || '无'}`
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
      totalDurationMs,
      executionTrace,
      retryableSteps,
    };
  }

  private classifyFailure(errorCode: string): FailureCategory {
    if ([ERROR_CODES.EMPTY_TOPIC, ERROR_CODES.EMPTY_TEXT, ERROR_CODES.EMPTY_BULLET_POINTS, ERROR_CODES.EMPTY_INSTRUCTION, ERROR_CODES.EMPTY_CONVERSATION_ID].includes(errorCode as any)) return 'empty_input';
    if ([ERROR_CODES.INVALID_CHAPTER_COUNT, ERROR_CODES.INVALID_VERSION_COUNT, ERROR_CODES.INVALID_TITLE_COUNT, ERROR_CODES.INVALID_STYLES, ERROR_CODES.INVALID_STRICTNESS, ERROR_CODES.INVALID_WORD_RANGE].includes(errorCode as any)) return 'parameter_out_of_range';
    if ([ERROR_CODES.KEYWORD_MISSING, ERROR_CODES.EXAGGERATION_DETECTED, ERROR_CODES.WORD_COUNT_OUT_OF_RANGE, ERROR_CODES.FORBIDDEN_TONE_DETECTED, ERROR_CODES.QUALITY_CHECK_FAILED].includes(errorCode as any)) return 'quality_check_failed';
    if (errorCode === ERROR_CODES.PARSE_ERROR) return 'parse_error';
    if ([ERROR_CODES.CONVERSATION_NOT_FOUND, ERROR_CODES.VERSION_NOT_FOUND, ERROR_CODES.INVALID_BRANCH_ID, ERROR_CODES.BRANCH_NOT_FOUND].includes(errorCode as any)) return 'invalid_input';
    if (errorCode === ERROR_CODES.RESULT_MISMATCH) return 'provider_error';
    return 'unknown';
  }

  private buildRetrySuggestion(step: PipelineStep, errorCode: string, message: string): RetrySuggestion {
    const cat = this.classifyFailure(errorCode);
    if (cat === 'empty_input') {
      let fixedParams: Record<string, unknown> | undefined;
      if (errorCode === ERROR_CODES.EMPTY_TOPIC) fixedParams = { topic: '请填写非空主题' };
      if (errorCode === ERROR_CODES.EMPTY_BULLET_POINTS) fixedParams = { bulletPoints: ['请补充要点 1', '请补充要点 2'] };
      return {
        shouldRetry: true,
        action: 'fix_input',
        userFriendlySuggestion: `🚫 请先修正输入参数：${message}，再重试该步骤`,
        fixedParams,
      };
    }
    if (cat === 'parameter_out_of_range') {
      return {
        shouldRetry: true,
        action: 'fix_input',
        userFriendlySuggestion: `⚙️ 参数超出合法范围：${message}，请调整后重试`,
      };
    }
    if (cat === 'quality_check_failed') {
      return {
        shouldRetry: true,
        action: 'adjust_quality_settings',
        userFriendlySuggestion: `✅ 可降低质量要求（如放宽关键词硬约束、放宽字数范围）后重试，或手动修正`,
      };
    }
    if (cat === 'parse_error' || cat === 'provider_error') {
      return {
        shouldRetry: true,
        action: 'retry_with_same_params',
        userFriendlySuggestion: `🔄 可能是临时故障，使用相同参数再试一次即可`,
      };
    }
    return {
      shouldRetry: false,
      action: 'skip_step',
      userFriendlySuggestion: `❌ 错误原因不明确，建议跳过该步骤或联系技术支持`,
    };
  }

  private buildPipelineSummary(topics: TopicPipelineResult[], s: number, p: number, f: number): string {
    const perTopic = topics.map(t => {
      const dur = t.totalDurationMs != null ? `（${t.totalDurationMs}ms）` : '';
      return `· ${t.userFriendlyStatus}${dur}`;
    }).join('\n');
    return `共处理 ${topics.length} 个主题：成功 ${s} 个，部分成功 ${p} 个，失败 ${f} 个。\n` + perTopic;
  }

  private buildPipelineFriendlyReport(topics: TopicPipelineResult[], s: number, p: number, f: number): string {
    const allDurations = topics.map(t => t.totalDurationMs || 0);
    const totalMs = allDurations.reduce((a, b) => a + b, 0);
    const failureBuckets: Record<string, number> = {};
    topics.forEach(t => {
      Object.values(t.results).forEach(r => {
        if (r.status === 'failed' && r.failureCategory) {
          failureBuckets[r.failureCategory] = (failureBuckets[r.failureCategory] || 0) + 1;
        }
      });
    });
    const perTopic = topics.map(t => {
      const details = ['topic', 'outline', 'title'].map(step => {
        const r = t.results[step as PipelineStep];
        const dur = r.durationMs != null ? ` ${r.durationMs}ms` : '';
        const cat = r.failureCategory ? ` [${r.failureCategory}]` : '';
        if (r.status === 'success') return `  ✅ ${step}：成功${dur}`;
        if (r.status === 'failed') return `  ❌ ${step}：失败${cat}（${r.errorMessage}）→ ${r.retrySuggestion?.userFriendlySuggestion || ''}`;
        return `  ⏭ ${step}：跳过（${r.skippedReason}）`;
      }).join('\n');
      const traceSummary = t.executionTrace ? `${t.executionTrace.length} 个执行事件` : '';
      return `${t.userFriendlyStatus}${traceSummary ? '，' + traceSummary : ''}\n${details}`;
    }).join('\n\n');
    const failureSummary = Object.keys(failureBuckets).length > 0
      ? `\n\n🔍 失败原因分类：${Object.entries(failureBuckets).map(([k, v]) => `${k}×${v}`).join('、')}`
      : '';
    return `📋 主题批量处理总览：共 ${topics.length} 个，成功 ${s}，部分成功 ${p}，失败 ${f}，总耗时 ${totalMs}ms${failureSummary}\n\n${perTopic}`;
  }
}
