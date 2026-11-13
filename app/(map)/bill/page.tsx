import { BillAnalyzer } from "@/components/flows/BillAnalyzer";
import { getBuilding } from "@/lib/queries";

export default async function Page({ searchParams }: { searchParams: Promise<{ building?: string | string[] }> }) {
  const { building } = await searchParams;
  const b = typeof building === "string" ? (await getBuilding(building))?.building : undefined;
  return <BillAnalyzer house={b ? { id: b.id, address: b.address } : null} />;
}
