// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { VoiceGuide } from "../src/services/voice";
import { setupVoiceSettings } from "../src/services/voice-settings";

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  vi.unstubAllGlobals();
});
function speech() {
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  let voices: SpeechSynthesisVoice[] = [];
  const synth = Object.assign(new EventTarget(), {
    getVoices: () => voices,
    speak: vi.fn(),
    cancel: vi.fn(),
    speaking: false,
  });
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  return {
    synth,
    load: (next: SpeechSynthesisVoice[]) => {
      voices = next;
      synth.dispatchEvent(new Event("voiceschanged"));
    },
  };
}
const czech: SpeechSynthesisVoice = {
  voiceURI: "cz-one",
  name: "Český hlas",
  lang: "cs-CZ",
  default: true,
  localService: true,
};
const premium: SpeechSynthesisVoice = {
  ...czech,
  voiceURI: "cz-two",
  name: "Druhý český hlas",
  default: false,
};

it("restores a late-loading voice, filters Czech choices and uses it for preview and run instructions", () => {
  const { synth, load } = speech();
  const data = new Map([["runguide.voice-uri", premium.voiceURI]]);
  const voice = new VoiceGuide(vi.fn());
  cleanup = setupVoiceSettings(voice, {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  const select = document.getElementById("voice-select") as HTMLSelectElement;
  expect(select.value).toBe(premium.voiceURI);
  load([czech, premium, { ...czech, voiceURI: "en", lang: "en-US" }]);
  expect(select.options).toHaveLength(3);
  expect(select.value).toBe(premium.voiceURI);
  voice.enabled = false;
  document.getElementById("test-voice")!.click();
  expect(synth.speak.mock.lastCall?.[0].voice).toBe(premium);
  expect(voice.enabled).toBe(false);
  voice.enabled = true;
  voice.speak("Pokračuj.", "navigation");
  expect(synth.speak.mock.lastCall?.[0].voice).toBe(premium);
  select.value = czech.voiceURI;
  select.dispatchEvent(new Event("change"));
  expect(data.get("runguide.voice-uri")).toBe(czech.voiceURI);
});

it("falls back when a selected voice disappears and uses it again when it returns", () => {
  const { synth, load } = speech();
  const voice = new VoiceGuide(vi.fn());
  cleanup = setupVoiceSettings(voice, {
    getItem: () => premium.voiceURI,
    setItem: vi.fn(),
  });
  load([czech]);
  voice.speak("Test", "test");
  expect(synth.speak.mock.lastCall?.[0].voice).toBe(czech);
  expect(voice.selectedVoiceURI).toBe(premium.voiceURI);
  load([czech, premium]);
  voice.speak("Test", "test");
  expect(synth.speak.mock.lastCall?.[0].voice).toBe(premium);
});

it("keeps selection usable on storage failure and shows preview errors in the menu", () => {
  const { synth, load } = speech();
  const voice = new VoiceGuide(vi.fn());
  cleanup = setupVoiceSettings(voice, {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  });
  load([czech]);
  const select = document.getElementById("voice-select") as HTMLSelectElement;
  select.value = czech.voiceURI;
  select.dispatchEvent(new Event("change"));
  expect(voice.selectedVoiceURI).toBe(czech.voiceURI);
  expect(
    document.getElementById("voice-preview-status")?.textContent,
  ).toContain("nepodařilo uložit");
  document.getElementById("test-voice")!.click();
  synth.speak.mock.lastCall?.[0].onerror();
  expect(
    document.getElementById("voice-preview-status")?.textContent,
  ).toContain("Zvuk se nepodařilo přehrát");
});
