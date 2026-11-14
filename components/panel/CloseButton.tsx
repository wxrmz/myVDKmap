"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { closeTo } from "@/components/map/navMotion";

/** A link that closes the card it sits in, the way the card opened (navMotion). */
export function CloseLink(props: { href: string; label: string; className: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={props.href}
      prefetch
      aria-label={props.label}
      className={props.className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        closeTo(props.href, router.push);
      }}
    >
      {props.children}
    </Link>
  );
}

/** Top-right cross of a map panel: closes it by going one level up (house → ЖК or район, ЖК → район, район → город). */
export function CloseButton({ href, label }: { href: string; label: string }) {
  return (
    <CloseLink
      href={href}
      label={label}
      className="absolute -top-1 -right-1 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="size-5" />
    </CloseLink>
  );
}
