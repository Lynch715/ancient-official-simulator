import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createGame, dispatch, validateSave, VERSION } from "../src/engine.js";
import { PREF_EVENTS } from "../src/prefecture.js";
import { TZ_EVENTS } from "../src/tongzhi.js";
import { ZF_EVENTS } from "../src/zhifu.js";
import { EVENTS } from "../src/data.js";
import {
  OFFICES,
  officeState,
  ensureReview,
  qualified,
} from "../src/accountability.js";
import {
  completedPrefecture,
  completedTongzhi,
  act,
} from "./helpers/career.js";
const oldCounty = () =>
  validateSave(
    JSON.parse(
      fs.readFileSync(
        new URL("./fixtures/quarter-v1-finished.json", import.meta.url),
      ),
    ),
  );
const pFull = completedPrefecture(),
  tFull = completedTongzhi();
function passive(s) {
  const q = officeState(s);
  if (s.zhifu) {
    if (q.event)
      s = act(s, "zf_event", {
        choice: ZF_EVENTS.find((e) => e.id === q.event).options[1].id,
      });
    return act(s, "zf_advance");
  }
  if (s.tongzhi) {
    if (q.event)
      s = act(s, "tz_event", {
        choice: TZ_EVENTS.find((e) => e.id === q.event).options[0].id,
      });
    return act(s, "tz_advance");
  }
  if (s.prefecture) {
    if (q.event)
      s = act(s, "pref_event", {
        choice: PREF_EVENTS.find((e) => e.id === q.event).options[0].id,
      });
    return act(s, "pref_advance");
  }
  for (const row of q.events) {
    const e = EVENTS[row.id],
      o = e.options.find(
        (o) =>
          Object.entries(o.cost).every(([k, v]) => s[k] >= v) &&
          !o.flags?.bribe &&
          !o.flags?.destroyed &&
          !o.flags?.concealed,
      );
    if (o) s = act(s, "event", { event: row.id, choice: o.id });
  }
  return act(s, "advance");
}
function finishedZhifu() {
  let s = act(tFull, "zf_appoint");
  while (!s.zhifu.finished) s = passive(s);
  return s;
}
const zFull = finishedZhifu();
function failed(role) {
  let s = structuredClone(
      role === "county"
        ? oldCounty()
        : role === "prefecture"
          ? pFull
          : role === "tongzhi"
            ? tFull
            : zFull,
    ),
    q = officeState(s, role);
  s.accountability.current = null;
  s.accountability.incidents = [];
  s.accountability.nextIncident = 1;
  s.accountability.qualifications = {};
  if (role === "county") {
    q.integrity = 20;
    q.people = 10;
    q.economy = 0;
    q.wellJudged = 0;
    q.projectsCompleted = 0;
    q.avoidableLoss = 40;
    q.flags.bribe = false;
    q.flags.concealed = false;
    q.flags.destroyed = false;
  } else {
    q.integrity = 20;
    for (const c of Object.values(q.counties)) c.people = 10;
  }
  return validateSave(s);
}
function successfulStage(s) {
  const status = s.accountability.current.status;
  while (s.accountability.current.status === status) {
    let p = s.accountability.current;
    for (const t of p.targets) {
      if (
        p.ap &&
        p.pending.length < 2 &&
        t.done + p.pending.filter((x) => x.topic === t.id).length <
          t.required &&
        p.week + 2 <= p.deadline
      ) {
        s = act(s, "ac_work", { topic: t.id });
        p = s.accountability.current;
      }
    }
    s = validateSave(act(s, "ac_advance"));
  }
  return s;
}
function acWeeks(s, n) {
  for (let i = 0; i < n; i++) s = validateSave(act(s, "ac_advance"));
  return s;
}
function prisonCase() {
  let s = act(oldCounty(), "appointment");
  while (s.prefecture.turn < 26) s = passive(s);
  s = act(s, "pref_event", { choice: "allow" });
  while (!s.prefecture.finished) s = passive(s);
  return s;
}
function exileCase() {
  let s = act(pFull, "tz_appoint");
  while (s.tongzhi.turn < 104) s = passive(s);
  s = act(s, "tz_event", { choice: "divert" });
  while (!s.tongzhi.finished) s = passive(s);
  return s;
}
const criminal = prisonCase(),
  embezzle = exileCase();
test("四任低分均进入非刑事整改，原任冻结且不能绕过升任", () => {
  for (const role of Object.keys(OFFICES)) {
    const s = failed(role),
      q = officeState(s);
    assert.equal(s.accountability.current.status, "notice");
    assert(["ability", "disaster"].includes(s.accountability.current.cause));
    assert.throws(() =>
      act(
        s,
        role === "county"
          ? "appointment"
          : role === "prefecture"
            ? "tz_appoint"
            : "zf_appoint",
      ),
    );
    const n = act(s, "ac_begin");
    assert.deepEqual(officeState(n).outcome, q.outcome);
    assert.equal(n.accountability.current.deadline, 13);
    assert.equal(n.accountability.current.silver, 140);
    assert.equal(n.accountability.current.grain, 90);
  }
});
test("整改差事先扣款，两周核验、两组上限、命令幂等和失败原子性", () => {
  let s = act(failed("county"), "ac_begin");
  const command = { id: "one-ac-work", type: "ac_work", topic: "life" };
  s = dispatch(s, command);
  assert.equal(s.accountability.current.silver, 132);
  assert.equal(s.accountability.current.targets[0].done, 0);
  assert.equal(dispatch(s, command), s);
  s = act(s, "ac_work", { topic: "finance" });
  const before = structuredClone(s);
  assert.throws(() => act(s, "ac_work", { topic: "justice" }));
  assert.deepEqual(s, before);
  s = acWeeks(s, 1);
  assert.equal(s.accountability.current.targets[0].done, 0);
  s = acWeeks(s, 1);
  assert.equal(s.accountability.current.targets[0].done, 1);
  assert.deepEqual(validateSave(s), s);
});
test("四任整改13周后留任复考26周，合格不改旧考语且恢复资格", () => {
  for (const role of Object.keys(OFFICES)) {
    let s = act(failed(role), "ac_begin"),
      old = structuredClone(officeState(s).outcome);
    s = successfulStage(s);
    assert.equal(s.accountability.current.status, "retest");
    assert.equal(s.accountability.current.week, 13);
    s = successfulStage(s);
    assert.equal(s.accountability.current.status, "cleared");
    assert.equal(s.accountability.current.week, 39);
    assert(qualified(s, role));
    assert.deepEqual(officeState(s).outcome, old);
    assert.doesNotThrow(() => validateSave(s));
  }
});
test("整改及复考失败先降调，降调通过后仍须回原职复考", () => {
  let s = act(failed("prefecture"), "ac_begin");
  s = acWeeks(s, 39);
  assert.equal(s.accountability.current.status, "demotionNotice");
  assert.equal(s.accountability.current.remedyPassed, false);
  s = act(s, "ac_begin");
  const money = s.accountability.current.private;
  s = acWeeks(s, 1);
  assert.equal(s.accountability.current.private, money + 0.5);
  s = successfulStage(s);
  assert.equal(s.accountability.current.status, "retest");
  assert(s.accountability.current.restored);
  assert(!qualified(s, "prefecture"));
  s = successfulStage(s);
  assert.equal(s.accountability.current.status, "cleared");
  assert(s.accountability.current.demoted);
  assert.equal(s.accountability.current.stageResults.length, 4);
});
test("降调仍失败或知县复考失败实际罢官，不能继续办事或晋升", () => {
  let s = act(failed("tongzhi"), "ac_begin");
  s = acWeeks(s, 39);
  s = act(s, "ac_begin");
  s = acWeeks(s, 26);
  assert.equal(s.accountability.current.status, "dismissed");
  assert.throws(() => act(s, "ac_advance"));
  assert.throws(() => act(s, "zf_appoint"));
  let c = acWeeks(act(failed("county"), "ac_begin"), 39);
  assert.equal(c.accountability.current.status, "dismissed");
  assert.equal(c.accountability.current.cause, "ability");
  assert.deepEqual(validateSave(c), c);
});
test("灾情及尽责记录获核实才延期拨款，申请不提前发钱且不可重复", () => {
  let s = structuredClone(tFull);
  s.accountability.current = null;
  s.tongzhi.integrity = 20;
  for (const c of Object.values(s.tongzhi.counties)) c.people = 10;
  s = validateSave(s); // Low integrity is not itself intentional wrongdoing; actual relief remains documented.
  assert.equal(s.accountability.current.cause, "disaster");
  s = act(s, "ac_disaster");
  assert.equal(s.accountability.current.silver, 0);
  s = acWeeks(s, 2);
  assert.equal(s.accountability.current.silver, 80);
  assert(s.accountability.current.reliefGranted);
  assert.throws(() => act(s, "ac_disaster"));
  s = act(s, "ac_begin");
  assert.equal(s.accountability.current.deadline, 28);
  s = successfulStage(s);
  assert.equal(s.accountability.current.status, "retest");
  assert.equal(s.accountability.current.week, 28);
});
test("没有尽责证据的灾情申诉不获自动免责，也不加罪", () => {
  let s = act(failed("county"), "ac_begin");
  s = act(s, "ac_disaster");
  s = acWeeks(s, 2);
  assert.equal(s.accountability.current.reliefGranted, false);
  assert.equal(s.accountability.current.deadline, 13);
  assert.equal(s.accountability.incidents.length, 0);
  assert.equal(s.accountability.current.status, "remedy");
});
test("前三级复考通过可真正接任下一职务，私产附卷净额准确承接", () => {
  for (const [role, type, next] of [
    ["county", "appointment", "prefecture"],
    ["prefecture", "tz_appoint", "tongzhi"],
    ["tongzhi", "zf_appoint", "zhifu"],
  ]) {
    let s = failed(role);
    if (role === "tongzhi") s.accountability.current.disaster.eligible = false;
    s = successfulStage(successfulStage(act(s, "ac_begin")));
    const privateFunds = s.accountability.current.private,
      source = structuredClone(officeState(s));
    s = act(s, type);
    assert.equal(s[next].private, privateFunds);
    assert.equal(s.accountability.current, null);
    assert.equal(s.accountability.history.length, 1);
    assert.deepEqual(officeState(s, role).silver, source.silver);
    assert.doesNotThrow(() => validateSave(s));
  }
});
test("新版本主动包庇具有明确罪证，先查核再复核，最终下狱", () => {
  let s = structuredClone(criminal);
  assert.equal(s.accountability.current.status, "inquiry");
  assert(
    s.accountability.incidents.some((i) => i.code === "cover" && !i.legacy),
  );
  s = act(s, "ac_reply", { reply: "deny" });
  s = acWeeks(s, 5);
  assert.equal(s.accountability.current.status, "inquiry");
  s = acWeeks(s, 1);
  assert.equal(s.accountability.current.status, "review");
  assert.equal(s.accountability.current.proposed, "prison");
  s = acWeeks(s, 3);
  assert.equal(s.accountability.current.status, "prison");
  assert.throws(() => act(s, "tz_appoint"));
});
test("挪用专项形成流放；如实陈述并足额退赔只减为下狱", () => {
  let a = acWeeks(structuredClone(embezzle), 9);
  assert.equal(a.accountability.current.status, "exile");
  let s = act(embezzle, "ac_reply", { reply: "truth" });
  const before = s.accountability.current.private;
  s = act(s, "ac_repay");
  assert.equal(s.accountability.current.private, before - 100);
  assert.equal(s.accountability.current.repaid, 100);
  assert.throws(() => act(s, "ac_repay"));
  s = acWeeks(s, 9);
  assert.equal(s.accountability.current.status, "prison");
  assert.equal(s.accountability.current.liability, 100);
  assert(s.accountability.incidents.some((i) => i.code === "divert"));
});
test("申诉延长复核，合法否认和灾情申辩不会加罪", () => {
  for (const reply of ["deny", "disaster"]) {
    let s = act(criminal, "ac_reply", { reply });
    s = acWeeks(s, 6);
    s = act(s, "ac_appeal");
    assert.equal(s.accountability.current.deadline, 11);
    assert.throws(() => act(s, "ac_appeal"));
    s = acWeeks(s, 4);
    assert.equal(s.accountability.current.status, "review");
    s = acWeeks(s, 1);
    assert.equal(s.accountability.current.status, "prison");
    assert.equal(
      s.accountability.incidents.length,
      criminal.accountability.incidents.length,
    );
  }
});
test("毁证保留原罪证并形成新罪，最终流放", () => {
  let s = act(criminal, "ac_crime", { kind: "destroy", confirmed: true });
  assert.equal(s.accountability.current.evidence.length, 2);
  s = acWeeks(s, 9);
  assert.equal(s.accountability.current.status, "exile");
  assert(s.accountability.incidents.some((i) => i.code === "cover"));
  assert(s.accountability.incidents.some((i) => i.code === "case-destroy"));
});
test("指使灭口须明确确认，独立双证、普通复核及最终核准后才斩首", () => {
  assert.throws(() => act(criminal, "ac_crime", { kind: "murder" }));
  let s = acWeeks(criminal, 5);
  s = act(s, "ac_crime", { kind: "murder", confirmed: true });
  s = acWeeks(s, 1);
  assert.equal(s.accountability.current.status, "inquiry");
  assert.equal(s.accountability.current.evidence.at(-1).documents, false);
  s = acWeeks(s, 3);
  assert.equal(s.accountability.current.status, "review");
  assert.equal(s.accountability.current.proposed, "executed");
  s = act(s, "ac_appeal");
  s = acWeeks(s, 5);
  assert.equal(s.accountability.current.status, "capitalReview");
  s = acWeeks(s, 1);
  assert.equal(s.accountability.current.status, "capitalReview");
  s = acWeeks(s, 1);
  assert.equal(s.accountability.current.status, "executed");
  assert.equal(s.accountability.current.week, 16);
  assert.throws(() => act(s, "ac_advance"));
});
test("v6旧违规标记只进入行政核查，不补造贪污数额或死罪", () => {
  const old = structuredClone(embezzle);
  old.version = 6;
  delete old.accountability;
  const migrated = validateSave(old);
  assert.equal(migrated.version, VERSION);
  assert.equal(migrated.accountability.current.liability, 0);
  assert(
    migrated.accountability.incidents.every(
      (i) => i.legacy && i.severity === 1,
    ),
  );
  const result = acWeeks(migrated, 9);
  assert.equal(result.accountability.current.status, "dismissed");
  assert.equal(old.version, 6);
  assert.deepEqual(result.tongzhi, validateSave(embezzle).tongzhi);
});
test("新旧正常任期不重放钱粮；本任未结束不提前生成整改", () => {
  for (const state of [createGame({ difficulty: "standard" }), pFull, tFull]) {
    const old = structuredClone(state);
    old.version = 6;
    delete old.accountability;
    const n = validateSave(old);
    assert.equal(n.silver, old.silver);
    assert.equal(n.turn, old.turn);
    assert.equal(n.accountability.current, null);
    assert.deepEqual(n.prefecture, old.prefecture);
  }
});
test("伪造资金、安置、证据成熟时间、无杀人证据死刑均拒绝且不污染原档", () => {
  for (const change of [
    (p) => p.silver++,
    (p) => p.settled++,
    (p) => (p.evidence[0].witnesses = true),
    (p) => {
      p.status = "executed";
      p.sentence = "executed";
      p.finalizedAt = 0;
      p.deadline = null;
    },
  ]) {
    const s = structuredClone(criminal);
    change(s.accountability.current);
    const before = structuredClone(s);
    assert.throws(() => validateSave(s));
    assert.deepEqual(s, before);
  }
});
test("附卷结算真实账目与回执一致，罪责不被高分或旧存档结局覆盖", () => {
  let s = act(failed("county"), "ac_begin");
  for (const [type, args] of [
    ["ac_work", { topic: "life" }],
    ["ac_advance", {}],
    ["ac_advance", {}],
  ]) {
    const p = s.accountability.current;
    s = act(s, type, args);
    for (const k of ["silver", "grain", "private"])
      assert(
        Math.abs(
          s.accountability.current[k] -
            p[k] -
            s.receipts[0].ledger.reduce((n, l) => n + (l[k] || 0), 0),
        ) < 0.001,
      );
  }
  let c = structuredClone(criminal);
  c.prefecture.outcome = {
    ...c.prefecture.outcome,
    rating: "称职",
    candidate: true,
    score: 100,
  };
  c = validateSave(c);
  assert.equal(c.prefecture.outcome.rating, "候查");
  assert.equal(c.accountability.current.status, "inquiry");
});

test("自然低绩效县任带有未定义可选标记时，失败附卷仍可完整存取", () => {
  let s = createGame({ difficulty: "standard" });
  while (!s.finished) {
    for (const r of s.events) {
      const o = EVENTS[r.id].options
        .toReversed()
        .find(
          (o) =>
            Object.entries(o.cost).every(([k, v]) => s[k] >= v) &&
            !o.flags?.bribe &&
            !o.flags?.destroyed &&
            !o.flags?.concealed,
        );
      if (o) s = act(s, "event", { event: r.id, choice: o.id });
    }
    s = act(s, "advance");
  }
  assert.equal(s.outcome.rating, "不称职");
  assert.equal(s.accountability.current.disaster.eligible, false);
  assert.deepEqual(validateSave(s), s);
});
