import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Point, TracePoint } from "../types/models";

export class RouteMap {
  private map = L.map("map", { zoomControl: false }).setView(
    [49.78, 18.43],
    13,
  );
  private route = L.featureGroup().addTo(this.map);
  private trace = L.featureGroup().addTo(this.map);
  private position = L.featureGroup().addTo(this.map);
  constructor(onPoint: (p: Point) => void, onTileError: () => void) {
    L.control.zoom({ position: "bottomright" }).addTo(this.map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on("tileerror", onTileError)
      .addTo(this.map);
    this.map.on("click", (event: L.LeafletMouseEvent) =>
      onPoint({ lat: event.latlng.lat, lng: event.latlng.lng }),
    );
  }
  setRoute(points: Point[], fit = false, waypoints: Point[] = points) {
    this.route.clearLayers();
    if (points.length > 1)
      L.polyline(points, { color: "#c54c27", weight: 5 }).addTo(this.route);
    waypoints.forEach((p, i) =>
      L.circleMarker(p, {
        radius: i === 0 ? 7 : 4,
        color: "#102e27",
        weight: 2,
        fillColor: i === 0 ? "#d8ff51" : "#ff754c",
        fillOpacity: 1,
      }).addTo(this.route),
    );
    const bounds = points.length ? points : waypoints;
    if (fit && bounds.length)
      this.map.fitBounds(L.latLngBounds(bounds), {
        padding: [30, 50],
        maxZoom: 16,
      });
  }
  setTrace(points: TracePoint[]) {
    this.trace.clearLayers();
    const segments = new Map<number, Point[]>();
    points.forEach((p) => {
      const line = segments.get(p.segment) || [];
      line.push(p);
      segments.set(p.segment, line);
    });
    for (const line of segments.values())
      L.polyline(line, { color: "#13706b", weight: 5 }).addTo(this.trace);
  }
  locate(point: Point, accuracy: number, center = false) {
    this.position.clearLayers();
    L.circle(point, {
      radius: accuracy,
      color: "#13706b",
      weight: 1,
      fillOpacity: 0.08,
    }).addTo(this.position);
    L.circleMarker(point, {
      radius: 8,
      color: "#102e27",
      weight: 3,
      fillColor: "#d8ff51",
      fillOpacity: 1,
    }).addTo(this.position);
    if (center) this.map.setView(point, 16);
  }
  centerPoint(): Point {
    const p = this.map.getCenter();
    return { lat: p.lat, lng: p.lng };
  }
}
