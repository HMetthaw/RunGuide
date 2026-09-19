import type { TrackingInterruption } from "../types/recording";

interface TrackingCallbacks {
  position: PositionCallback;
  error: (code: number) => void;
  suspend: (reason: TrackingInterruption["reason"]) => void;
  resume: () => void;
  tick: () => void;
  wakeStatus: (message: string) => void;
}

// Screen Wake Lock protects an active screen only. It cannot keep web GPS alive
// after locking the phone, suspending the WebView, or terminating its process.
export class GpsTracker {
  private enabled = false;
  private suspended = false;
  private generation = 0;
  private watch: number | null = null;
  private lastUsableAt = 0;
  private lastStartAt = 0;
  private wake: WakeLockSentinel | null = null;
  private wakeGeneration = 0;
  private wakePending = false;
  private lastWakeAttempt = -Infinity;
  private timer: ReturnType<typeof setInterval>;

  constructor(private callbacks: TrackingCallbacks) {
    document.addEventListener("visibilitychange", this.visibility);
    window.addEventListener("pagehide", this.pagehide);
    window.addEventListener("pageshow", this.pageshow);
    this.timer = setInterval(() => {
      if (!this.enabled || this.suspended || document.hidden) return;
      this.callbacks.tick();
      // A watcher can silently stop across OS suspension. Retry at a bounded
      // rate, including while waiting for the very first usable fix.
      if (Date.now() - Math.max(this.lastUsableAt, this.lastStartAt) >= 30000)
        this.watchPosition();
      if (!this.wake && Date.now() - this.lastWakeAttempt >= 30000)
        void this.lockScreen();
    }, 1000);
  }
  start() {
    this.stop();
    this.enabled = true;
    this.suspended = document.hidden;
    this.lastUsableAt = 0;
    if (this.suspended) this.callbacks.suspend("hidden");
    else {
      this.watchPosition();
      void this.lockScreen();
    }
  }
  stop() {
    this.enabled = false;
    this.suspended = false;
    this.clearWatch();
    this.releaseScreen();
    this.callbacks.wakeStatus("");
  }
  receivedUsableFix() {
    this.lastUsableAt = Date.now();
  }
  dispose() {
    this.stop();
    clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("pagehide", this.pagehide);
    window.removeEventListener("pageshow", this.pageshow);
  }
  private clearWatch() {
    this.generation++;
    if (this.watch !== null) navigator.geolocation?.clearWatch(this.watch);
    this.watch = null;
  }
  private watchPosition() {
    this.clearWatch();
    const generation = this.generation;
    this.lastStartAt = Date.now();
    try {
      this.watch = navigator.geolocation.watchPosition(
        (position) => {
          if (this.enabled && !this.suspended && generation === this.generation)
            this.callbacks.position(position);
        },
        (error) => {
          if (this.enabled && !this.suspended && generation === this.generation)
            this.callbacks.error(error.code);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    } catch {
      this.callbacks.error(navigator.geolocation ? 2 : 1);
    }
  }
  private suspend(reason: TrackingInterruption["reason"]) {
    if (!this.enabled || this.suspended) return;
    this.suspended = true;
    // Synchronous checkpoint in this callback; pagehide may never arrive.
    this.callbacks.suspend(reason);
    this.clearWatch();
    this.releaseScreen();
    this.callbacks.wakeStatus(
      "Aplikace je skrytá. GPS na pozadí není zaručená.",
    );
  }
  private resume() {
    if (!this.enabled || !this.suspended || document.hidden) return;
    this.suspended = false;
    this.callbacks.resume();
    this.watchPosition();
    void this.lockScreen();
  }
  private visibility = () => {
    if (document.hidden) this.suspend("hidden");
    else this.resume();
  };
  private pagehide = () => this.suspend("pagehide");
  private pageshow = () => this.resume();

  private releaseScreen() {
    this.wakeGeneration++;
    this.wakePending = false;
    const lock = this.wake;
    this.wake = null;
    void lock?.release().catch(() => undefined);
  }
  private async lockScreen() {
    if (
      !this.enabled ||
      this.suspended ||
      document.hidden ||
      this.wakePending ||
      this.wake
    )
      return;
    this.lastWakeAttempt = Date.now();
    if (!("wakeLock" in navigator)) {
      this.callbacks.wakeStatus(
        "Telefon nepodporuje držení rozsvíceného displeje. Nastav delší automatické zamykání a nech aplikaci otevřenou.",
      );
      return;
    }
    const generation = this.wakeGeneration;
    this.wakePending = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (
        generation !== this.wakeGeneration ||
        !this.enabled ||
        this.suspended ||
        document.hidden
      ) {
        await lock.release();
        return;
      }
      this.wake = lock;
      const released = () => {
        if (this.wake !== lock) return;
        this.wake = null;
        this.callbacks.wakeStatus(
          "Držení displeje se přerušilo. Nezamykat telefon; GPS může vypadnout.",
        );
      };
      lock.addEventListener("release", released, { once: true });
      this.callbacks.wakeStatus(
        "Displej zůstává rozsvícený. Telefon ručně nezamykej.",
      );
      if (lock.released) released();
    } catch {
      if (generation === this.wakeGeneration)
        this.callbacks.wakeStatus(
          "Telefon nedovolil držet displej rozsvícený. Nastav delší automatické zamykání a nech aplikaci otevřenou.",
        );
    } finally {
      if (generation === this.wakeGeneration) this.wakePending = false;
    }
  }
}
