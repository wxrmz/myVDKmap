// Self-check: npx tsx lib/votes.test.ts
import assert from "node:assert/strict";
import { tally } from "./votes";

const r = (gone: boolean, author = false) => ({ gone, author });

assert.equal(tally([]).closed, false);
assert.equal(tally([r(true), r(true)]).closed, false, "two residents are not enough");
assert.equal(tally([r(true), r(true), r(true)]).closed, true, "three residents close it");
assert.equal(tally([r(true), r(true), r(true), r(false), r(false), r(false)]).closed, false, "a tie keeps it open");
assert.equal(tally([r(true, true)]).closed, true, "the author alone closes it");
assert.equal(tally([r(true, true), r(false), r(false), r(false), r(false)]).closed, false, "four residents outvote the author");
assert.deepEqual(tally([r(true), r(false)]), { gone: 1, still: 1, closed: false });

console.log("votes: ok");
