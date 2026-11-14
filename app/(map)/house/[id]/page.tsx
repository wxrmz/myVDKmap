import { prisma } from "@/lib/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HousePassport } from "@/components/house/HousePassport";
import { houseHref } from "@/lib/nav";
import { getBuilding } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const b = await prisma.building.findUnique({ where: { id: (await params).id }, select: { address: true } });
  return b ? { title: b.address, description: `Паспорт дома ${b.address}: проблемы, ремонты и отключения рядом, управляющая компания.` } : {};
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const passport = await getBuilding(id);
  if (!passport) notFound();
  // `osm-…` ids resolve to an existing house: keep one canonical URL per house.
  if (passport.building.id !== id) redirect(houseHref(passport.building.id));
  return <HousePassport key={passport.building.id} passport={passport} />;
}
