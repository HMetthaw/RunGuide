import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runSchema, type Run } from "../types/models";

export class CloudRepository {
  readonly client: SupabaseClient | null;
  owner: string | null = null;
  email: string | null = null;
  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    this.client =
      url && key && !url.includes("your-project")
        ? createClient(url, key, {
            auth: {
              flowType: "pkce",
              persistSession: true,
              detectSessionInUrl: true,
            },
          })
        : null;
  }
  async refreshIdentity() {
    if (!this.client) return;
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) {
      this.owner = null;
      this.email = null;
      return;
    }
    this.owner = data.user.id;
    this.email = data.user.email || null;
  }
  async login(email: string) {
    if (!this.client) throw new Error("Cloudový účet zatím není propojený.");
    const redirect = new URL("runner.html", location.href);
    redirect.hash = "";
    redirect.search = "";
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirect.href },
    });
    if (error)
      throw new Error(
        "Odkaz se nepodařilo odeslat. Zkontroluj pozvánku, e-mail a připojení.",
      );
  }
  async logout() {
    const result = await this.client?.auth.signOut({ scope: "local" });
    if (result?.error)
      throw new Error("Odhlášení se nepodařilo. Zkus to znovu.");
    this.owner = null;
    this.email = null;
  }
  private async verifiedClient(): Promise<{
    client: SupabaseClient;
    owner: string;
  }> {
    const expected = this.owner;
    if (!this.client || !expected) throw new Error("Přihlas se do svého účtu.");
    const { data, error } = await this.client.auth.getUser();
    if (error || data.user?.id !== expected)
      throw new Error(
        "Přihlášení se změnilo. Obnov stránku a přihlas se znovu.",
      );
    // Keep the local repository bound to its original owner even after a rejected identity change.
    return { client: this.client, owner: expected };
  }
  async sync(runs: Run[]): Promise<{ runs: Run[]; deletedIds: string[] }> {
    const { client, owner } = await this.verifiedClient();
    const deletedIds: string[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("run_deletions")
        .select("run_id")
        .eq("owner_id", owner)
        .order("run_id")
        .range(offset, offset + 499);
      if (error)
        throw new Error(
          "Smazané běhy nelze ověřit. Synchronizaci zopakuj později.",
        );
      for (const row of data || [])
        if (typeof row.run_id === "string") deletedIds.push(row.run_id);
      if (!data || data.length < 500) break;
    }
    runs = runs.filter((run) => !deletedIds.includes(run.id));
    if (runs.length) {
      const rows = runs.map((raw) => {
        const run = runSchema.parse(raw);
        return {
          id: run.id,
          owner_id: owner,
          status: "completed",
          started_at: run.startedAt,
          finished_at: run.finishedAt,
          distance_meters: Math.round(run.distanceMeters),
          duration_seconds: Math.round(run.durationSeconds),
          average_pace_seconds_per_km:
            run.distanceMeters > 0
              ? Math.max(
                  1,
                  Math.round((run.durationSeconds * 1000) / run.distanceMeters),
                )
              : null,
          simplified_path: run.trace.map((p) => [p.lng, p.lat]),
          client_record: run,
        };
      });
      // Completed GPS records are immutable snapshots: an older device must not overwrite them.
      const { error } = await client
        .from("runs")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error)
        throw new Error(
          "Cloud běhy nepřijal. Zkontroluj pozvánku, připojení a nastavení databáze. Místní kopie zůstává.",
        );
    }
    const records: Run[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client
        .from("runs")
        .select("client_record")
        .eq("owner_id", owner)
        .order("id")
        .range(offset, offset + 499);
      if (error)
        throw new Error(
          "Historii z cloudu se nepodařilo načíst. Místní kopie zůstává.",
        );
      for (const row of data || []) {
        const run = runSchema.safeParse(row.client_record);
        if (run.success) records.push(run.data);
      }
      if (!data || data.length < 500) break;
    }
    return { runs: records, deletedIds };
  }
  async deleteRun(id: string) {
    const { client } = await this.verifiedClient();
    const { error } = await client.rpc("delete_private_run", {
      target_run_id: id,
    });
    if (error)
      throw new Error(
        "Cloudové smazání se nepodařilo. Běh zatím zůstává i v telefonu.",
      );
  }
}
