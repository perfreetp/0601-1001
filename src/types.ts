export type Tone = 'formal' | 'casual' | 'academic' | 'persuasive' | 'narrative' | 'humorous' | 'objective';

export type ArticleLength = 'short' | 'medium' | 'long' | 'detailed';

export type TitleStyle = 'catchy' | 'formal' | 'question' | 'howto' | 'list' | 'story' | 'news';

export interface SDKConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  provider?: 'mock' | 'openai' | 'custom';
}

export interface TopicAnalysisRequest {
  topic: string;
  context?: string;
}

export interface AudienceProfile {
  name: string;
  description: string;
  characteristics: string[];
  painPoints: string[];
}

export interface WritingAngle {
  title: string;
  description: string;
  uniqueness: string;
  suitability: string;
}

export interface TopicAnalysisResult {
  audiences: AudienceProfile[];
  angles: WritingAngle[];
  keywords: {
    primary: string[];
    secondary: string[];
    longTail: string[];
  };
  summary: string;
}

export interface OutlineGenerationRequest {
  topic: string;
  chapterCount: number;
  tone?: Tone;
  length?: ArticleLength;
  audience?: string;
  keywords?: string[];
  context?: string;
}

export interface OutlineChapter {
  index: number;
  title: string;
  purpose: string;
  keyPoints: string[];
  estimatedLength: string;
}

export interface OutlineGenerationResult {
  title: string;
  introduction: string;
  chapters: OutlineChapter[];
  conclusion: string;
  totalEstimatedWords: number;
  structureNote: string;
}

export interface ParagraphExpansionRequest {
  bulletPoints: string[];
  tone?: Tone;
  versions?: number;
  context?: string;
  focusPoint?: string;
  minWords?: number;
  maxWords?: number;
  forbiddenTones?: Tone[];
}

export interface ExpandedVersion {
  version: number;
  style: string;
  content: string;
  highlights: string[];
}

export interface ParagraphExpansionResult {
  expandedVersions: ExpandedVersion[];
  recommendations: string[];
}

export interface PolishRequest {
  text: string;
  options?: {
    fixTypos?: boolean;
    removeRepetition?: boolean;
    adjustTone?: boolean;
    fixLogicJumps?: boolean;
    targetTone?: Tone;
  };
  context?: string;
}

export interface PolishIssue {
  type: 'typo' | 'repetition' | 'tone' | 'logic' | 'style';
  severity: 'low' | 'medium' | 'high';
  original: string;
  suggestion: string;
  reason: string;
  position?: {
    start: number;
    end: number;
  };
}

export interface PolishResult {
  polishedText: string;
  issues: PolishIssue[];
  summary: {
    typoCount: number;
    repetitionCount: number;
    toneAdjustments: number;
    logicFixes: number;
    totalImprovements: number;
  };
  userFriendlyChanges: string[];
}

export interface TitleGenerationRequest {
  topic: string;
  styles?: TitleStyle[];
  count?: number;
  keywords?: string[];
  context?: string;
  tone?: Tone;
  mustIncludeKeywords?: boolean;
  avoidExaggeration?: boolean;
}

export interface TitleOption {
  title: string;
  style: TitleStyle;
  highlights: string[];
  explanation: string;
  suitabilityScore: number;
  matchedKeywords: string[];
}

export interface KeywordCoverage {
  totalKeywords: number;
  coveredKeywords: string[];
  missingKeywords: string[];
  coverageRate: number;
  perTitleCoverage: { titleIndex: number; matchedKeywords: string[]; hasAllRequired: boolean }[];
}

export interface TitleGenerationResult {
  titles: TitleOption[];
  recommendation: string;
  bestPractice: string;
  keywordCoverage?: KeywordCoverage;
}

export interface CitationCheckRequest {
  text: string;
  strictness?: 'lenient' | 'moderate' | 'strict';
}

export interface MissingSource {
  sentence: string;
  claim: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
}

export interface ExaggerationIssue {
  sentence: string;
  original: string;
  alternative: string;
  reason: string;
}

export interface CitationCheckResult {
  missingSources: MissingSource[];
  exaggerations: ExaggerationIssue[];
  overallScore: number;
  recommendations: string[];
  userFriendlyReport: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface VersionComparison {
  fromVersion: number;
  toVersion: number;
  changes: {
    type: 'added' | 'removed' | 'modified';
    original?: string;
    modified?: string;
    explanation: string;
  }[];
  summary: string;
}

export interface ConversationResult {
  conversationId: string;
  response: string;
  revisedContent: string;
  userFriendlyChanges: string[];
  currentVersion: number;
  versions: ArticleVersion[];
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  chat(messages: AIChatMessage[], options?: { temperature?: number; responseFormat?: 'json' | 'text' }): Promise<string>;
}

export type BatchTaskType = 'topic' | 'outline' | 'title';

export type BatchTaskStatus = 'success' | 'failed' | 'skipped';

export interface BatchTopicTask {
  id?: string;
  type: 'topic';
  request: TopicAnalysisRequest;
}

export interface BatchOutlineTask {
  id?: string;
  type: 'outline';
  request: OutlineGenerationRequest;
}

export interface BatchTitleTask {
  id?: string;
  type: 'title';
  request: TitleGenerationRequest;
}

export type BatchTask = BatchTopicTask | BatchOutlineTask | BatchTitleTask;

export interface BatchTaskResult<T = unknown> {
  id: string;
  type: BatchTaskType;
  status: BatchTaskStatus;
  result?: T;
  errorCode?: string;
  errorMessage?: string;
  userFriendlyError?: string;
}

export interface BatchRunResult {
  total: number;
  successCount: number;
  failedCount: number;
  results: BatchTaskResult[];
  summary: string;
}

export interface ArticleVersion {
  version: number;
  content: string;
  timestamp: number;
  description: string;
  changes: string[];
  branchId: string;
  parentVersion?: number;
}

export interface ConversationContinueRequest {
  conversationId: string;
  instruction: string;
  currentContent?: string;
  baseVersion?: number;
  branchId?: string;
}

export interface BranchComparison {
  conversationId: string;
  branches: {
    branchId: string;
    latestVersion: number;
    baseVersion: number;
    changes: string[];
    description: string;
  }[];
  commonBase: number;
  differences: string[];
  userFriendlySummary: string;
}

export interface RouteVersionInfo {
  branchId: string;
  version: number;
  content: string;
  summary: string;
  wordCount: number;
  keyChanges: string[];
  diffFromBase: {
    charsAdded: number;
    charsRemoved: number;
    overview: string;
  };
}

export interface RouteComparison {
  conversationId: string;
  baseVersion: number;
  baseContent: string;
  baseSummary: string;
  routes: RouteVersionInfo[];
  crossRouteDiffs: {
    fromBranch: string;
    toBranch: string;
    charsAdded: number;
    charsRemoved: number;
    overview: string;
    keyDifferences: string[];
  }[];
  userFriendlySummary: string;
}

export type PipelineStep = 'topic' | 'outline' | 'title';

export interface TopicPipelineRequest {
  topic: string;
  context?: string;
  audience?: string;
  keywords?: string[];
  chapterCount?: number;
  titleCount?: number;
  titleStyles?: TitleStyle[];
  tone?: Tone;
  length?: ArticleLength;
  runSteps?: PipelineStep[];
}

export interface PipelineStepResult {
  step: PipelineStep;
  status: BatchTaskStatus;
  result?: unknown;
  errorCode?: string;
  errorMessage?: string;
  skippedReason?: string;
}

export interface TopicPipelineResult {
  topic: string;
  status: 'success' | 'partial' | 'failed';
  steps: PipelineStep[];
  results: Record<PipelineStep, PipelineStepResult>;
  topicAnalysis?: TopicAnalysisResult;
  outline?: OutlineGenerationResult;
  titles?: TitleGenerationResult;
  summary: string;
  userFriendlyStatus: string;
}

export interface PipelineRunResult {
  total: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  topics: TopicPipelineResult[];
  summary: string;
  userFriendlyReport: string;
}
