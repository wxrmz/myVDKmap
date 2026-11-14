import { prisma } from "@/lib/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ComplexCard } from "@/components/panel/ComplexCard";
import { complexHref } from "@/lib/nav";
import { getComplex } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ complex: string }> }): Promise<Metadata> {
  const c = await prisma.complex.findUnique({ where: { id: (await params).complex }, select: { name: true } });
  return c ? { title: c.name, description: `${c.name}: дома комплекса, проблемы и работы рядом.` } : {};
}

export default async function Page({ params }: { params: Promise<{ district: string; complex: string }> }) {
  const { district, complex: id } = await params;
  const complex = await getComplex(id);
  if (!complex) notFound();
  if (complex.district.id !== district) redirect(complexHref(complex.district.id, complex.id));
  return <ComplexCard complex={complex} />;
}
