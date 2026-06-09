import { SDKConfig, AIProvider } from './types';
import { createProvider } from './provider';
import { TopicAnalyzer } from './capabilities/topicAnalyzer';
import { OutlineGenerator } from './capabilities/outlineGenerator';
import { ParagraphExpander } from './capabilities/paragraphExpander';
import { Polisher } from './capabilities/polisher';
import { TitleGenerator } from './capabilities/titleGenerator';
import { CitationChecker } from './capabilities/citationChecker';
import { ConversationManager } from './capabilities/conversationManager';
import { BatchProcessor } from './capabilities/batchProcessor';

export class WritingAISDK {
  public topic: TopicAnalyzer;
  public outline: OutlineGenerator;
  public expand: ParagraphExpander;
  public polish: Polisher;
  public title: TitleGenerator;
  public citation: CitationChecker;
  public conversation: ConversationManager;
  public batch: BatchProcessor;

  private provider: AIProvider;
  private config: SDKConfig;

  constructor(config: SDKConfig = {}) {
    this.config = {
      provider: 'mock',
      timeout: 30000,
      ...config,
    };
    this.provider = createProvider(this.config);
    this.topic = new TopicAnalyzer(this.provider);
    this.outline = new OutlineGenerator(this.provider);
    this.expand = new ParagraphExpander(this.provider);
    this.polish = new Polisher(this.provider);
    this.title = new TitleGenerator(this.provider);
    this.citation = new CitationChecker(this.provider);
    this.conversation = new ConversationManager(this.provider);
    this.batch = new BatchProcessor(this.provider);
  }
}

export * from './types';
export { SDKError, ERROR_CODES } from './errors';
export { createProvider, MockAIProvider, OpenAIProvider } from './provider';
export { TopicAnalyzer } from './capabilities/topicAnalyzer';
export { OutlineGenerator } from './capabilities/outlineGenerator';
export { ParagraphExpander } from './capabilities/paragraphExpander';
export { Polisher } from './capabilities/polisher';
export { TitleGenerator } from './capabilities/titleGenerator';
export { CitationChecker } from './capabilities/citationChecker';
export { ConversationManager } from './capabilities/conversationManager';
export { BatchProcessor } from './capabilities/batchProcessor';
