import type { FreeRunAdvice, FreeRunSnapshot } from "../types/free-run";
import type { PaceSettings } from "../types/pace-settings";
import { PaceSchedule } from "./pace-schedule";
import { averagePace } from "./run-progress";

// Configurable pace channels and one announcement for each completed kilometer.
export class FreeRunCoach {
  private schedule: PaceSchedule;
  private lastKilometer = 0;
  private boundarySeconds = 0;
  private previousMeters = 0;
  private previousSeconds = 0;
  private pending: FreeRunAdvice | null = null;

  constructor(settings?: PaceSettings) {
    this.schedule = new PaceSchedule(settings);
  }

  configure(settings: PaceSettings, activeSeconds: number) {
    this.schedule.configure(settings, activeSeconds);
  }

  reset(activeSeconds = 0, meters = 0) {
    this.schedule.reset(activeSeconds);
    this.lastKilometer = Math.floor(meters / 1000);
    this.boundarySeconds = activeSeconds;
    this.previousMeters = meters;
    this.previousSeconds = activeSeconds;
    this.pending = null;
  }

  resume(activeSeconds: number) {
    this.schedule.resume(activeSeconds);
  }

  advise(snapshot: FreeRunSnapshot): FreeRunAdvice | null {
    const { activeSeconds, meters, currentPace } = snapshot;
    if (
      snapshot.phase !== "running" ||
      !snapshot.gpsReliable ||
      !Number.isFinite(activeSeconds) ||
      !Number.isFinite(meters)
    )
      return null;

    if (this.pending) {
      if (snapshot.traceIncomplete && this.pending.kind === "kilometer")
        this.pending.pace = null;
      return this.pending;
    }
    const kilometer = Math.floor(meters / 1000);
    if (kilometer > this.lastKilometer) {
      const boundary = (this.lastKilometer + 1) * 1000;
      const fraction =
        meters > this.previousMeters
          ? Math.max(
              0,
              Math.min(
                1,
                (boundary - this.previousMeters) /
                  (meters - this.previousMeters),
              ),
            )
          : 1;
      const at =
        this.previousSeconds +
        fraction * (activeSeconds - this.previousSeconds);
      const seconds = at - this.boundarySeconds;
      this.pending = {
        kind: "kilometer",
        kilometer: this.lastKilometer + 1,
        pace: !snapshot.traceIncomplete && seconds > 0 ? seconds : null,
      };
      this.boundarySeconds = at;
    }
    this.previousMeters = meters;
    this.previousSeconds = activeSeconds;
    if (this.pending) return this.pending;
    if (activeSeconds >= 20 && meters >= 30) {
      const due = this.schedule.due(activeSeconds);
      const currentReliable =
        currentPace !== null && Number.isFinite(currentPace) && currentPace > 0;
      const reportCurrent = due.current && currentReliable;
      const average = averagePace(meters, activeSeconds);
      const reportAverage =
        due.average && (average !== null || snapshot.traceIncomplete);
      if (reportCurrent || reportAverage)
        return {
          kind: "pace",
          pace: reportCurrent ? currentPace : null,
          averagePace:
            reportAverage && !snapshot.traceIncomplete ? average : null,
          averageUncertain: due.average && snapshot.traceIncomplete,
        };
    }
    return null;
  }

  spoken(advice: FreeRunAdvice, activeSeconds: number) {
    this.schedule.spoken(
      {
        current: advice.kind === "pace" && advice.pace !== null,
        average:
          advice.kind === "pace" &&
          (advice.averagePace !== null || advice.averageUncertain),
      },
      activeSeconds,
    );
    if (advice.kind === "kilometer") {
      this.lastKilometer = advice.kilometer;
      this.pending = null;
    }
  }
}

export function freeRunMessage(
  advice: FreeRunAdvice,
  spokenPace: (pace: number) => string,
): string {
  if (advice.kind === "pace") {
    const messages: string[] = [];
    if (advice.pace !== null)
      messages.push(`Aktuální tempo ${spokenPace(advice.pace)}.`);
    if (advice.averagePace !== null)
      messages.push(
        `Dosavadní průměrné tempo ${spokenPace(advice.averagePace)}.`,
      );
    if (advice.averageUncertain)
      messages.push(
        "Záznam GPS není úplný. Průměrné tempo teď nelze spolehlivě posoudit.",
      );
    return messages.join(" ");
  }
  const label =
    advice.kilometer === 1 ? "První kilometr" : `${advice.kilometer}. kilometr`;
  return advice.pace === null
    ? `${label} je za tebou. Kvůli výpadku GPS nelze tempo kilometru spolehlivě určit.`
    : `${label} je za tebou. Tempo tohoto kilometru ${spokenPace(advice.pace)}.`;
}
