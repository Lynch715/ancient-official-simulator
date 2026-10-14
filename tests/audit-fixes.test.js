import { countyEvent, caseChoices } from "../src/county-content.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createGame, dispatch, validateSave } from "../src/engine.js";
import { CASES } from "../src/data.js";
import { prefAssessment } from "../src/prefecture.js";
import { act, completedTongzhi } from "./helpers/career.js";
import { persistState, restoreMessage } from "../src/storage.js";

test("bad scoring baselines, oversized metrics and inconsistent case queues are rejected atomically", () => {
  for (const mutate of [
    (s) => (s.base = {}),
    (s) => (s.base.people = NaN),
    (s) => (s.people = 101),
    (s) => (s.ap = 999),
    (s) => (s.grainPrice = 0),
    (s) => (s.flags.arrears = -1),
    (s) => (s.events[0].id = "constructor"),
  ]) {
    const s = createGame({ difficulty: "standard" });
    mutate(s);
    const before = structuredClone(s);
    assert.throws(() => validateSave(s));
    assert.deepEqual(s, before);
  }
  let s = createGame({ difficulty: "standard" });
  s.turn = 5;
  s.events = [];
  s.cases.boundary = {
    id: "boundary",
    clues: CASES[0].clues.map((x) => x.id),
    status: "review",
    judgment: "good",
    due: 7,
  };
  assert.throws(() => validateSave(s), /复核/);
});

test("round trips and repeat deliveries do not create additional relief merit", () => {
  let s = validateSave(
    JSON.parse(
      fs.readFileSync(
        new URL("./fixtures/quarter-v1-finished.json", import.meta.url),
      ),
    ),
  );
  s = act(s, "appointment");
  s = act(s, "pref_event", { choice: "coordinate" });
  let returning = structuredClone(s);
  returning = act(returning, "pref_transfer", {
    from: "linhe",
    to: "府仓",
    amount: 60,
    route: "urgent",
  });
  returning = act(returning, "pref_advance");
  returning = act(returning, "pref_transfer", {
    from: "府仓",
    to: "linhe",
    amount: 60,
    route: "urgent",
  });
  returning = act(returning, "pref_advance");
  assert.equal(returning.prefecture.request.netReceived, 0);
  assert.equal(returning.prefecture.effectiveDelivered, 0);
  assert.equal(returning.prefecture.met, 0);
  assert.deepEqual(validateSave(returning), returning);
  s = act(s, "pref_transfer", {
    from: "府仓",
    to: "qinghe",
    amount: 120,
    route: "urgent",
  });
  assert.equal(
    s.receipts[0].ledger.find((l) => l.title.includes("运费")).silver,
    -16,
  );
  s = act(s, "pref_advance");
  s = act(s, "pref_transfer", {
    from: "qinghe",
    to: "府仓",
    amount: 120,
    route: "urgent",
  });
  s = act(s, "pref_advance");
  assert.equal(s.prefecture.delivered, 240);
  assert.equal(s.prefecture.effectiveDelivered, 0);
  assert.equal(
    prefAssessment(s.prefecture).score,
    prefAssessment({ ...s.prefecture, delivered: 0 }).score,
  );
  s = act(s, "pref_transfer", {
    from: "府仓",
    to: "linhe",
    amount: 120,
    route: "urgent",
  });
  s = act(s, "pref_advance");
  assert.equal(s.prefecture.effectiveDelivered, 60);
  assert.equal(s.prefecture.met, 1);
  s = act(s, "pref_transfer", {
    from: "府仓",
    to: "linhe",
    amount: 60,
    route: "urgent",
  });
  s = act(s, "pref_advance");
  assert.equal(s.prefecture.effectiveDelivered, 60);
  const priorTrust = s.prefecture.trust;
  s = act(s, "pref_transfer", {
    from: "linhe",
    to: "府仓",
    amount: 120,
    route: "urgent",
  });
  assert.equal(s.prefecture.effectiveDelivered, 60); // 180 received, 120 sent: net 60
  s = act(s, "pref_advance");
  s = act(s, "pref_transfer", {
    from: "linhe",
    to: "府仓",
    amount: 60,
    route: "urgent",
  });
  assert.equal(s.prefecture.effectiveDelivered, 0);
  assert.equal(s.prefecture.met, 0);
  assert.equal(s.prefecture.trust, priorTrust - 2);
  s = act(s, "pref_advance");
  s = act(s, "pref_transfer", {
    from: "府仓",
    to: "linhe",
    amount: 60,
    route: "urgent",
  });
  s = act(s, "pref_advance");
  assert.equal(s.prefecture.effectiveDelivered, 60);
  assert.equal(s.prefecture.met, 1);
  assert.equal(s.prefecture.trust, priorTrust);
  assert.deepEqual(validateSave(s), s);
  const bad = structuredClone(s);
  bad.prefecture.silver += 1;
  assert.throws(() => validateSave(bad), /账目/);
});

test("county refuses late review and execution without spending or enqueuing", () => {
  let s = createGame({ difficulty: "standard" });
  s.turn = 155;
  s.events = [];
  s.cases.boundary = {
    id: "boundary",
    clues: CASES[0].clues.map((x) => x.id),
    status: "open",
    judgment: null,
    due: null,
  };
  const before = structuredClone(s);
  assert.throws(
    () => act(s, "judge", { case: "boundary", choice: "good" }),
    /余期/,
  );
  assert.deepEqual(s, before);
  s.cases.boundary.status = "closed";
  s.cases.boundary.execution = { status: "awaiting", deadline: 159, due: null };
  const other = structuredClone(s);
  assert.throws(() => act(s, "enforce", { case: "boundary" }), /余期/);
  assert.deepEqual(s, other);
  s.turn = 154;
  s = act(s, "enforce", { case: "boundary" });
  s = act(s, "advance");
  s = act(s, "event", { event: "G08", choice: "summary" });
  s = act(s, "advance");
  assert.equal(s.cases.boundary.execution.status, "done");
  assert.deepEqual(validateSave(s), s);
});

test("capped report records the measured delivery, distinct from natural decay and planned output", () => {
  let s = act(completedTongzhi(), "zf_appoint");
  s = act(s, "zf_event", { choice: "reserve" });
  s.zhifu.counties.qinghe.economy = 99;
  s = act(validateSave(s), "zf_task", { county: "qinghe", kind: "economy" });
  while (s.zhifu.turn < 4) s = act(s, "zf_advance");
  const t = s.zhifu.tasks[0];
  assert.equal(t.plannedActual, 8);
  assert.equal(t.actual, 1.4);
  assert(Math.abs(t.deliveryAfter - t.deliveryBefore - 1.4) < 1e-8);
  assert.equal(
    s.receipts[0].changes.find((x) => x.name === "清河县 · 农商").delta,
    1.3,
  );
  assert.deepEqual(validateSave(s), s);
  s = act(s, "zf_audit", { idTask: t.id });
  s = act(act(s, "zf_advance"), "zf_advance");
  assert.equal(s.zhifu.tasks[0].actual, 1.4);
});

test("v7 accounts migrate using opening balances without replaying historical money or changing completed merit", () => {
  let s = act(completedTongzhi(), "zf_appoint");
  const old = structuredClone(s);
  old.version = 7;
  delete old.countyRules;
  delete old.routines;
  for (const k of [
    "ledger",
    "lastLedger",
    "effectiveDelivered",
    "effectiveOpening",
    "assessmentMode",
  ])
    delete old.prefecture[k];
  for (const x of old.prefecture.shipments) delete x.credited;
  const restored = validateSave(old);
  assert.equal(restored.prefecture.assessmentMode, "legacy");
  for (const k of ["silver", "grain", "private", "turn"])
    assert.equal(restored.prefecture[k], old.prefecture[k]);
  assert.equal(restored.prefecture.outcome.score, old.prefecture.outcome.score);
  assert.equal(restored.prefecture.ledger[0].opening, true);
  assert.deepEqual(validateSave(restored), restored);
});

test("failed persistence never produces a saved confirmation, while backup failure alone does not block saving", () => {
  const broken = {
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
  };
  assert.equal(persistState(broken, "test", createGame({ difficulty: "standard" })), false);
  assert.match(restoreMessage(false), /未能存档/);
  const written = [];
  const partiallyWorking = {
    getItem: () => "old",
    setItem: (key, value) => {
      if (key.endsWith("-backup")) throw Error("quota");
      written.push([key, value]);
    },
  };
  assert.equal(persistState(partiallyWorking, "test", createGame({ difficulty: "standard" })), true);
  assert.equal(written.length, 1);
  assert.equal(written[0][0], "test");
});

test("routine followups survive restore and custom seeds change the routine order", () => {
  let s = createGame({ difficulty: "standard" });
  s = act(s, "event", { event: "X01", choice: "note" });
  s = act(s, "advance");
  const original = countyEvent(s, "W02").text;
  s = act(s, "event", { event: "W02", choice: "hire" });
  s = validateSave(JSON.parse(JSON.stringify(s)));
  assert.notEqual(countyEvent(s, "W02").text, original);
  assert.equal(s.routines.W02.lastChoice, "hire");
  let other = createGame({ difficulty: "standard", seed: 314160 });
  other = act(other, "event", { event: "X01", choice: "note" });
  other = act(other, "advance");
  assert.notEqual(s.events[0]?.id, other.events[0]?.id);
});
test("education contributes to new county merit, family changes recovery, and grain price changes real purchase cost", () => {
  let baseline = createGame({ difficulty: "standard" });
  baseline.turn = 155;
  baseline.events = [];
  const educated = structuredClone(baseline);
  educated.education = 70;
  assert(
    act(educated, "advance").outcome.scores.mission >
      act(baseline, "advance").outcome.scores.mission,
  );
  let healthy = createGame({ difficulty: "standard" });
  healthy.family = 75;
  healthy.fatigue = 20;
  healthy = act(healthy, "event", { event: "X01", choice: "note" });
  healthy = act(healthy, "advance");
  assert.equal(healthy.fatigue, 16);
  let buyer = createGame({ difficulty: "standard" });
  buyer.turn = 52;
  buyer.events = [{ id: "X04", mandatory: true }];
  buyer.grainPrice = 1.3;
  const cost = countyEvent(buyer, "X04").options.find((o) => o.id === "buy")
    .cost.silver;
  const paid = act(buyer, "event", { event: "X04", choice: "buy" });
  assert.equal(buyer.silver - paid.silver, cost);
  assert.equal(cost, 488);
});
test("staff expertise, allocation limits and concealed judgments remain consistent", () => {
  let s = createGame({ difficulty: "standard" });
  assert.throws(
    () => act(s, "staff", { person: "clerk", task: "works" }),
    /分工/,
  );
  s = act(s, "staff", { person: "deputy", task: "works" });
  assert.throws(
    () => act(s, "staff", { person: "captain", task: "works" }),
    /最多/,
  );
  const btn = (label, action, attrs) => `<button ${attrs}>${label}</button>`;
  const partial = { status: "open", clues: [] };
  assert(
    !caseChoices(s, CASES[0], partial, btn).includes('data-choice="good"'),
  );
  assert(
    caseChoices(
      s,
      CASES[0],
      { ...partial, clues: CASES[0].clues.map((c) => c.id) },
      btn,
    ).includes('data-choice="good"'),
  );
});

test("new county judgments reserve time for both review and execution", () => {
  let s = createGame({ difficulty: "standard" });
  s.turn = 154;
  s.events = [];
  s.cases.boundary = {
    id: "boundary",
    clues: CASES[0].clues.map((x) => x.id),
    status: "open",
    judgment: null,
    due: null,
  };
  assert.throws(
    () => act(s, "judge", { case: "boundary", choice: "good" }),
    /余期/,
  );
  s.turn = 152;
  assert.equal(
    act(s, "judge", { case: "boundary", choice: "good" }).cases.boundary.due,
    154,
  );
});

test("skipped routines produce context but no decision reward, and followup repair labels match the new issue", () => {
  let s = createGame({ difficulty: "standard" });
  s = act(s, "event", { event: "X01", choice: "note" });
  s = act(s, "advance");
  const before = s.economy;
  s = act(s, "advance");
  assert.equal(s.economy, before);
  assert.equal(s.routines.W02.by, "staff");
  s.routines.W03 = {
    count: 1,
    lastChoice: "repair",
    lastTurn: 0,
    by: "player",
  };
  s.events.find((row) => row.id === "W03").contentKey = "legacy";
  const e = countyEvent(s, "W03");
  assert.match(e.text, /漏水/);
  assert.match(e.options[0].label, /漏点/);
});
