import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Region } from "@/types/db";

const REGIONS: Region[] = ["Marmara", "Ege", "İç Anadolu"];

export default function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [region, setRegion] = useState<Region>("Marmara");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, region },
          },
        });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (e: any) {
      setErr(e.message ?? "Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="device">
      <div className="scroll-area p-6">
        <div className="pt-8 pb-6">
          <div className="text-3xl font-bold text-primary tracking-tight">ToolA</div>
          <div className="text-sm text-text-2 mt-1">Putzmeister · Saha Bakım Asistanı</div>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-bg-2 rounded-lg">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition ${
                mode === m ? "bg-background text-foreground shadow-sm" : "text-text-3"
              }`}
            >
              {m === "signin" ? "Giriş" : "Kayıt"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-2 mb-1.5">Ad Soyad</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Mehmet Yılmaz"
                  className="w-full px-3.5 py-3 bg-bg-2 border border-border rounded-[10px] text-[15px] outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-2 mb-1.5">Bölge</label>
                <div className="grid grid-cols-3 gap-2">
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRegion(r)}
                      className={`py-2.5 rounded-[10px] text-sm font-semibold border transition ${
                        region === r
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-bg-2 text-text-2 border-border"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1.5">E-posta</label>
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="usta@toola.app"
              className="w-full px-3.5 py-3 bg-bg-2 border border-border rounded-[10px] text-[15px] outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1.5">Şifre</label>
            <input
              required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" minLength={6}
              className="w-full px-3.5 py-3 bg-bg-2 border border-border rounded-[10px] text-[15px] outline-none focus:border-primary"
            />
          </div>
          {err && (
            <div className="text-sm text-destructive bg-destructive-bg p-3 rounded-lg">{err}</div>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? "Bekleyin..." : mode === "signin" ? "Giriş yap" : "Hesap oluştur"}
          </button>
        </form>
      </div>
    </div>
  );
}
