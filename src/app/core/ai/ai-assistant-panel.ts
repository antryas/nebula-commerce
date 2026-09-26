import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AI_QUESTION_MAX, AI_SUGGESTED_QUESTIONS } from '../../models';
import { AiAssistantStore, AiMessage, toolLabel } from './ai-assistant.store';
import { MarkdownLite } from './markdown-lite';

/**
 * "Ask Nebula AI": a right-hand drawer (full screen on phones) with the chat thread, suggested
 * questions and the current AI mode. Loaded with `@defer` by the shell on first open.
 */
@Component({
  selector: 'nb-ai-assistant-panel',
  imports: [CdkTrapFocus, MarkdownLite],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-assistant-panel.html',
  styleUrl: './ai-assistant-panel.scss',
})
export class AiAssistantPanel {
  private readonly injector = inject(Injector);
  protected readonly store = inject(AiAssistantStore);

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  protected readonly suggestions = AI_SUGGESTED_QUESTIONS;
  protected readonly maxLength = AI_QUESTION_MAX;
  protected readonly draft = signal('');

  constructor() {
    // Keep the newest message in view, and hand focus back to the input once an answer lands.
    effect(() => {
      this.store.messages();
      const pending = this.store.pending();
      afterNextRender(
        () => {
          const thread = this.thread()?.nativeElement;
          if (thread) thread.scrollTop = thread.scrollHeight;
          if (!pending) this.input()?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    });
  }

  protected tools(message: AiMessage): string {
    return (message.toolsUsed ?? []).map(toolLabel).join(', ');
  }

  protected onInput(e: Event): void {
    this.draft.set((e.target as HTMLTextAreaElement).value);
  }

  /** Enter sends, Shift+Enter adds a line break (and IME composition is left alone). */
  protected onKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    this.send();
  }

  protected send(): void {
    const text = this.draft().trim();
    if (!text || this.store.pending()) return;
    this.store.ask(text);
    this.draft.set('');
    // The binding may not have seen the typed text yet, so clear the element directly too.
    const input = this.input()?.nativeElement;
    if (input) input.value = '';
  }

  protected ask(question: string): void {
    this.store.ask(question);
  }
}
