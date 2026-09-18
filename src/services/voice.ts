export class VoiceGuide {
  enabled = true;
  private lastNavigationAt = -Infinity;
  private lastSpokenAt = -Infinity;
  constructor(private onText: (text: string) => void) {}
  get available() {
    return "speechSynthesis" in window;
  }
  speak(
    text: string,
    kind: "navigation" | "pace" | "status" | "test" = "status",
    now = Date.now(),
  ): boolean {
    if (
      kind === "pace" &&
      (now - this.lastNavigationAt < 20000 || now - this.lastSpokenAt < 10000)
    )
      return false;
    this.onText(text);
    if (kind === "navigation") this.lastNavigationAt = now;
    if (!this.enabled || !this.available) return true;
    const synth = window.speechSynthesis;
    if (kind === "pace" && synth.speaking) return false;
    if (kind !== "pace") synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "cs-CZ";
    utterance.rate = 1;
    const czech = synth
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("cs"));
    if (czech) utterance.voice = czech;
    utterance.onerror = () =>
      this.onText(`${text} (Zvuk se nepodařilo přehrát.)`);
    synth.speak(utterance);
    this.lastSpokenAt = now;
    return true;
  }
  cancel() {
    if (this.available) window.speechSynthesis.cancel();
  }
}
