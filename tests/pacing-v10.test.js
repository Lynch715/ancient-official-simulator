import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createGame,
  dispatch,
  validateSave,
  budgetForecast,
} from "../src/engine.js";
import { countyEvent } from "../src/county-content.js";
import { countyCase } from "../src/case-content.js";
import { AFFAIRS } from "../src/county-affairs.js";
import { routineStop, routineBoundary } from "../src/county-pacing.js";
import { marketYield } from "../src/governance.js";
import { inspectionLoad, qualified } from "../src/accountability.js";
let id = 0;
const act = (s, type, args = {}) =>
  dispatch(s, { id: "v10-" + id++, type, ...args });
const affordable = (s, c) => Object.entries(c).every(([k, v]) => s[k] >= v);
function mandatory(s) {
  for (const e of s.events.filter((e) => e.mandatory)) {
    const o = countyEvent(s, e.id).options.find((o) => affordable(s, o.cost));
    s = act(s, "event", { event: e.id, choice: o.id });
  }
  return s;
}
function at(turn) {
  let s = createGame({ difficulty: "standard" });
  while (s.turn < turn) s = validateSave(act(mandatory(s), "advance"));
  return s;
}
function staff(s) {
  for (const [person, task] of [
    ["deputy", "works"],
    ["dianshi", "ledger"],
    ["clerk", "ledger"],
    ["captain", "patrol"],
    ["advisor", "care"],
  ])
    s = act(s, "staff", { person, task });
  return s;
}
function idleCounty() {
  let s = staff(createGame({ difficulty: "standard" }));
  while (!s.finished) s = validateSave(act(mandatory(s), "advance"));
  return s;
}
function remedy(s, withCases = true) {
  s = act(s, "ac_begin");
  while (!["cleared", "dismissed"].includes(s.accountability.current.status)) {
    let p = s.accountability.current;
    if (withCases)
      for (const [cid, c] of Object.entries(p.caseReviews)) {
        const d = countyCase(s, cid);
        for (const clue of d.clues) {
          p = s.accountability.current;
          if (
            p.caseReviews[cid].status === "open" &&
            !p.caseReviews[cid].clues.includes(clue.id) &&
            p.ap
          )
            s = act(s, "ac_case_clue", { case: cid, clue: clue.id });
        }
        p = s.accountability.current;
        if (
          p.caseReviews[cid].status === "open" &&
          p.caseReviews[cid].clues.length === d.clues.length &&
          p.ap &&
          inspectionLoad(p) < 2 &&
          p.week + 2 <= p.deadline
        )
          s = act(s, "ac_case_handover", { case: cid });
      }
    for (const t of s.accountability.current.targets) {
      p = s.accountability.current;
      if (
        p.ap &&
        inspectionLoad(p) < 2 &&
        t.done + p.pending.filter((x) => x.topic === t.id).length <
          t.required &&
        p.week + 2 <= p.deadline
      )
        s = act(s, "ac_work", { topic: t.id });
    }
    s = validateSave(act(s, "ac_advance"));
  }
  return s;
}

test("新任高分但四案未办进入普通整改，不能直接升任或绕过逐案补查", () => {
  let s = idleCounty();
  assert.equal(s.outcome.score, 78);
  assert.equal(s.outcome.rating, "平常");
  assert.equal(s.outcome.duties.length, 4);
  assert.equal(s.accountability.current.cause, "ability");
  assert.throws(() => act(s, "appointment"));
  assert.equal(s.accountability.incidents.length, 0);
  let wrong = remedy(s, false);
  assert.equal(wrong.accountability.current.status, "dismissed");
  assert(!qualified(wrong, "county"));
});
test("原卷补查与正式移交恢复资格，原任未办事实、分数与判决保留", () => {
  let s = idleCounty(),
    original = structuredClone(s.cases);
  s = remedy(s);
  assert(qualified(s, "county"));
  assert.deepEqual(s.cases, original);
  assert.equal(s.outcome.score, 78);
  assert.equal(s.outcome.rating, "平常");
  assert(
    Object.values(s.accountability.current.caseReviews).every(
      (c) => c.status === "done",
    ),
  );
  assert(act(s, "appointment").prefecture);
  let fake = structuredClone(s);
  delete fake.accountability.current.caseReviews.boundary;
  assert.throws(() => validateSave(fake));
});
test("未查齐证据、无精力、查验占满或期限不足不能收费移交", () => {
  let s = act(idleCounty(), "ac_begin"),
    before = structuredClone(s);
  assert.throws(() => act(s, "ac_case_handover", { case: "boundary" }));
  assert.deepEqual(s, before);
  for (const clue of countyCase(s, "boundary").clues)
    s = act(s, "ac_case_clue", { case: "boundary", clue: clue.id });
  assert.throws(() => act(s, "ac_case_handover", { case: "boundary" }));
  s = act(s, "ac_advance");
  s = act(s, "ac_case_handover", { case: "boundary" });
  assert.equal(inspectionLoad(s.accountability.current), 1);
  assert.throws(() => act(s, "ac_case_handover", { case: "boundary" }));
  assert.equal(
    validateSave(s).accountability.current.caseReviews.boundary.status,
    "checking",
  );
});
test("已经完成的v9考语与任命保留，未办案件的旧称职履历不追溯撤销", () => {
  for (const name of ["week-v9-finished.json", "week-v9-idle-finished.json"]) {
    const old = JSON.parse(
        fs.readFileSync(new URL("./fixtures/" + name, import.meta.url)),
      ),
      n = validateSave(old);
    assert.equal(n.version, 11);
    assert.equal(n.countyPacing, "legacy");
    assert.equal(n.outcome.score, old.outcome.score);
    assert.equal(n.outcome.rating, old.outcome.rating);
    assert.deepEqual(n.cases, old.cases);
    for (const k of ["silver", "grain", "private"]) assert.equal(n[k], old[k]);
    assert(act(n, "appointment").prefecture);
  }
});
test("在任v9迁移保留现有钱粮与要务，过去阶段事务不补发", () => {
  let old = createGame({ difficulty: "standard" });
  old.version = 9;
  delete old.countyPacing;
  delete old.countyAffairs;
  delete old.governance.pendingWorks;
  delete old.governance.nextWork;
  old.turn = 100;
  old.events = [];
  const n = validateSave(old);
  assert.equal(n.countyPacing, "current");
  assert.equal(n.governance.mandate.mode, "immediate");
  assert.equal(n.silver, 900);
  assert(
    Object.entries(AFFAIRS)
      .filter(([, d]) => d.release < 100)
      .every(([id]) => n.countyAffairs.retired[id]),
  );
});
test("零疲劳时不送劳瘁来信，有疲劳时按实际差值恢复", () => {
  let s = at(121);
  assert.equal(s.fatigue, 0);
  assert(!s.events.some((e) => e.id === "G05"), "零疲劳不出空抉择");
  s.events = [{ id: "G05", mandatory: false }];
  let n;
  s.fatigue = 7;
  n = act(s, "event", { event: "G05", choice: "rest" });
  assert.equal(n.ap, s.ap - 1);
  assert.equal(n.fatigue, 0);
  assert.equal(n.receipts[0].changes.find((c) => c.name === "疲劳").delta, -7);
});
test("第二第三年18项阶段内容按期进入，处理和交办后均不重复", () => {
  let s = createGame({ difficulty: "standard" }),
    seen = new Set(),
    empty = 0,
    max = 0,
    run = 0;
  while (!s.finished) {
    let events = s.events;
    for (const e of events.filter((e) => AFFAIRS[e.id])) {
      assert(!seen.has(e.id));
      seen.add(e.id);
    }
    if (s.turn >= 52) {
      if (!events.length) {
        empty++;
        run++;
        max = Math.max(max, run);
      } else run = 0;
    }
    s = validateSave(act(mandatory(s), "advance"));
  }
  assert.equal(seen.size, 18);
  assert(max <= 8);
  assert.equal(s.countyAffairs.records.length, 18);
  assert(s.countyAffairs.records.every((r) => r.status === "staff"));
  assert.equal(s.countyAffairs.pending.length, 0);
  assert(empty < 91);
});
test("阶段投入付款与交付分开，读档不提前记成果或重复结算", () => {
  let s = at(56),
    e = s.events.find((e) => e.id === "C01");
  assert(e);
  const before = s.governance.districts.fields.commerce;
  s = act(s, "event", { event: "C01", choice: "fund" });
  assert.equal(s.governance.districts.fields.commerce, before);
  assert.equal(s.countyAffairs.pending[0].due, 59);
  assert.equal(s.receipts[0].ledger[0].silver, -14);
  s = validateSave(s);
  for (let i = 0; i < 3; i++) s = validateSave(act(mandatory(s), "advance"));
  assert.equal(s.governance.districts.fields.commerce, before + 4);
  assert.equal(s.countyAffairs.pending.length, 0);
  assert.equal(
    s.countyAffairs.records.find((r) => r.id === "C01").status,
    "done",
  );
  const r = structuredClone(s);
  assert.deepEqual(validateSave(s), r);
  assert.throws(() => act(s, "event", { event: "C01", choice: "fund" }));
});
test("18种阶段事务都可由两种实际安排交验并存取，地方与养护遵守上限", () => {
  for (const [cid, d] of Object.entries(AFFAIRS))
    for (const choice of ["inspect", "fund"]) {
      let s = at(d.release);
      s.events = [{ id: cid, mandatory: false }];
      s.countyAffairs.retired[cid] = true;
      s = act(s, "event", { event: cid, choice });
      assert.equal(s.countyAffairs.records.at(-1).status, "pending");
      const due = s.countyAffairs.pending.at(-1).due;
      while (s.turn < due) s = validateSave(act(mandatory(s), "advance"));
      assert.equal(
        s.countyAffairs.records.find((r) => r.id === cid).status,
        "done",
      );
      assert(s.governance.districts[d.district][d.metric] <= 100);
      assert.deepEqual(validateSave(s), s);
    }
});
test("交验型要务必须查勘、投入、到期核验，直接加指标不能代替交付", () => {
  let s = at(13),
    m = s.governance.mandate;
  assert.equal(m.mode, "verified");
  const args = { district: m.district, kind: m.metric };
  assert.throws(() => act(s, "district", args));
  s = act(s, "action", { action: "inspect" });
  const before = s.governance.districts[m.district][m.metric];
  s = act(s, "district", args);
  assert.equal(s.governance.districts[m.district][m.metric], before);
  assert.equal(s.governance.mandate.status, "active");
  assert.throws(() => act(s, "district", args));
  s = validateSave(act(mandatory(s), "advance"));
  assert.equal(s.governance.mandate.status, "active");
  s = validateSave(act(mandatory(s), "advance"));
  assert.equal(s.governance.mandate.status, "met");
  assert.equal(
    s.governance.districts[m.district][m.metric],
    before + (m.metric === "commerce" ? 8 : 10),
  );
});
test("亲自跟办提前一周交验，查勘在全局指标饱和时仍有实际用途", () => {
  let s = at(13);
  s.people = s.integrity = 100;
  assert.equal(s.governance.mandate.checked, false);
  s = act(s, "action", { action: "inspect" });
  assert(s.governance.mandate.checked);
  let m = s.governance.mandate;
  s = act(s, "district", { district: m.district, kind: m.metric });
  s = act(s, "action", { action: m.metric === "security" ? "patrol" : "farm" });
  assert(s.governance.pendingWorks[0].expedited);
  assert.equal(s.governance.pendingWorks[0].due, 14);
  s = validateSave(act(mandatory(s), "advance"));
  assert.equal(s.governance.mandate.status, "met");
  assert.equal(s.governance.pendingWorks.length, 0);
});
test("开集淡旺季与低高产能产生不同取舍，预算与实际入账一致", () => {
  let s = createGame({ difficulty: "standard" });
  s.governance.districts.market = {
    commerce: 100,
    security: 100,
    livelihood: 80,
  };
  s.turn = 26;
  assert(marketYield(s) > 3);
  s.turn = 39;
  assert(marketYield(s) < 3);
  s.governance.districts.market.commerce = 40;
  assert.equal(marketYield(s), 0);
  s = createGame({ difficulty: "standard" });
  s = act(s, "policy", { category: "commerce", choice: "fair" });
  for (let i = 0; i < 5; i++) s = act(mandatory(s), "advance");
  const forecast = budgetForecast(s),
    before = s.silver;
  {
    const n = act(mandatory(s), "advance");
    assert(Math.abs(n.silver - before - forecast.net) < 0.02);
    assert(n.receipts[0].policies.some((p) => p.includes("按商坊产能")));
  }
});
test("无施工时雇工与赶工停支，有施工才扣费、提速或承担工役影响", () => {
  for (const choice of ["gentle", "intensive"]) {
    let s = act(createGame({ difficulty: "standard" }), "policy", { category: "labor", choice });
    const before = s.governance.districts.fields.livelihood;
    s = act(mandatory(s), "advance");
    assert.equal(s.governance.funded.labor, false);
    assert.equal(s.governance.districts.fields.livelihood, before);
    assert(!s.receipts[0].ledger.some((l) => l.title === "县政 · 雇工减役"));
    s = act(s, "project", { project: "canal" });
    s = act(mandatory(s), "advance");
    assert(s.governance.funded.labor);
    assert(s.projects[0].remaining !== 25);
  }
});
test("常例推进阻止略过来信、未办案件、居民和未安排要务", () => {
  let s = createGame({ difficulty: "standard" });
  assert(routineStop(s).includes("来信"));
  s.events = [];
  s.cases.boundary = { id: "boundary", status: "open" };
  assert(routineStop(s).includes("案卷"));
  s.cases = {};
  s.displaced = 3;
  assert(routineStop(s).includes("居民"));
  s.displaced = 0;
  assert(routineStop(s).includes("地方要务"));
});
test("常例每个推进步与手动周结算一致，并停在新来信和项目交付", () => {
  let s = at(10);
  s.cases.boundary.status = "closed";
  s.cases.boundary.execution = { status: "legacy", due: null, deadline: null };
  s.governance.mandate.status = "met";
  s = act(s, "project", { project: "canal" });
  s.projects[0].remaining = 1;
  let manual = act(s, "advance");
  assert(routineBoundary(s, manual).includes("已交付"));
  assert.deepEqual(validateSave(manual), manual);
  s = at(55);
  s.cases.boundary.status = "closed";
  s.cases.boundary.execution = { status: "legacy", due: null, deadline: null };
  s.cases.granary.status = "closed";
  s.cases.granary.execution = { status: "legacy", due: null, deadline: null };
  s.displaced = 0;
  s.populationLedger.settled =
    s.populationLedger.opening + s.populationLedger.arrived;
  s.governance.mandate.status = "met";
  const n = act(s, "advance");
  assert(n.events.some((e) => e.id === "C01"));
  assert(routineBoundary(s, n).includes("新来信"));
  assert(n.countyAffairs.records.every((r) => r.id !== "C01"));
  assert(n.events.some((e) => e.id === "C01"));
});
