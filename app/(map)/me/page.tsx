import type { Metadata } from "next";
import { CabinetPage } from "@/components/cabinet/CabinetPage";

export const metadata: Metadata = { title: "Личный кабинет", robots: { index: false } };

export default function Page() {
  return <CabinetPage />;
}
