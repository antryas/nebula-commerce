import { DOCUMENT, Injectable, inject } from '@angular/core';

/**
 * Thin injectable wrapper around the native `window.confirm` dialog, so pages and guards
 * can ask for confirmation while tests stub the answer.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly window = inject(DOCUMENT).defaultView;

  confirm(message: string): boolean {
    return this.window ? this.window.confirm(message) : true;
  }
}
