import type { Run } from "../types/models";
import { profileSchema, type Profile } from "../types/profile";
import { runSummary, type SummaryPeriod } from "../domain/summary";
import { formatDistance, formatPace, formatTime } from "../domain/pace";
import type { StoragePort } from "./storage";

export function setupDashboard(
  storage: StoragePort,
  getRuns: () => Run[],
  getOwnerKey: () => string,
) {
  let period: SummaryPeriod = "week";
  let profile: Profile = { name: "", weeklyKm: 15 };
  const text = (id: string, value: string) => {
    document.getElementById(id)!.textContent = value;
  };
  const name = document.getElementById("profile-name") as HTMLInputElement;
  const weekly = document.getElementById("profile-weekly") as HTMLInputElement;
  function loadProfile() {
    profile = { name: "", weeklyKm: 15 };
    try {
      const raw = storage.getItem(`${getOwnerKey()}:profile`);
      if (raw) profile = profileSchema.parse(JSON.parse(raw));
      text("profile-status", "");
    } catch {
      text(
        "profile-status",
        "Profil nelze načíst. Můžeš ho zkusit uložit znovu.",
      );
    }
    name.value = profile.name;
    weekly.value = String(profile.weeklyKm);
    render();
  }
  function render() {
    const runs = getRuns();
    const now = new Date();
    const summary = runSummary(runs, period, now);
    const week = runSummary(runs, "week", now);
    text(
      "overview-greeting",
      profile.name ? `Ahoj, ${profile.name}.` : "Tvůj běh. Tvůj rytmus.",
    );
    text("profile-display-name", profile.name || "Tvůj běžecký profil");
    text(
      "profile-avatar",
      profile.name ? Array.from(profile.name)[0].toLocaleUpperCase("cs") : "R",
    );
    text("summary-distance", formatDistance(summary.meters));
    text("summary-count", String(summary.count));
    text("summary-time", formatTime(summary.seconds));
    text("summary-pace", formatPace(summary.pace));
    text(
      "summary-period-label",
      period === "week" ? "Tento týden" : "Tento měsíc",
    );
    text(
      "chart-title",
      period === "week" ? "Tvůj týden v pohybu" : "Tvůj měsíc v pohybu",
    );
    text(
      "summary-empty",
      summary.count
        ? "Každý další běh se tu přičte."
        : "Zatím bez běhu v tomto období. První kilometry čekají na tebe.",
    );
    const percent = Math.round((week.meters / (profile.weeklyKm * 1000)) * 100);
    text(
      "weekly-progress-copy",
      `${formatDistance(week.meters)} / ${profile.weeklyKm} km`,
    );
    text("weekly-percent", `${percent} %`);
    const progress = document.getElementById(
      "weekly-progress",
    ) as HTMLProgressElement;
    progress.max = profile.weeklyKm * 1000;
    progress.value = week.meters;
    const total = runs.reduce((sum, run) => sum + run.distanceMeters, 0);
    text("profile-total", `${formatDistance(total)} km`);
    text("profile-run-count", String(runs.length));
    text(
      "profile-longest",
      runs.length
        ? `${formatDistance(Math.max(...runs.map((run) => run.distanceMeters)))} km`
        : "—",
    );
    const latest = [...runs].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    )[0];
    text(
      "latest-run",
      latest
        ? `${formatDistance(latest.distanceMeters)} km · ${formatTime(latest.durationSeconds)}`
        : "Tvoje první trasa začíná tady.",
    );
    text(
      "latest-date",
      latest
        ? new Date(latest.startedAt).toLocaleDateString("cs", {
            day: "numeric",
            month: "long",
          })
        : "Až doběhneš, najdeš tady svůj poslední běh.",
    );
    const chart = document.getElementById("activity-chart")!;
    chart.replaceChildren();
    const max = Math.max(1000, ...summary.buckets.map((b) => b.meters));
    for (const bucket of summary.buckets) {
      const item = document.createElement("div");
      item.className = "activity-column";
      const value = document.createElement("span");
      value.textContent = `${formatDistance(bucket.meters)}`;
      const track = document.createElement("div");
      track.className = "activity-track";
      const bar = document.createElement("i");
      bar.style.height = `${(bucket.meters / max) * 100}%`;
      track.append(bar);
      const label = document.createElement("span");
      label.textContent = bucket.label;
      item.append(value, track, label);
      chart.append(item);
    }
  }
  document
    .querySelectorAll<HTMLButtonElement>("[data-period]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        period = button.dataset.period === "month" ? "month" : "week";
        document
          .querySelectorAll<HTMLButtonElement>("[data-period]")
          .forEach((option) =>
            option.setAttribute("aria-pressed", String(option === button)),
          );
        render();
      }),
    );
  document
    .getElementById("profile-form")!
    .addEventListener("submit", (event) => {
      event.preventDefault();
      const result = profileSchema.safeParse({
        name: name.value,
        weeklyKm: Number(weekly.value),
      });
      if (!result.success) {
        text(
          "profile-status",
          "Jméno může mít nejvýš 40 znaků a týdenní cíl 1 až 500 km.",
        );
        return;
      }
      try {
        storage.setItem(
          `${getOwnerKey()}:profile`,
          JSON.stringify(result.data),
        );
        profile = result.data;
        render();
        text("profile-status", "Profil uložený v tomto zařízení.");
      } catch {
        text(
          "profile-status",
          "Profil se nepodařilo uložit. Zkontroluj volné místo a povolení úložiště.",
        );
      }
    });
  loadProfile();
  return { render, loadProfile };
}
