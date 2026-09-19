import { z } from "zod";
import { planSchema, runSchema, type Plan, type Run } from "../types/models";
import { draftSchema, type Draft } from "../types/recording";

const documentSchema = z.object({
  version: z.literal(2),
  runs: z.array(runSchema),
  plans: z.array(planSchema),
  draft: draftSchema.nullable(),
});
type StoredData = z.infer<typeof documentSchema>;
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export class LocalRepository {
  readonly key: string;
  private data: StoredData = { version: 2, runs: [], plans: [], draft: null };
  private readable = true;
  private lastRaw: string | null = null;
  warning = "";
  constructor(
    private storage: StoragePort,
    owner = "device",
  ) {
    this.key = `runguide-v2:${owner}`;
    try {
      const value = storage.getItem(this.key);
      this.lastRaw = value;
      if (value) this.data = documentSchema.parse(JSON.parse(value));
      else if (owner === "device") this.migratePlan();
    } catch {
      this.readable = false;
      this.warning =
        "Místní data nelze přečíst. Původní záznam zůstává zachovaný; nejdřív exportuj zálohu.";
    }
  }
  private migratePlan() {
    const old = this.storage.getItem("runguide-planned-route");
    if (old) {
      const parsed = z
        .object({
          route: planSchema.shape.points,
          goalDistance: z.coerce.number(),
          goalTime: z.coerce.number(),
        })
        .safeParse(JSON.parse(old));
      if (parsed.success) {
        const plan = planSchema.safeParse({
          id: crypto.randomUUID(),
          name: "Původní plán",
          goal: {
            distanceKm: parsed.data.goalDistance,
            durationMinutes: parsed.data.goalTime,
          },
          points: parsed.data.route,
          createdAt: new Date().toISOString(),
        });
        if (plan.success) this.data.plans.push(plan.data);
      }
    }
    if (this.storage.getItem("runguide-runs"))
      this.warning =
        "Starší prototyp ukládal plán místo GPS záznamu. Původní historii zachováváme v exportu zálohy, ale nezobrazujeme ji jako ověřené běhy.";
  }
  private save(data: StoredData) {
    if (!this.readable) throw new Error(this.warning);
    const validated = documentSchema.parse(data);
    if (this.storage.getItem(this.key) !== this.lastRaw)
      throw new Error(
        "Data byla změněna v jiné kartě. Nejdřív exportuj rozpracovaný běh a pak obnov stránku.",
      );
    const raw = JSON.stringify(validated);
    try {
      this.storage.setItem(this.key, raw);
      this.lastRaw = raw;
    } catch {
      throw new Error(
        "Záznam se nepodařilo uložit do telefonu. Uvolni místo nebo stáhni zálohu, než stránku zavřeš.",
      );
    }
    this.data = validated;
  }
  runs(): Run[] {
    return structuredClone(this.data.runs);
  }
  plans(): Plan[] {
    return structuredClone(this.data.plans);
  }
  draft(): Draft | null {
    return structuredClone(this.data.draft);
  }
  saveDraft(draft: Draft | null) {
    this.save({ ...this.data, draft });
  }
  savePlan(plan: Plan) {
    this.save({
      ...this.data,
      plans: [plan, ...this.data.plans.filter((p) => p.id !== plan.id)],
    });
  }
  deletePlan(id: string) {
    this.save({
      ...this.data,
      plans: this.data.plans.filter((p) => p.id !== id),
    });
  }
  saveRun(run: Run) {
    this.save({
      ...this.data,
      draft: this.data.draft?.id === run.id ? null : this.data.draft,
      runs: [run, ...this.data.runs.filter((r) => r.id !== run.id)],
    });
  }
  deleteRun(id: string) {
    this.save({
      ...this.data,
      runs: this.data.runs.filter((r) => r.id !== id),
    });
  }
  mergeRuns(runs: Run[], deletedIds: string[] = []) {
    const combined = new Map(runs.map((r) => [r.id, r]));
    // Unsynced local edits win. Cloud records never overwrite a local feedback draft.
    this.data.runs.forEach((r) => combined.set(r.id, r));
    deletedIds.forEach((id) => combined.delete(id));
    this.save({
      ...this.data,
      runs: Array.from(combined.values()).sort((a, b) =>
        b.startedAt.localeCompare(a.startedAt),
      ),
    });
  }
  backup(): string {
    return JSON.stringify(
      {
        version: 2,
        data: this.data,
        original: this.storage.getItem(this.key),
        legacyRuns: this.storage.getItem("runguide-runs"),
        legacyPlan: this.storage.getItem("runguide-planned-route"),
      },
      null,
      2,
    );
  }
}
