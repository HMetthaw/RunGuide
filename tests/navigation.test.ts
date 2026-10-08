import { describe, expect, it } from "vitest";
import { Navigator } from "../src/domain/navigation";
import type { Fix, Point } from "../src/types/models";

const epoch = 1789580000000;
const point = (east: number, north: number): Point => ({
  lat: 50 + north / 111195,
  lng: 14 + east / (111195 * Math.cos((50 * Math.PI) / 180)),
});
const fix = (
  seconds: number,
  east: number,
  north: number,
  accuracy = 5,
): Fix => ({
  ...point(east, north),
  timestamp: epoch + seconds * 1000,
  accuracy,
  speed: null,
});
const update = (
  nav: Navigator,
  seconds: number,
  east: number,
  north: number,
  accuracy = 5,
) => nav.update(fix(seconds, east, north, accuracy), epoch + seconds * 1000);
const rightTurn = () =>
  new Navigator([point(0, 0), point(0, 100), point(200, 100)]);
const straight = () => new Navigator([point(0, 0), point(0, 500)]);

describe("spoken turn decisions", () => {
  it.each([
    [200, "doprava"],
    [-200, "doleva"],
  ])(
    "announces only once at the junction without a distance preview (%s)",
    (east, direction) => {
      const nav = new Navigator([point(0, 0), point(0, 100), point(east, 100)]);
      expect(update(nav, 0, 0, 0)).toBeNull();
      expect(update(nav, 15, 0, 40)).toBeNull();
      for (let t = 16; t < 25; t++) expect(update(nav, t, 0, 45)).toBeNull();
      expect(nav.hasPriority).toBe(false);
      expect(update(nav, 30, 0, 90)).toBe(`Odbočte ${direction}.`);
      for (let t = 31; t < 45; t++) expect(update(nav, t, 0, 90)).toBeNull();
      expect(update(nav, 46, Math.sign(east) * 30, 100)).toBeNull();
      expect(nav.next).toBe(2);
      expect(nav.hasPriority).toBe(false);
    },
  );

  it("joins the first segment even when initial GPS misses the start point", () => {
    const nav = rightTurn();
    expect(update(nav, 0, 0, 50)).toBeNull();
    expect(nav.next).toBe(1);
  });

  it("speaks on the first accurate fix just before a turn instead of consuming it silently", () => {
    const nav = rightTurn();
    expect(update(nav, 0, 0, 94, 80)).toBeNull();
    expect(nav.next).toBe(0);
    expect(update(nav, 1, 0, 94)).toBe("Odbočte doprava.");
    expect(update(nav, 2, 0, 94)).toBeNull();
  });

  it("matches segments after missed vertices and does not speak an already passed turn", () => {
    const nav = rightTurn();
    update(nav, 0, 0, 0);
    expect(update(nav, 45, 45, 100)).toBeNull();
    expect(nav.next).toBe(2);
    expect(update(nav, 46, 48, 100)).toBeNull();
  });

  it("supports long sparse segments without requiring arrival at the next vertex", () => {
    const nav = new Navigator([point(0, 0), point(0, 1000), point(200, 1000)]);
    update(nav, 0, 0, 0);
    expect(update(nav, 300, 0, 950)).toBeNull();
    expect(update(nav, 310, 0, 990)).toBe("Odbočte doprava.");
  });

  it("recovers on dense geometry beyond the normal lookahead after a long signal gap", () => {
    const points = Array.from({ length: 101 }, (_, i) => point(0, i * 10));
    points.push(point(200, 1000));
    const nav = new Navigator(points);
    update(nav, 0, 0, 0);
    expect(update(nav, 300, 0, 950)).toBeNull();
    expect(update(nav, 310, 0, 990)).toBe("Odbočte doprava.");
    expect(nav.next).toBeGreaterThan(90);
  });

  it("announces consecutive opposite turns without a long global cooldown", () => {
    const nav = new Navigator([
      point(0, 0),
      point(0, 100),
      point(25, 100),
      point(25, 200),
    ]);
    expect(update(nav, 0, 0, 94)).toBe("Odbočte doprava.");
    expect(update(nav, 5, 12, 100)).toBe("Odbočte doleva.");
  });

  it("ignores small geometry wiggles but recognizes a rounded corner", () => {
    const noisy = Array.from({ length: 50 }, (_, i) =>
      point(i % 2 ? 2 : -2, i * 5),
    );
    const nav = new Navigator(noisy);
    for (let t = 0; t <= 60; t++) expect(update(nav, t, 0, t * 3)).toBeNull();
    const rounded = new Navigator([
      point(0, 0),
      point(0, 80),
      point(2, 88),
      point(6, 94),
      point(12, 98),
      point(20, 100),
      point(200, 100),
    ]);
    expect(update(rounded, 0, 0, 40)).toBeNull();
    expect(update(rounded, 1, 0, 70)).toBe("Odbočte doprava.");
    expect(update(rounded, 2, 6, 94)).toBeNull();
  });

  it("keeps two distinct right-angle turns on a short connecting street", () => {
    const nav = new Navigator([
      point(0, 0),
      point(0, 100),
      point(25, 100),
      point(25, 0),
    ]);
    expect(update(nav, 0, 0, 94)).toBe("Odbočte doprava.");
    expect(update(nav, 5, 12, 100)).toBe("Odbočte doprava.");
  });

  it("preserves route order through a complete out-and-back route", () => {
    const outward = Array.from({ length: 101 }, (_, i) => point(0, i * 2));
    const nav = new Navigator([...outward, ...outward.slice(0, -1).reverse()]);
    const messages: string[] = [];
    for (let t = 0; t <= 100; t++) {
      const text = update(nav, t, 0, t <= 50 ? t * 4 : 400 - t * 4);
      if (t < 45) expect(nav.next).toBeLessThan(100);
      if (text) messages.push(text);
    }
    expect(messages.filter((text) => text.includes("Otočte"))).toHaveLength(1);
    expect(messages.filter((text) => text.includes("poslednímu"))).toHaveLength(
      1,
    );
    expect(messages.some((text) => text.includes("Opustili"))).toBe(false);
    expect(nav.next).toBe(outward.length * 2 - 1);
  });

  it("does not skip a loop at overlapping start/finish or a future crossing", () => {
    const nav = new Navigator([
      point(0, 0),
      point(0, 100),
      point(50, 100),
      point(50, 50),
      point(-50, 50),
      point(-50, 0),
      point(0, 0),
    ]);
    update(nav, 0, 0, 0);
    expect(nav.next).toBe(1);
    update(nav, 20, 2, 50);
    expect(nav.next).toBe(1);
  });

  it("restores the upcoming point and finishes only once", () => {
    const nav = rightTurn();
    nav.next = 2;
    expect(update(nav, 0, 50, 100)).toBeNull();
    expect(update(nav, 50, 199, 100)).toContain("poslednímu");
    expect(update(nav, 51, 200, 100)).toBeNull();
  });
});

describe("off-route confidence and recovery", () => {
  it("requires sustained deviation, speaks immediately after confirmation and repeats at most once a minute", () => {
    const nav = straight();
    update(nav, 0, 0, 0);
    expect(update(nav, 1, 55, 40)).toBeNull();
    expect(update(nav, 5, 55, 40)).toBe("Opustili jste trasu.");
    for (let t = 6; t < 65; t++) expect(update(nav, t, 55, 40)).toBeNull();
    expect(update(nav, 65, 55, 40)).toBe("Opustili jste trasu.");
    expect(nav.next).toBe(1);
  });

  it("ignores one outlier and does not count uncertain GPS as a deviation", () => {
    const nav = rightTurn();
    update(nav, 0, 0, 0);
    expect(update(nav, 1, -60, 40)).toBeNull();
    expect(update(nav, 2, 0, 20)).toBeNull();
    for (let t = 3; t < 15; t++) expect(update(nav, t, -50, 40, 25)).toBeNull();
    expect(update(nav, 15, 0, 45)).toBeNull();
    expect(update(nav, 25, 0, 90)).toBe("Odbočte doprava.");
  });

  it("confirms return inside a tighter corridor and detects a new departure", () => {
    const nav = straight();
    update(nav, 0, 0, 0);
    update(nav, 1, -60, 40);
    expect(update(nav, 5, -60, 40)).toBe("Opustili jste trasu.");
    for (let t = 6; t <= 10; t++) expect(update(nav, t, -30, 40)).toBeNull();
    expect(update(nav, 11, 0, 40)).toBeNull();
    expect(update(nav, 15, 0, 40)).toBe("Jste zpět na trase.");
    expect(update(nav, 16, 0, 40)).toBeNull();
    update(nav, 17, -60, 40);
    expect(update(nav, 21, -60, 40)).toBe("Opustili jste trasu.");
  });

  it("withholds turns off-route and waits for the junction after confirmed return", () => {
    const nav = rightTurn();
    update(nav, 0, 0, 0);
    update(nav, 1, -60, 50);
    expect(update(nav, 5, -60, 50)).toBe("Opustili jste trasu.");
    expect(update(nav, 6, 0, 50)).toBeNull();
    expect(update(nav, 10, 0, 50)).toBe("Jste zpět na trase.");
    expect(update(nav, 11, 0, 50)).toBeNull();
    expect(update(nav, 20, 0, 90)).toBe("Odbočte doprava.");
  });

  it("breaks confirmation across poor fixes, GPS gaps and explicit interruptions", () => {
    const nav = straight();
    update(nav, 0, -60, 40);
    update(nav, 3, -60, 40, 100);
    expect(update(nav, 5, -60, 40)).toBeNull();
    expect(update(nav, 30, -60, 40)).toBeNull();
    nav.resetConfidence();
    expect(update(nav, 34, -60, 40)).toBeNull();
    expect(update(nav, 38, -60, 40)).toBe("Opustili jste trasu.");
  });

  it("can warn before ever reaching the planned start", () => {
    const nav = straight();
    expect(update(nav, 0, -60, -50)).toBeNull();
    expect(update(nav, 4, -60, -50)).toBe("Opustili jste trasu.");
    expect(nav.next).toBe(0);
  });

  it("rejects invalid, old, future, duplicated and low-accuracy fixes without consuming turns", () => {
    const nav = rightTurn();
    expect(update(nav, 0, 0, 90, 26)).toBeNull();
    expect(update(nav, 1, 0, 90, NaN)).toBeNull();
    expect(nav.update(fix(2, 0, 90), epoch + 30000)).toBeNull();
    expect(nav.update(fix(30, 0, 90), epoch + 2000)).toBeNull();
    expect(nav.next).toBe(0);
    expect(update(nav, 3, 0, 90)).toBe("Odbočte doprava.");
    expect(nav.update(fix(3, -60, 40), epoch + 8000)).toBeNull();
    expect(update(nav, 4, 0, 90)).toBeNull();
  });
});
