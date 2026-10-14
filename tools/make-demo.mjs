import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { validateSave, dispatch } from "../src/engine.js";
const s = validateSave(
  JSON.parse(
    readFileSync(
      new URL("../tests/fixtures/quarter-v1-finished.json", import.meta.url),
    ),
  ),
);
s.name = "府任体验";
const demo = dispatch(s, {
  id: "demo-prefecture-appointment",
  type: "appointment",
});
mkdirSync(new URL("../outputs/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../outputs/永平府_通判开局体验履历.json", import.meta.url),
  JSON.stringify(demo, null, 2),
);
