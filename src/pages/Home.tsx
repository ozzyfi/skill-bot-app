import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Machine, WorkOrder } from "@/types/db";

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

const SparkIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.3 0 .56.2.64.49l1.36 5.01 5.01 1.36a.67.67 0 0 1 0 1.28l-5.01 1.36-1.36 5.01a.67.67 0 0 1-1.28 0l-1.36-5.01-5.01-1.36a.67.67 0 0 1 0-1.28l5.01-1.36 1.36-5.01A.67.67 0 0 1 12 2z"/></svg>
);
const AlertIcon = () => (
  <svg className="machine-alert-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const ClockIcon = () => (
  <svg className="machine-alert-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

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
        supabase
          .from("work_orders")
          .select("*, machines(*)")
          .neq("status", "closed")
          .order("created_at", { ascending: false }),
      ]);
      setMachines((m.data ?? []) as Machine[]);
      setOrders((o.data ?? []) as any);
      setLoading(false);
    })();
  }, []);

  const myOrders = orders;

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

  const regionStats = useMemo(
    () => ({
      total: machines.length,
      active: machines.filter((m) => m.status === "busy" || m.status === "fault").length,
      upcoming: machines.filter((m) => m.alert_text).length,
    }),
    [machines]
  );

  const cities = Array.from(new Set(machines.map((m) => m.city)));
  const firstName = profile?.full_name?.split(" ")[0] ?? "Usta";

  if (loading) return <div className="p-8 text-center text-text-3">Yükleniyor...</div>;

  return (
    <>
      {/* Greeting */}
      <div className="greeting">
        <div className="greeting-hi">Merhaba {firstName}</div>
        <div className="greeting-sub">Bugün {myOrders.length} iş atandı.</div>
      </div>

      {/* Quick Ask CTA */}
      <button className="quick-ask" onClick={() => navigate("/diagnosis")}>
        <div className="qa-icon"><SparkIcon /></div>
        <div className="qa-text">
          <div className="qa-title">Sor — Hemen yardım al</div>
          <div className="qa-sub">Sesli veya yazılı, Türkçe</div>
        </div>
      </button>

      {/* Home Tabs */}
      <div className="home-tabs">
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
            <button key={o.id} className="job" onClick={() => navigate(`/job/${o.id}`)}>
              <div className="job-head">
                <div className="job-name">{o.machines.name}</div>
                <div className={`job-badge ${o.badge}`}>
                  {o.badge === "urgent" ? "Devam" : o.badge === "active" ? "Atandı" : "Planlı"}
                </div>
              </div>
              <div className="job-loc">{o.machines.district}, {o.machines.city}</div>
              {o.description && <div className="job-desc">{o.description}</div>}
              <div className="job-ref">
                {o.code}{o.alarm_code ? ` · ${o.alarm_code}` : ""}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          {/* Region header */}
          <div className="region-header">
            <div className="region-header-title">{firstName}'in bölgesi</div>
            <div className="region-header-cities">{cities.join(" · ")}</div>
          </div>

          {/* Stats */}
          <div className="region-summary">
            <div className="region-stat">
              <div className="region-stat-val">{regionStats.total}</div>
              <div className="region-stat-lbl">Makine</div>
            </div>
            <div className="region-stat">
              <div className="region-stat-val warn">{regionStats.active}</div>
              <div className="region-stat-lbl">Aktif iş</div>
            </div>
            <div className="region-stat">
              <div className="region-stat-val accent">{regionStats.upcoming}</div>
              <div className="region-stat-lbl">Yaklaşan bakım</div>
            </div>
          </div>

          {/* Search */}
          <div className="region-search">
            <input
              type="text"
              className="region-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Makine, kod veya şehir ara..."
            />
          </div>

          {/* Filters */}
          <div className="region-filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`region-chip ${f.tone === "warn" ? "warn" : f.tone === "danger" ? "danger" : ""} ${filter === f.id ? "active" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* City groups */}
          {cityGroups.map(([city, list]) => (
            <div key={city}>
              <div className="region-city-header">
                <span>{city}</span>
                <span className="city-count">{list.length} makine</span>
              </div>
              {list.map((m) => (
                <button key={m.id} className="machine" onClick={() => navigate(`/machine/${m.id}`)}>
                  <div className="machine-head">
                    <div className="machine-name">{m.name}</div>
                    {m.status !== "ok" && (
                      <div className={`machine-status ${m.status}`}>
                        {m.status === "fault" ? "Arıza" : m.status === "busy" ? "Atandı" : "Bakımda"}
                      </div>
                    )}
                  </div>
                  <div className="machine-meta">
                    <span>{m.district}</span>
                    <span className="dot" />
                    <span>Son servis: {fmt(m.last_service)}</span>
                  </div>
                  {m.alert_text && (
                    <div className="machine-alerts">
                      {m.status === "service" ? <ClockIcon /> : <AlertIcon />}
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

const fmt = (d: string | null) => {
  if (!d) return "-";
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]}`;
};
