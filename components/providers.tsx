"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { CABINET_SYNC_FAILED } from "@/lib/cabinet";

const SYNC_FAILED: Record<number, string> = {
  0: "Нет связи с сервером: изменения кабинета пока сохранены только на этом устройстве.",
  401: "Сессия закончилась: изменения сохранены только на этом устройстве. Войдите снова, чтобы они попали в кабинет.",
  413: "Кабинет не поместился в одно сохранение: удалите старые квитанции или показания.",
};

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onFail = (e: Event) =>
      toast.error(SYNC_FAILED[(e as CustomEvent<number>).detail] ?? "Не удалось сохранить кабинет на сервере: изменения пока только на этом устройстве.", {
        id: "cabinet-sync",
      });
    window.addEventListener(CABINET_SYNC_FAILED, onFail);
    return () => window.removeEventListener(CABINET_SYNC_FAILED, onFail);
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster />
      </MotionConfig>
    </ThemeProvider>
  );
}
