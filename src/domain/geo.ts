import type { Point, TracePoint } from "../types/models";
import type { SegmentProjection } from "../types/navigation";
const radians = (degrees: number) => (degrees * Math.PI) / 180;
export function distance(a: Point, b: Point): number {
  const h =
    Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export const routeDistance = (points: Point[]): number =>
  points
    .slice(1)
    .reduce((total, point, index) => total + distance(points[index], point), 0);
export function bearing(a: Point, b: Point): number {
  const x = Math.sin(radians(b.lng - a.lng)) * Math.cos(radians(b.lat));
  const y =
    Math.cos(radians(a.lat)) * Math.sin(radians(b.lat)) -
    Math.sin(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.cos(radians(b.lng - a.lng));
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}
export function turnAt(
  before: Point,
  junction: Point,
  after: Point,
): "left" | "right" | "straight" | "back" {
  const angle =
    ((bearing(junction, after) - bearing(before, junction) + 540) % 360) - 180;
  if (Math.abs(angle) > 150) return "back";
  return angle > 30 ? "right" : angle < -30 ? "left" : "straight";
}
// Project onto the path, so sparse GPS samples need not hit individual vertices.
export function projectOnSegment(
  point: Point,
  a: Point,
  b: Point,
): SegmentProjection {
  const scale = Math.cos(radians(point.lat));
  const x = (b.lng - a.lng) * scale,
    y = b.lat - a.lat;
  const px = (point.lng - a.lng) * scale,
    py = point.lat - a.lat;
  const t =
    x * x + y * y
      ? Math.max(0, Math.min(1, (px * x + py * y) / (x * x + y * y)))
      : 0;
  return {
    point: { lat: a.lat + t * y, lng: a.lng + t * (b.lng - a.lng) },
    fraction: t,
  };
}
export function segmentDistance(point: Point, a: Point, b: Point): number {
  return distance(point, projectOnSegment(point, a, b).point);
}
export function simplifyTrace(
  trace: TracePoint[],
  toleranceMeters = 4,
): TracePoint[] {
  const result: TracePoint[] = [];
  for (let start = 0; start < trace.length;) {
    let end = start;
    while (
      end + 1 < trace.length &&
      trace[end + 1].segment === trace[start].segment
    )
      end++;
    const keep = new Set([start, end]);
    const stack: [number, number][] = [[start, end]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      let max = toleranceMeters,
        index = -1;
      for (let i = a + 1; i < b; i++) {
        const d = segmentDistance(trace[i], trace[a], trace[b]);
        if (d > max) {
          max = d;
          index = i;
        }
      }
      if (index >= 0) {
        keep.add(index);
        stack.push([a, index], [index, b]);
      }
    }
    result.push(
      ...Array.from(keep)
        .sort((a, b) => a - b)
        .map((i) => trace[i]),
    );
    start = end + 1;
  }
  return result;
}
