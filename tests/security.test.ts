import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
const runId = "44444444-4444-4444-8444-444444444444",
  routeId = "55555555-5555-4555-8555-555555555555";
async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create table auth.users (id uuid primary key); create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  // PGlite has core gen_random_uuid; Supabase additionally installs pgcrypto in production.
  const initial = readFileSync(
    "supabase/migrations/20260916180000_initial_schema.sql",
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(initial);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260916220000_private_beta_security.sql",
      "utf8",
    ),
  );
  await db.exec(`insert into auth.users(id) values ('${alice}'), ('${bob}'), ('${outsider}');
    insert into public.beta_access(user_id) values ('${alice}'), ('${bob}');
    insert into public.running_routes(id, owner_id, name, simplified_path, distance_meters) values ('${routeId}', '${bob}', 'Private', '[[18,49],[18,49.1]]', 1000);`);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("database authorization executed in PostgreSQL", () => {
  it("allows an invited owner to insert/read a private run", async () => {
    await asUser(alice);
    await db.exec(
      `insert into public.runs(id, owner_id, status) values ('${runId}', '${alice}', 'completed');`,
    );
    expect((await db.query("select * from public.runs")).rows).toHaveLength(1);
  });
  it("prevents another user reading, changing or deleting the run", async () => {
    await asUser(bob);
    expect((await db.query("select * from public.runs")).rows).toHaveLength(0);
    expect(
      (
        await db.query(
          `update public.runs set distance_meters=999 where id='${runId}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          `delete from public.runs where id='${runId}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("blocks spoofed owner IDs and cross-owner route references", async () => {
    await asUser(alice);
    await expect(
      db.exec(`insert into public.runs(owner_id) values ('${bob}')`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.runs(owner_id, route_id) values ('${alice}', '${routeId}')`,
      ),
    ).rejects.toThrow("Route is not available");
  });
  it("does not let a user enroll themselves or read game history", async () => {
    await asUser(outsider);
    await expect(
      db.exec(`insert into public.beta_access(user_id) values ('${outsider}')`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.profiles(id, display_name) values ('${outsider}', 'User')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query("select * from public.territory_claims"),
    ).rejects.toThrow();
  });
  it("blocks anonymous users and revokes access after beta removal", async () => {
    await db.exec("reset role; set role anon;");
    await expect(db.query("select * from public.runs")).rejects.toThrow();
    await db.exec(
      `reset role; update public.beta_access set enabled=false where user_id='${alice}';`,
    );
    await asUser(alice);
    expect((await db.query("select * from public.runs")).rows).toHaveLength(0);
  });
  it("deletes GPS data atomically and blocks resurrection by an old phone", async () => {
    await db.exec(
      `reset role; update public.beta_access set enabled=true where user_id='${alice}';`,
    );
    await asUser(alice);
    await db.exec(`select public.delete_private_run('${runId}');`);
    expect((await db.query("select * from public.runs")).rows).toHaveLength(0);
    expect(
      (await db.query("select * from public.run_deletions")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(
        `insert into public.runs(id, owner_id) values ('${runId}', '${alice}')`,
      ),
    ).rejects.toThrow("deleted");
    await asUser(bob);
    expect(
      (await db.query("select * from public.run_deletions")).rows,
    ).toHaveLength(0);
  });
});
