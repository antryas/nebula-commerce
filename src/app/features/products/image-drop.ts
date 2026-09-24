import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Drag-and-drop (or click) image picker with a preview. Emits the chosen file. */
@Component({
  selector: 'nb-image-drop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="nb-drop"
      [class.nb-drop--over]="dragOver()"
      [class.nb-drop--filled]="!!url()"
      (dragenter)="onDragOver($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      @if (url()) {
        <img class="nb-drop__preview" [src]="url()" [alt]="alt()" />
        <div class="nb-drop__actions">
          <button type="button" class="nb-drop__chip" (click)="file.click()">
            <span class="material-symbols-rounded" aria-hidden="true">swap_horiz</span>
            Replace
          </button>
          <button type="button" class="nb-drop__chip" (click)="cleared.emit()">
            <span class="material-symbols-rounded" aria-hidden="true">delete</span>
            Remove
          </button>
        </div>
      } @else {
        <button
          type="button"
          class="nb-drop__empty"
          aria-describedby="nb-drop-hint"
          (click)="file.click()"
        >
          <span class="nb-drop__icon" aria-hidden="true">
            <span class="material-symbols-rounded">cloud_upload</span>
          </span>
          <span class="nb-drop__title">Drop an image here</span>
          <span class="nb-drop__sub">or <u>browse your files</u> · PNG, JPG, WebP up to 5 MB</span>
        </button>
      }
      <input
        #file
        class="sr-only"
        type="file"
        accept="image/*"
        tabindex="-1"
        aria-hidden="true"
        (change)="onPick($event)"
      />
    </div>
    @if (error(); as message) {
      <p class="nb-drop__error" role="alert">{{ message }}</p>
    }
    <p id="nb-drop-hint" class="nb-drop__hint">
      <span class="material-symbols-rounded" aria-hidden="true">lock</span>
      Images stay in your browser in this demo.
    </p>
  `,
  styles: `
    .nb-drop {
      position: relative;
      overflow: hidden;
      aspect-ratio: 4 / 3;
      border: 1.5px dashed color-mix(in srgb, var(--nb-muted) 40%, var(--nb-border));
      border-radius: 1rem;
      background:
        radial-gradient(
          100% 80% at 50% 0%,
          color-mix(in srgb, var(--nb-accent-1) 10%, transparent),
          transparent 70%
        ),
        color-mix(in srgb, var(--nb-bg) 45%, transparent);
      transition:
        border-color 200ms ease,
        box-shadow 200ms ease,
        transform 200ms ease;
    }
    .nb-drop:hover,
    .nb-drop:focus-within {
      border-color: color-mix(in srgb, var(--nb-accent-1) 65%, var(--nb-border));
    }
    .nb-drop--over {
      border-style: solid;
      border-color: var(--nb-accent-2);
      box-shadow:
        0 0 0 4px color-mix(in srgb, var(--nb-accent-2) 18%, transparent),
        0 18px 40px -20px var(--nb-accent-2);
      transform: scale(1.01);
    }
    .nb-drop--filled {
      border-style: solid;
    }
    .nb-drop__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      width: 100%;
      height: 100%;
      padding: 1rem;
      border: 0;
      font: inherit;
      text-align: center;
      color: var(--nb-text);
      background: transparent;
      cursor: pointer;
    }
    .nb-drop__empty:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: -4px;
      border-radius: 1rem;
    }
    .nb-drop__icon {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      margin-bottom: 0.25rem;
      border-radius: 1rem;
      color: #fff;
      background: linear-gradient(135deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 12px 28px -12px var(--nb-accent-1);
      transition: transform 250ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    .nb-drop:hover .nb-drop__icon,
    .nb-drop--over .nb-drop__icon {
      transform: translateY(-4px);
    }
    .nb-drop__icon .material-symbols-rounded {
      width: 1.5rem;
      overflow: hidden;
      font-size: 1.5rem;
    }
    .nb-drop__title {
      font-size: 0.9375rem;
      font-weight: 600;
    }
    .nb-drop__sub {
      font-size: 0.75rem;
      color: var(--nb-muted);
    }
    .nb-drop__sub u {
      color: var(--nb-accent-1);
      text-underline-offset: 2px;
    }
    .nb-drop__preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .nb-drop__actions {
      position: absolute;
      right: 0.625rem;
      bottom: 0.625rem;
      display: flex;
      gap: 0.375rem;
    }
    .nb-drop__chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      height: 2rem;
      padding: 0 0.625rem;
      border: 0;
      border-radius: 0.625rem;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      color: #fff;
      background: rgba(3, 6, 14, 0.6);
      backdrop-filter: blur(8px);
      cursor: pointer;
    }
    .nb-drop__chip:hover {
      background: rgba(3, 6, 14, 0.8);
    }
    .nb-drop__chip:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: 2px;
    }
    .nb-drop__chip .material-symbols-rounded {
      width: 1rem;
      overflow: hidden;
      font-size: 1rem;
    }
    .nb-drop__error {
      margin: 0.5rem 0 0;
      font-size: 0.8125rem;
      color: color-mix(in srgb, var(--nb-danger) 80%, var(--nb-text));
    }
    .nb-drop__hint {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin: 0.625rem 0 0;
      font-size: 0.75rem;
      color: var(--nb-muted);
    }
    .nb-drop__hint .material-symbols-rounded {
      width: 0.875rem;
      overflow: hidden;
      font-size: 0.875rem;
    }
  `,
})
export class ImageDrop {
  readonly url = input('');
  readonly alt = input('Product image');

  readonly picked = output<File>();
  readonly cleared = output<void>();

  protected readonly dragOver = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('file');

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.dragOver.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.accept(event.dataTransfer?.files?.[0]);
  }

  protected onPick(event: Event): void {
    this.accept((event.target as HTMLInputElement).files?.[0]);
    // Allow picking the same file again after "Remove".
    this.fileInput().nativeElement.value = '';
  }

  private accept(file: File | undefined): void {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Please choose an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.error.set('Image is larger than 5 MB.');
      return;
    }
    this.error.set(null);
    this.picked.emit(file);
  }
}
