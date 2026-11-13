import { notFound, redirect } from "next/navigation";
import { HousePassport } from "@/components/house/HousePassport";
import { houseHref } from "@/lib/nav";
import { getBuilding } from "@/lib/queries";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ issue?: string | string[] }>;
}) {
  const [{ id }, { issue }] = await Promise.all([params, searchParams]);
  const passport = await getBuilding(id);
  if (!passport) notFound();
  const issueId = typeof issue === "string" ? issue : undefined;
  // `osm-…` ids resolve to an existing house: keep one canonical URL per house.
  if (passport.building.id !== id)
    redirect(houseHref(passport.building.id) + (issueId ? `?issue=${encodeURIComponent(issueId)}` : ""));
  return <HousePassport key={passport.building.id} passport={passport} issueId={issueId} />;
}
