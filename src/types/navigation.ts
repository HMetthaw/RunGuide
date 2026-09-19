import type { Point } from "./models";

export interface SegmentProjection {
  point: Point;
  fraction: number;
}

export interface RouteMatch {
  segment: number;
  meters: number;
  deviation: number;
}

export interface NavigationTurn {
  index: number;
  direction: "left" | "right" | "back";
}
