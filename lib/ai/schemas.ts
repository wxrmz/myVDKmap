// Minimal schema needed by lib/fixtures/documents.ts; task 8 extends this file.
import { z } from "zod";

export const DocSummarySchema = z.object({
  title: z.string(),
  plainSummary: z.string(),
  what: z.string(),
  where: z.array(z.string()),
  when: z.string(),
  whoAffected: z.string(),
  kind: z.string(),
});
export type DocSummary = z.infer<typeof DocSummarySchema>;
