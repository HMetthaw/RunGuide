// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { VoiceGuide } from "../src/services/voice";
afterEach(() => vi.unstubAllGlobals());
function speech() {
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: () => [{ lang: "cs-CZ", name: "Test voice" }],
    speaking: false,
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  return synth;
}
it("preserves navigation priority when pace advice arrives immediately after it", () => {
  const synth = speech(),
    text = vi.fn(),
    voice = new VoiceGuide(text);
  voice.speak("Odboč doprava.", "navigation", 100000);
  expect(voice.speak("Přidej.", "pace", 105000)).toBe(false);
  expect(synth.speak).toHaveBeenCalledTimes(1);
  expect(text).toHaveBeenLastCalledWith("Odboč doprava.");
});
it("shows muted instructions without playing audio", () => {
  const synth = speech(),
    text = vi.fn(),
    voice = new VoiceGuide(text);
  voice.enabled = false;
  voice.speak("Pokračuj rovně.", "navigation");
  expect(text).toHaveBeenCalledWith("Pokračuj rovně.");
  expect(synth.speak).not.toHaveBeenCalled();
});
