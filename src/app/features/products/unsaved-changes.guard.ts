import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from './confirm.service';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const UNSAVED_CHANGES_MESSAGE = 'You have unsaved changes. Leave anyway?';

/** Asks before leaving a page whose form has unsaved edits. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() || inject(ConfirmService).confirm(UNSAVED_CHANGES_MESSAGE);
