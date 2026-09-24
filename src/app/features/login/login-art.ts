import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Sparkline } from '../../shared/ui/sparkline';

/** Marketing half of the login page: headline plus floating mock KPI cards. */
@Component({
  selector: 'nb-login-art',
  imports: [Sparkline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-art.html',
  styleUrl: './login-art.scss',
})
export class LoginArt {
  protected readonly spark = [12, 14, 13, 17, 16, 19, 18, 23, 22, 27];
  protected readonly bars = [38, 52, 44, 63, 58, 76, 88];
}
