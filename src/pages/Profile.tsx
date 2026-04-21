import { useAuth } from "@/hooks/useAuth";

export default function Profile() {
  const { profile, user, signOut } = useAuth();
  return (
    <div>
      <div className="px-5 py-6 border-b border-border">
        <div className="text-[26px] font-bold tracking-tight">Profil</div>
      </div>
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
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between items-center py-3 border-b border-border">
    <span className="text-sm text-text-3">{k}</span>
    <span className="text-sm font-semibold">{v}</span>
  </div>
);
