// zod schemas of the rules layer (§6.1): route inputs and the shapes of its answers.
import { z } from "zod";
import { BILL_KINDS, ISSUE_CATEGORIES, WORK_KINDS } from "@/lib/types";

const PHOTO = /^(data:image\/[\w.+-]+;base64,|\/(?!\/))/; // a data URL, or a site path such as the demo photo
const BILL_PDF = /^data:application\/pdf;base64,/;
/** Citations of laws («ст. 12», «статья», «№ 59-ФЗ»): appeals must not invent them. */
const LAW_CITATION = /(?<![\p{L}])ст\.\s*\d|стать[яиюей]|\d+-фз|федеральн\S* закон/iu;

// --- classifyIssue ---
export const ClassifyInputSchema = z
  .object({
    text: z.string().trim().max(5000, "Описание длиннее 5000 символов").default(""),
    address: z.string({ error: "Укажите адрес" }).trim().min(1, "Укажите адрес").max(300, "Адрес длиннее 300 символов"),
    photo: z.string().regex(PHOTO, "Фото должно быть картинкой").optional(),
  })
  .refine((b) => b.text || b.photo, { message: "Добавьте фото или опишите проблему", path: ["text"] });
export type ClassifyInput = z.infer<typeof ClassifyInputSchema>;

export const ClassifyOutputSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  title: z.string().trim().min(1).max(200),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  authorityId: z.string().min(1),
  reasoning: z.string().trim().min(1),
  appealText: z
    .string()
    .trim()
    .min(1)
    .refine((s) => !LAW_CITATION.test(s), "В обращении не должно быть ссылок на статьи и номера законов"),
});
export type ClassifyOutput = z.infer<typeof ClassifyOutputSchema>;

// --- parseBill ---
const PERIOD = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const BillItemSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.number(),
  unit: z.string().optional(),
  volume: z.number().optional(),
  tariff: z.number().optional(),
});

export const BillInputSchema = z
  .object({
    buildingId: z.string().min(1).optional(),
    kind: z.enum(BILL_KINDS, { error: "Выберите, какая это квитанция" }).default("housing"),
    pdf: z.string().regex(BILL_PDF, "Загрузите квитанцию в PDF").optional(),
    text: z.string().trim().max(20000, "Текст длиннее 20 000 символов").optional(),
    demo: z.boolean().optional(),
    /** The resident's own saved receipts of this kind (cabinet): the analysis compares with them first. */
    previous: z.array(z.object({ period: PERIOD, total: z.number(), items: z.array(BillItemSchema).max(100) })).max(60).optional(),
  })
  .refine((b) => b.demo || b.pdf || b.text, { message: "Загрузите PDF квитанции, вставьте её текст или выберите пример", path: ["text"] });
export type BillInput = z.infer<typeof BillInputSchema>;

/** What reading a receipt gives: its lines as printed. */
export type BillRaw = { period?: string; items: z.infer<typeof BillItemSchema>[]; total: number };

export const BillOutputSchema = z.object({
  period: PERIOD.optional(),
  items: z.array(BillItemSchema.extend({ plainName: z.string(), explanation: z.string() })),
  total: z.number(),
  history: z.array(z.object({ period: PERIOD, total: z.number() })),
  changes: z.array(z.object({ item: z.string(), deltaPercent: z.number(), likelyReason: z.string(), action: z.string() })),
  /** Arithmetic checks of the receipt itself (lib/bills.ts). */
  checks: z.array(z.object({ ok: z.boolean(), text: z.string() })),
  /** Sentences with numbers: the biggest line, change to last month, the average. */
  insights: z.array(z.string()),
});
export type BillOutput = z.infer<typeof BillOutputSchema>;

// --- summarizeDocument ---
export const DocumentInputSchema = z.object({
  text: z.string({ error: "Вставьте текст объявления" }).trim().min(1, "Вставьте текст объявления").max(20000, "Текст длиннее 20 000 символов"),
});

export const DocSummarySchema = z.object({
  title: z.string(),
  plainSummary: z.string(),
  what: z.string(),
  where: z.array(z.string()),
  when: z.string(),
  whoAffected: z.string(),
  kind: z.enum(WORK_KINDS),
});
export type DocSummary = z.infer<typeof DocSummarySchema>;

/** Route answer: the summary plus the houses its streets and numbers point to. */
export type DocumentOutput = DocSummary & { buildings: { id: string; address: string }[] };

// --- districtDigest ---
export type DigestOutput = { text: string };
