import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  AI_HISTORY_CONTENT_MAX,
  AI_HISTORY_MAX,
  AI_QUESTION_MAX,
  AiChatTurn,
  AiMode,
  AiQuota,
  AiStatus,
} from '../../models';
import { AiApi } from '../api/ai-api';
import { ApiConfigService } from '../api/api-config.service';
import { toApiError } from '../http/api-error';

export interface AiMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  /** Assistant answers: store data tools the answer was built from. */
  toolsUsed?: string[];
  mode?: AiMode;
  /** A failed request, shown inline and never sent back as history. */
  error?: boolean;
}

/** `top_products` / `get-orders` → "top products" / "orders". */
export function toolLabel(tool: string): string {
  return tool
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^get\s+/i, '')
    .trim()
    .toLowerCase();
}

/**
 * State of the "Ask Nebula AI" panel: open flag, backend AI status and quota, and the chat
 * thread. Lives at the root so the palette and the topbar can open it and the conversation
 * survives navigation; switching backends starts a fresh conversation.
 */
@Injectable({ providedIn: 'root' })
export class AiAssistantStore {
  private readonly api = inject(AiApi);
  private readonly config = inject(ApiConfigService);

  private readonly _isOpen = signal(false);
  private readonly _activated = signal(false);
  private readonly _status = signal<AiStatus | null>(null);
  private readonly _quota = signal<AiQuota | null>(null);
  private readonly _messages = signal<AiMessage[]>([]);
  private readonly _pending = signal(false);
  private readonly _limitReached = signal(false);
  private nextId = 0;
  private request: Subscription | null = null;
  private statusRequest: Subscription | null = null;

  readonly isOpen = this._isOpen.asReadonly();
  /** True once the panel has been opened; the shell defers loading the panel until then. */
  readonly activated = this._activated.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly pending = this._pending.asReadonly();
  /** A live backend answered in recorded mode: today's live quota is used up. */
  readonly limitReached = this._limitReached.asReadonly();

  /** Live AI needs the live backend and a provider configured on it. */
  readonly isLive = computed(
    () => this.config.mode() === 'live' && this._status()?.enabled === true,
  );
  readonly badge = computed(() =>
    this.isLive() ? `Live AI · ${this._status()?.provider ?? 'model'}` : 'Recorded demo',
  );
  /** "12 of 20 left today" while live; `null` in recorded mode. */
  readonly quotaText = computed(() => {
    const quota = this._quota();
    return this.isLive() && quota ? `${quota.remaining} of ${quota.limit} left today` : null;
  });

  constructor() {
    // A conversation (and its quota) belongs to one backend.
    let mode = this.config.mode();
    effect(() => {
      const next = this.config.mode();
      if (next === mode) return;
      mode = next;
      untracked(() => {
        this.clear();
        this.statusRequest?.unsubscribe();
        this._status.set(null);
        this._quota.set(null);
      });
    });
  }

  open(): void {
    this._activated.set(true);
    if (this._isOpen()) return;
    this._isOpen.set(true);
    this.refreshStatus();
  }

  close(): void {
    this._isOpen.set(false);
  }

  toggle(): void {
    if (this._isOpen()) this.close();
    else this.open();
  }

  /** Sends a question with the last `AI_HISTORY_MAX` messages as context. */
  ask(question: string): void {
    const text = question.trim();
    if (!text || text.length > AI_QUESTION_MAX || this._pending()) return;

    const history: AiChatTurn[] = this._messages()
      .filter((m) => !m.error)
      .slice(-AI_HISTORY_MAX)
      .map((m) => ({ role: m.role, content: m.content.slice(0, AI_HISTORY_CONTENT_MAX) }));
    this.push({ role: 'user', content: text });
    this._pending.set(true);

    const expectLive = this.isLive();
    // Failures are shown inline in the thread, so the global error toast is skipped.
    this.request = this.api.ask({ question: text, history }, { silent: true }).subscribe({
      next: (res) => {
        this._pending.set(false);
        this._quota.set(res.quota);
        this._limitReached.set(expectLive && res.mode === 'recorded');
        this.push({
          role: 'assistant',
          content: res.answer,
          toolsUsed: res.toolsUsed,
          mode: res.mode,
        });
      },
      error: (e: unknown) => {
        this._pending.set(false);
        this.push({ role: 'assistant', content: toApiError(e).message, error: true });
      },
    });
  }

  /** Empties the thread and drops an answer that is still on its way. */
  clear(): void {
    this.request?.unsubscribe();
    this.request = null;
    this._pending.set(false);
    this._messages.set([]);
    this._limitReached.set(false);
  }

  private refreshStatus(): void {
    this.statusRequest?.unsubscribe();
    this.statusRequest = this.api.status().subscribe({
      next: (status) => {
        this._status.set(status);
        this._quota.set(status.quota);
      },
      // No status means no live AI: the panel falls back to the recorded badge.
      error: () => this._status.set(null),
    });
  }

  private push(message: Omit<AiMessage, 'id'>): void {
    this._messages.update((list) => [...list, { ...message, id: ++this.nextId }]);
  }
}
