// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setupTheme } from "../src/services/theme";

let darkSystem = false;
let system: EventTarget;
let cleanup: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#172c45">';
  document.body.innerHTML =
    '<button id="theme-toggle" aria-label="Tmavý režim"></button>';
  darkSystem = false;
  system = new EventTarget();
  Object.defineProperty(system, "matches", { get: () => darkSystem });
  vi.stubGlobal("matchMedia", () => system);
});
afterEach(() => {
  cleanup?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const toggle = () => document.getElementById("theme-toggle")!;
const theme = () => document.documentElement.dataset.theme;

it("follows system changes until the user chooses, then restores that choice on reload", () => {
  cleanup = setupTheme();
  expect(theme()).toBe("light");
  darkSystem = true;
  system.dispatchEvent(new Event("change"));
  expect(theme()).toBe("dark");
  toggle().click();
  expect(theme()).toBe("light");
  expect(localStorage.getItem("runguide.theme")).toBe("light");
  system.dispatchEvent(new Event("change"));
  expect(theme()).toBe("light");
  cleanup?.();
  cleanup = setupTheme();
  expect(theme()).toBe("light");
});

it("restores saved dark mode with accessible state and dark browser chrome", () => {
  localStorage.setItem("runguide.theme", "dark");
  cleanup = setupTheme();
  expect(theme()).toBe("dark");
  expect(toggle().getAttribute("aria-pressed")).toBe("true");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(
    document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
  ).toBe("#101922");
});

it("keeps toggling when storage is unavailable without disrupting the app", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  cleanup = setupTheme();
  toggle().click();
  expect(theme()).toBe("dark");
  toggle().click();
  expect(theme()).toBe("light");
});
