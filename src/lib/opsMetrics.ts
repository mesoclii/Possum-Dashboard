export type MetricSample = {
  ts: number;
  host: {
    cpu: { usagePct: number | null };
    memory: { usedPct: number | null; swapUsedPct: number | null };
    disk: { root: { usedPct: number | null } };
  };
};

export function aggregateResourceSamples(data: unknown): MetricSample[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || !Number.isFinite(entry.ts)) return [];
    const metrics = entry.metrics && typeof entry.metrics === "object" ? entry.metrics : {};
    const average = (key: string) => {
      const value = metrics[key]?.avg;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    };
    return [{
      ts: entry.ts,
      host: {
        cpu: { usagePct: average("host.cpu.usagePct") },
        memory: {
          usedPct: average("host.memory.usedPct"),
          swapUsedPct: average("host.memory.swapUsedPct"),
        },
        disk: { root: { usedPct: average("host.disk.root.usedPct") } },
      },
    }];
  });
}
