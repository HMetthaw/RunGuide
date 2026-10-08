import {
  DEFAULT_PACE_SETTINGS,
  paceIntervalSchema,
  paceSettingsSchema,
  type PaceSettings,
} from "../types/pace-settings";
import type { StoragePort } from "./storage";

export const PACE_SETTINGS_KEY = "runguide.pace-settings";

export function setupPaceSettings(
  storage: StoragePort,
  onChange: (settings: PaceSettings) => void,
) {
  let settings = structuredClone(DEFAULT_PACE_SETTINGS);
  try {
    const raw = storage.getItem(PACE_SETTINGS_KEY);
    if (raw) {
      const parsed = paceSettingsSchema.safeParse(JSON.parse(raw));
      if (parsed.success) settings = parsed.data;
    }
  } catch {
    /* Settings remain usable for this session. */
  }

  const status = document.getElementById("pace-settings-status")!;
  for (const channel of ["current", "average"] as const) {
    const enabled = document.getElementById(
      `pace-${channel}-enabled`,
    ) as HTMLInputElement;
    const interval = document.getElementById(
      `pace-${channel}-interval`,
    ) as HTMLInputElement;
    const error = document.getElementById(`pace-${channel}-error`)!;
    enabled.checked = settings[channel].enabled;
    interval.value = String(settings[channel].intervalSeconds);
    interval.disabled = !enabled.checked;

    const change = () => {
      const parsed = paceIntervalSchema.safeParse(interval.valueAsNumber);
      const message =
        parsed.success || !enabled.checked
          ? ""
          : "Zadej celé číslo od 15 do 3 600 sekund.";
      interval.setCustomValidity(message);
      interval.setAttribute("aria-invalid", String(!!message));
      error.textContent = message;
      interval.disabled = !enabled.checked;
      if (message) return;
      settings = {
        ...settings,
        [channel]: {
          enabled: enabled.checked,
          intervalSeconds: parsed.success
            ? parsed.data
            : settings[channel].intervalSeconds,
        },
      };
      if (!parsed.success)
        interval.value = String(settings[channel].intervalSeconds);
      onChange(structuredClone(settings));
      try {
        storage.setItem(PACE_SETTINGS_KEY, JSON.stringify(settings));
        status.textContent =
          "Nastavení uložené. Platí i pro právě probíhající běh.";
      } catch {
        status.textContent =
          "Nastavení platí pro tuto návštěvu. Do zařízení se ho nepodařilo uložit.";
      }
    };
    enabled.addEventListener("change", change);
    interval.addEventListener("change", change);
  }
  onChange(structuredClone(settings));
}
