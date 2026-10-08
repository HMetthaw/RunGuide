// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import {
  PACE_SETTINGS_KEY,
  setupPaceSettings,
} from "../src/services/pace-settings";
import { DEFAULT_PACE_SETTINGS } from "../src/types/pace-settings";

const control = (id: string) => document.getElementById(id) as HTMLInputElement;
function page() {
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
}
function interval(channel: string, value: string) {
  const input = control(`pace-${channel}-interval`);
  input.value = value;
  input.dispatchEvent(new Event("change"));
}

it("saves and restores both switches and independent custom intervals", () => {
  page();
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const changed = vi.fn();
  setupPaceSettings(storage, changed);
  expect(control("pace-average-interval").disabled).toBe(true);
  interval("current", "45");
  control("pace-average-enabled").click();
  interval("average", "150");
  const expected = {
    current: { enabled: true, intervalSeconds: 45 },
    average: { enabled: true, intervalSeconds: 150 },
  };
  expect(changed.mock.lastCall?.[0]).toEqual(expected);
  expect(JSON.parse(data.get(PACE_SETTINGS_KEY)!)).toEqual(expected);
  page();
  setupPaceSettings(storage, changed);
  expect(control("pace-current-interval").value).toBe("45");
  expect(control("pace-average-interval").value).toBe("150");
  expect(control("pace-average-enabled").checked).toBe(true);
  control("pace-current-enabled").click();
  expect(changed.mock.lastCall?.[0].current.enabled).toBe(false);
  expect(changed.mock.lastCall?.[0].average).toEqual(expected.average);
});

it("rejects invalid intervals and remains usable when storage fails", () => {
  page();
  const changed = vi.fn();
  setupPaceSettings(
    {
      getItem: () => "{bad JSON",
      setItem: () => {
        throw new Error("quota");
      },
    },
    changed,
  );
  expect(changed.mock.lastCall?.[0]).toEqual(DEFAULT_PACE_SETTINGS);
  for (const value of ["", "0", "14", "3601", "60.5"])
    interval("current", value);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(control("pace-current-interval").getAttribute("aria-invalid")).toBe(
    "true",
  );
  interval("current", "180");
  expect(changed.mock.lastCall?.[0].current.intervalSeconds).toBe(180);
  expect(control("pace-current-interval").validationMessage).toBe("");
  expect(
    document.getElementById("pace-settings-status")!.textContent,
  ).toContain("nepodařilo uložit");
});
