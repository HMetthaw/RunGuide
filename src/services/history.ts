import type { Run } from "../types/models";
import { formatDistance, formatPace, formatTime } from "../domain/pace";
export function historyCard(
  run: Run,
  onExport: () => void,
  onDelete: () => void,
  onFeedback: (text: string) => void,
): HTMLElement {
  const article = document.createElement("article");
  article.className = "history-item";
  const summary = document.createElement("div");
  summary.className = "history-summary";
  const date = document.createElement("p");
  date.textContent = new Date(run.startedAt).toLocaleString("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const length = document.createElement("strong");
  length.textContent = `${formatDistance(run.distanceMeters)} km`;
  const metrics = document.createElement("p");
  metrics.textContent = `${formatTime(run.durationSeconds)} · ${formatPace(run.distanceMeters ? (run.durationSeconds * 1000) / run.distanceMeters : null)} / km`;
  const target = document.createElement("p");
  target.textContent = `Cíl: ${run.goal.distanceKm} km za ${run.goal.durationMinutes} min`;
  summary.append(date, length, metrics, target);
  article.append(summary);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 280 130");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Soukromá mapa skutečně uběhnuté trasy");
  if (run.trace.length) {
    const base = run.trace[0],
      scaleX = Math.cos((base.lat * Math.PI) / 180);
    const points = run.trace.map((p) => ({
      x: (p.lng - base.lng) * scaleX,
      y: -(p.lat - base.lat),
      segment: p.segment,
    }));
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    const minX = Math.min(...xs),
      minY = Math.min(...ys);
    const width = Math.max(...xs) - minX,
      height = Math.max(...ys) - minY;
    const scale = Math.min(250 / (width || 1e-8), 100 / (height || 1e-8));
    const parts = new Map<number, string[]>();
    points.forEach((p) => {
      const list = parts.get(p.segment) || [];
      list.push(
        `${(p.x - minX) * scale + (280 - width * scale) / 2},${(p.y - minY) * scale + (130 - height * scale) / 2}`,
      );
      parts.set(p.segment, list);
    });
    for (const part of parts.values()) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline",
      );
      line.setAttribute("points", part.join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#12635b");
      line.setAttribute("stroke-width", "3");
      svg.append(line);
    }
  }
  article.append(svg);
  const details = document.createElement("details");
  const label = document.createElement("summary");
  label.textContent = "Poznámka a data běhu";
  const quality = document.createElement("p");
  quality.textContent = `Vynechané GPS vzorky: ${run.quality.rejectedFixes}. Přerušení signálu: ${run.quality.gaps}.`;
  const feedback = document.createElement("textarea");
  feedback.maxLength = 1000;
  feedback.value = run.feedback;
  feedback.setAttribute("aria-label", "Poznámka k běhu");
  feedback.placeholder = "Jak fungovalo tempo, GPS a hlas?";
  const save = document.createElement("button");
  save.textContent = "Uložit poznámku";
  save.onclick = () => onFeedback(feedback.value);
  const exportButton = document.createElement("button");
  exportButton.textContent = "Exportovat GPX";
  exportButton.onclick = onExport;
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Smazat běh";
  deleteButton.onclick = onDelete;
  details.append(label, quality, feedback, save, exportButton, deleteButton);
  article.append(details);
  return article;
}
