import type { Run, TracePoint } from "../types/models";
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function gpx(run: Run): string {
  const segments = new Map<number, TracePoint[]>();
  run.trace.forEach((p) => {
    const points = segments.get(p.segment) || [];
    points.push(p);
    segments.set(p.segment, points);
  });
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="RunGuide" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>RunGuide ${run.startedAt.slice(0, 10)}</name>${Array.from(
    segments.values(),
  )
    .map(
      (points) =>
        `<trkseg>${points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}">${p.altitude == null ? "" : `<ele>${p.altitude}</ele>`}<time>${new Date(p.timestamp).toISOString()}</time></trkpt>`).join("")}</trkseg>`,
    )
    .join("")}</trk></gpx>`;
}
