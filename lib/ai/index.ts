// Rules layer (§6.1): keyword classification, receipt lines, document summaries and district digests. No model, no keys.
import * as rules from "./rules";
import type { DocumentOutput } from "./schemas";

export { classifyIssue, parseBill } from "./rules";

/** Summary plus houses bound from the text's streets and numbers. */
export async function summarizeDocument(text: string): Promise<DocumentOutput> {
  return { ...rules.summarizeDocument(text), buildings: await rules.bindBuildings(text) };
}

/** Null when there is no such district. */
export async function districtDigest(id: string) {
  const facts = await rules.districtFacts(id);
  return facts && rules.districtDigest(facts);
}
