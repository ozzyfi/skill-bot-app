// Offline sync queue — persists pending mutations in localStorage
// and replays them when online. Used for closing work orders when offline.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "toola_sync_queue_v1";

export type QueuedJob = {
  id: string; // local uuid
  ts: number;
  kind: "close_wo";
  payload: any;
  status: "pending" | "syncing" | "synced" | "failed";
  error?: string;
};

function load(): QueuedJob[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(q: QueuedJob[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {}
}

export function enqueue(job: Omit<QueuedJob, "id" | "ts" | "status">) {
  const q = load();
  q.push({ ...job, id: crypto.randomUUID(), ts: Date.now(), status: "pending" });
  save(q);
  window.dispatchEvent(new CustomEvent("toola-queue-change"));
}

export async function flushQueue(): Promise<{ ok: number; fail: number }> {
  if (!navigator.onLine) return { ok: 0, fail: 0 };
  let q = load();
  let ok = 0, fail = 0;
  for (const job of q) {
    if (job.status === "synced") continue;
    job.status = "syncing";
    save(q);
    try {
      if (job.kind === "close_wo") {
        const { woId, closing_notes, learning } = job.payload;
        const { error } = await supabase
          .from("work_orders")
          .update({ status: "closed", badge: "scheduled", closed_at: new Date().toISOString(), closing_notes })
          .eq("id", woId);
        if (error) throw error;
        if (learning) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from("learning_cases").insert({ ...learning, created_by: user?.id ?? null });
        }
      }
      job.status = "synced";
      ok++;
    } catch (e: any) {
      job.status = "failed";
      job.error = e?.message ?? "sync failed";
      fail++;
    }
    save(q);
  }
  // clean up synced after 30s
  setTimeout(() => {
    save(load().filter((j) => j.status !== "synced"));
    window.dispatchEvent(new CustomEvent("toola-queue-change"));
  }, 30_000);
  window.dispatchEvent(new CustomEvent("toola-queue-change"));
  return { ok, fail };
}

export function useSyncQueue() {
  const [queue, setQueue] = useState<QueuedJob[]>(load);
  const refresh = useCallback(() => setQueue(load()), []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener("toola-queue-change", onChange);
    window.addEventListener("online", () => { flushQueue().then(refresh); });
    return () => window.removeEventListener("toola-queue-change", onChange);
  }, [refresh]);

  return { queue, pending: queue.filter((j) => j.status !== "synced").length, refresh, flush: flushQueue };
}
