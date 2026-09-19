import { describe, expect, it } from "vitest";
import {
  durationMinutesAtPace,
  parsePaceInput,
} from "../src/domain/goal-calculator";
import { targetPace } from "../src/domain/pace";

describe("target pace calculator", () => {
  it.each([
    ["5", "50", 350],
    ["6", "00", 360],
    ["4", "59", 299],
    ["0", "01", 1],
    ["05", "9", 309],
  ])("reads %s:%s as seconds per kilometre", (minutes, seconds, expected) => {
    expect(parsePaceInput(minutes, seconds)).toBe(expected);
  });

  it.each([
    ["5", "60"],
    ["5", "-1"],
    ["5", "1.5"],
    ["5", "1,5"],
    ["5", "000"],
    ["5", "1e1"],
    ["5", ""],
    ["", "30"],
    ["-5", "30"],
    ["5.5", "30"],
    ["5,5", "30"],
    ["1e1", "30"],
    [" 5", "30"],
    ["Infinity", "30"],
    ["9007199254740991", "30"],
    ["0", "00"],
  ])("rejects malformed or zero pace %s:%s", (minutes, seconds) => {
    expect(parsePaceInput(minutes, seconds)).toBeNull();
  });

  it("calculates fractional route lengths and minutes without rounding the result", () => {
    expect(durationMinutesAtPace(5.55, 350)).toBe(32.375);
    expect(durationMinutesAtPace(2, 350)).toBe(700 / 60);
    const goal = { distanceKm: 5.55, durationMinutes: 27.5 };
    expect(targetPace(goal)).toBeCloseTo(297.2972972972973, 12);
    expect(
      durationMinutesAtPace(goal.distanceKm, targetPace(goal)),
    ).toBeCloseTo(goal.durationMinutes, 12);
  });

  it.each([
    [0, 350],
    [-1, 350],
    [NaN, 350],
    [Infinity, 350],
    [5, 0],
    [5, -350],
    [5, NaN],
    [5, Infinity],
    [Number.MAX_VALUE, Number.MAX_VALUE],
  ])("rejects unusable distance %s or pace %s", (distance, pace) => {
    expect(durationMinutesAtPace(distance, pace)).toBeNull();
  });
});
