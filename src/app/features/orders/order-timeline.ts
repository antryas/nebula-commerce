import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { STATUS_META } from '../../shared/ui/status-chip';
import { TimelineStep } from './order-format';

const STATE_LABEL = { done: 'Completed', current: 'Current status', upcoming: 'Pending' };

/** Vertical status history with glowing dots; upcoming steps are dimmed. */
@Component({
  selector: 'nb-order-timeline',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="nb-timeline">
      @for (step of steps(); track $index) {
        <li
          class="nb-timeline__step"
          data-timeline-step
          [class]="'is-' + step.state"
          [style.--nb-step-color]="meta[step.status].color"
          [style.--nb-step-index]="$index"
        >
          <span class="nb-timeline__dot" aria-hidden="true">
            <span class="material-symbols-rounded">{{ meta[step.status].icon }}</span>
          </span>
          <div class="nb-timeline__body">
            <p class="nb-timeline__title">
              {{ meta[step.status].label }}
              <span class="sr-only">— {{ stateLabel[step.state] }}</span>
            </p>
            @if (step.at) {
              <time class="nb-timeline__time" [attr.datetime]="step.at">
                {{ step.at | date: 'MMM d, y · h:mm a' }}
              </time>
            } @else {
              <span class="nb-timeline__time">Pending</span>
            }
            @if (step.note) {
              <p class="nb-timeline__note">{{ step.note }}</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styleUrl: './order-timeline.scss',
})
export class OrderTimeline {
  readonly steps = input.required<TimelineStep[]>();
  protected readonly meta = STATUS_META;
  protected readonly stateLabel = STATE_LABEL;
}
