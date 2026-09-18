// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { setupDashboard } from "../src/services/dashboard";

it("saves a profile for its owner, renders names as text and resets when identity changes", () => {
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  const data = new Map<string, string>();
  let owner = "device";
  const dashboard = setupDashboard(
    {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        data.set(key, value);
      },
    },
    () => [],
    () => owner,
  );
  (document.getElementById("profile-name") as HTMLInputElement).value =
    "<b>Matěj</b>";
  (document.getElementById("profile-weekly") as HTMLInputElement).value = "20";
  document
    .getElementById("profile-form")!
    .dispatchEvent(new Event("submit", { cancelable: true }));
  expect(document.getElementById("overview-greeting")?.textContent).toBe(
    "Ahoj, <b>Matěj</b>.",
  );
  expect(document.querySelector("#overview-greeting b")).toBeNull();
  expect(
    document.getElementById("weekly-progress-copy")?.textContent,
  ).toContain("20 km");
  owner = "another-account";
  dashboard.loadProfile();
  expect(
    (document.getElementById("profile-name") as HTMLInputElement).value,
  ).toBe("");
  owner = "device";
  dashboard.loadProfile();
  expect(
    (document.getElementById("profile-name") as HTMLInputElement).value,
  ).toBe("<b>Matěj</b>");
});
