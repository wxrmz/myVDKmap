"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ShareButton({ title }: { title: string }) {
  async function share() {
    const url = location.origin + location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // closed by the user
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не получилось скопировать ссылку");
    }
  }
  return (
    <Button variant="outline" size="icon" aria-label="Поделиться" onClick={share} className="size-10 rounded-full">
      <Share2 />
    </Button>
  );
}
