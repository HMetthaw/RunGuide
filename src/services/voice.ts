export class VoiceGuide {
  enabled = true;
  selectedVoiceURI = "";
  private lastNavigationAt = -Infinity;
  private lastSpokenAt = -Infinity;
  constructor(private onText: (text: string) => void) {}
  get available() {
    return "speechSynthesis" in window;
  }
  get voices(): SpeechSynthesisVoice[] {
    return this.available
      ? window.speechSynthesis
          .getVoices()
          .filter((voice) => /^cs(?:[-_]|$)/i.test(voice.lang))
      : [];
  }
  speak(
    text: string,
    kind: "navigation" | "pace" | "status" | "test" = "status",
    now = Date.now(),
    onText = this.onText,
  ): boolean {
    if (
      kind === "pace" &&
      (now - this.lastNavigationAt < 20000 || now - this.lastSpokenAt < 10000)
    )
      return false;
    onText(text);
    if (kind === "navigation") this.lastNavigationAt = now;
    if ((!this.enabled && kind !== "test") || !this.available) return true;
    const synth = window.speechSynthesis;
    if (kind === "pace" && synth.speaking) return false;
    if (kind !== "pace") synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "cs-CZ";
    utterance.rate = 1;
    const voices = this.voices;
    const czech =
      voices.find((voice) => voice.voiceURI === this.selectedVoiceURI) ??
      voices.find((voice) => voice.default) ??
      voices[0];
    if (czech) utterance.voice = czech;
    utterance.onerror = () => onText(`${text} (Zvuk se nepodařilo přehrát.)`);
    synth.speak(utterance);
    this.lastSpokenAt = now;
    return true;
  }
  cancel() {
    if (this.available) window.speechSynthesis.cancel();
  }
}
