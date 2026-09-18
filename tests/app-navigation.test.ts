// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { setupAppNavigation } from "../src/services/app-navigation";

it("opens five independent pages, preserves the planner DOM, supports back and returns Start to an active run", () => {
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  history.replaceState(null, "", "/");
  let running = false;
  const resize = vi.fn();
  const router = setupAppNavigation(resize, () => running);
  const map = document.getElementById("map");
  expect(document.body.dataset.page).toBe("overview");
  expect(
    document.querySelectorAll(".app-page[data-page]:not([hidden])"),
  ).toHaveLength(1);
  router.navigate("start");
  expect(document.body.dataset.step).toBe("route");
  expect(resize).toHaveBeenCalledOnce();
  (document.getElementById("goal-distance") as HTMLInputElement).value = "12";
  router.navigate("profile");
  expect(document.body.hidden).toBe(false);
  router.navigate("goal");
  expect(document.getElementById("map")).toBe(map);
  expect(
    (document.getElementById("goal-distance") as HTMLInputElement).value,
  ).toBe("12");
  expect(
    document.querySelector('[data-nav="start"]')?.getAttribute("aria-current"),
  ).toBe("page");
  history.replaceState(null, "", "#history");
  window.dispatchEvent(new PopStateEvent("popstate"));
  expect(document.body.dataset.page).toBe("history");
  running = true;
  router.navigate("start");
  expect(document.body.dataset.step).toBe("run");
  router.navigate("menu");
  expect(
    document.querySelectorAll(".app-page[data-page]:not([hidden])"),
  ).toHaveLength(1);
  expect(document.body.dataset.page).toBe("menu");
});
