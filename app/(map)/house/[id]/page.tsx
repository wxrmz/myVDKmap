import { notFound, redirect } from "next/navigation";
import { HousePassport } from "@/components/house/HousePassport";
import { houseHref } from "@/lib/nav";
import { getBuilding } from "@/lib/queries";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passport = await getBuilding(id);
  if (!passport) notFound();
  // `osm-…` ids resolve to an existing house: keep one canonical URL per house.
  if (passport.building.id !== id) redirect(houseHref(passport.building.id));
  return <HousePassport key={passport.building.id} passport={passport} />;
}
