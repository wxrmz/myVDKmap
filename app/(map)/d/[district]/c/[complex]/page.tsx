import { notFound, redirect } from "next/navigation";
import { ComplexCard } from "@/components/panel/ComplexCard";
import { complexHref } from "@/lib/nav";
import { getComplex } from "@/lib/queries";

export default async function Page({ params }: { params: Promise<{ district: string; complex: string }> }) {
  const { district, complex: id } = await params;
  const complex = await getComplex(id);
  if (!complex) notFound();
  if (complex.district.id !== district) redirect(complexHref(complex.district.id, complex.id));
  return <ComplexCard complex={complex} />;
}
