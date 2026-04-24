import { useEffect, useState } from "react";

const STEPS = [
  "Hata kodu analiz ediliyor",
  "Kılavuz taranıyor",
  "Saha verileri eşleştiriliyor",
  "Çelişkiler kontrol ediliyor",
];

/** Animated "AI is thinking" stepper. While `loading=true`, advances steps every ~700ms.
 *  When `loading` flips to false, all steps mark as done. */
export default function ThinkingSteps({ loading }: { loading: boolean }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!loading) {
      setActive(STEPS.length); // mark all done
      return;
    }
    setActive(0);
    const id = setInterval(() => {
      setActive((a) => (a < STEPS.length - 1 ? a + 1 : a));
    }, 700);
    return () => clearInterval(id);
  }, [loading]);

  return (
    <div className="thinking">
      {STEPS.map((label, i) => {
        const state = i < active ? "done" : i === active && loading ? "active" : loading ? "" : "done";
        return (
          <div key={i} className={`think-step ${state}`}>
            <div className="think-dot">
              {state === "done" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
