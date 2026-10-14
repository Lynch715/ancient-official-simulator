import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dispatch, validateSave } from "../src/engine.js";
import { PREF_EVENTS } from "../src/prefecture.js";
import { TZ_EVENTS } from "../src/tongzhi.js";
import { ZF_EVENTS } from "../src/zhifu.js";
import { OFFICE_HARD, officeEvent, prefHard, tzHard, zfHard } from "../src/office-hard.js";

let id = 0;
const act = (s, type, args = {}) =>
  dispatch(s, { id: `hard-office-${id++}`, type, ...args });
const fixture = (name) =>
  validateSave(JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url))));
const can = (q, c = {}) => Object.entries(c).every(([k, v]) => q[k] >= v);
const harmful = (o) => ["misconduct", "collect", "expel", "exclude"].includes(o.special);
function idleChoice(q, list) {
  const e = officeEvent(q, list.find((e) => e.id === q.event));
  const ok = e.options.filter((o) => can(q, o.cost) && !harmful(o));
  return (ok.filter((o) => !Object.keys(o.cost).length).at(-1) || ok.at(-1)).id;
}

test("严苛知县升任通判：开任钱粮缩减，申请数额与期限随种子变化", () => {
  const c = fixture("hard-county-finished");
  assert.equal(c.difficulty, "hard");
  const s = act(c, "appointment"),
    p = s.prefecture;
  assert(p.hard);
  assert.equal(p.silver, OFFICE_HARD.pref.silver);
  assert.equal(p.grain, OFFICE_HARD.pref.grain);
  assert(OFFICE_HARD.pref.needs.includes(p.request.need));
  assert(p.request.due - p.turn >= 8 && p.request.due - p.turn <= 13);
  const a = prefHard(7, PREF_EVENTS),
    b = prefHard(8, PREF_EVENTS);
  assert.deepEqual(prefHard(7, PREF_EVENTS), a);
  assert.notDeepEqual(a.needs.concat(a.spans), b.needs.concat(b.spans));
  for (const e of PREF_EVENTS)
    if (e.week > 0 && e.week < 140) assert(Math.abs(a.weeks[e.id] - e.week) <= 5);
  validateSave(s);
});

test("常例旧档的府任不生成严苛记录", () => {
  const old = fixture("week-v9-finished");
  assert.equal(old.difficulty, "standard");
  const p = act(old, "appointment").prefecture;
  assert.equal(p.hard, undefined);
  assert.equal(p.silver, 600);
  assert.equal(p.request.need, 60);
});

test("严苛通判挂机三年不称职，逐季存取有效", () => {
  let s = act(fixture("hard-county-finished"), "appointment");
  while (!s.prefecture.finished) {
    const p = s.prefecture;
    if (p.event) s = act(s, "pref_event", { choice: idleChoice(p, PREF_EVENTS) });
    s = act(s, "pref_advance");
    if (s.prefecture.turn % 13 === 0) s = validateSave(JSON.parse(JSON.stringify(s)));
  }
  const o = s.prefecture.outcome;
  assert.equal(o.rating, "不称职");
  assert.equal(o.candidate, false);
  assert(s.prefecture.hard.needTotal >= 12 * 60);
});

test("严苛同知：汛期周次与雨势随局变化，在窗口内按期结算", () => {
  const p = fixture("hard-pref-finished");
  assert(p.prefecture.outcome.candidate);
  let s = act(p, "tz_appoint");
  const q = s.tongzhi;
  assert(q.hard);
  assert.equal(q.silver, OFFICE_HARD.tz.silver);
  const turns = q.hard.floods.map((f) => f.turn);
  assert(turns[0] >= 20 && turns[0] <= 30 && turns[1] >= 72 && turns[1] <= 82 && turns[2] >= 124 && turns[2] <= 134);
  const seen = new Set();
  for (let seed = 1; seed <= 20; seed++) seen.add(JSON.stringify(tzHard(seed, TZ_EVENTS).floods));
  assert(seen.size >= 18);
  while (!s.tongzhi.finished) {
    const t = s.tongzhi;
    if (t.event) s = act(s, "tz_event", { choice: idleChoice(t, TZ_EVENTS) });
    s = act(s, "tz_advance");
    if (s.tongzhi.turn % 13 === 0) s = validateSave(JSON.parse(JSON.stringify(s)));
  }
  const done = s.tongzhi;
  assert.deepEqual(done.floods.map((f) => f.turn), turns);
  assert.deepEqual(done.floods.map((f) => f.pressure), q.hard.floods.map((f) => f.pressure));
  assert.equal(done.outcome.rating, "不称职");
});

test("严苛知府：侵渔属官随局不同，只有查证才能确认", () => {
  const t = fixture("hard-tz-finished");
  assert(t.tongzhi.outcome.candidate);
  let s = act(t, "zf_appoint");
  const q = s.zhifu;
  assert(q.hard);
  assert.equal(q.silver, OFFICE_HARD.zf.silver);
  const ids = Object.keys(q.counties);
  for (const c of q.hard.corrupt) assert(ids.includes(c));
  const firsts = new Set();
  for (let seed = 1; seed <= 30; seed++) firsts.add(zfHard(seed, ZF_EVENTS).corrupt[0]);
  assert.equal(firsts.size, 3, "三县都可能是侵渔者");
  const clean = ids.find((c) => !q.hard.corrupt.includes(c)),
    dirty = q.hard.corrupt[0];
  while (s.zhifu.event) s = act(s, "zf_event", { choice: idleChoice(s.zhifu, ZF_EVENTS) });
  s = act(s, "zf_official", { county: clean, action: "investigate" });
  s = act(s, "zf_official", { county: dirty, action: "investigate" });
  for (let i = 0; i < 2; i++) {
    if (s.zhifu.event) s = act(s, "zf_event", { choice: idleChoice(s.zhifu, ZF_EVENTS) });
    s = act(s, "zf_advance");
  }
  assert.equal(s.zhifu.counties[clean].official.exonerated, true);
  assert.equal(s.zhifu.counties[dirty].official.evidence, true);
  // F02 线索按实际侵渔县点名
  const f02 = officeEvent(s.zhifu, ZF_EVENTS.find((e) => e.id === "F02"));
  assert(f02.text.includes(s.zhifu.counties[dirty].name.replace("县", "")));
  s = validateSave(JSON.parse(JSON.stringify(s)));
  while (!s.zhifu.finished) {
    if (s.zhifu.event) s = act(s, "zf_event", { choice: idleChoice(s.zhifu, ZF_EVENTS) });
    s = act(s, "zf_advance");
  }
  assert.notEqual(s.zhifu.outcome.rating, "称职");
  validateSave(JSON.parse(JSON.stringify(s)));
});

test("府任三页在严苛与常例存档下均可渲染，严苛不显示确切汛期", async () => {
  const { prefectureView } = await import("../src/prefecture-view.js");
  const { tongzhiView } = await import("../src/tongzhi-view.js");
  const { zhifuView } = await import("../src/zhifu-view.js");
  const { guideContent } = await import("../src/guide.js");
  const h = {
    esc: (v) => String(v ?? ""),
    num: (n) => String(n),
    scene: () => "",
    avatar: () => "",
    portrait: () => "",
    btn: (t) => `<button>${t}</button>`,
    icon: () => "",
  };
  const p = act(fixture("hard-county-finished"), "appointment");
  const t = act(fixture("hard-pref-finished"), "tz_appoint");
  const z = act(fixture("hard-tz-finished"), "zf_appoint");
  const ph = prefectureView(p, h),
    th = tongzhiView(t, h),
    zh = zhifuView(z, h);
  assert(ph.includes("府署粮运") && th.includes("河工与赈济") && zh.includes("一府之治"));
  assert(th.includes("汛期约在") && !th.includes("距下一汛期"));
  for (const html of [ph, th, zh]) assert(!/undefined|NaN/.test(html));
  for (const s of [p, t, z]) assert(guideContent(s).includes("严苛难度"));
  const std = act(fixture("week-v9-finished"), "appointment");
  assert(!prefectureView(std, h).includes("严苛"));
});
