import type { Goal, GoalDistanceSource, Point, Run } from "./types/models";
import { Runner } from "./domain/runner";
import { GpsTracker } from "./services/gps-tracker";
import { Navigator } from "./domain/navigation";
import { distance } from "./domain/geo";
import { routeGoalDistance } from "./domain/goal-distance";
import {
  formatDistance,
  formatPace,
  formatSpokenPace,
  formatTime,
  paceAdvice,
  remainingTime,
  targetPace,
} from "./domain/pace";
import { LocalRepository, type StoragePort } from "./services/storage";
import { RouteMap } from "./services/map";
import { RoutePlanner } from "./services/route-planner";
import { MAX_WAYPOINTS } from "./services/routing";
import { VoiceGuide } from "./services/voice";
import { setupVoiceSettings } from "./services/voice-settings";
import { CloudRepository } from "./services/cloud";
import { download, gpx } from "./services/export";
import { historyCard } from "./services/history";
import { registerApp } from "./services/pwa";
import { setupPlannerInterface } from "./services/planner-ui";
import { setupTheme } from "./services/theme";
import { setupAppNavigation } from "./services/app-navigation";
import { setupDashboard } from "./services/dashboard";
import { setupGoalCalculator } from "./services/goal-calculator";
import "./app.css";
import "./pages.css";
import "@fontsource/barlow-condensed/latin-ext-800.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/manrope/latin-ext-400.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-ext-700.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/dm-mono/latin-ext-400.css";
import "@fontsource/dm-mono/latin-400.css";

setupTheme();

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing interface element: ${id}`);
  return found as T;
}
const text = (id: string, value: string) => {
  element(id).textContent = value;
};
const show = (id: string, visible: boolean) => {
  element(id).hidden = !visible;
};
const input = (id: string) => element<HTMLInputElement>(id);
const active = () => ["running", "paused", "acquiring"].includes(runner.phase);
function notice(message: string) {
  text("app-status", message);
  show("app-status", true);
}
function report(error: unknown) {
  notice(
    error instanceof Error
      ? error.message
      : "Akce se nepodařila. Zkus to znovu.",
  );
}
function action(id: string, task: () => void | Promise<void>) {
  element(id).addEventListener("click", () => {
    Promise.resolve().then(task).catch(report);
  });
}
async function confirmAction(title: string, message: string): Promise<boolean> {
  const dialog = element<HTMLDialogElement>("confirm-dialog");
  text("confirm-title", title);
  text("confirm-text", message);
  dialog.returnValue = "cancel";
  dialog.showModal();
  return new Promise((resolve) =>
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    ),
  );
}

const runner = new Runner();
let storagePort: StoragePort;
try {
  storagePort = window.localStorage;
} catch {
  storagePort = {
    getItem() {
      throw new Error("Úložiště je zakázané.");
    },
    setItem() {
      throw new Error("Úložiště je zakázané.");
    },
  };
}
let repository = new LocalRepository(storagePort);
const cloud = new CloudRepository();
let route: Point[] = [];
let goalDistanceSource: GoalDistanceSource = "route";
const planner = new RoutePlanner(() => {
  route = planner.points;
  if (
    !active() &&
    goalDistanceSource === "route" &&
    !planner.blocked &&
    planner.routing
  ) {
    const km = routeGoalDistance(planner.distanceMeters);
    if (km !== null) goalCalculator.setDistance(km);
  }
  renderRoute();
});
let navigation = new Navigator([]);
let lastAdviceAt = 0,
  lastCheckpointAt = 0;
let lastSignalAdviceAt = -Infinity;
let lastRecoveryAdviceAt = -Infinity;
let pendingRun: Run | null = null;
let syncBusy = false;
let identityReady = false;
const voice = new VoiceGuide((message) => text("voice-copy", message));
const gpsTracker = new GpsTracker({
  position: receivePosition,
  error: gpsError,
  wakeStatus: (message) => text("wake-status", message),
  suspend: (reason) => {
    runner.interrupt(Date.now(), reason);
    checkpoint();
    voice.cancel();
    renderRun();
  },
  resume: () => {
    runner.checkSignal(Date.now());
    runner.reacquire(Date.now());
    text("gps-status", "Obnovuji GPS. Čekám na novou přesnou polohu…");
    if (runner.incomplete) announceSignalGap();
    renderRun();
  },
  tick: () => {
    if (runner.checkSignal(Date.now())) {
      announceSignalGap();
      checkpoint();
      renderRun();
    }
  },
});
try {
  voice.enabled = storagePort.getItem("runguide.voice") !== "false";
  input("voice-enabled").checked = voice.enabled;
} catch {
  /* The control still works when browser storage is unavailable. */
}
const map = new RouteMap(addWaypoint, () =>
  text(
    "map-status",
    "Mapový podklad není dostupný. Uložená trasa a měření zůstávají použitelné.",
  ),
);
setupPlannerInterface(() => map.resize());
const appNavigation = setupAppNavigation(() => map.resize(), active);
const dashboard = setupDashboard(
  storagePort,
  () => repository.runs(),
  () => repository.key,
);
const goalCalculator = setupGoalCalculator(() => renderRoute());

function addWaypoint(point: Point) {
  if (active()) return;
  if (planner.waypoints.length >= MAX_WAYPOINTS) {
    notice(`Trasa může mít nejvýš ${MAX_WAYPOINTS} zvolených bodů.`);
    return;
  }
  planner.setWaypoints([...planner.waypoints, point]);
}

function goal(): Goal | null {
  return goalCalculator.readGoal();
}
function renderRoute(fit = false) {
  map.setRoute(route, fit, planner.routing?.waypoints ?? planner.waypoints);
  const meters = planner.distanceMeters,
    target = goal();
  const count = planner.waypoints.length;
  const pointLabel =
    count === 1 ? "bod" : count >= 2 && count <= 4 ? "body" : "bodů";
  text(
    "route-summary",
    count
      ? `${count} ${pointLabel} · ${planner.blocked ? "čeká na výpočet" : `${formatDistance(meters)} km`}`
      : "Vyber start v mapě",
  );
  text(
    "map-hint",
    active()
      ? "Běh probíhá · plán je uzamčený"
      : count
        ? "Dalším ťuknutím přidej bod"
        : "Ťukni do mapy a vyber start",
  );
  element("map-stage").dataset.state = planner.status;
  text("route-distance", planner.blocked ? "—" : formatDistance(meters));
  text(
    "run-preparation-summary",
    !target
      ? "Nejdřív oprav vzdálenost, čas nebo tempo v kroku Cíl a tempo."
      : planner.blocked
        ? "Trasa není připravená. Vrať se na mapu a dokonči výpočet."
        : `Cíl ${target.distanceKm.toLocaleString("cs")} km · ${target.durationMinutes.toLocaleString("cs")} min · tempo ${formatPace(targetPace(target))} / km`,
  );
  text("routing-status", planner.message);
  element("routing-status").setAttribute(
    "aria-busy",
    String(planner.status === "pending"),
  );
  show(
    "retry-route",
    planner.status === "error" ||
      (planner.status === "ready" && planner.blocked),
  );
  const difference =
    target && !planner.blocked ? meters - target.distanceKm * 1000 : null;
  text(
    "route-difference",
    difference === null
      ? "—"
      : `${difference >= 0 ? "+" : "−"}${formatDistance(Math.abs(difference))}`,
  );
  text("target-pace", target ? formatPace(targetPace(target)) : "—");
  if (target && runner.phase === "idle") {
    runner.goal = target;
    renderRun();
  }
  input("start-run").disabled =
    !identityReady ||
    !target ||
    !!pendingRun ||
    !!repository.draft() ||
    syncBusy ||
    planner.blocked ||
    active();
  renderRouteControls();
}
function renderRouteControls() {
  for (const id of ["save-route", "use-route-distance"])
    input(id).disabled = active() || planner.blocked || !planner.routing;
  input("undo-route").disabled = active() || !planner.waypoints.length;
  input("clear-route").disabled = active() || !planner.waypoints.length;
  input("close-loop").disabled = active() || planner.waypoints.length < 2;
  input("goal-use-route").disabled =
    active() || planner.blocked || !planner.routing;
  text(
    "goal-route-copy",
    planner.blocked
      ? "Trasa čeká na výpočet. Vrať se na mapu a zkontroluj ji."
      : planner.routing
        ? `Naplánovaná trasa: ${formatDistance(planner.distanceMeters)} km.`
        : "Běžíš bez naplánované trasy. GPS zaznamená tvůj skutečný pohyb.",
  );
}
function renderPlans() {
  const select = element<HTMLSelectElement>("saved-routes");
  select.replaceChildren(new Option("Vyber trasu", ""));
  repository
    .plans()
    .forEach((plan) => select.add(new Option(plan.name, plan.id)));
}
function renderHistory() {
  dashboard.render();
  const runs = repository.runs();
  text("history-count", String(runs.length));
  text(
    "history-total",
    `${runs.length} běhů · ${formatDistance(runs.reduce((sum, run) => sum + run.distanceMeters, 0))} km celkem`,
  );
  const list = element("history-list");
  list.replaceChildren();
  if (!runs.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#icon-route"/></svg><div><strong>Tady začíná tvoje běžecká historie.</strong><p>Dokonči první běh. Jeho trasu, čas a tempo najdeš právě tady.</p></div>';
    list.append(empty);
  }
  runs.forEach((run) =>
    list.append(
      historyCard(
        run,
        () =>
          download(
            `runguide-${run.startedAt.slice(0, 10)}.gpx`,
            gpx(run),
            "application/gpx+xml",
          ),
        () => {
          void (async () => {
            if (active() || syncBusy) {
              notice(
                "Spravuj historii až po ukončení běhu nebo synchronizace.",
              );
              return;
            }
            if (
              !(await confirmAction(
                "Smazat tento běh?",
                "Odstraníme GPS stopu i souhrn. U přihlášeného účtu také cloudovou kopii.",
              ))
            )
              return;
            if (cloud.owner) await cloud.deleteRun(run.id);
            repository.deleteRun(run.id);
            renderHistory();
          })().catch(report);
        },
        (feedback) => {
          try {
            if (active() || syncBusy) {
              notice("Poznámku ulož až po ukončení běhu nebo synchronizace.");
              return;
            }
            repository.saveRun({ ...run, feedback });
            notice("Poznámka uložená.");
          } catch (error) {
            report(error);
          }
        },
      ),
    ),
  );
}
function renderRun() {
  document.body.dataset.runPhase = runner.phase;
  show("active-run-link", active() || !!pendingRun);
  show("run-preparation-summary", !active());
  text(
    "start-title",
    active() ? "Tvůj běh právě teď." : "Připrav si svůj běh.",
  );
  const now = Date.now(),
    seconds = runner.elapsed(now),
    pace = runner.currentPace(now);
  text("live-time", formatTime(seconds));
  text("live-distance", formatDistance(runner.meters));
  text("live-pace", formatPace(pace));
  text("average-pace", formatPace(runner.averagePace(now)));
  const delta =
    pace === null ? null : Math.round(pace - targetPace(runner.goal));
  text(
    "live-delta",
    delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta} s/km`,
  );
  const remaining = remainingTime(runner.goal, runner.meters, seconds);
  text("remaining-distance", `${formatDistance(remaining.remainingMeters)} km`);
  text(
    "remaining-time",
    runner.incomplete
      ? "Zbývající vzdálenost je jen podle zachycené GPS. Část běhu chybí."
      : remaining.remainingMeters === 0
        ? "Vzdálenostní cíl splněn."
        : `Do cílového času ${formatTime(remaining.remainingSeconds)}`,
  );
  show("start-run", !active());
  show("pause-run", ["running", "acquiring"].includes(runner.phase));
  show("resume-run", runner.phase === "paused");
  show("stop-run", active());
  show("retry-save", !!pendingRun);
  element<HTMLFieldSetElement>("goal-fields").disabled = active();
  document
    .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(
      "[data-route-edit]",
    )
    .forEach((el) => {
      el.disabled = active();
    });
  renderRouteControls();
  for (const id of ["sync-cloud", "import-device", "logout"])
    input(id).disabled = active() || !!pendingRun || syncBusy;
  const labels = {
    idle: "Připraven vyběhnout?",
    acquiring: "Hledám tvou polohu.",
    running: "Drž si svoje tempo.",
    paused: "Chvíle na nádech.",
    finished: pendingRun ? "Ještě uložit běh." : "Dobrý běh. Hotovo.",
  };
  text(
    "run-title",
    runner.interruption ? "GPS záznam se přerušil." : labels[runner.phase],
  );
  show("recording-status", runner.incomplete);
  text(
    "recording-status",
    runner.interruption
      ? "GPS neměří. Čas dál běží, vzdálenost chybí. Nech aplikaci otevřenou a telefon odemčený. Průměrné tempo nelze určit."
      : runner.recoveryUncertain
        ? "Neúplný záznam po obnovení aplikace. Čas je zachovaný jen do posledního uložení a za další měření; dobu mimo aplikaci neznáme. Vzdálenost je jen zachycená GPS, průměrné tempo nelze určit."
        : "Záznam obsahuje výpadek GPS. Čas zahrnuje výpadek, vzdálenost je jen zachycená část. Průměrné tempo nelze určit.",
  );
}
function announceSignalGap() {
  if (Date.now() - lastSignalAdviceAt < 60000) return;
  voice.speak(
    "Záznam GPS má výpadek. Nech aplikaci otevřenou a telefon odemčený.",
  );
  lastSignalAdviceAt = Date.now();
}
function checkpoint() {
  const draft = runner.checkpoint(Date.now());
  if (!draft) return;
  try {
    repository.saveDraft(draft);
    lastCheckpointAt = Date.now();
  } catch (error) {
    report(error);
  }
}
function stopGps() {
  navigation.resetConfidence();
  gpsTracker.stop();
}
function gpsError(code: number) {
  navigation.resetConfidence();
  if (runner.interrupt(Date.now(), "gps-error")) announceSignalGap();
  text(
    "gps-status",
    code === 1
      ? "Přístup k poloze je zamítnutý. Povol ho v nastavení tohoto webu a pokračuj."
      : code === 2
        ? "Poloha není dostupná. Zkus otevřené prostranství."
        : "GPS zatím neodpověděla. Čekáme na použitelný signál.",
  );
  if (code === 1) {
    runner.pause(Date.now());
    stopGps();
  }
  checkpoint();
  renderRun();
}
function beginGps() {
  text("gps-status", "Čekám na GPS s přesností do 35 metrů…");
  gpsTracker.start();
}
function receivePosition(position: GeolocationPosition) {
  const { latitude: lat, longitude: lng, accuracy, speed } = position.coords;
  const now = Date.now(),
    wasWaiting = runner.phase === "acquiring";
  const fix = {
    lat,
    lng,
    accuracy,
    speed,
    timestamp: position.timestamp,
  };
  const previousGaps = runner.gaps;
  const wasInterrupted = !!runner.interruption;
  const result = runner.ingest(fix, now);
  if (runner.gaps > previousGaps) announceSignalGap();
  if (result === "ignored") return;
  if (result === "weak" || result === "jump" || result === "stale") {
    navigation.resetConfidence();
    text(
      "gps-status",
      result === "weak"
        ? "GPS je nepřesná. Tento vzorek nepřičítám k trase."
        : "Neplatný GPS vzorek byl vynechán.",
    );
    renderRun();
    return;
  }
  text("gps-status", `GPS ±${Math.round(accuracy)} m · záznam v telefonu`);
  gpsTracker.receivedUsableFix();
  map.locate(fix, accuracy, wasWaiting);
  map.setTrace(runner.trace);
  if (wasWaiting) {
    voice.speak("GPS je připravená. Měříme běh.");
  } else if (wasInterrupted) {
    if (now - lastRecoveryAdviceAt >= 60000) {
      voice.speak("GPS znovu měří. Chybějící část trasy zůstává označená.");
      lastRecoveryAdviceAt = now;
    }
    lastAdviceAt = now;
  }
  const instruction = navigation.update(fix, now);
  runner.navigationNext = navigation.next;
  if (instruction) voice.speak(instruction, "navigation", now);
  const pace = runner.currentPace(now),
    advice = paceAdvice(
      pace,
      targetPace(runner.goal),
      runner.elapsed(now),
      now,
      lastAdviceAt,
    );
  if (!instruction && advice) {
    const messages = {
      fast: "Běžíš rychleji než svůj cíl. Zkus trochu zpomalit.",
      slow: "Běžíš pomaleji než svůj cíl. Jestli se cítíš dobře, lehce přidej.",
      "on-target": "Držíš cílové tempo. Pokračuj ve svém rytmu.",
    };
    if (
      voice.speak(
        `${messages[advice]} Aktuální tempo ${formatPace(pace)} na kilometr.`,
        "pace",
        now,
      )
    )
      lastAdviceAt = now;
  }
  if (result === "accepted" || now - lastCheckpointAt >= 5000) checkpoint();
  renderRun();
}
function savePending() {
  if (!pendingRun) return;
  repository.saveRun(pendingRun);
  pendingRun = null;
  notice("Běh uložený v telefonu. Soukromý souhrn najdeš v historii.");
  voice.speak("Běh je uložený.");
  show("history", true);
  renderHistory();
  renderRun();
  renderRoute();
}

input("goal-distance").addEventListener("input", () => {
  goalDistanceSource = "manual";
});
element("goal-form").addEventListener("submit", (event) =>
  event.preventDefault(),
);
action("undo-route", () => {
  if (!active()) {
    planner.setWaypoints(planner.waypoints.slice(0, -1));
  }
});
action("add-center", () => addWaypoint(map.centerPoint()));
action("retry-route", () => {
  if (!active()) planner.setWaypoints(planner.waypoints);
});
action("close-loop", () => {
  const points = planner.waypoints;
  if (
    !active() &&
    points.length >= 2 &&
    distance(points[0], points[points.length - 1]) > 1
  ) {
    addWaypoint({ ...points[0] });
  }
});
action("clear-route", async () => {
  if (
    !active() &&
    (!planner.waypoints.length ||
      (await confirmAction(
        "Vymazat rozpracovanou trasu?",
        "Uložené plány zůstanou zachované.",
      )))
  ) {
    if (!active()) planner.setWaypoints([]);
  }
});
action("use-route-distance", () => {
  if (active() || planner.blocked || !planner.routing) return;
  const km = routeGoalDistance(planner.distanceMeters);
  if (km === null) {
    notice("Délka cíle musí být 0,1–100 km.");
    return;
  }
  goalDistanceSource = "route";
  goalCalculator.setDistance(km);
  renderRoute();
});
action("locate-me", () => {
  if (!navigator.geolocation || !window.isSecureContext) {
    notice("Poloha vyžaduje HTTPS a prohlížeč s podporou GPS.");
    return;
  }
  text("location-status", "Hledám polohu…");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      map.locate(
        { lat: position.coords.latitude, lng: position.coords.longitude },
        position.coords.accuracy,
        true,
      );
      text(
        "location-status",
        `Poloha nalezena, přesnost ±${Math.round(position.coords.accuracy)} metrů.`,
      );
    },
    () =>
      text(
        "location-status",
        "Polohu se nepodařilo načíst. Zkontroluj oprávnění webu.",
      ),
    { enableHighAccuracy: true, timeout: 15000 },
  );
});
action("save-route", () => {
  if (active() || planner.blocked || !planner.routing) return;
  const target = goal();
  if (!target || route.length < 2 || planner.distanceMeters < 10) {
    text("planner-status", "Zadej platný cíl a alespoň dva různé body trasy.");
    return;
  }
  repository.savePlan({
    id: crypto.randomUUID(),
    name:
      input("route-name").value.trim() ||
      `Můj okruh ${repository.plans().length + 1}`,
    goal: target,
    goalDistanceSource,
    points: route,
    routing: planner.routing,
    createdAt: new Date().toISOString(),
  });
  renderPlans();
  text("planner-status", "Trasa uložená v tomto zařízení.");
});
element("saved-routes").addEventListener("change", () => {
  if (active()) return;
  const plan = repository
    .plans()
    .find((p) => p.id === input("saved-routes").value);
  if (!plan) return;
  // Older plans did not record intent and may still contain the default 5 km.
  goalDistanceSource = plan.goalDistanceSource ?? "route";
  goalCalculator.setGoal(plan.goal);
  input("route-name").value = plan.name;
  planner.load(plan.points, plan.routing);
  renderRoute(true);
});
action("delete-plan", async () => {
  if (active()) return;
  const id = input("saved-routes").value;
  if (
    id &&
    (await confirmAction(
      "Smazat uložený plán?",
      "Historie dokončených běhů zůstane zachovaná.",
    ))
  ) {
    repository.deletePlan(id);
    renderPlans();
  }
});
action("start-run", () => {
  const target = goal();
  if (
    !identityReady ||
    !target ||
    active() ||
    pendingRun ||
    repository.draft() ||
    planner.blocked ||
    syncBusy
  )
    return;
  if (!navigator.geolocation || !window.isSecureContext) {
    notice("Běh vyžaduje HTTPS a dostupnou GPS.");
    return;
  }
  repository.saveDraft(null);
  runner.start(target, route, planner.routing);
  checkpoint();
  navigation = new Navigator(route);
  lastAdviceAt = Date.now();
  lastSignalAdviceAt = -Infinity;
  lastRecoveryAdviceAt = -Infinity;
  map.setTrace([]);
  renderRun();
  renderRoute();
  text(
    "run-message",
    "Tempo hlásíme až po ustálení GPS. Pauza se do času nepočítá. Výpadek GPS není pauza a označí běh jako neúplný.",
  );
  voice.speak("Hledám GPS. Při běhu nech aplikaci otevřenou.");
  beginGps();
  appNavigation.navigate("run");
});
action("pause-run", () => {
  runner.pause(Date.now());
  stopGps();
  checkpoint();
  voice.cancel();
  text("gps-status", "Běh je pozastavený. GPS neměří.");
  renderRun();
});
action("resume-run", () => {
  if (runner.phase === "paused") {
    runner.resume(Date.now());
    checkpoint();
    lastAdviceAt = Date.now();
    renderRun();
    beginGps();
  }
});
action("stop-run", async () => {
  if (!active()) return;
  if (
    !(await confirmAction(
      "Ukončit běh?",
      "Změřenou vzdálenost, čas a skutečnou trasu uložíme do historie.",
    ))
  )
    return;
  stopGps();
  voice.cancel();
  checkpoint();
  pendingRun = runner.finish(Date.now());
  renderRun();
  if (pendingRun) savePending();
  else {
    repository.saveDraft(null);
    notice(
      "Záznam je příliš krátký (méně než 10 m). Prázdný běh jsme do historie nepřidali.",
    );
    renderRoute();
  }
});
action("retry-save", savePending);
action("restore-run", () => {
  const draft = repository.draft();
  if (!draft) return;
  runner.restore(draft);
  goalDistanceSource = "manual";
  checkpoint();
  planner.restoreRun(draft.route, draft.routing);
  navigation = new Navigator(route);
  navigation.next = draft.navigationNext;
  goalCalculator.setGoal(draft.goal);
  show("recovery", false);
  map.setTrace(runner.trace);
  renderRoute(true);
  renderRun();
  text("gps-status", "Běh obnovený v pauze. Až budeš připravený, pokračuj.");
  appNavigation.navigate("run");
});
action("discard-draft", async () => {
  if (
    await confirmAction(
      "Zahodit nedokončený záznam?",
      "Tuto GPS stopu už nebude možné obnovit.",
    )
  ) {
    repository.saveDraft(null);
    show("recovery", false);
    renderRoute();
  }
});
input("voice-enabled").addEventListener("change", () => {
  voice.enabled = input("voice-enabled").checked;
  try {
    storagePort.setItem("runguide.voice", String(voice.enabled));
  } catch {
    /* Keep this session's choice. */
  }
  if (!voice.enabled) voice.cancel();
});
setupVoiceSettings(voice, storagePort);
action("goal-use-route", () => input("use-route-distance").click());
action("export-all", () =>
  download(
    "runguide-soukroma-zaloha.json",
    JSON.stringify(
      {
        saved: JSON.parse(repository.backup()),
        pendingRun,
        currentDraft: active() ? runner.checkpoint(Date.now()) : null,
      },
      null,
      2,
    ),
  ),
);

async function updateAccount() {
  identityReady = false;
  renderRoute();
  await cloud.refreshIdentity();
  repository = new LocalRepository(storagePort, cloud.owner || "device");
  dashboard.loadProfile();
  identityReady = true;
  renderPlans();
  renderHistory();
  show("recovery", !!repository.draft());
  renderRoute();
  if (repository.warning) notice(repository.warning);
  show("login-form", !!cloud.client && !cloud.owner);
  show("cloud-actions", !!cloud.owner);
  text(
    "account-status",
    cloud.owner
      ? `Přihlášený účet: ${cloud.email || "soukromý účet"}. Místní historie je oddělená podle účtu.`
      : "Osobní režim: běhy jsou uložené pouze v tomto zařízení. Pravidelně si stáhni zálohu.",
  );
  if (!cloud.client)
    text(
      "cloud-status",
      "Přihlášení a cloudové ukládání zatím nejsou aktivované.",
    );
}
element("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = element<HTMLFormElement>("login-form");
  if (active() || pendingRun || !form.reportValidity()) return;
  const button = form.querySelector<HTMLButtonElement>("button")!;
  button.disabled = true;
  void cloud
    .login(input("login-email").value.trim())
    .then(() =>
      text(
        "cloud-status",
        "Pokud je účet pozvaný, přihlašovací odkaz najdeš v e-mailu. Otevři ho v tomto prohlížeči.",
      ),
    )
    .catch(report)
    .finally(() => {
      button.disabled = false;
    });
});
action("sync-cloud", async () => {
  if (active() || pendingRun || syncBusy || !cloud.owner) return;
  syncBusy = true;
  renderRun();
  renderRoute();
  text("cloud-status", "Synchronizuji soukromé běhy…");
  try {
    const result = await cloud.sync(repository.runs());
    repository.mergeRuns(result.runs, result.deletedIds);
    renderHistory();
    text("cloud-status", "Soukromá historie je synchronizovaná.");
  } finally {
    syncBusy = false;
    renderRun();
    renderRoute();
  }
});
action("import-device", async () => {
  if (active() || pendingRun || syncBusy || !cloud.owner) return;
  if (
    !(await confirmAction(
      "Převzít místní běhy do účtu?",
      "Potvrď, že běhy uložené v osobním režimu na tomto zařízení jsou tvoje. Při další synchronizaci se nahrají do tvého účtu.",
    ))
  )
    return;
  const local = new LocalRepository(storagePort);
  repository.mergeRuns(local.runs());
  renderHistory();
  notice(
    "Místní běhy převzaté. Synchronizaci spusť, až je budeš chtít zálohovat do cloudu.",
  );
});
action("logout", async () => {
  if (!active() && !pendingRun && !syncBusy) {
    await cloud.logout();
    await updateAccount();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!active()) return;
  checkpoint();
  if (document.hidden) voice.cancel();
});
window.addEventListener("beforeunload", (event) => {
  if (active() || pendingRun) event.preventDefault();
});
function networkStatus() {
  document.body.dataset.offline = String(!navigator.onLine);
  text(
    "offline-status",
    navigator.onLine
      ? "Aplikace je online · tvoje běhy zůstávají soukromé."
      : "Jsi offline · GPS a místní ukládání zůstávají dostupné, mapa může chybět.",
  );
}
window.addEventListener("online", networkStatus);
window.addEventListener("offline", networkStatus);
networkStatus();
registerApp((apply) => {
  show("update-app", true);
  action("update-app", async () => {
    if (active() || pendingRun) {
      notice("Aktualizaci spusť po ukončení a uložení běhu.");
      return;
    }
    await apply();
  });
});
setInterval(() => {
  if (active()) {
    renderRun();
    if (Date.now() - lastCheckpointAt >= 5000) checkpoint();
  }
}, 1000);
renderRoute();
renderRun();
renderPlans();
renderHistory();
void updateAccount().catch(report);
