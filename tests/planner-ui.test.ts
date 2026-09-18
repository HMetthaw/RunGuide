// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { setupPlannerInterface } from "../src/services/planner-ui";

it("expands the existing map without losing its DOM, then restores it and keyboard focus on close", () => {
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
  const dialog = document.getElementById("map-dialog") as HTMLDialogElement;
  const toggle = document.getElementById("expand-map") as HTMLButtonElement;
  const stage = document.getElementById("map-stage")!;
  const map = document.getElementById("map")!;
  const parent = stage.parentElement;
  const resize = vi.fn();
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new Event("close"));
  };
  setupPlannerInterface(resize);
  toggle.click();
  expect(dialog.open).toBe(true);
  expect(dialog.contains(map)).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(toggle);
  toggle.click();
  expect(stage.parentElement).toBe(parent);
  expect(document.getElementById("map")).toBe(map);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
  expect(document.body.classList.contains("map-expanded")).toBe(false);
  expect(resize).toHaveBeenCalledTimes(2);
});
