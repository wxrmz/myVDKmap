import Link from "next/link";
import { X } from "lucide-react";

/** Top-right cross of a map panel: closes it by going one level up (house → ЖК or район, ЖК → район, район → город). */
export function CloseButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      prefetch
      aria-label={label}
      className="absolute -top-1 -right-1 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="size-5" />
    </Link>
  );
}
