// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { VoiceGuide } from "../src/services/voice";
afterEach(() => vi.unstubAllGlobals());
function speech() {
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn<(utterance: SpeechSynthesisUtterance) => void>(),
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
it("interrupts pace for Czech navigation and ignores late errors from canceled speech", () => {
  const synth = speech();
  const text = vi.fn();
  const voice = new VoiceGuide(text);
  voice.speak("Zpomal.", "pace", 100000);
  const pace = synth.speak.mock.calls[0][0];
  synth.speaking = true;
  voice.speak("Odbočte doprava.", "navigation", 101000);
  expect(synth.cancel).toHaveBeenCalledTimes(1);
  const navigation = synth.speak.mock.calls[1][0];
  expect(navigation.lang).toBe("cs-CZ");
  expect(navigation.text).toBe("Odbočte doprava.");
  pace.onerror?.call(pace, new Event("error") as SpeechSynthesisErrorEvent);
  expect(text).toHaveBeenLastCalledWith("Odbočte doprava.");
  expect(voice.speak("Zrychli.", "pace", 130000)).toBe(false);
  expect(text).toHaveBeenLastCalledWith("Odbočte doprava.");
  synth.speaking = false;
  expect(voice.speak("Zrychli.", "pace", 131000)).toBe(true);
});

it("keeps the latest instruction visible when synthesis is unavailable", () => {
  const text = vi.fn();
  const voice = new VoiceGuide(text);
  expect(voice.available).toBe(false);
  expect(voice.speak("Opustili jste trasu.", "navigation", 100000)).toBe(true);
  expect(text).toHaveBeenLastCalledWith("Opustili jste trasu.");
  expect(voice.speak("Přidej.", "pace", 101000)).toBe(false);
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
