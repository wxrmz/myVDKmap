import type { Metadata } from "next";
import { ReportWizard } from "@/components/flows/ReportWizard";
import { getAuthorities, getBuilding } from "@/lib/queries";

export const metadata: Metadata = { title: "Сообщить о проблеме", description: "Отметьте проблему на карте: мы подскажем, кто за неё отвечает, и подготовим текст обращения." };

export default async function Page({ searchParams }: { searchParams: Promise<{ building?: string | string[] }> }) {
  const { building } = await searchParams;
  const [authorities, passport] = await Promise.all([getAuthorities(), typeof building === "string" ? getBuilding(building) : null]);
  const b = passport?.building;
  return (
    <ReportWizard
      house={b ? { id: b.id, address: b.address, lat: b.lat, lng: b.lng } : null}
      authorities={authorities.map(({ id, name }) => ({ id, name }))}
    />
  );
}
