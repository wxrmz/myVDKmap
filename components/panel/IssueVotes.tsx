"use client";

// «Проблема ещё есть?»: signed-in residents close a stale issue (it moves to the house archive) or reopen it.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { CLOSE_VOTES } from "@/lib/votes";

export type IssueVotesState = { gone: number; still: number; mine: boolean | null };

export function IssueVotes({ issueId, closed, initial }: { issueId: string; closed: boolean; initial: IssueVotesState }) {
  const session = useSession();
  const router = useRouter();
  const [votes, setVotes] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function vote(gone: boolean) {
    setBusy(true);
    let error = "Не получилось, проверьте интернет и попробуйте ещё раз";
    try {
      const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gone }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<IssueVotesState & { closed: boolean; error: string }>;
      if (res.ok && body.closed !== undefined) {
        setVotes({ gone: body.gone ?? 0, still: body.still ?? 0, mine: gone });
        error = "";
        if (body.closed !== closed) {
          toast.success(body.closed ? "Проблема ушла в архив дома" : "Проблема снова на карте");
          window.dispatchEvent(new Event("issues:changed"));
          router.refresh();
        } else toast.success("Спасибо, учли");
      } else if (body.error) error = body.error;
    } catch {
      // network error: keep the default message
    }
    if (error) toast.error(error);
    setBusy(false);
  }

  const left = Math.max(CLOSE_VOTES - votes.gone, 0);
  return (
    <section className="panel-box flex flex-col gap-2">
      <h2 className="font-semibold">{closed ? "Проблема вернулась?" : "Проблема ещё есть?"}</h2>
      <p className="text-sm text-muted-foreground">
        {closed
          ? "Жители отметили, что её уже решили, поэтому она в архиве дома. Если это не так, отметьте — она вернётся на карту."
          : `Если проблемы больше нет, отметьте это. Когда так ответят ${CLOSE_VOTES} жителя (или автор), она уйдёт с карты в архив дома.`}
        {!closed && votes.gone > 0 && ` Уже отметили: ${votes.gone}, осталось ${left}.`}
        {votes.still > 0 && ` Говорят, что ещё есть: ${votes.still}.`}
      </p>
      {session.status === "guest" ? (
        <Link href="/me" prefetch className="self-start text-sm font-medium underline-offset-4 hover:underline">
          Войдите в кабинет, чтобы отметить
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={votes.mine === true ? "default" : "outline"}
            size="xs"
            aria-pressed={votes.mine === true}
            onClick={() => vote(true)}
            disabled={busy || session.status !== "user" || votes.mine === true}
            className="rounded-full"
          >
            Уже решено
          </Button>
          <Button
            variant={votes.mine === false ? "default" : "outline"}
            size="xs"
            aria-pressed={votes.mine === false}
            onClick={() => vote(false)}
            disabled={busy || session.status !== "user" || votes.mine === false}
            className="rounded-full"
          >
            Ещё есть
          </Button>
        </div>
      )}
    </section>
  );
}
