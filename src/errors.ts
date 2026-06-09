export class SDKError extends Error {
  public code: string;
  public details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, SDKError.prototype);
  }
}

export const ERROR_CODES = {
  EMPTY_TOPIC: 'EMPTY_TOPIC',
  EMPTY_TEXT: 'EMPTY_TEXT',
  EMPTY_BULLET_POINTS: 'EMPTY_BULLET_POINTS',
  EMPTY_INSTRUCTION: 'EMPTY_INSTRUCTION',
  EMPTY_CONVERSATION_ID: 'EMPTY_CONVERSATION_ID',
  INVALID_CHAPTER_COUNT: 'INVALID_CHAPTER_COUNT',
  INVALID_VERSION_COUNT: 'INVALID_VERSION_COUNT',
  INVALID_TITLE_COUNT: 'INVALID_TITLE_COUNT',
  INVALID_STYLES: 'INVALID_STYLES',
  INVALID_STRICTNESS: 'INVALID_STRICTNESS',
  INVALID_WORD_RANGE: 'INVALID_WORD_RANGE',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  VERSION_NOT_FOUND: 'VERSION_NOT_FOUND',
  INVALID_BRANCH_ID: 'INVALID_BRANCH_ID',
  BRANCH_NOT_FOUND: 'BRANCH_NOT_FOUND',
  RESULT_MISMATCH: 'RESULT_MISMATCH',
  PARSE_ERROR: 'PARSE_ERROR',
  KEYWORD_MISSING: 'KEYWORD_MISSING',
  EXAGGERATION_DETECTED: 'EXAGGERATION_DETECTED',
  WORD_COUNT_OUT_OF_RANGE: 'WORD_COUNT_OUT_OF_RANGE',
  FORBIDDEN_TONE_DETECTED: 'FORBIDDEN_TONE_DETECTED',
  QUALITY_CHECK_FAILED: 'QUALITY_CHECK_FAILED',
  EMPTY_BATCH_TASKS: 'EMPTY_BATCH_TASKS',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export function assertNonEmptyString(value: string, code: ErrorCode, message: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SDKError(code, message);
  }
}

export function assertNonEmptyArray<T>(value: T[], code: ErrorCode, message: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new SDKError(code, message);
  }
}

export function assertIntegerInRange(
  value: number,
  min: number,
  max: number,
  code: ErrorCode,
  message: string
): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new SDKError(code, message, { value, min, max });
  }
}
