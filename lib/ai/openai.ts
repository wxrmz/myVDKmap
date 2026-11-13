// OpenAI-compatible provider (§6.1): POST {AI_BASE_URL}/chat/completions via fetch, JSON answers checked by zod.
// Invalid answer → one retry, then the mock; network or HTTP error → the mock at once.
import type { z } from "zod";
import { getAuthorities } from "@/lib/queries";
import { ISSUE_CATEGORIES, ISSUE_CATEGORY_LABELS, WORK_KINDS, WORK_KIND_LABELS } from "@/lib/types";
import * as mock from "./mock";
import {
  BillRawSchema,
  ClassifyOutputSchema,
  DigestOutputSchema,
  DocSummarySchema,
  type BillInput,
  type BillOutput,
  type ClassifyInput,
  type ClassifyOutput,
  type DigestOutput,
  type DocSummary,
} from "./schemas";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type Message = { role: "system" | "user"; content: string | Part[] };

const NO_INVENTION = "Не выдумывай статьи и номера законов, телефоны, адреса, имена и цифры, которых нет во входных данных.";
const RASTER = /^data:image\/(png|jpe?g|webp|gif);base64,/;

async function complete(messages: Message[], vision: boolean): Promise<string> {
  const base = (process.env.AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({
      model: (vision && process.env.AI_VISION_MODEL) || process.env.AI_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const content = ((await res.json()) as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("AI answer has no message content");
  return content;
}

/** Validated JSON from the model, or null when the caller should use the mock. */
async function askJson<T>(schema: z.ZodType<T>, messages: Message[], vision = false): Promise<T | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let content: string;
    try {
      content = await complete(messages, vision);
    } catch (e) {
      console.warn("[ai] provider unavailable, using mock:", e instanceof Error ? e.message : e);
      return null;
    }
    try {
      const parsed = schema.safeParse(JSON.parse(content, (_k, v) => (v === null ? undefined : v))); // models send null for «unknown»
      if (parsed.success) return parsed.data;
      console.warn(`[ai] invalid answer (attempt ${attempt}):`, parsed.error.issues.slice(0, 3));
    } catch {
      console.warn(`[ai] answer is not JSON (attempt ${attempt})`);
    }
  }
  return null;
}

const list = (pairs: Record<string, string>) =>
  Object.entries(pairs)
    .map(([id, label]) => `${id} — ${label}`)
    .join("; ");

export async function classifyIssue(input: ClassifyInput): Promise<ClassifyOutput> {
  const image = input.photo && RASTER.test(input.photo) ? input.photo : null;
  if (!input.text && !image) return mock.classifyIssue(input); // nothing the model can read (e.g. the SVG demo photo)
  const authorities = await getAuthorities();
  const ids = authorities.map((a) => a.id);
  const system = [
    "Ты помогаешь жителю Владивостока составить обращение о проблеме в доме, во дворе или на улице.",
    "Ответь только JSON-объектом: {\"category\", \"title\", \"severity\", \"authorityId\", \"reasoning\", \"appealText\"}.",
    `category — одно из: ${list(Object.fromEntries(ISSUE_CATEGORIES.map((c) => [c, ISSUE_CATEGORY_LABELS[c]])))}.`,
    "title — короткий заголовок до 60 символов. severity — 1 (неудобство), 2 (мешает жить) или 3 (опасно для людей).",
    "authorityId — строго id из справочника ниже; других органов не предлагай. reasoning — 1–2 предложения, почему такая категория и такой орган.",
    "appealText — официально-деловое обращение: адресат (название органа из справочника), адрес проблемы, описание, просьба устранить и сообщить о принятых мерах в установленный законом срок.",
    NO_INVENTION,
    "Справочник ответственных:",
    ...authorities.map((a) => `- ${a.id}: ${a.name} — ${a.handles.join(", ")}`),
  ].join("\n");
  const text = `Адрес: ${input.address}\nОписание: ${input.text || "(только фото)"}`;
  const answer = await askJson(
    ClassifyOutputSchema.refine((o) => ids.includes(o.authorityId), { message: "authorityId вне справочника", path: ["authorityId"] }),
    [
      { role: "system", content: system },
      { role: "user", content: image ? [{ type: "text", text }, { type: "image_url", image_url: { url: image } }] : text },
    ],
    !!image,
  );
  return answer ?? mock.classifyIssue(input);
}

export async function parseBill(input: BillInput): Promise<BillOutput | null> {
  const image = input.image && RASTER.test(input.image) ? input.image : null;
  if (input.demo || (!input.text && !image)) return mock.parseBill(input); // demo receipt, or a file nobody can read
  const system = [
    "Ты распознаёшь российскую квитанцию ЖКХ (единый платёжный документ).",
    "Ответь только JSON-объектом: {\"period\": \"YYYY-MM\", \"items\": [{\"name\", \"amount\", \"unit\", \"volume\", \"tariff\"}], \"total\"}.",
    "name — название услуги как в квитанции; amount — начислено, ₽, числом; unit, volume, tariff — только если они напечатаны в строке, иначе не указывай.",
    "period — расчётный период, если он есть. total — итог к оплате числом.",
    NO_INVENTION,
  ].join("\n");
  const raw = await askJson(
    BillRawSchema,
    [
      { role: "system", content: system },
      { role: "user", content: image ? [{ type: "image_url", image_url: { url: image } }] : input.text! },
    ],
    !!image,
  );
  // Plain names, history and changes are computed from our own data, never by the model.
  return raw ? mock.analyzeBill(raw, input.buildingId, input.kind) : mock.parseBill(input);
}

export async function summarizeDocument(text: string): Promise<DocSummary> {
  const system = [
    "Ты пересказываешь объявления о городских работах во Владивостоке простыми словами, без канцелярита.",
    "Ответь только JSON-объектом: {\"title\", \"plainSummary\", \"what\", \"where\", \"when\", \"whoAffected\", \"kind\"}.",
    "title — до 60 символов; plainSummary — 1–2 простых предложения и, если уместно, что делать жителю; what — что делают;",
    "where — массив улиц и адресов из текста (например «ул. Посьетская, д. 12–20»); when — сроки из текста; whoAffected — кого касается.",
    `kind — одно из: ${list(Object.fromEntries(WORK_KINDS.map((k) => [k, WORK_KIND_LABELS[k]])))}.`,
    NO_INVENTION,
  ].join("\n");
  const answer = await askJson(DocSummarySchema, [
    { role: "system", content: system },
    { role: "user", content: text },
  ]);
  return answer ?? mock.summarizeDocument(text);
}

export async function districtDigest(facts: mock.DistrictFacts): Promise<DigestOutput> {
  const system = [
    "Ты пишешь короткую сводку о районе Владивостока для жителей: 3–4 простых предложения, без канцелярита.",
    "Используй только факты из входных данных. Ответь только JSON-объектом: {\"text\"}.",
    NO_INVENTION,
  ].join("\n");
  const answer = await askJson(DigestOutputSchema, [
    { role: "system", content: system },
    { role: "user", content: JSON.stringify(facts) },
  ]);
  return answer ?? mock.districtDigest(facts);
}
