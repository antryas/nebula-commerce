let pending: Promise<void> | null = null;

/**
 * Fetches the world GeoJSON (a static asset, not part of any bundle) and registers it with
 * ECharts as the `world` map. Runs once per session; a failed attempt can be retried.
 */
export function loadWorldMap(baseUri: string): Promise<void> {
  pending ??= Promise.all([
    import('echarts'),
    fetch(new URL('geo/world.json', baseUri)).then((res) => {
      if (!res.ok) throw new Error(`World map request failed (${res.status})`);
      return res.json() as Promise<object>;
    }),
  ])
    .then(([echarts, geoJson]) => {
      // The file is a GeoJSON FeatureCollection; ECharts' GeoJSON type is structural.
      echarts.registerMap('world', geoJson as Parameters<typeof echarts.registerMap>[1]);
    })
    .catch((e: unknown) => {
      pending = null;
      throw e;
    });
  return pending;
}
