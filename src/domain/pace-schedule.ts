import {
  DEFAULT_PACE_SETTINGS,
  type DuePaces,
  type PaceSettings,
} from "../types/pace-settings";

// Each channel counts active run time and advances only on accepted speech.
export class PaceSchedule {
  private settings: PaceSettings;
  private lastCurrent = 0;
  private lastAverage = 0;
  private lastSpoken = 0;

  constructor(settings: PaceSettings = DEFAULT_PACE_SETTINGS) {
    this.settings = structuredClone(settings);
  }

  configure(settings: PaceSettings, activeSeconds: number) {
    if (
      settings.current.enabled !== this.settings.current.enabled ||
      settings.current.intervalSeconds !== this.settings.current.intervalSeconds
    )
      this.lastCurrent = activeSeconds;
    if (
      settings.average.enabled !== this.settings.average.enabled ||
      settings.average.intervalSeconds !== this.settings.average.intervalSeconds
    )
      this.lastAverage = activeSeconds;
    this.settings = structuredClone(settings);
  }

  reset(activeSeconds = 0) {
    this.lastCurrent = activeSeconds;
    this.lastAverage = activeSeconds;
    this.lastSpoken = activeSeconds;
  }

  resume(activeSeconds: number) {
    this.lastSpoken = activeSeconds;
  }

  due(activeSeconds: number): DuePaces {
    if (!Number.isFinite(activeSeconds) || activeSeconds - this.lastSpoken < 10)
      return { current: false, average: false };
    return {
      current:
        this.settings.current.enabled &&
        activeSeconds - this.lastCurrent >=
          this.settings.current.intervalSeconds,
      average:
        this.settings.average.enabled &&
        activeSeconds - this.lastAverage >=
          this.settings.average.intervalSeconds,
    };
  }

  spoken(channels: DuePaces, activeSeconds: number) {
    if (channels.current) this.lastCurrent = activeSeconds;
    if (channels.average) this.lastAverage = activeSeconds;
    this.lastSpoken = activeSeconds;
  }
}
