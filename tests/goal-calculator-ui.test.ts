// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { targetPace } from "../src/domain/pace";
import { setupGoalCalculator } from "../src/services/goal-calculator";

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
function edit(id: string, value: string) {
  field(id).value = value;
  field(id).dispatchEvent(new Event("input", { bubbles: true }));
}
function editPace(minutes: string, seconds: string) {
  edit("goal-pace-minutes", minutes);
  edit("goal-pace-seconds", seconds);
}

beforeEach(() => {
  document.documentElement.innerHTML = readFileSync("runner.html", "utf8");
});

describe("goal calculator interface", () => {
  it("recalculates immediately in both directions with an explicit fixed-time distance rule", () => {
    const onChange = vi.fn();
    const calculator = setupGoalCalculator(onChange);
    edit("goal-distance", "5.55");
    editPace("5", "50");
    expect(calculator.readGoal()).toEqual({
      distanceKm: 5.55,
      durationMinutes: 32.375,
    });
    expect(field("goal-time").value).toBe("32.375");
    expect(onChange).toHaveBeenCalledTimes(3);

    edit("goal-time", "27.5");
    expect(calculator.readGoal()).toEqual({
      distanceKm: 5.55,
      durationMinutes: 27.5,
    });
    expect(field("goal-pace-minutes").value).toBe("4");
    expect(field("goal-pace-seconds").value).toBe("57");
    edit("goal-distance", "5");
    expect(calculator.readGoal()).toEqual({
      distanceKm: 5,
      durationMinutes: 27.5,
    });
    expect(field("goal-pace-minutes").value).toBe("5");
    expect(field("goal-pace-seconds").value).toBe("30");
    expect(document.getElementById("goal-rule")!.textContent).toContain(
      "zachováme čas",
    );
  });

  it("keeps precise calculated time through repeated reads, focus, blur and distance changes", () => {
    const calculator = setupGoalCalculator(vi.fn());
    edit("goal-distance", "2");
    editPace("5", "50");
    expect(field("goal-time").value).toBe("11.666667");
    for (let i = 0; i < 20; i++) {
      field("goal-time").focus();
      field("goal-time").blur();
      field("goal-pace-seconds").focus();
      field("goal-pace-seconds").blur();
      edit("goal-distance", "3");
      expect(calculator.readGoal()!.durationMinutes).toBe(700 / 60);
      calculator.setDistance(2);
      expect(targetPace(calculator.readGoal()!)).toBe(350);
    }
    // An explicit time edit adopts that value, even if it matches the display.
    edit("goal-time", "11.666667");
    expect(calculator.readGoal()!.durationMinutes).toBe(11.666667);
  });

  it("does not turn a rounded 6:00 display into a different stored target", () => {
    const calculator = setupGoalCalculator(vi.fn());
    const goal = { distanceKm: 5.55, durationMinutes: 33.299 };
    calculator.setGoal(goal);
    expect(field("goal-pace-minutes").value).toBe("6");
    expect(field("goal-pace-seconds").value).toBe("00");
    field("goal-pace-seconds").dispatchEvent(new Event("blur"));
    expect(calculator.readGoal()).toEqual(goal);
  });

  it.each(["", "60", "99", "-1", "1.5", "1,5", "abc", "1e1", "000"])(
    "keeps invalid seconds %s visible and refuses a stale valid goal until corrected",
    (seconds) => {
      const calculator = setupGoalCalculator(vi.fn());
      edit("goal-pace-seconds", seconds);
      expect(calculator.readGoal()).toBeNull();
      expect(field("goal-pace-seconds").value).toBe(seconds);
      expect(field("goal-pace-seconds").getAttribute("aria-invalid")).toBe(
        "true",
      );
      expect(document.getElementById("goal-error")!.textContent).toContain(
        "00–59",
      );
      expect(field("goal-time").value).toBe("30");
      edit("goal-pace-seconds", "59");
      expect(targetPace(calculator.readGoal()!)).toBeCloseTo(419, 12);
      expect(document.getElementById("goal-error")!.textContent).toBe("");
    },
  );

  it("accepts 00 and 59 seconds, pads a single digit on blur and rejects 0:00", () => {
    const calculator = setupGoalCalculator(vi.fn());
    editPace("5", "00");
    expect(calculator.readGoal()!.durationMinutes).toBe(25);
    editPace("0", "00");
    expect(calculator.readGoal()).toBeNull();
    editPace("0", "59");
    expect(targetPace(calculator.readGoal()!)).toBe(59);
    editPace("5", "9");
    field("goal-pace-seconds").dispatchEvent(new Event("blur"));
    expect(field("goal-pace-seconds").value).toBe("09");
    expect(targetPace(calculator.readGoal()!)).toBe(309);
  });

  it("enforces goal bounds on calculated durations and recovers after invalid distance/time", () => {
    const calculator = setupGoalCalculator(vi.fn());
    editPace("0", "01");
    expect(calculator.readGoal()).toBeNull();
    expect(field("goal-time").getAttribute("aria-invalid")).toBe("true");
    editPace("300", "00");
    expect(calculator.readGoal()).toBeNull();
    expect(field("goal-time").value).toBe("1500");
    editPace("5", "00");
    expect(calculator.readGoal()!.durationMinutes).toBe(25);
    edit("goal-distance", "");
    expect(calculator.readGoal()).toBeNull();
    expect(field("goal-pace-minutes").value).toBe("");
    edit("goal-distance", "5");
    expect(field("goal-pace-minutes").value).toBe("5");
    edit("goal-time", "0");
    expect(calculator.readGoal()).toBeNull();
    edit("goal-time", "27.5");
    expect(field("goal-pace-seconds").value).toBe("30");
  });

  it("resets invalid pace and previous precise values when loading a saved goal", () => {
    const calculator = setupGoalCalculator(vi.fn());
    calculator.setDistance(2);
    editPace("5", "50");
    edit("goal-pace-seconds", "60");
    const stored = { distanceKm: 2, durationMinutes: 11.666667 };
    calculator.setGoal(stored);
    expect(calculator.readGoal()).toEqual(stored);
    expect(field("goal-pace-seconds").value).toBe("50");
    expect(document.getElementById("goal-error")!.textContent).toBe("");
  });
});
