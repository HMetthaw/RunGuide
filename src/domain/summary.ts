import type { Run } from "../types/models";
import { isIncomplete } from "./recording-quality";

export type SummaryPeriod = "week" | "month";
export function runSummary(
  runs: Run[],
  period: SummaryPeriod,
  now = new Date(),
) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else start.setDate(1);
  const end = new Date(start);
  if (period === "week") end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  const selected = runs.filter((run) => {
    const time = Date.parse(run.startedAt);
    return (
      time >= start.getTime() && time < end.getTime() && time <= now.getTime()
    );
  });
  const meters = selected.reduce((sum, run) => sum + run.distanceMeters, 0);
  const seconds = selected.reduce((sum, run) => sum + run.durationSeconds, 0);
  const incompleteCount = selected.filter(isIncomplete).length;
  const days = Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86400000,
  );
  const buckets = Array.from(
    { length: period === "week" ? 7 : Math.ceil(days / 7) },
    (_, i) => ({
      label:
        period === "week"
          ? ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"][i]
          : `${i * 7 + 1}.–${Math.min(days, (i + 1) * 7)}.`,
      meters: 0,
    }),
  );
  for (const run of selected) {
    const date = new Date(run.startedAt);
    const index =
      period === "week"
        ? (date.getDay() + 6) % 7
        : Math.floor((date.getDate() - 1) / 7);
    buckets[index].meters += run.distanceMeters;
  }
  return {
    meters,
    seconds,
    count: selected.length,
    pace:
      meters > 0 && incompleteCount === 0 ? (seconds * 1000) / meters : null,
    incompleteCount,
    buckets,
  };
}
