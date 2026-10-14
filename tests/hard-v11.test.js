import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createGame, dispatch, validateSave, VERSION } from "../src/engine.js";
import { countyEvent } from "../src/county-content.js";
import { countyCase } from "../src/case-content.js";
import { EVENTS, PROJECTS, CASES } from "../src/data.js";
import { HARD, blankHard, remitGrain } from "../src/county-hard.js";

let id = 0;
const act = (s, type, args = {}) =>
  dispatch(s, { id: `hard-${id++}`, type, ...args });
const can = (s, c = {}) => Object.entries(c).every(([k, v]) => s[k] >= v);
function clearEvents(s, pick = "free") {
  for (const e of [...s.events]) {
    const def = countyEvent(s, e.id);
    const legal = def.options.filter(
      (o) => can(s, o.cost) && !o.flags?.bribe && !o.flags?.concealed && !o.flags?.destroyed,
    );
    const free = legal.filter((o) => !Object.keys(o.cost).length);
    const o = pick === "free" ? free.at(-1) || legal.at(-1) : legal[0];
    s = act(s, "event", { event: e.id, choice: o.id });
  }
  return s;
}
const weeks = (s, n, pick) => {
  for (let i = 0; i < n && !s.finished; i++) s = act(clearEvents(s, pick), "advance");
  return s;
};

test("新开局默认严苛，日程由种子决定且落在季节窗口内", () => {
  const s = createGame({ seed: 7 });
  assert.equal(s.version, VERSION);
  assert.equal(s.difficulty, "hard");
  assert.equal(s.silver, HARD.silver);
  assert.equal(s.grain, HARD.grain);
  assert.deepEqual(createGame({ seed: 7 }).hard, s.hard);
  const schedules = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const h = blankHard(seed);
    const at = Object.fromEntries(Object.entries(h.schedule).map(([w, e]) => [e, Number(w)]));
    assert(at.X04 >= 52 && at.X04 <= 62, "春旱在第二年春季");
    assert(at.X12 >= 65 && at.X12 <= 77, "汛情在第二年夏季");
    if (at.H12) assert(at.H12 >= 131 && at.H12 <= 141);
    assert(Object.keys(h.schedule).length === new Set(Object.keys(h.schedule)).size);
    for (const e of Object.values(h.schedule)) assert(EVENTS[e]);
    schedules.add(JSON.stringify(h.schedule) + h.droughtSev + h.floodSev);
  }
  assert(schedules.size >= 35, "不同种子的灾情日程应明显不同");
  const std = createGame({ difficulty: "standard" });
  assert.equal(std.difficulty, "standard");
  assert.equal(std.hard, null);
  assert.equal(std.silver, 900);
});

test("v10 旧档升级为常例难度，不套用严苛规则", () => {
  const old = JSON.parse(
    fs.readFileSync(new URL("./fixtures/week-v9-finished.json", import.meta.url)),
  );
  const s = validateSave(old);
  assert.equal(s.version, VERSION);
  assert.equal(s.difficulty, "standard");
  assert.equal(s.hard, null);
  const v10 = structuredClone(s);
  v10.version = 10;
  delete v10.difficulty;
  delete v10.hard;
  assert.equal(validateSave(v10).difficulty, "standard");
});

test("季末实解府库，交不足记欠解并扣信任，补解可清偿", () => {
  let s = weeks(createGame({ seed: 101 }), 12);
  const before = { silver: s.silver, grain: s.grain, trust: s.trust };
  s = act(clearEvents(s), "advance");
  const row = s.ledger.find((l) => l.title === "季末实解府库");
  assert.equal(row.silver, -HARD.remit.silver);
  assert.equal(row.grain, -remitGrain(12));
  assert.equal(s.hard.owedSilver, 0);
  // 人为掏空官库，下一季必然欠解
  let poor = clearEvents(weeks(s, 12));
  assert.equal(poor.turn % 13, 12);
  poor.silver = 5;
  poor = validateSave(poor);
  poor = act(poor, "advance");
  assert(poor.hard.owedSilver > 0);
  assert.equal(poor.hard.remitMissed, 1);
  assert(poor.trust < before.trust);
  assert(poor.logs.some((l) => l.title === "上解不足"));
  poor.silver += 200;
  poor = act(validateSave(poor), "hard_remit");
  assert.equal(poor.hard.owedSilver, 0);
  assert.throws(() => act(poor, "hard_remit"), /没有欠解/);
});

test("全县指标每周向常态回落，高位回落更快", () => {
  let s = createGame({ seed: 3 });
  s.people = 90;
  s.order = 60;
  s = validateSave(s);
  const n = act(clearEvents(s), "advance");
  const dropHigh = 90 - n.people,
    dropLow = 60 - n.order;
  assert(dropHigh > 0 && dropLow > 0);
  assert(dropHigh > dropLow * 2);
});

test("春旱按种子周次出现，粮需随严重度变化", () => {
  const s0 = createGame({ seed: 202 });
  const week = Number(Object.entries(s0.hard.schedule).find(([, e]) => e === "X04")[0]);
  let s = weeks(s0, week);
  assert.equal(s.turn, week);
  const row = s.events.find((e) => e.id === "X04");
  assert(row?.mandatory);
  const def = countyEvent(s, "X04");
  const need = Math.round((Math.round((300 * s.hard.droughtSev) / 10) * 10) * 1.2);
  assert.equal(def.options.find((o) => o.id === "grain").cost.grain, need);
  assert(def.text.includes(`${need}石`));
});

test("案卷：一条线索可拟判，和息限两案，逾限记过", () => {
  let s = weeks(createGame({ seed: 11 }), 5);
  assert(s.cases.boundary);
  const def = countyCase(s, "boundary");
  s = act(s, "investigate", { case: "boundary", clue: def.clues[0].id });
  s = act(s, "judge", { case: "boundary", choice: "good" });
  assert.equal(s.cases.boundary.status, "review");
  assert.equal(typeof s.cases.boundary.weak, "boolean");
  s = validateSave(s);
  s = weeks(s, 2);
  assert(["closed", "returned"].includes(s.cases.boundary.status));
  // 和息
  let t = weeks(createGame({ seed: 12 }), 6);
  t = act(t, "judge", { case: "boundary", choice: "settle" });
  assert.equal(t.cases.boundary.status, "closed");
  assert.equal(t.cases.boundary.execution.status, "done");
  assert.deepEqual(t.hard.settled, ["boundary"]);
  t = weeks(t, 40);
  assert(t.cases.granary);
  assert.throws(() => act(t, "judge", { case: "granary", choice: "settle" }), /不能和息/);
  // 逾限
  let u = weeks(createGame({ seed: 13 }), 5 + HARD.caseLimit);
  assert(u.cases.boundary.overdue);
  assert(u.hard.overdue >= 1);
  assert(u.logs.some((l) => l.title === "案卷逾限"));
});

test("私聘书启：私产换精力，钱尽自辞；捐俸与籴粮入账", () => {
  let s = createGame({ seed: 5, family: "humble" });
  s = act(s, "hard_hire");
  s = act(clearEvents(s), "advance");
  assert.equal(s.ap, 4);
  s = validateSave(s);
  const p = s.private;
  s = act(clearEvents(s), "advance");
  assert(s.private < p + 0.5);
  s.private = 1;
  s = validateSave(s);
  s = act(clearEvents(s), "advance");
  assert.equal(s.hard.hired, false);
  assert(s.logs.some((l) => l.title === "书启辞馆"));
  s = act(clearEvents(s), "advance");
  assert.equal(s.ap, 3);
  // 捐俸
  let d = createGame({ seed: 5, family: "gentry" });
  const silver = d.silver;
  d = act(d, "hard_donate");
  assert.equal(d.silver, silver + HARD.donate);
  assert.throws(() => act(d, "hard_donate"), /本周已捐俸/);
  // 籴粮
  const grain = d.grain;
  d = act(d, "hard_buy");
  assert.equal(d.pending.at(-1).kind, "buy");
  d = validateSave(d);
  d = act(clearEvents(d), "advance");
  assert(d.grain > grain + HARD.buyAmount - 30);
  assert.throws(() => act(createGame({ difficulty: "standard" }), "hard_hire"), /常例规则/);
});

test("事件选项按局打乱顺序，结算不受顺序影响", () => {
  const orders = new Set();
  for (let seed = 1; seed <= 12; seed++)
    orders.add(countyEvent(createGame({ seed }), "X01").options.map((o) => o.id).join());
  assert(orders.size > 1);
});

test("严苛任期：挂机不称职，逐周存取可重放", () => {
  let s = createGame({ seed: 99 }),
    again = createGame({ seed: 99 });
  while (!s.finished) {
    s = validateSave(JSON.parse(JSON.stringify(act(clearEvents(s), "advance"))));
  }
  assert.equal(s.outcome.rating, "不称职");
  assert(s.outcome.score < 40);
  while (!again.finished) again = act(clearEvents(again), "advance");
  assert.equal(again.outcome.score, s.outcome.score);
  assert.equal(again.silver, s.silver);
});

test("严苛任期：只修工程、办案的适度玩法不再称职", () => {
  let s = createGame({ seed: 314159 });
  for (const [p, t] of Object.entries({ clerk: "ledger", dianshi: "ledger", captain: "patrol", advisor: "care", deputy: "care" }))
    s = act(s, "staff", { person: p, task: t });
  while (!s.finished) {
    s = clearEvents(s, "best");
    if (s.hard.owedSilver || s.hard.owedGrain) try { s = act(s, "hard_remit"); } catch {}
    for (const p of PROJECTS)
      if (!s.projects.some((x) => x.id === p.id) && !s.projects.some((x) => x.status === "building") && s.silver > p.cost + 60 && s.ap)
        s = act(s, "project", { project: p.id });
    for (const c of CASES) {
      const f = s.cases[c.id];
      if (!f) continue;
      const def = countyCase(s, c.id);
      if (["open", "returned"].includes(f.status)) {
        for (const cl of def.clues) if (!s.cases[c.id].clues.includes(cl.id) && s.ap) s = act(s, "investigate", { case: c.id, clue: cl.id });
        if (s.cases[c.id].clues.length === def.clues.length && s.turn + 4 <= 156) s = act(s, "judge", { case: c.id, choice: "good" });
      }
      if (["awaiting", "overdue"].includes(s.cases[c.id].execution?.status) && s.ap && s.silver >= 6 && s.turn + 2 <= 156) s = act(s, "enforce", { case: c.id });
    }
    s = act(s, "advance");
  }
  assert.notEqual(s.outcome.rating, "称职");
  assert(s.outcome.score < 70, `适度玩法得${s.outcome.score}分`);
  for (const v of Object.values(s.outcome.scores)) assert(v <= 100);
  assert(Object.values(s.outcome.scores).filter((v) => v >= 99).length <= 1, "考评各项不应普遍封顶");
});
