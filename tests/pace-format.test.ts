import { describe, expect, it } from "vitest";
import { formatPace, formatSpokenPace } from "../src/domain/pace";

describe("spoken Czech pace", () => {
  it.each([
    [495, "8 minut 15 sekund na kilometr"],
    [480, "8 minut 0 sekund na kilometr"],
    [61, "1 minuta 1 sekunda na kilometr"],
    [122, "2 minuty 2 sekundy na kilometr"],
    [183, "3 minuty 3 sekundy na kilometr"],
    [244, "4 minuty 4 sekundy na kilometr"],
    [305, "5 minut 5 sekund na kilometr"],
    [671, "11 minut 11 sekund na kilometr"],
    [732, "12 minut 12 sekund na kilometr"],
    [854, "14 minut 14 sekund na kilometr"],
    [1281, "21 minut 21 sekund na kilometr"],
    [1342, "22 minut 22 sekund na kilometr"],
    [1464, "24 minut 24 sekund na kilometr"],
    [3601, "60 minut 1 sekunda na kilometr"],
  ])(
    "speaks %s seconds per kilometer with explicit units",
    (pace, expected) => {
      expect(formatSpokenPace(pace)).toBe(expected);
    },
  );

  it.each([
    [0.1, "0:00", "0 minut 0 sekund na kilometr"],
    [0.5, "0:01", "0 minut 1 sekunda na kilometr"],
    [59.49, "0:59", "0 minut 59 sekund na kilometr"],
    [59.5, "1:00", "1 minuta 0 sekund na kilometr"],
    [481.49, "8:01", "8 minut 1 sekunda na kilometr"],
    [481.5, "8:02", "8 minut 2 sekundy na kilometr"],
    [539.49, "8:59", "8 minut 59 sekund na kilometr"],
    [539.5, "9:00", "9 minut 0 sekund na kilometr"],
    [539.99, "9:00", "9 minut 0 sekund na kilometr"],
    [3599.5, "60:00", "60 minut 0 sekund na kilometr"],
  ])("rounds %s consistently for screen and speech", (pace, screen, spoken) => {
    expect(formatPace(pace)).toBe(screen);
    expect(formatSpokenPace(pace)).toBe(spoken);
  });

  it.each([null, NaN, Infinity, -Infinity, 0, -1])(
    "does not announce invalid pace %s as a time",
    (pace) => {
      expect(formatSpokenPace(pace)).toBe("není k dispozici");
      expect(formatPace(pace)).toBe("—");
    },
  );
});
