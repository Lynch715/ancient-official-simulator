import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dispatch, validateSave, VERSION } from "../src/engine.js";
import { completedPrefecture, completedTongzhi } from "./helpers/career.js";
import { OFFICE_CONTENT } from "../src/office-stories.js";
import { PREF_EVENTS } from "../src/prefecture.js";
import { TZ_EVENTS } from "../src/tongzhi-data.js";
import { ZF_EVENTS } from "../src/zhifu-data.js";
let seq = 0;
const act = (s, type, args = {}) => dispatch(s, { id: `stories-${seq++}`, type, ...args });
const start = () => act(validateSave(JSON.parse(fs.readFileSync(new URL("./fixtures/quarter-v1-finished.json", import.meta.url)))), "appointment");
test("new prefecture appoints a persistent one-time content queue", () => {
  const s = start();
  assert.ok(s.officeStories?.offices?.prefecture);
  assert.equal(s.version, VERSION);
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
});
const commands = { prefecture: ["pref_event", "pref_advance", PREF_EVENTS], tongzhi: ["tz_event", "tz_advance", TZ_EVENTS], zhifu: ["zf_event", "zf_advance", ZF_EVENTS] };
function next(s, key) {
  const [event, advance, defs] = commands[key], q = s[key];
  if (q.event) {
    const e = defs.find((x) => x.id === q.event);
    const o = e.options.find((o) => Object.entries(o.cost).every(([k, v]) => q[k] >= v));
    s = act(s, event, { choice: o.id });
  }
  return act(s, advance);
}
for (const [key, make] of [["prefecture", start], ["tongzhi", () => act(completedPrefecture(), "tz_appoint")], ["zhifu", () => act(completedTongzhi(), "zf_appoint")]]) {
  test(`${key}: 18 unique story events and four different sourced cases`, () => {
    assert.equal(OFFICE_CONTENT[key].events.length, 18);
    assert.equal(OFFICE_CONTENT[key].cases.length, 4);
    assert.equal(new Set(OFFICE_CONTENT[key].cases.map((d) => d.source.key)).size, 4);
  });
  test(`${key}: incomplete evidence is refused, hasty review returns, full proof closes only after execution`, () => {
    let s = make(), d = OFFICE_CONTENT[key].cases[0];
    assert.ok(d, "four sourced cases must exist");
    while (s[key].turn < d.week) s = next(s, key);
    assert.throws(() => act(s, "office_case", { case: d.id, action: "review", choice: "evidence" }));
    s = act(s, "office_case", { case: d.id, action: "review", choice: "hasty" });
    s = next(next(s, key), key);
    assert.equal(s.officeStories.offices[key].cases[d.id].status, "returned");
    for (const c of d.clues) {
      if (s[key].ap < 1) s = next(s, key);
      s = act(s, "office_case", { case: d.id, action: "clue", clue: c.id });
      assert.throws(() => act(s, "office_case", { case: d.id, action: "clue", clue: c.id }));
    }
    s = next(s, key);
    const cmd = { id: `case-once-${key}`, type: "office_case", case: d.id, action: "review", choice: "evidence" };
    s = dispatch(s, cmd);
    assert.deepEqual(dispatch(s, cmd), s);
    s = next(s, key);
    assert.equal(s.officeStories.offices[key].cases[d.id].status, "review");
    s = validateSave(JSON.parse(JSON.stringify(next(s, key))));
    assert.equal(s.officeStories.offices[key].cases[d.id].status, "approved");
    const before = s[key].silver;
    s = act(s, "office_case", { case: d.id, action: "execute" });
    assert.equal(s[key].silver, before - 6);
    s = next(s, key);
    assert.equal(s.officeStories.offices[key].cases[d.id].status, "executing");
    s = validateSave(JSON.parse(JSON.stringify(next(s, key))));
    assert.equal(s.officeStories.offices[key].cases[d.id].status, "closed");
    assert.throws(() => act(s, "office_case", { case: d.id, action: "execute" }));
    for (const status of ["approved", "executing", "open", "returned", "review"]) {
      const forged = structuredClone(s);
      forged.officeStories.offices[key].cases[d.id].status = status;
      assert.throws(() => validateSave(forged), `closed case cannot roll back to ${status}`);
    }
  });
}
test("new cases enter the playable office command path and require evidence", () => {
  let s = start();
  s = act(s, "pref_event", { choice: "coordinate" });
  for (let i = 0; i < 6; i++) s = act(s, "pref_advance");
  assert.ok(s.officeStories?.offices?.prefecture?.queue.length);
  s = act(s, "office_story", { event: "TP01", choice: "help" });
  assert.equal(s.officeStories.counts.TP01, 1);
  assert.throws(() => act(s, "office_story", { event: "TP01", choice: "help" }));
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
});
test("v11 active office retires only past content and does not mint outcomes or replay money", () => {
  let s = start();
  while (s.prefecture.turn < 80) s = next(s, "prefecture");
  const old = structuredClone(s);
  old.version = 11;
  delete old.officeStories;
  const migrated = validateSave(old), b = migrated.officeStories.offices.prefecture;
  assert.deepEqual(migrated.prefecture, old.prefecture);
  assert.equal(migrated.version, VERSION);
  assert.equal(b.queue.length, 0);
  assert.equal(Object.keys(b.cases).length, 0);
  assert.equal(b.retiredCases.length, 3);
  assert.equal(Object.keys(migrated.officeStories.counts).length, 0);
  assert.equal(old.version, 11);
  let resumed = next(migrated, "prefecture");
  while (resumed.prefecture.turn < 112) resumed = next(resumed, "prefecture");
  assert.deepEqual(Object.keys(resumed.officeStories.offices.prefecture.cases), ["PC04"]);
  validateSave(resumed);
});
test("unanswered mail leaves once after eight weeks without early or delegated rewards", () => {
  let s = start();
  while (s.prefecture.turn < 3) s = next(s, "prefecture");
  assert.equal(s.officeStories.offices.prefecture.events.TP01.status, "pending");
  while (s.prefecture.turn < 11) s = next(s, "prefecture");
  const row = s.officeStories.offices.prefecture.events.TP01;
  assert.equal(row.status, "delegated");
  assert.equal(row.settled, false);
  assert.equal(s.officeStories.counts.TP01, 1);
  assert.throws(() => act(s, "office_story", { event: "TP01", choice: "help" }));
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
});
test("queue collisions retain both mail and cases and completed evidence cannot be forged", () => {
  let s = start();
  while (s.prefecture.turn < 19) s = next(s, "prefecture");
  assert(s.officeStories.offices.prefecture.queue.includes("TP03"));
  assert(s.officeStories.offices.prefecture.cases.PC01);
  for (const corrupt of [
    (x) => { x.officeStories.counts.TP03 = 2; },
    (x) => { x.officeStories.offices.prefecture.queue.push("TP03"); },
    (x) => { x.officeStories.offices.prefecture.cases.PC01.clues.push({ id: "unknown", turn: 19 }); },
    (x) => { x.officeStories.offices.prefecture.cases.PC01.status = "closed"; },
    (x) => { x.officeStories.offices.prefecture.cases.PC01.status = "review"; x.officeStories.offices.prefecture.cases.PC01.due = 156; },
    (x) => { x.officeStories.sources.fake = "PC01"; },
  ]) {
    const raw = structuredClone(s);
    corrupt(raw);
    const unchanged = structuredClone(raw);
    assert.throws(() => validateSave(raw));
    assert.deepEqual(raw, unchanged);
  }
});
test("late reviews fail atomically and unclosed case is handed over without merit", () => {
  let s = start();
  while (s.prefecture.turn < 153) s = next(s, "prefecture");
  const before = structuredClone(s);
  assert.throws(() => act(s, "office_case", { case: "PC04", action: "review", choice: "hasty" }));
  assert.deepEqual(s, before);
  while (!s.prefecture.finished) s = next(s, "prefecture");
  assert(Object.values(s.officeStories.offices.prefecture.cases).every((f) => f.status === "handover"));
  assert.equal(Object.keys(s.officeStories.counts).length, 18);
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
});
test("both difficulties keep a new-event gap of at most eight weeks across the three offices", () => {
  const parents = { prefecture: "hard-county-finished", tongzhi: "hard-pref-finished", zhifu: "hard-tz-finished" };
  const appoint = { prefecture: "appointment", tongzhi: "tz_appoint", zhifu: "zf_appoint" };
  for (const key of Object.keys(parents)) for (let seed = 1; seed <= 40; seed++) {
    const old = JSON.parse(fs.readFileSync(new URL(`./fixtures/${parents[key]}.json`, import.meta.url)));
    old.seed = seed;
    const s = act(validateSave(old), appoint[key]);
    const pts = [...new Set([0, 156, ...Object.values(s[key].hard.weeks), ...Object.values(s.officeStories.offices[key].schedule), ...OFFICE_CONTENT[key].cases.map((d) => d.week)])].sort((a,b) => a-b);
    const gap = Math.max(...pts.slice(1).map((x,i)=>x-pts[i]));
    assert(gap <= 8, `${key} seed ${seed}: gap ${gap}`);
  }
});
test("a verified earlier story makes the related witness easier to find without changing case facts", () => {
  let s = start();
  while (s.prefecture.turn < 3) s = next(s, "prefecture");
  s = act(s, "office_story", { event: "TP01", choice: "help" });
  while (s.prefecture.turn < 12) s = next(s, "prefecture");
  const before = s.prefecture.silver;
  s = act(s, "office_case", { case: "PC01", action: "clue", clue: "e2" });
  assert.equal(before - s.prefecture.silver, 2);
  assert.equal(s.officeStories.offices.prefecture.cases.PC01.clues[0].id, "e2");
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))), s);
});
