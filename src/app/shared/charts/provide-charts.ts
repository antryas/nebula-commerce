import { Provider } from '@angular/core';
import { provideEchartsCore } from 'ngx-echarts';

/**
 * ECharts config for `[echarts]` directives. Provided by the lazily loaded shell (not in
 * `app.config.ts`) so ngx-echarts and the rxjs/interop code it pulls in stay out of the
 * initial bundle; ECharts itself is fetched on demand by the first chart.
 */
export function provideCharts(): Provider {
  return provideEchartsCore({ echarts: () => import('echarts') });
}
