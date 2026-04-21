import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "@/components/icons";

export default function Placeholder({ title, note }: { title: string; note: string }) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="grid grid-cols-[80px_1fr_80px] items-center px-5 py-3.5 border-b border-border min-h-[56px]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[15px] font-medium text-text-2 -ml-1 py-2">
          <ChevronLeft /> Geri
        </button>
        <div className="text-[17px] font-semibold tracking-tight text-center">{title}</div>
        <div />
      </div>
      <div className="p-8 text-center">
        <div className="text-5xl mb-4">🚧</div>
        <div className="text-base font-semibold mb-2">Build 2'de geliyor</div>
        <div className="text-sm text-text-2 leading-relaxed">{note}</div>
      </div>
    </div>
  );
}
