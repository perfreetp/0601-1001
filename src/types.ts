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
}

export interface TitleOption {
  title: string;
  style: TitleStyle;
  highlights: string[];
  explanation: string;
  suitabilityScore: number;
}

export interface TitleGenerationResult {
  titles: TitleOption[];
  recommendation: string;
  bestPractice: string;
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

export interface ArticleVersion {
  version: number;
  content: string;
  timestamp: number;
  description: string;
  changes: string[];
}

export interface ConversationContinueRequest {
  conversationId: string;
  instruction: string;
  currentContent?: string;
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
