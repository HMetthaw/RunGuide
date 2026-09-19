import type { StoragePort } from "./storage";
import type { VoiceGuide } from "./voice";

export function setupVoiceSettings(voice: VoiceGuide, storage: StoragePort) {
  const select = document.getElementById("voice-select") as HTMLSelectElement;
  const preview = document.getElementById("test-voice") as HTMLButtonElement;
  const status = document.getElementById("voice-support")!;
  const feedback = document.getElementById("voice-preview-status")!;
  try {
    voice.selectedVoiceURI = storage.getItem("runguide.voice-uri") || "";
  } catch {
    /* The choice can still be used for this session. */
  }

  function refresh() {
    const voices = voice.voices;
    select.replaceChildren(new Option("Automaticky · český hlas telefonu", ""));
    voices.forEach((item) =>
      select.add(
        new Option(
          `${item.name}${item.localService ? " · v zařízení" : " · online"}`,
          item.voiceURI,
        ),
      ),
    );
    const missing =
      !!voice.selectedVoiceURI &&
      !voices.some((item) => item.voiceURI === voice.selectedVoiceURI);
    if (missing) {
      const option = new Option(
        "Uložený hlas nyní není dostupný",
        voice.selectedVoiceURI,
      );
      option.disabled = true;
      select.add(option);
    }
    select.value = voice.selectedVoiceURI;
    select.disabled = !voice.available;
    preview.disabled = !voice.available;
    status.textContent = !voice.available
      ? "Tento prohlížeč nemá hlasový výstup. Pokyny uvidíš na displeji."
      : missing
        ? "Dočasně použijeme automatický český hlas. Původní volba zůstává uložená."
        : !voices.length
          ? "Prohlížeč zatím nenabídl žádný konkrétní český hlas. Ukázka zkusí automatickou češtinu; seznam se doplní po načtení hlasů."
          : "Vyber hlas a poslechni si ukázku se sluchátky. Nabídku určuje tvůj telefon a prohlížeč. Online hlas může potřebovat internet.";
  }
  function change() {
    voice.selectedVoiceURI = select.value;
    try {
      storage.setItem("runguide.voice-uri", select.value);
      feedback.textContent = "Hlas uložený. Použije se od dalšího pokynu.";
    } catch {
      feedback.textContent =
        "Hlas je vybraný pro tuto návštěvu. Volbu se nepodařilo uložit do zařízení.";
    }
    refresh();
  }
  function test() {
    voice.speak(
      "Ahoj, tady RunGuide. Držíš cílové tempo. Za padesát metrů pokračuj doprava.",
      "test",
      Date.now(),
      (message) => {
        feedback.textContent = message;
      },
    );
  }
  select.addEventListener("change", change);
  preview.addEventListener("click", test);
  if (voice.available)
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
  refresh();
  return () => {
    select.removeEventListener("change", change);
    preview.removeEventListener("click", test);
    if (voice.available)
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  };
}
