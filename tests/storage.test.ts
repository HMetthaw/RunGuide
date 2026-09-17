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
