import { expect, it } from "vitest";
import { routeGoalDistance } from "../src/domain/goal-distance";

it.each([
  [5550, 5.55],
  [588, 0.588],
  [7025.4, 7.0254],
  [100, 0.1],
  [100000, 100],
])("preserves route length %s m as %s km", (meters, kilometers) => {
  expect(routeGoalDistance(meters)).toBe(kilometers);
});

it.each([0, 99, -5550, 100001, NaN, Infinity])(
  "does not turn an unsupported route length %s into a valid goal",
  (meters) => {
    expect(routeGoalDistance(meters)).toBeNull();
  },
);
