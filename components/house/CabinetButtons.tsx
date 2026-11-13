"use client";

// Local cabinet actions on the passport: save the house, support an issue (§5.4).
import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markSupported, toggleSavedHouse, useCabinet } from "@/components/map/savedHouses";
import { cn } from "@/lib/utils";

export function SaveHouseButton({ buildingId }: { buildingId: string }) {
  const saved = useCabinet().houses.includes(buildingId);
  return (
    <Button
      variant="outline"
      aria-pressed={saved}
      onClick={() => toast.success(toggleSavedHouse(buildingId) ? "Дом сохранён" : "Дом убран из сохранённых")}
      className="h-10 rounded-full"
    >
      <Heart className={cn("transition-colors duration-200", saved && "fill-coral text-coral")} />
      {saved ? "Сохранён" : "Сохранить дом"}
    </Button>
  );
}

export function SupportButton({ issueId, supports }: { issueId: string; supports: number }) {
  const supported = useCabinet().supported.includes(issueId);
  const [count, setCount] = useState(supports);
  const [busy, setBusy] = useState(false);

  async function support() {
    setBusy(true);
    let error = "Не получилось, проверьте интернет и попробуйте ещё раз";
    try {
      const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}/support`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { supports?: number; error?: string };
      if (res.ok && body.supports !== undefined) {
        setCount(body.supports);
        markSupported(issueId);
        error = "";
      } else if (body.error) error = body.error;
    } catch {
      // network error: keep the default message
    }
    if (error) toast.error(error);
    setBusy(false);
  }

  if (supported) return <span className="self-start text-xs font-medium text-turquoise">Вы поддержали · {count}</span>;
  return (
    <Button variant="outline" size="xs" onClick={support} disabled={busy} className="self-start rounded-full">
      Меня тоже касается{count > 0 && ` · ${count}`}
    </Button>
  );
}
