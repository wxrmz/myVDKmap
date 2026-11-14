import { prisma } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DistrictPanel } from "@/components/panel/DistrictPanel";
import { getDistrict, getDistrictStats } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ district: string }> }): Promise<Metadata> {
  const d = await prisma.district.findUnique({ where: { id: (await params).district }, select: { name: true } });
  return d ? { title: `${d.name} район`, description: `${d.name} район Владивостока: проблемы, жилые комплексы и работы в городе.` } : {};
}

export default async function Page({ params }: { params: Promise<{ district: string }> }) {
  const { district: id } = await params;
  const [district, stats] = await Promise.all([getDistrict(id), getDistrictStats(id)]);
  if (!district) notFound();
  return <DistrictPanel district={district} stats={stats} />;
}
