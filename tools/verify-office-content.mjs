import fs from "node:fs";
import assert from "node:assert/strict";
import { dispatch, validateSave } from "../src/engine.js";
import { PREF_EVENTS } from "../src/prefecture.js";
import { TZ_EVENTS } from "../src/tongzhi-data.js";
import { ZF_EVENTS } from "../src/zhifu-data.js";
import { OFFICE_CONTENT } from "../src/office-stories.js";
import { officeEvent } from "../src/office-hard.js";
import { completedPrefecture, completedTongzhi } from "../tests/helpers/career.js";
const dir = "outputs/qa/v0.16";
fs.mkdirSync(dir, { recursive: true });
let seq = 0;
const act = (s, type, args = {}) => dispatch(s, { id: `content-qa-${seq++}`, type, ...args });
const read = (name) => validateSave(JSON.parse(fs.readFileSync(`tests/fixtures/${name}.json`)));
const standard = { prefecture: read("quarter-v1-finished"), tongzhi: completedPrefecture(), zhifu: completedTongzhi() };
const hard = { prefecture: read("hard-county-finished"), tongzhi: read("hard-pref-finished"), zhifu: read("hard-tz-finished") };
const commands = { prefecture: ["appointment", "pref_event", "pref_advance", PREF_EVENTS], tongzhi: ["tz_appoint", "tz_event", "tz_advance", TZ_EVENTS], zhifu: ["zf_appoint", "zf_event", "zf_advance", ZF_EVENTS] };
const can = (q, cost) => Object.entries(cost || {}).every(([k, v]) => q[k] >= v);
function main(s, key) {
  const [, command, , list] = commands[key], q = s[key];
  if (!q.event) return s;
  const e = officeEvent(q, list.find((e) => e.id === q.event));
  const safe = e.options.filter((o) => !["misconduct", "force", "collect", "cover", "inflate", "mold", "blocked", "expel", "exclude"].includes(o.special) && can(q, o.cost));
  const choice = safe.find((o) => Object.keys(o.cost).length === 0) || safe[0];
  assert(choice, `${key}:${e.id} safe choice missing`);
  return act(s, command, { choice: choice.id });
}
const report = [];
for (const difficulty of ["standard", "hard"]) for (const key of Object.keys(commands)) for (const seed of [7, 31, 97]) {
  const base = structuredClone((difficulty === "hard" ? hard : standard)[key]);
  base.seed = seed;
  // 从旧任交接的v11快照起步；新种子用于新任排程，不改写已有v12排程。
  base.version = 11;
  delete base.officeStories;
  let s = act(validateSave(base), commands[key][0]);
  const snapshot = key === "prefecture" ? JSON.stringify(s.projects) : JSON.stringify(s[key === "tongzhi" ? "prefecture" : "tongzhi"]);
  const defs = OFFICE_CONTENT[key], chronology = [];
  while (!s[key].finished) {
    const q = s[key], b = s.officeStories.offices[key];
    if (q.event || b.queue.some((id) => b.events[id].opened === q.turn) || Object.values(b.cases).some((f) => f.opened === q.turn)) chronology.push(q.turn);
    s = main(s, key);
    for (const id of [...s.officeStories.offices[key].queue]) {
      const d = defs.events.find((d) => d.id === id);
      const choice = d.options.find((o) => o.id === "help" && can(s[key], o.cost)) || d.options.find((o) => o.id === "check" && can(s[key], o.cost));
      if (choice) s = act(s, "office_story", { event: id, choice: choice.id });
    }
    for (const d of defs.cases) {
      let f = s.officeStories.offices[key].cases[d.id];
      if (!f) continue;
      if (["open", "returned"].includes(f.status)) {
        for (const c of d.clues) if (!f.clues.some((x) => x.id === c.id) && can(s[key], { silver: 4, ap: 1 })) {
          s = act(s, "office_case", { case: d.id, action: "clue", clue: c.id });
          f = s.officeStories.offices[key].cases[d.id];
        }
        if (f.clues.length === 3 && s[key].ap) s = act(s, "office_case", { case: d.id, action: "review", choice: "evidence" });
      } else if (f.status === "approved" && can(s[key], { silver: 6, ap: 1 })) s = act(s, "office_case", { case: d.id, action: "execute" });
    }
    // 本轮只验证内容程序和原常例结算；经营策略称职由原完整职业测试独立验证。
    s = act(s, commands[key][2]);
    s = validateSave(JSON.parse(JSON.stringify(s)));
  }
  const b = s.officeStories.offices[key];
  assert.equal(Object.values(b.events).filter((r) => r.status === "done").length, 18);
  assert.equal(Object.values(b.cases).filter((f) => f.status === "closed").length, 4);
  assert.equal(Object.keys(b.main).length, 8);
  assert(defs.events.every((d) => s.officeStories.counts[d.id] === 1));
  assert.equal(key === "prefecture" ? JSON.stringify(s.projects) : JSON.stringify(s[key === "tongzhi" ? "prefecture" : "tongzhi"]), snapshot);
  const points = [...new Set([0, ...chronology, 156])].sort((a,b) => a-b);
  const maxGap = Math.max(...points.slice(1).map((x,i) => x-points[i]));
  report.push({ difficulty, office: key, seed, weeks: s[key].turn, events: 18, mainline: 8, sourcedCasesClosed: 4, maxGap, restoredWeekly: true, previousOfficeFrozen: true });
}
// UI fixtures use real commands; no money or evidence is injected.
for (const key of Object.keys(commands)) {
  let s = act(structuredClone(standard[key]), commands[key][0]);
  while (s[key].turn < 12) s = act(main(s, key), commands[key][2]);
  fs.writeFileSync(`${dir}/${key}-case-start.json`, JSON.stringify(validateSave(s)));
}
const events = Object.values(OFFICE_CONTENT).flatMap((d) => d.events), cases = Object.values(OFFICE_CONTENT).flatMap((d) => d.cases);
assert.equal(new Set(events.map((d) => d.id)).size, 54);
assert.equal(new Set(events.map((d) => d.text)).size, 54);
assert.equal(new Set(events.map((d) => d.title)).size, 54);
assert.equal(new Set(cases.map((d) => d.source.key)).size, 12);
fs.writeFileSync(`${dir}/full-term-verification.json`, JSON.stringify({ terms: report.length, weeks: report.reduce((n,r)=>n+r.weeks,0), events: events.length, cases: cases.length, sourceChaptersUnique: true, maxAppearances: 1, runs: report }, null, 2));
console.log(JSON.stringify({ terms: report.length, weeks: report.reduce((n,r)=>n+r.weeks,0), events: 54, newCases: 12, maxAppearance: 1, maxGap: Math.max(...report.map((r)=>r.maxGap)) }));
