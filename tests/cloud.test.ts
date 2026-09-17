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
