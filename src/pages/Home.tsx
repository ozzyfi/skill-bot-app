import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Machine, WorkOrder } from "@/types/db";
import { Alert, Clock, Spark } from "@/components/icons";

type Tab = "jobs" | "region";
type Filter = "all" | "active" | "upcoming" | "fault" | "BSF" | "BSA";

const FILTERS: { id: Filter; label: string; tone?: "warn" | "danger" }[] = [
  { id: "all", label: "Tümü" },
  { id: "active", label: "Aktif iş", tone: "warn" },
  { id: "upcoming", label: "Yaklaşan bakım" },
  { id: "fault", label: "Arızalı", tone: "danger" },
  { id: "BSF", label: "BSF" },
  { id: "BSA", label: "BSA" },
];

export default function Home() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("jobs");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [orders, setOrders] = useState<(WorkOrder & { machines: Machine })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    (async () => {
      const [m, o] = await Promise.all([
        supabase.from("machines").select("*").order("city"),
        supabase.from("work_orders").select("*, machines(*)").neq("status", "closed").order("created_at", { ascending: false }),
      ]);
      setMachines((m.data ?? []) as Machine[]);
      setOrders((o.data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  const myOrders = orders;
  const upcoming = useMemo(
    () =>
      machines
        .filter((mc) => mc.alert_text)
        .slice(0, 2),
    [machines]
  );

  const filteredMachines = useMemo(() => {
    let list = machines;
    if (search) {
      const q = search.toLocaleLowerCase("tr-TR");
      list = list.filter(
        (m) =>
          m.name.toLocaleLowerCase("tr-TR").includes(q) ||
          m.code.toLocaleLowerCase("tr-TR").includes(q) ||
          m.city.toLocaleLowerCase("tr-TR").includes(q)
      );
    }
    if (filter === "active") list = list.filter((m) => m.status === "busy" || m.status === "fault");
    else if (filter === "fault") list = list.filter((m) => m.status === "fault");
    else if (filter === "upcoming") list = list.filter((m) => !!m.alert_text);
    else if (filter === "BSF") list = list.filter((m) => m.model.startsWith("BSF"));
    else if (filter === "BSA") list = list.filter((m) => m.model.startsWith("BSA"));
    return list;
  }, [machines, search, filter]);

  const cityGroups = useMemo(() => {
    const map = new Map<string, Machine[]>();
    filteredMachines.forEach((m) => {
      if (!map.has(m.city)) map.set(m.city, []);
      map.get(m.city)!.push(m);
    });
    return Array.from(map.entries());
  }, [filteredMachines]);

  const regionStats = useMemo(() => {
    return {
      total: machines.length,
      active: machines.filter((m) => m.status === "busy" || m.status === "fault").length,
      upcoming: machines.filter((m) => m.alert_text).length,
    };
  }, [machines]);

  if (loading) return <div className="p-8 text-center text-text-3">Yükleniyor...</div>;

  return (
    <>
      {/* Greeting */}
      <div className="px-5 pt-6 pb-2">
        <div className="text-[26px] font-bold tracking-tight leading-tight">
          Merhaba {profile?.full_name?.split(" ")[0] ?? "Usta"}
        </div>
        <div className="text-[15px] text-text-2 mt-1">
          Bugün {myOrders.length} iş atandı.
        </div>
      </div>

      {/* Quick Ask */}
      <button className="quick-ask" onClick={() => navigate("/diagnosis")}>
        <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
          <Spark />
        </div>
        <div className="flex-1">
          <div className="text-[16px] font-semibold text-white">Sor — Hemen yardım al</div>
          <div className="text-[13px] text-white/85 mt-0.5">Sesli veya yazılı, Türkçe</div>
        </div>
      </button>

      {/* Prediction panel */}
      {upcoming.length > 0 && (
        <div className="mx-5 mb-4 p-3 bg-warn-bg border border-warn rounded-xl">
          <div className="text-[11px] font-bold text-warn uppercase tracking-wider mb-2">
            ⚡ Yaklaşan Riskler
          </div>
          {upcoming.map((m) => (
            <button
              key={m.id}
              className="w-full text-left py-1.5 text-[13px] text-text-2"
              onClick={() => navigate(`/machine/${m.id}`)}
            >
              <strong className="text-foreground">{m.name}</strong> — {m.alert_text}
            </button>
          ))}
        </div>
      )}

      {/* Home Tabs */}
      <div className="flex px-5 border-b border-border mt-1">
        <button className={`home-tab ${tab === "jobs" ? "active" : ""}`} onClick={() => setTab("jobs")}>
          İşlerim <span className="home-tab-count">{myOrders.length}</span>
        </button>
        <button className={`home-tab ${tab === "region" ? "active" : ""}`} onClick={() => setTab("region")}>
          Bölgem <span className="home-tab-count">{machines.length}</span>
        </button>
      </div>

      {tab === "jobs" ? (
        <div>
          {myOrders.length === 0 && (
            <div className="p-8 text-center text-text-3 text-sm">Atanmış iş yok.</div>
          )}
          {myOrders.map((o) => (
            <button
              key={o.id}
              onClick={() => navigate(`/job/${o.id}`)}
              className="block w-full text-left p-5 border-t border-border bg-background active:bg-bg-2"
            >
              <div className="flex justify-between items-center gap-3 mb-1.5">
                <div className="text-[17px] font-semibold tracking-tight flex-1 leading-tight">
                  {o.machines.name}
                </div>
                <span className={`job-badge ${o.badge}`}>
                  {o.badge === "urgent" ? "Devam" : o.badge === "active" ? "Atandı" : "Planlı"}
                </span>
              </div>
              <div className="text-sm text-text-2 mb-2">
                {o.machines.district}, {o.machines.city}
              </div>
              <div className="text-sm text-text-2 leading-snug mb-2.5">{o.description}</div>
              <div className="text-xs text-text-3 font-medium">
                {o.code} · {o.alarm_code}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          {/* Region header */}
          <div className="px-5 py-4 pb-2">
            <div className="text-[17px] font-bold tracking-tight">
              {profile?.full_name?.split(" ")[0]}'in bölgesi
            </div>
            <div className="text-[13px] text-text-3 font-medium">
              {Array.from(new Set(machines.map((m) => m.city))).join(" · ")}
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 py-4 bg-bg-2 border-y border-border flex justify-between gap-3">
            <Stat val={regionStats.total} label="Makine" />
            <Stat val={regionStats.active} label="Aktif iş" tone="warn" />
            <Stat val={regionStats.upcoming} label="Yaklaşan bakım" tone="accent" />
          </div>

          {/* Search */}
          <div className="px-5 pt-3.5 pb-2.5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Makine, kod veya şehir ara..."
              className="w-full pl-9 pr-3.5 py-3 bg-bg-2 border border-border rounded-[10px] text-sm outline-none focus:border-primary focus:bg-background"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238a9099' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='7'/><line x1='21' y1='21' x2='16.5' y2='16.5'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "12px center",
              }}
            />
          </div>

          {/* Filters */}
          <div className="px-5 pb-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`region-chip ${f.tone ?? ""} ${filter === f.id ? "active" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {cityGroups.map(([city, list]) => (
            <div key={city}>
              <div className="px-5 py-3 text-xs font-semibold text-text-3 uppercase tracking-wider bg-bg-2 border-y border-border flex justify-between">
                <span>{city}</span>
                <span className="text-text-3 font-medium normal-case tracking-normal">
                  {list.length} makine
                </span>
              </div>
              {list.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/machine/${m.id}`)}
                  className="block w-full text-left px-5 py-3.5 border-b border-border bg-background active:bg-bg-2"
                >
                  <div className="flex justify-between items-center gap-2.5 mb-1.5">
                    <div className="text-[15px] font-semibold leading-tight flex-1">{m.name}</div>
                    {m.status !== "ok" && (
                      <span className={`ms-badge ${m.status}`}>
                        {m.status === "fault" ? "Arıza" : m.status === "busy" ? "Atandı" : "Bakımda"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[13px] text-text-2 mb-1.5">
                    <span>{m.district}</span>
                    <span className="self-center w-[3px] h-[3px] rounded-full bg-text-3" />
                    <span>Son servis: {fmt(m.last_service)}</span>
                  </div>
                  {m.alert_text && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-dashed border-border text-xs text-warn font-medium items-center">
                      {m.status === "service" ? <Clock /> : <Alert />}
                      <span>{m.alert_text}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const Stat = ({ val, label, tone }: { val: number; label: string; tone?: "warn" | "accent" }) => (
  <div className="flex-1 text-center">
    <div
      className={`text-xl font-bold leading-none tracking-tight ${
        tone === "warn" ? "text-warn" : tone === "accent" ? "text-primary" : "text-foreground"
      }`}
    >
      {val}
    </div>
    <div className="text-[11px] text-text-3 mt-1 font-medium">{label}</div>
  </div>
);

const fmt = (d: string | null) => {
  if (!d) return "-";
  const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]}`;
};
