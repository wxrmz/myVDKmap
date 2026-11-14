"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const CARD = 'section[aria-label="Панель"]';
// The panel leaves the way it sits: the phone sheet down, the desktop card to the left.
const away = () => (matchMedia("(max-width: 767.98px)").matches ? "translateY(100%)" : "translateX(-24px)");

/** Called by MapShell when the next page is in: a panel closed by its cross comes back with the level above. */
export function reopenClosedCard() {
  const card = document.querySelector<HTMLElement>(`${CARD}[data-closing]`);
  if (!card) return false;
  delete card.dataset.closing;
  card.getAnimations().forEach((a) => a.cancel());
  card.animate({ opacity: [0, 1], transform: [away(), "none"] }, { duration: 280, easing: "cubic-bezier(0.2, 0, 0, 1)" });
  return true;
}

/** Top-right cross of a map panel: closes it by going one level up (house → ЖК or район, ЖК → район, район → город). */
export function CloseButton({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    const card = e.currentTarget.closest<HTMLElement>(CARD);
    if (!plain || !card || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    card.dataset.closing = "";
    router.prefetch(href);
    card
      .animate({ opacity: [1, 0], transform: ["none", away()] }, { duration: 220, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" })
      .finished.then(() => router.push(href), () => router.push(href));
  };
  return (
    <Link
      href={href}
      prefetch
      onClick={onClick}
      aria-label={label}
      className="absolute -top-1 -right-1 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="size-5" />
    </Link>
  );
}
