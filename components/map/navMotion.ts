"use client";

// How the card changes between pages (§5.1). Closing is the opening played back:
// a map panel's content fades out, the panel resizes to the level above, the new content fades in (MapShell);
// a phone flow card slides back down to the map; on a desktop a flow cross-fades back like it came.

type Push = (href: string) => void;

/** Set on <html> while a desktop rail link cross-fades the card (styles in globals.css). */
export const NAV_VT = "data-nav-vt";
/** The map panel or the flow card (MapShell). */
const CARD = 'section:is([aria-label="Панель"], [aria-label="Раздел"])';
export const isPhone = () => matchMedia("(max-width: 767.98px)").matches;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let showPage: (() => void) | null = null;
let closing: { slide: true } | { height: number } | null = null;

/** Desktop: old and new sections cross-fade in a View Transition. */
export function crossFadeTo(href: string, push: Push) {
  if (!document.startViewTransition || still()) return push(href);
  const root = document.documentElement;
  root.setAttribute(NAV_VT, "");
  const t = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        showPage = resolve;
        setTimeout(resolve, 600); // a slow page swaps without the picture rather than freezing the screen
        push(href);
      }),
  );
  t.finished.finally(() => root.removeAttribute(NAV_VT));
}

/** Closes the current card toward `href` the way it opened, then navigates. */
export function closeTo(href: string, push: Push) {
  const card = document.querySelector<HTMLElement>(CARD);
  if (!card || still()) return push(href);
  const flow = card.getAttribute("aria-label") === "Раздел";
  if (flow && !isPhone()) return crossFadeTo(href, push);
  let gone = false;
  const after = () => {
    if (gone) return;
    gone = true;
    push(href);
  };
  setTimeout(after, 400); // a background tab may never finish the animation; the close must still happen
  if (flow) {
    closing = { slide: true };
    card
      .animate({ transform: ["none", "translateY(100%)"] }, { duration: 240, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" })
      .finished.then(after, after);
    return;
  }
  const page = card.querySelector<HTMLElement>("[data-page]"); // MapShell's page wrapper
  if (!page) return after();
  closing = { height: card.offsetHeight };
  page.animate({ opacity: [1, 0] }, { duration: 150, easing: "ease-in", fill: "forwards" }).finished.then(after, after);
}

/**
 * MapShell, once the next page is in the DOM: lets a desktop cross-fade take its picture and finishes a close.
 * Returns true when it animated the card itself (the page then needs no fade of its own).
 */
export function pageArrived(page: HTMLElement | null) {
  showPage?.();
  showPage = null;
  const c = closing;
  closing = null;
  page?.getAnimations().forEach((a) => a.cancel()); // the close fade-out holds the old page hidden
  const card = document.querySelector<HTMLElement>(CARD);
  if (!c || !card) return false;
  if ("slide" in c) {
    // The map sheet comes back up under the card that went down.
    card.animate({ transform: ["translateY(100%)", "none"] }, { duration: 280, easing: "cubic-bezier(0.2, 0, 0, 1)" });
    return true;
  }
  // Desktop card resizes to the new content; the phone sheet springs to its snap by itself (PanelSheet).
  if (!isPhone() && card.offsetHeight !== c.height)
    card.animate({ height: [`${c.height}px`, `${card.offsetHeight}px`] }, { duration: 260, easing: "cubic-bezier(0.2, 0, 0, 1)" });
  return false;
}
