import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConfirmService } from './confirm.service';
import { unsavedChangesGuard } from './unsaved-changes.guard';

function run(dirty: boolean): boolean {
  return TestBed.runInInjectionContext(
    () =>
      unsavedChangesGuard(
        { hasUnsavedChanges: () => dirty },
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ) as boolean,
  );
}

describe('unsavedChangesGuard', () => {
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirm = vi.fn(() => false);
    TestBed.configureTestingModule({
      providers: [{ provide: ConfirmService, useValue: { confirm } }],
    });
  });

  it('lets the user leave a clean form without asking', () => {
    expect(run(false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before leaving unsaved changes', () => {
    expect(run(true)).toBe(false);
    expect(confirm).toHaveBeenCalledWith('You have unsaved changes. Leave anyway?');
    confirm.mockReturnValue(true);
    expect(run(true)).toBe(true);
  });
});
