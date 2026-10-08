import { describe, expect, it } from "vitest";
import { LocalRepository, type StoragePort } from "../src/services/storage";
import { Runner } from "../src/domain/runner";
import { gpx } from "../src/services/export";
class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("Quota");
    this.values.set(key, value);
  }
}
function recordedRun() {
  const runner = new Runner(),
    now = 1789500000000;
  runner.start({ distanceKm: 5, durationMinutes: 30 }, []);
  for (let i = 0; i <= 30; i++)
    runner.ingest(
      {
        lat: 49 + i / 40000,
        lng: 18,
        accuracy: 5,
        timestamp: now + i * 1000,
        speed: null,
      },
      now + i * 1000,
    );
  return runner.finish(now + 30000)!;
}
describe("private local persistence", () => {
  it("preserves routed geometry, distance and editing points through plan and active-run reloads", () => {
    const storage = new MemoryStorage(),
      repo = new LocalRepository(storage);
    const points = [
      { lat: 50, lng: 14 },
      { lat: 50.01, lng: 14 },
      { lat: 50.01, lng: 14.01 },
    ];
    const plan = {
      id: crypto.randomUUID(),
      name: "Po cestách",
      goal: { distanceKm: 2, durationMinutes: 12 },
      points,
      routing: {
        profile: "foot" as const,
        provider: "osrm" as const,
        waypoints: [points[0], points[2]],
        distanceMeters: 1800,
      },
      createdAt: new Date().toISOString(),
    };
    repo.savePlan(plan);
    expect(new LocalRepository(storage).plans()[0]).toEqual(plan);
    const runner = new Runner(),
      now = 1789500000000;
    runner.start(plan.goal, points, plan.routing);
    runner.ingest(
      { ...points[0], timestamp: now, accuracy: 5, speed: null },
      now,
    );
    repo.saveDraft(runner.checkpoint(now));
    const restored = new Runner();
    restored.restore(new LocalRepository(storage).draft());
    expect(restored.route).toEqual(points);
    expect(restored.routing).toEqual(plan.routing);
  });
  it("roundtrips actual traces, goals and feedback", () => {
    const storage = new MemoryStorage(),
      repo = new LocalRepository(storage),
      run = recordedRun();
    repo.saveRun({ ...run, feedback: "<img src=x onerror=alert(1)>" });
    const loaded = new LocalRepository(storage).runs()[0];
    expect(loaded.trace).toEqual(run.trace);
    expect(loaded.feedback).toContain("<img");
  });
  it("retains all historical runs instead of silently deleting after 50", () => {
    const repo = new LocalRepository(new MemoryStorage()),
      run = recordedRun();
    for (let i = 0; i < 55; i++)
      repo.saveRun({ ...run, id: crypto.randomUUID() });
    expect(repo.runs()).toHaveLength(55);
  });
  it("does not overwrite corrupt stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem("runguide-v2:device", "{broken");
    const repo = new LocalRepository(storage);
    expect(repo.warning).not.toBe("");
    expect(() => repo.saveRun(recordedRun())).toThrow();
    expect(storage.getItem(repo.key)).toBe("{broken");
    expect(repo.backup()).toContain("{broken");
  });
  it("does not report success or mutate in-memory history on quota error", () => {
    const storage = new MemoryStorage(),
      repo = new LocalRepository(storage);
    storage.failWrites = true;
    expect(() => repo.saveRun(recordedRun())).toThrow("uložit");
    expect(repo.runs()).toHaveLength(0);
  });
  it("separates account histories and device history", () => {
    const storage = new MemoryStorage();
    new LocalRepository(storage, "alice").saveRun(recordedRun());
    expect(new LocalRepository(storage, "bob").runs()).toHaveLength(0);
    expect(new LocalRepository(storage).runs()).toHaveLength(0);
  });
  it("rejects overwrites from a stale second tab", () => {
    const storage = new MemoryStorage(),
      a = new LocalRepository(storage),
      b = new LocalRepository(storage);
    a.saveRun(recordedRun());
    expect(() => b.saveRun(recordedRun())).toThrow("jiné kartě");
    expect(new LocalRepository(storage).runs()).toHaveLength(1);
  });
  it("exports GPS records as a standards-shaped GPX file", () => {
    const xml = gpx(recordedRun());
    expect(xml).toContain("<trkseg>");
    expect(xml).toContain('lat="49"');
    expect(xml).not.toContain("<script");
    const elevated = recordedRun();
    elevated.trace[0].altitude = 321.5;
    expect(gpx(elevated)).toContain("<ele>321.5</ele>");
  });
  it("persists interruption quality privately and exports disjoint GPX segments", () => {
    const storage = new MemoryStorage();
    const run = recordedRun();
    const last = run.trace.at(-1)!;
    run.trace.push({
      ...last,
      timestamp: last.timestamp + 60000,
      segment: last.segment + 1,
    });
    run.quality = {
      gaps: 1,
      rejectedFixes: 3,
      untrackedSeconds: 60,
      recoveryUncertain: true,
    };
    new LocalRepository(storage, "alice").saveRun(run);
    const saved = new LocalRepository(storage, "alice").runs()[0];
    expect(saved.quality).toEqual(run.quality);
    expect(new LocalRepository(storage, "bob").runs()).toHaveLength(0);
    expect(gpx(saved).match(/<trkseg>/g)).toHaveLength(2);
  });
  it("keeps an interrupted run when editing a different historical run", () => {
    const storage = new MemoryStorage(),
      repo = new LocalRepository(storage),
      runner = new Runner();
    runner.start({ distanceKm: 5, durationMinutes: 30 }, []);
    runner.ingest(
      { lat: 49, lng: 18, accuracy: 5, timestamp: 1789500000000, speed: null },
      1789500000000,
    );
    const draft = runner.checkpoint(1789500005000)!;
    repo.saveDraft(draft);
    repo.saveRun(recordedRun());
    expect(repo.draft()?.id).toBe(draft.id);
  });
});
