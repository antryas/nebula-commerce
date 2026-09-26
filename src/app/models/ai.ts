import { ProductCategory } from './product';

/** `live` came from the model provider; `recorded` is a canned answer built from store data. */
export type AiMode = 'live' | 'recorded';

export type AiTone = 'friendly' | 'premium' | 'playful';

/** Live AI calls left for the current user today. */
export interface AiQuota {
  remaining: number;
  limit: number;
}

export interface AiStatus {
  /** True when the backend has a model provider configured. */
  enabled: boolean;
  provider: 'DeepSeek' | null;
  quota: AiQuota;
}

export interface AiChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiAskRequest {
  question: string;
  history?: AiChatTurn[];
}

export interface AiAnswer {
  /** Plain text with simple markdown: paragraphs, `-` bullets and `**bold**`. */
  answer: string;
  mode: AiMode;
  /** Store data tools the answer was built from, e.g. `top_products`. */
  toolsUsed: string[];
  quota: AiQuota;
}

export interface AiDescriptionRequest {
  name: string;
  category: ProductCategory;
  keywords?: string;
  tone: AiTone;
}

export interface AiDescription {
  description: string;
  mode: AiMode;
  quota: AiQuota;
}

/** Limits of the `/api/ai` contract. */
export const AI_QUESTION_MAX = 500;
export const AI_HISTORY_MAX = 6;
export const AI_HISTORY_CONTENT_MAX = 2000;
export const AI_PRODUCT_NAME_MAX = 120;

/** Suggested questions; the backend and the mock both answer them from store data. */
export const AI_SUGGESTED_QUESTIONS: readonly string[] = [
  'What were my top 5 products this month?',
  'How did revenue change compared to the previous period?',
  'Which orders are still waiting to be shipped?',
  'Who are my most valuable customers?',
];
