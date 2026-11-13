import { notFound } from "next/navigation";
import { DistrictPanel } from "@/components/panel/DistrictPanel";
import { getDistrict, getDistrictStats } from "@/lib/queries";

export default async function Page({ params }: { params: Promise<{ district: string }> }) {
  const { district: id } = await params;
  const [district, stats] = await Promise.all([getDistrict(id), getDistrictStats(id)]);
  if (!district) notFound();
  return <DistrictPanel district={district} stats={stats} />;
}
