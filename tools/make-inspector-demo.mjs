import { writeFileSync, mkdirSync } from "node:fs";
import { inspectorPrevious, inPlay } from "../tests/helpers/inspector.js";
import { act } from "../tests/helpers/career.js";
import { validateSave } from "../src/engine.js";
const dir = new URL("../outputs/v0.17/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const hard of [false, true]) {
  const previous = inspectorPrevious(hard), label = hard ? "严苛" : "常例";
  const start = act(previous, "in_appoint");
  writeFileSync(new URL(`按察司副使_${label}_开局.json`, dir), JSON.stringify(validateSave(start), null, 2));
  const last = inPlay(start);
  writeFileSync(new URL(`按察司副使_${label}_考满.json`, dir), JSON.stringify(validateSave(last), null, 2));
  console.log(`${label}：${last.inspector.outcome.summary}考语${last.inspector.outcome.rating}，${last.inspector.outcome.score}分。`);
}
