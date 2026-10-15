import fs from "node:fs";
import { validateSave } from "../../src/engine.js";
import { completedZhifu, act } from "./career.js";
import { IN_DOCKETS, inTeams, inTravel } from "../../src/inspector.js";
import { OFFICE_CONTENT } from "../../src/office-stories.js";
export const inspectorPrevious = (hard = false) => completedZhifu(hard ? act(validateSave(JSON.parse(fs.readFileSync(new URL("../fixtures/hard-tz-finished.json", import.meta.url)))), "zf_appoint") : undefined);
export function inNext(s, choice = "verify") {
  if (s.inspector.event) s = act(s, "in_event", { choice });
  return act(s, "in_advance");
}
export function inPlay(s, { until = 156, policy = "help", onStep = () => {} } = {}) {
  const call = (type, args) => { s = act(s, type, args); onStep(s, type); };
  while (s.inspector.turn < until && !s.inspector.finished) {
    if (s.inspector.event) call("in_event", { choice: "verify" });
    let q = s.inspector;
    for (const id of [...s.officeStories.offices.inspector.queue]) {
      if (!q.ap && policy !== "delegate") break;
      call("office_story", { event: id, choice: policy }); q = s.inspector;
    }
    // 先验收腾出巡察人手，再取证、呈核和派出；案件与剧情使用同一周精力。
    for (let i = 0; i < 3 && s.inspector.ap; i++) {
      q = s.inspector;
      const items = Object.values(q.dockets);
      let r = items.find((r) => r.status === "ready");
      if (r) { call("in_docket", { docket: r.id, action: "accept" }); continue; }
      r = items.find((r) => r.status === "onsite");
      if (r) {
        const d = IN_DOCKETS.find((d) => d.id === r.id), clue = d.evidence.find((e) => !r.clues.some((x) => x.id === e.id));
        call("in_docket", { docket: r.id, action: clue ? "clue" : "submit", clue: clue?.id }); continue;
      }
      r = items.find((r) => r.status === "approved");
      if (r && inTeams(q) < 2) { call("in_docket", { docket: r.id, action: "execute" }); continue; }
      const f = Object.values(s.officeStories.offices.inspector.cases).find((f) => ["open", "returned", "approved"].includes(f.status));
      if (f) {
        const d = OFFICE_CONTENT.inspector.cases.find((d) => d.id === f.id), clue = d.clues.find((e) => !f.clues.some((x) => x.id === e.id));
        call("office_case", { case: f.id, action: f.status === "approved" ? "execute" : clue ? "clue" : "review", clue: clue?.id, choice: "evidence" }); continue;
      }
      r = items.find((r) => r.status === "open");
      if (r && inTeams(q) < 2 && q.turn + inTravel(q, IN_DOCKETS.find((d) => d.id === r.id)) + 6 <= 156) { call("in_docket", { docket: r.id, action: "visit", route: "ordinary" }); continue; }
      break;
    }
    call("in_advance", {});
  }
  return s;
}
