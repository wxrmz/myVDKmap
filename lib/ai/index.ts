// AI facade (§6.1): AI_PROVIDER=openai with AI_API_KEY and AI_MODEL set uses the model, anything else the mock.
import * as mock from "./mock";
import * as openai from "./openai";
import type { BillInput, ClassifyInput, DocumentOutput } from "./schemas";

const provider = () =>
  process.env.AI_PROVIDER === "openai" && process.env.AI_API_KEY && process.env.AI_MODEL ? openai : mock;

export const classifyIssue = (input: ClassifyInput) => provider().classifyIssue(input);

export const parseBill = (input: BillInput) => provider().parseBill(input);

/** Summary plus houses bound from the text's streets and numbers (always local: the DB is ours). */
export async function summarizeDocument(text: string): Promise<DocumentOutput> {
  const [summary, buildings] = await Promise.all([provider().summarizeDocument(text), mock.bindBuildings(text)]);
  return { ...summary, buildings };
}

/** Null when there is no such district. */
export async function districtDigest(id: string) {
  const facts = await mock.districtFacts(id);
  return facts && provider().districtDigest(facts);
}
