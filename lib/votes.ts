// Residents close an issue by voting «уже решено» (or reopen it with «ещё есть»).

/** «Уже решено» votes needed to close; the author's own vote counts as this many on its own. */
export const CLOSE_VOTES = 3;

export type Vote = { gone: boolean; author: boolean };

export function tally(votes: Vote[]) {
  const gone = votes.reduce((n, v) => n + (v.gone ? (v.author ? CLOSE_VOTES : 1) : 0), 0);
  const still = votes.filter((v) => !v.gone).length;
  return { gone, still, closed: gone >= CLOSE_VOTES && gone > still };
}
