"use client";

// District digest from `/api/ai/digest`; hidden when the request fails.
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AiDigest({ districtId }: { districtId: string }) {
  const [state, setState] = useState<{ id: string; text: string | null } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/ai/digest?district=${encodeURIComponent(districtId)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ text: string }>) : null))
      .then((d) => setState({ id: districtId, text: d?.text ?? null }))
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ id: districtId, text: null });
      });
    return () => ctrl.abort();
  }, [districtId]);

  const loading = state?.id !== districtId;
  if (!loading && !state?.text) return null;
  return (
    <section className="panel-box flex flex-col gap-2">
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4" />
        Коротко о районе
      </h2>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <p className="text-sm whitespace-pre-line animate-in fade-in duration-300">{state?.text}</p>
      )}
      <p className="text-xs text-muted-foreground">Сводка собрана автоматически по данным сервиса.</p>
    </section>
  );
}
