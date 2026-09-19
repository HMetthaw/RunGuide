import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  signInWithOtp: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser, signInWithOtp: mocks.signInWithOtp },
    from: mocks.from,
  }),
}));
import { CloudRepository } from "../src/services/cloud";
import type { Run } from "../src/types/models";
beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-test-key");
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("fails closed without cloud configuration", () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  expect(new CloudRepository().client).toBeNull();
});
it("does not send account A history to account B, even after repeated sync attempts", async () => {
  const cloud = new CloudRepository();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "alice", email: "a@example.test" } },
    error: null,
  });
  await cloud.refreshIdentity();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "bob", email: "b@example.test" } },
    error: null,
  });
  await expect(cloud.sync([])).rejects.toThrow("změnilo");
  await expect(cloud.sync([])).rejects.toThrow("změnilo");
  expect(mocks.from).not.toHaveBeenCalled();
  expect(cloud.owner).toBe("alice");
});
it("keeps the original identity if a session expires while deleting", async () => {
  const cloud = new CloudRepository();
  cloud.owner = "alice";
  mocks.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error("Expired"),
  });
  await expect(cloud.deleteRun(crypto.randomUUID())).rejects.toThrow();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("uploads an incomplete run with null average pace and retains its quality metadata", async () => {
  const cloud = new CloudRepository();
  cloud.owner = "alice";
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "alice" } },
    error: null,
  });
  const run: Run = {
    id: crypto.randomUUID(),
    startedAt: "2026-09-19T10:00:00.000Z",
    finishedAt: "2026-09-19T10:30:00.000Z",
    durationSeconds: 1800,
    distanceMeters: 4840,
    goal: { distanceKm: 5.7, durationMinutes: 30 },
    trace: [],
    plannedRoute: [],
    feedback: "",
    quality: {
      gaps: 1,
      rejectedFixes: 0,
      untrackedSeconds: 120,
      recoveryUncertain: true,
    },
  };
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const query = (records: { client_record: Run }[]) => ({
    select: () => ({
      eq: () => ({
        order: () => ({ range: async () => ({ data: records, error: null }) }),
      }),
    }),
  });
  mocks.from.mockImplementation((table: string) =>
    table === "run_deletions"
      ? query([])
      : { ...query([{ client_record: run }]), upsert },
  );
  const result = await cloud.sync([run]);
  expect(upsert).toHaveBeenCalledWith(
    [
      expect.objectContaining({
        average_pace_seconds_per_km: null,
        distance_meters: 4840,
        duration_seconds: 1800,
        owner_id: "alice",
        client_record: run,
      }),
    ],
    { onConflict: "id", ignoreDuplicates: true },
  );
  expect(result.runs[0].quality).toEqual(run.quality);
});
