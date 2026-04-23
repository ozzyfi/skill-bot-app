import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { MasterProfile, CorrectionRule } from "@/types/db";

export default function Profile() {
  const { profile, user, signOut } = useAuth();
  const [tab, setTab] = useState<"profil" | "usta" | "kurallar">("profil");
  const [usta, setUsta] = useState<MasterProfile | null>(null);
  const [loadingUsta, setLoadingUsta] = useState(false);
  const [rules, setRules] = useState<CorrectionRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);

  useEffect(() => {
    if (tab !== "usta" || !profile?.region) return;
    setLoadingUsta(true);
    supabase
      .from("master_profiles")
      .select("*")
      .eq("region", profile.region)
      .eq("is_active", true)
      .order("experience_years", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setUsta(data as MasterProfile | null);
        setLoadingUsta(false);
      });
  }, [tab, profile?.region]);

  useEffect(() => {
    if (tab !== "kurallar" || !profile?.region) return;
    setLoadingRules(true);
    supabase
      .from("correction_rules")
      .select("*")
      .eq("region", profile.region)
      .eq("is_active", true)
      .order("applied_count", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRules((data ?? []) as any);
        setLoadingRules(false);
      });
  }, [tab, profile?.region]);

  return (
    <div>
      <div className="px-5 py-6 border-b border-border">
        <div className="text-[26px] font-bold tracking-tight">Profil</div>
      </div>

      <div className="flex border-b border-border px-5">
        <TabBtn active={tab === "profil"} onClick={() => setTab("profil")}>Profilim</TabBtn>
        <TabBtn active={tab === "usta"} onClick={() => setTab("usta")}>Usta'm</TabBtn>
        <TabBtn active={tab === "kurallar"} onClick={() => setTab("kurallar")}>Kurallar</TabBtn>
      </div>

      {tab === "profil" && (
        <>
          <div className="p-5 space-y-4">
            <Row k="Ad Soyad" v={profile?.full_name ?? "-"} />
            <Row k="E-posta" v={user?.email ?? "-"} />
            <Row k="Bölge" v={profile?.region ?? "-"} />
            <Row k="Müşteri" v={profile?.client ?? "-"} />
          </div>
          <div className="px-5 mt-4">
            <button onClick={signOut} className="btn-secondary w-full">
              Çıkış yap
            </button>
          </div>
          <div className="px-5 mt-6 text-xs text-text-3">
            SAP / Maximo entegrasyonu: <span className="font-semibold text-text-2">Beklemede</span>
          </div>
        </>
      )}

      {tab === "usta" && (
        <div className="p-5 space-y-4">
          {loadingUsta && <div className="text-sm text-text-3">Yükleniyor…</div>}
          {!loadingUsta && !usta && (
            <div className="text-sm text-text-3">
              {profile?.region} bölgesi için aktif usta profili bulunamadı.
            </div>
          )}
          {!loadingUsta && usta && (
            <>
              <div className="bg-primary-bg border border-primary/20 rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider text-primary font-bold mb-1">Bu cevapları veren</div>
                <div className="text-[20px] font-bold">{usta.name}</div>
                <div className="text-[13px] text-text-2 mt-0.5">
                  {usta.experience_years} yıl · {usta.city} · {usta.domain}
                </div>
              </div>

              <Section title="İş Bilgisi (work.md)">
                <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed font-mono text-text-2">{usta.work_md}</pre>
              </Section>

              <Section title="Persona (persona.md)">
                <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed font-mono text-text-2">{usta.persona_md}</pre>
              </Section>

              <div className="text-[11px] text-text-3 px-1">
                Versiyon {usta.version} · Son güncelleme: {new Date(usta.updated_at).toLocaleDateString("tr-TR")}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px ${
      active ? "border-primary text-primary" : "border-transparent text-text-3"
    }`}
  >
    {children}
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-bg-2 border border-border rounded-xl p-4">
    <div className="text-[11px] font-bold text-text-3 uppercase tracking-wider mb-2">{title}</div>
    {children}
  </div>
);

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between items-center py-3 border-b border-border">
    <span className="text-sm text-text-3">{k}</span>
    <span className="text-sm font-semibold">{v}</span>
  </div>
);
