import type {
  CoachingAdvice,
  CoachingSnapshot,
  GoalAssessment,
  GoalTrend,
} from "../types/coaching";
import { targetPace } from "./pace";
import { runProgress } from "./run-progress";
import { PaceSchedule } from "./pace-schedule";
import type { PaceSettings } from "../types/pace-settings";

// Enter outside ±20 s/km; return to the target band only inside ±10 s/km.
export function goalTrend(
  delta: number,
  previous: GoalTrend | null,
): GoalTrend {
  if (delta > 20) return "behind";
  if (delta < -20) return "ahead";
  if (previous === "behind" && delta > 10) return "behind";
  if (previous === "ahead" && delta < -10) return "ahead";
  return "on-track";
}

export class RunCoach {
  private lastSpokenSeconds = 0;
  private schedule: PaceSchedule;
  private currentTrend: GoalTrend | null = null;
  private averageTrend: GoalTrend | null = null;
  private completion: Extract<
    CoachingAdvice,
    { kind: "progress" | "completion" }
  > | null = null;
  private completionAnnounced = false;
  private historyIncomplete = false;

  constructor(settings?: PaceSettings) {
    this.schedule = new PaceSchedule(settings);
  }

  configure(settings: PaceSettings, activeSeconds: number) {
    this.schedule.configure(settings, activeSeconds);
  }

  reset(activeSeconds = 0, historyIncomplete = false) {
    this.lastSpokenSeconds = activeSeconds;
    this.schedule.reset(activeSeconds);
    this.currentTrend = null;
    this.averageTrend = null;
    this.completion = null;
    this.completionAnnounced = false;
    this.historyIncomplete = historyIncomplete;
  }

  resume(activeSeconds: number) {
    // Active-time channel clocks are preserved across a pause.
    this.lastSpokenSeconds = activeSeconds;
    this.schedule.resume(activeSeconds);
  }

  advise(snapshot: CoachingSnapshot): CoachingAdvice | null {
    const { goal, activeSeconds, meters, currentPace, gpsReliable } = snapshot;
    if (
      snapshot.phase !== "running" ||
      !gpsReliable ||
      !Number.isFinite(activeSeconds) ||
      !Number.isFinite(meters)
    )
      return null;
    const progress = runProgress(goal, meters, activeSeconds);
    const average = progress.averagePace;
    if (average === null) return null;
    this.historyIncomplete ||= snapshot.traceIncomplete;

    if (progress.remainingMeters === 0 && !this.completion) {
      // Freeze the first observed crossing, so continuing past the target does
      // not change its result or produce new advice to accelerate.
      this.completion = {
        kind: "completion",
        pace: average,
        assessment: this.historyIncomplete
          ? "uncertain"
          : activeSeconds <= goal.durationMinutes * 60
            ? "reached"
            : "reached-after-time",
        traceIncomplete: this.historyIncomplete,
      };
    }

    if (this.completion && !this.completionAnnounced) {
      if (activeSeconds - this.lastSpokenSeconds < 20) return null;
      // A gap between the crossing and delivery still makes the data uncertain.
      if (this.historyIncomplete) {
        this.completion.assessment = "uncertain";
        this.completion.traceIncomplete = true;
      }
      return this.completion;
    }

    // currentPace is already smoothed by Runner and null while GPS settles,
    // after stale fixes, or after the runner stops moving. A recorded finish
    // above can still be announced when the runner stops at the target.
    if (activeSeconds < 20 || meters < 30) return null;
    const currentReliable =
      currentPace !== null && Number.isFinite(currentPace) && currentPace > 0;
    if (currentReliable)
      this.currentTrend = goalTrend(
        currentPace - targetPace(goal),
        this.currentTrend,
      );
    this.averageTrend = goalTrend(
      average - targetPace(goal),
      this.averageTrend,
    );
    const due = this.schedule.due(activeSeconds);
    if (due.average) {
      const assessment: GoalAssessment = this.historyIncomplete
        ? "uncertain"
        : activeSeconds >= goal.durationMinutes * 60
          ? "time-expired"
          : this.averageTrend;
      return {
        kind: "progress",
        pace: average,
        assessment,
        traceIncomplete: this.historyIncomplete,
        currentPace: due.current && currentReliable ? currentPace : undefined,
        goalComplete: this.completionAnnounced,
      };
    }
    if (!due.current || !currentReliable) return null;
    return {
      kind: "current",
      pace: currentPace,
      trend: this.currentTrend ?? "on-track",
      timeExpired:
        this.completionAnnounced || activeSeconds >= goal.durationMinutes * 60,
    };
  }

  spoken(advice: CoachingAdvice, activeSeconds: number) {
    // Called only when VoiceGuide accepts the message; navigation can defer it.
    this.lastSpokenSeconds = activeSeconds;
    this.schedule.spoken(
      {
        current: advice.kind === "current" || advice.currentPace !== undefined,
        average: advice.kind === "progress",
      },
      activeSeconds,
    );
    if (advice.kind === "completion") this.completionAnnounced = true;
  }
}

export function coachingMessage(
  advice: CoachingAdvice,
  spokenPace: (pace: number) => string,
): string {
  if (advice.kind === "current") {
    const messages: Record<GoalTrend, string> = {
      ahead: "Běžíš rychleji než své cílové tempo. Zkus trochu zpomalit.",
      behind:
        "Běžíš pomaleji než své cílové tempo. Jestli se cítíš dobře, lehce přidej.",
      "on-track": "Držíš přibližně cílové tempo. Pokračuj ve svém rytmu.",
    };
    return `Aktuální tempo ${spokenPace(advice.pace)}.${advice.timeExpired ? "" : ` ${messages[advice.trend]}`}`;
  }
  const current =
    advice.currentPace === undefined
      ? ""
      : `Aktuální tempo ${spokenPace(advice.currentPace)}. `;
  if (advice.traceIncomplete || advice.assessment === "uncertain")
    return `${current}Záznam GPS není úplný. Průměrné tempo a splnění cíle teď nelze spolehlivě posoudit.`;
  const averageLabel =
    advice.kind === "completion"
      ? "Průměr při dosažení cílové vzdálenosti"
      : "Dosavadní průměrné tempo";
  const average = `${current}${averageLabel} ${spokenPace(advice.pace)}.`;
  if (advice.goalComplete) return average;
  const messages: Record<Exclude<GoalAssessment, "uncertain">, string> = {
    ahead:
      "Při zachování tohoto průměru bys cílovou vzdálenost zvládl s časovou rezervou.",
    "on-track": "Jsi přibližně na cílovém tempu. Výsledek je zatím odhad.",
    behind:
      "Při zachování tohoto průměru bys cílový čas překročil. Pokud se cítíš dobře, lehce přidej.",
    "time-expired":
      "Cílový čas už uplynul. Podle GPS ještě zbývá doběhnout cílovou vzdálenost.",
    reached: "Podle GPS máš cílovou vzdálenost za sebou v cílovém čase.",
    "reached-after-time":
      "Podle GPS máš cílovou vzdálenost za sebou. Cílový čas už uplynul.",
  };
  return `${average} ${messages[advice.assessment]}`;
}
