"use client";

// «Разобрать свой документ» (§5.7): paste an announcement, get a plain retelling and the houses it touches.
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentOutput } from "@/lib/ai/schemas";
import { houseHref } from "@/lib/nav";
import { WORK_KIND_LABELS } from "@/lib/types";
import { api } from "./api";

const SHOWN_HOUSES = 8;

export function DocumentParser() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<DocumentOutput | null>(null);

  async function run() {
    setBusy(true);
    const res = await api<DocumentOutput>("/api/ai/document", { body: { text } });
    if (res) setDoc(res);
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Разобрать свой документ</h2>
      <p className="text-sm text-muted-foreground">Вставьте текст объявления об отключении или ремонте — перескажем по-человечески.</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={20000}
        rows={5}
        placeholder="Текст объявления"
        aria-label="Текст объявления"
        className="text-base"
      />
      <Button className="h-11 self-start rounded-xl" onClick={run} disabled={busy || !text.trim()}>
        {busy && <Loader2 className="animate-spin" />} Пересказать
      </Button>
      {doc && !busy && (
        <article className="panel-box flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="self-start rounded-full bg-work/20 px-2.5 py-0.5 text-sm font-medium">{WORK_KIND_LABELS[doc.kind]}</span>
          <h3 className="text-base font-semibold">{doc.title}</h3>
          <p className="text-sm">{doc.plainSummary}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Что</dt>
            <dd>{doc.what}</dd>
            {doc.where.length > 0 && (
              <>
                <dt className="text-muted-foreground">Где</dt>
                <dd>{doc.where.join("; ")}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Когда</dt>
            <dd>{doc.when}</dd>
            <dt className="text-muted-foreground">Кого касается</dt>
            <dd>{doc.whoAffected}</dd>
          </dl>
          {doc.buildings.length > 0 && (
            <p className="text-sm">
              <span className="text-muted-foreground">Дома из нашей базы: </span>
              {doc.buildings.slice(0, SHOWN_HOUSES).map((b, i) => (
                <span key={b.id}>
                  {i > 0 && ", "}
                  <Link href={houseHref(b.id)} className="font-medium underline-offset-4 hover:underline">
                    {b.address}
                  </Link>
                </span>
              ))}
              {doc.buildings.length > SHOWN_HOUSES && " и другие"}
            </p>
          )}
        </article>
      )}
    </section>
  );
}
