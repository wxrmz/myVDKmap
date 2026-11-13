import { DocumentParser } from "@/components/flows/DocumentParser";
import { FlowHeader } from "@/components/flows/FlowHeader";
import { WorksFeed } from "@/components/flows/WorksFeed";
import { getCityWorks } from "@/lib/queries";
import { houseHref } from "@/lib/nav";
import { getWorkStreets } from "@/lib/search";

export default async function Page({ searchParams }: { searchParams: Promise<{ building?: string | string[]; work?: string | string[] }> }) {
  const [{ building, work }, works] = await Promise.all([searchParams, getCityWorks()]);
  const buildingId = typeof building === "string" ? building : undefined;
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <FlowHeader
        title="Что меняется в городе"
        description="Ремонты, отключения и стройки — простыми словами."
        backHref={buildingId ? houseHref(buildingId) : "/"}
      />
      <WorksFeed works={works} streets={getWorkStreets(works)} buildingId={buildingId} workId={typeof work === "string" ? work : undefined} />
      <DocumentParser />
    </div>
  );
}
