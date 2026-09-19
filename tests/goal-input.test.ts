import { describe, expect, it } from "vitest";
import { parseDecimalInput, parseGoalInput } from "../src/domain/goal-input";
import {
  formatPace,
  formatTime,
  remainingTime,
  targetPace,
} from "../src/domain/pace";

describe("decimal goal input", () => {
  it.each([
    ["27,5", 27.5],
    ["27.5", 27.5],
    ["5,5", 5.5],
    ["5.55", 5.55],
    ["5,555", 5.555],
    [" 27,50 ", 27.5],
    [",5", 0.5],
    [".5", 0.5],
    ["0", 0],
    ["30", 30],
  ])("parses %s without rounding", (raw, expected) => {
    expect(parseDecimalInput(raw)).toBe(expected);
  });

  it.each([
    "",
    " ",
    ",",
    ".",
    "27,",
    "27.",
    "27,5.0",
    "5,,5",
    "5..5",
    "5 55",
    "5,5 km",
    "27:30",
    "1e2",
    "0x10",
    "Infinity",
    "NaN",
    "-5",
    "+5",
    "9".repeat(400),
  ])("rejects malformed input %s without reading only its prefix", (raw) => {
    expect(parseDecimalInput(raw)).toBeNull();
  });

  it.each([
    ["0,1", "1"],
    ["100", "1440"],
    ["5,55", "27,5"],
    ["5.555", "27.25"],
  ])("accepts a goal of %s km in %s minutes", (distance, minutes) => {
    expect(parseGoalInput(distance, minutes).success).toBe(true);
  });

  it.each([
    ["0", "30"],
    ["0,09", "30"],
    ["100,01", "30"],
    ["5", "0,99"],
    ["5", "1440,01"],
    ["", "30"],
    ["5", ""],
    ["5,5km", "27,5"],
    ["5,5", "27,5min"],
  ])("rejects an invalid goal of %s km in %s minutes", (distance, minutes) => {
    expect(parseGoalInput(distance, minutes).success).toBe(false);
  });
});

describe("fractional goal calculations", () => {
  it("counts half a minute as 30 seconds and computes pace from the full value", () => {
    const parsed = parseGoalInput("5,5", "27,5");
    if (!parsed.success) throw parsed.error;
    expect(parsed.data).toEqual({ distanceKm: 5.5, durationMinutes: 27.5 });
    expect(targetPace(parsed.data)).toBe(300);
    expect(formatPace(targetPace(parsed.data))).toBe("5:00");
    const remaining = remainingTime(parsed.data, 0, 0);
    expect(remaining.remainingSeconds).toBe(1650);
    expect(formatTime(remaining.remainingSeconds)).toBe("27:30");
    expect(remainingTime(parsed.data, 5500, 1650)).toEqual({
      remainingMeters: 0,
      remainingSeconds: 0,
      requiredPace: null,
    });
  });

  it("keeps hundredths of a kilometre for pace and remaining distance", () => {
    const parsed = parseGoalInput("5.55", "27.5");
    if (!parsed.success) throw parsed.error;
    expect(targetPace(parsed.data)).toBeCloseTo(297.297297);
    expect(formatPace(targetPace(parsed.data))).toBe("4:57");
    expect(remainingTime(parsed.data, 5000, 1500)).toEqual({
      remainingMeters: 550,
      remainingSeconds: 150,
      requiredPace: 150000 / 550,
    });
  });
});
