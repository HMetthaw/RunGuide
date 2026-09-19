import {
  durationMinutesAtPace,
  parsePaceInput,
} from "../domain/goal-calculator";
import { formatPace, targetPace } from "../domain/pace";
import { parseDecimalInput } from "../domain/goal-input";
import { goalSchema, type Goal } from "../types/models";

export function setupGoalCalculator(onChange: () => void) {
  const field = (id: string) => {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement))
      throw new Error(`Missing goal input: ${id}`);
    return element;
  };
  const distance = field("goal-distance");
  const time = field("goal-time");
  const minutes = field("goal-pace-minutes");
  const seconds = field("goal-pace-seconds");
  const error = document.getElementById("goal-error")!;
  let editingPace = false;
  let calculatedDuration: number | null = null;
  let calculatedTimeValue = "";

  function readGoal(): Goal | null {
    // Keep the precise result while the displayed time is unchanged. Only a
    // deliberate time edit or loading a different goal replaces this value.
    const durationMinutes =
      calculatedDuration !== null && time.value === calculatedTimeValue
        ? calculatedDuration
        : parseDecimalInput(time.value);
    const parsed = goalSchema.safeParse({
      distanceKm: parseDecimalInput(distance.value),
      durationMinutes,
    });
    const invalidPace =
      editingPace && parsePaceInput(minutes.value, seconds.value) === null;
    const target = parsed.success && !invalidPace ? parsed.data : null;
    if (!editingPace) {
      const parts = target
        ? formatPace(targetPace(target)).split(":")
        : ["", ""];
      minutes.value = parts[0];
      seconds.value = parts[1];
    }
    distance.setAttribute(
      "aria-invalid",
      String(
        !goalSchema.shape.distanceKm.safeParse(parseDecimalInput(distance.value)).success,
      ),
    );
    time.setAttribute(
      "aria-invalid",
      String(
        !goalSchema.shape.durationMinutes.safeParse(durationMinutes).success,
      ),
    );
    for (const input of [minutes, seconds])
      input.setAttribute("aria-invalid", String(invalidPace));
    error.textContent = invalidPace
      ? "Zadej celé minuty a sekundy 00–59. Tempo musí být větší než 0:00 min/km."
      : !parsed.success
        ? "Zadej vzdálenost 0,1–100 km a čas 1–1 440 minut. I čas vypočtený z tempa musí být v tomto rozmezí."
        : "";
    return target;
  }

  function notify() {
    readGoal();
    onChange();
  }
  function writeCalculatedTime(value: number) {
    calculatedDuration = value;
    calculatedTimeValue = String(Number(value.toFixed(6)));
    time.value = calculatedTimeValue;
  }
  function editPace() {
    editingPace = true;
    const pace = parsePaceInput(minutes.value, seconds.value);
    const parsedDistance = goalSchema.shape.distanceKm.safeParse(
      parseDecimalInput(distance.value),
    );
    if (pace !== null && parsedDistance.success) {
      const duration = durationMinutesAtPace(parsedDistance.data, pace);
      if (duration !== null) writeCalculatedTime(duration);
    }
    notify();
  }
  // Distance always preserves time; time and pace edits preserve distance.
  distance.addEventListener("input", () => {
    editingPace = false;
    notify();
  });
  time.addEventListener("input", () => {
    editingPace = false;
    calculatedDuration = null;
    notify();
  });
  for (const input of [minutes, seconds])
    input.addEventListener("input", editPace);
  seconds.addEventListener("blur", () => {
    if (parsePaceInput(minutes.value, seconds.value) !== null)
      seconds.value = seconds.value.padStart(2, "0");
  });

  function setDistance(distanceKm: number) {
    distance.value = String(distanceKm);
    editingPace = false;
    readGoal();
  }
  function setGoal(goal: Goal) {
    editingPace = false;
    calculatedDuration = null;
    distance.value = String(goal.distanceKm);
    time.value = String(goal.durationMinutes);
    readGoal();
  }
  readGoal();
  return { readGoal, setDistance, setGoal };
}
