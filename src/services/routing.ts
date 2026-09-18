import { z } from "zod";
import { distance } from "../domain/geo";
import { pointSchema, type Point, type RoutedPath } from "../types/models";

export const FOOT_ROUTING_URL =
  "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
export const MAX_WAYPOINTS = 100;
const coordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const responseSchema = z.object({
  code: z.literal("Ok"),
  routes: z
    .array(
      z.object({
        distance: z.number().finite().nonnegative(),
        geometry: z.object({
          type: z.literal("LineString"),
          coordinates: z.array(coordinate).min(2).max(5000),
        }),
      }),
    )
    .min(1),
  waypoints: z
    .array(z.object({ location: coordinate }))
    .min(2)
    .max(MAX_WAYPOINTS),
});

export async function routeOnFoot(
  waypoints: Point[],
  signal: AbortSignal,
): Promise<RoutedPath> {
  z.array(pointSchema).min(2).max(MAX_WAYPOINTS).parse(waypoints);
  const url = new URL(
    `${FOOT_ROUTING_URL}/${waypoints.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";")}`,
  );
  url.search = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "false",
    alternatives: "false",
    continue_straight: "false",
    generate_hints: "false",
    radiuses: waypoints.map(() => "100").join(";"),
  }).toString();
  const response = await fetch(url, {
    signal,
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "strict-origin-when-cross-origin",
  });
  if (response.status === 429)
    throw new Error(
      "Služba plánování je vytížená. Počkej chvíli a zkus výpočet znovu.",
    );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      "Služba plánování nevrátila použitelnou trasu. Zkus výpočet znovu za chvíli.",
    );
  }
  const code = z.object({ code: z.string() }).safeParse(body);
  if (code.success && ["NoRoute", "NoSegment"].includes(code.data.code))
    throw new Error(
      "Mezi body se nepodařilo najít pěší cestu. Vrať poslední bod nebo ho umísti blíž k cestě (do 100 m).",
    );
  if (!response.ok)
    throw new Error(
      "Služba plánování není dostupná. Zkus výpočet znovu za chvíli.",
    );
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success)
    throw new Error(
      "Služba vrátila neplatnou nebo příliš podrobnou trasu. Zkus kratší trasu.",
    );
  const { routes, waypoints: snapped } = parsed.data;
  const points = routes[0].geometry.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));
  const snappedPoints = snapped.map(({ location: [lng, lat] }) => ({
    lat,
    lng,
  }));
  if (
    snappedPoints.length !== waypoints.length ||
    snappedPoints.some((p, i) => distance(p, waypoints[i]) > 101) ||
    distance(points[0], snappedPoints[0]) > 5 ||
    distance(
      points[points.length - 1],
      snappedPoints[snappedPoints.length - 1],
    ) > 5
  )
    throw new Error(
      "Cestu nelze spolehlivě přiřadit k vybraným bodům. Posuň body blíž k cestě.",
    );
  return {
    points,
    routing: {
      profile: "foot",
      provider: "osrm",
      distanceMeters: routes[0].distance,
      waypoints: snappedPoints,
    },
  };
}
