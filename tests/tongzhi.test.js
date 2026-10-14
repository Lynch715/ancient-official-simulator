import { adminCost } from "../src/rules.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch, validateSave, VERSION } from "../src/engine.js";
import {
  TZ_EVENTS,
  TZ_PROJECTS,
  defence,
  availableResettlers,
} from "../src/tongzhi.js";
import { act, completedPrefecture } from "./helpers/career.js";
const predecessor = completedPrefecture();
const start = () => act(predecessor, "tz_appoint");
function resolve(s) {
  if (s.tongzhi.event) {
    const e = TZ_EVENTS.find((e) => e.id === s.tongzhi.event),
      choice = e.options.find((o) =>
        Object.entries(o.cost).every(([k, v]) => s.tongzhi[k] >= v),
      );
    s = act(s, "tz_event", { choice: choice.id });
  }
  return s;
}
const next = (s) => act(resolve(s), "tz_advance");
function startWork(s, id) {
  s = resolve(s);
  s = act(s, "tz_project", { project: id, action: "survey" });
  if (!s.tongzhi.ap) s = next(s);
  s = act(s, "tz_project", { project: id, action: "propose" });
  s = next(next(s));
  return act(s, "tz_project", { project: id, action: "start" });
}
function ready(s, id) {
  s = startWork(s, id);
  while (s.tongzhi.projects[id].status === "building") s = next(s);
  return s;
}
function finishedWork(s, id) {
  s = ready(s, id);
  if (!s.tongzhi.projects[id].inspected)
    s = act(s, "tz_project", { project: id, action: "inspect" });
  if (s.tongzhi.projects[id].quality < 70) {
    if (!s.tongzhi.ap) s = next(s);
    s = act(s, "tz_project", { project: id, action: "rework" });
    s = next(next(s));
  }
  if (!s.tongzhi.ap) s = next(s);
  return act(s, "tz_project", { project: id, action: "accept" });
}
test("同知任命只接受称职通判，专项与旧任公私账分开，命令幂等", () => {
  assert.throws(() => act(createGame({ difficulty: "standard" }), "tz_appoint"));
  const old = structuredClone(predecessor),
    cmd = { id: "tz-appointment-once", type: "tz_appoint" },
    s = dispatch(old, cmd);
  assert.equal(s.tongzhi.silver, 900);
  assert.equal(s.tongzhi.grain, 480);
  assert.equal(s.tongzhi.private, old.prefecture.private);
  assert.deepEqual(s.prefecture, old.prefecture);
  assert.deepEqual(dispatch(s, cmd), s);
  assert.throws(() => act(s, "tz_appoint"));
  assert.throws(() => act(s, "pref_advance"));
  assert.deepEqual(validateSave(s), s);
  const bad = structuredClone(old);
  bad.prefecture.misconduct = true;
  assert.throws(() => act(bad, "tz_appoint"));
});
test("v4县任及通判旧档不改变原进度，任满旧档直接开放新任", () => {
  for (const state of [createGame({ difficulty: "standard" }), predecessor]) {
    const old = structuredClone(state);
    old.version = 4;
    delete old.tongzhi;
    const migrated = validateSave(old);
    assert.equal(migrated.version, VERSION);
    assert.equal(migrated.tongzhi, null);
    for (const k of [
      "turn",
      "grain",
      "silver",
      "prefecture",
      "governance",
      "cases",
    ])
      assert.deepEqual(migrated[k], old[k]);
  }
  const old = structuredClone(predecessor);
  old.version = 4;
  delete old.tongzhi;
  assert.equal(act(validateSave(old), "tz_appoint").tongzhi.turn, 0);
});
test("勘查报批不会提前开工或扣材料费，批复到期才可开工", () => {
  let s = resolve(start());
  const before = s.tongzhi.silver,
    surveyCost = adminCost(s.tongzhi, 8);
  s = act(s, "tz_project", { project: "levee", action: "survey" });
  s = act(s, "tz_project", { project: "levee", action: "propose" });
  assert.equal(s.tongzhi.silver, before - surveyCost);
  assert.throws(() =>
    act(s, "tz_project", { project: "levee", action: "start" }),
  );
  s = next(s);
  assert.equal(s.tongzhi.projects.levee.status, "approval");
  s = next(validateSave(s));
  assert.equal(s.tongzhi.projects.levee.status, "approved");
  s = act(s, "tz_project", { project: "levee", action: "start" });
  assert.equal(s.tongzhi.silver, before - surveyCost + 12 - 120);
  assert.equal(s.tongzhi.projects.levee.progress, 0);
  assert.equal(defence(s.tongzhi, "linhe"), 18);
});
test("查明劣质工程后必须返工，修护不能提高真实填料质量", () => {
  let s = ready(start(), "levee");
  s = resolve(s);
  if (!s.tongzhi.projects.levee.inspected)
    s = act(s, "tz_project", { project: "levee", action: "inspect" });
  assert.equal(s.tongzhi.projects.levee.quality, 55);
  assert.throws(() =>
    act(s, "tz_project", { project: "levee", action: "accept" }),
  );
  if (!s.tongzhi.ap) s = next(s);
  s = act(s, "tz_project", { project: "levee", action: "rework" });
  assert.equal(s.tongzhi.projects.levee.condition, 0);
  s = next(validateSave(next(s)));
  assert.equal(s.tongzhi.projects.levee.quality, 85);
  assert.equal(s.tongzhi.projects.levee.status, "ready");
  s = act(s, "tz_project", { project: "levee", action: "accept" });
  assert(defence(s.tongzhi, "linhe") > 18);
  assert.deepEqual(validateSave(s), s);
});
test("仅凭外观验收留下弱防护，重复验收不会重复记功", () => {
  let s = ready(start(), "levee");
  s = resolve(s);
  if (!s.tongzhi.ap) s = next(s);
  s = act(s, "tz_project", { project: "levee", action: "accept-fast" });
  assert.equal(s.tongzhi.projects.levee.condition, 55);
  assert.throws(() =>
    act(s, "tz_project", { project: "levee", action: "accept" }),
  );
  assert.throws(() =>
    act(s, "tz_project", { project: "levee", action: "maintain" }),
  );
});
test("无款施工真实停工，失败操作不改变原状态", () => {
  let s = startWork(start(), "levee");
  s.tongzhi.silver = 0;
  const before = structuredClone(s);
  assert.throws(() => act(s, "tz_supply", { kind: "buy" }));
  assert.deepEqual(s, before);
  s.tongzhi.projects.levee.progress = 0;
  let other = s.tongzhi.projects.drain;
  Object.assign(other, { status: "building", surveyed: true });
  s = next(s);
  assert.equal(s.tongzhi.projects.levee.progress, 1);
  assert.equal(s.tongzhi.projects.drain.progress, 0);
  assert.equal(s.tongzhi.projects.drain.stalled, true);
  assert.equal(s.tongzhi.silver, 0);
});
test("两支施工队上限，低协作减速", () => {
  let s = resolve(start());
  for (const p of Object.values(s.tongzhi.projects)) {
    p.surveyed = true;
    p.status = "approved";
  }
  s = act(s, "tz_project", { project: "levee", action: "start" });
  s = act(s, "tz_project", { project: "drain", action: "start" });
  assert.throws(() =>
    act(s, "tz_project", { project: "ferry", action: "start" }),
  );
  s.tongzhi.counties.linhe.cooperation = 30;
  s = next(s);
  assert.equal(s.tongzhi.projects.levee.progress, 0.5);
});
test("采购先付后到，协济不提前入账，渡口验收改善新运次", () => {
  let s = resolve(start()),
    before = s.tongzhi.grain;
  s = act(s, "tz_supply", { kind: "buy" });
  assert.equal(s.tongzhi.grain, before);
  s = next(s);
  assert.equal(s.tongzhi.grain, before);
  s = next(validateSave(s));
  assert.equal(s.tongzhi.grain, before + 120);
  assert.throws(() => act(s, "tz_supply", { kind: "buy" }));
  s = finishedWork(start(), "ferry");
  s = act(s, "tz_supply", { kind: "buy" });
  assert.equal(
    s.tongzhi.pending.find((x) => x.kind === "buy").due,
    s.tongzhi.turn + 1,
  );
  s = validateSave(s);
  assert(
    s.tongzhi.ledger.some(
      (x) => x.title === "采买赈粮预付款" && x.silver === -60,
    ),
  );
});
test("汛灾按已验收防护和准备结算，三年三次且重复读档不重放", () => {
  let bare = start(),
    protectedGame = finishedWork(start(), "levee");
  while (bare.tongzhi.turn < 26) bare = next(bare);
  while (protectedGame.tongzhi.turn < 26) protectedGame = next(protectedGame);
  const sum = (s) =>
    s.tongzhi.floods[0].counties.reduce((n, x) => n + x.displaced, 0);
  assert(sum(protectedGame) < sum(bare));
  assert.equal(protectedGame.tongzhi.floods.length, 1);
  const restored = validateSave(protectedGame);
  assert.equal(restored.tongzhi.affected, protectedGame.tongzhi.affected);
  assert.deepEqual(restored, protectedGame);
});
test("安置先锁定人数，核验前仍供粮，不能重复安置或把断粮当安置", () => {
  let s = start();
  while (s.tongzhi.turn < 26) s = next(s);
  s = resolve(s);
  const d = s.tongzhi.counties.linhe,
    n = d.displaced,
    initial = s.tongzhi.resettled;
  s = act(s, "tz_settle", { county: "linhe" });
  assert.equal(s.tongzhi.counties.linhe.displaced, n);
  assert.equal(availableResettlers(s.tongzhi, "linhe"), n - 24);
  s = next(validateSave(s));
  assert.equal(s.tongzhi.resettled, initial);
  s = next(s);
  assert.equal(s.tongzhi.resettled, initial + 24);
  assert.equal(s.tongzhi.counties.linhe.displaced, n - 24);
  const original = s.tongzhi.counties.linhe.displaced;
  s.tongzhi.grain = 0;
  s = next(s);
  assert.equal(s.tongzhi.counties.linhe.displaced, original);
  assert(s.tongzhi.shortage > 0);
});
test("全部金额增减与回执实际账目一致，无私产挪入公库", () => {
  let s = start();
  for (const command of [
    { type: "tz_event", choice: "fair" },
    { type: "tz_supply", kind: "buy" },
    { type: "tz_advance" },
    { type: "tz_advance" },
  ]) {
    const before = s.tongzhi;
    s = act(s, command.type, command);
    for (const key of ["silver", "grain", "private"]) {
      const ledger = s.receipts[0].ledger.reduce(
        (n, x) => n + (x[key] || 0),
        0,
      );
      assert(Math.abs(s.tongzhi[key] - before[key] - ledger) < 0.001);
    }
  }
  assert.equal(s.tongzhi.private, predecessor.prefecture.private + 2.4);
});
test("维护按实扣费，停护加速折损，完成奖励不能刷取", () => {
  let s = finishedWork(start(), "ferry"),
    before = s.tongzhi.projects.ferry.condition;
  s = next(s);
  assert.equal(s.tongzhi.projects.ferry.condition, before - 0.2);
  s = act(s, "tz_maintenance", { enabled: false });
  before = s.tongzhi.projects.ferry.condition;
  s = next(s);
  assert.equal(s.tongzhi.projects.ferry.condition, before - 1.2);
  assert.throws(() => act(s, "tz_maintenance", { enabled: false }));
});
test("任末禁止无法交验的采购、报批或安置", () => {
  let s = start();
  while (s.tongzhi.turn < 155) s = next(s);
  s = resolve(s);
  assert.throws(() => act(s, "tz_supply", { kind: "buy" }));
  assert.throws(() => act(s, "tz_supply", { kind: "aid" }));
  assert.throws(() => act(s, "tz_settle", { county: "linhe" }));
  s = act(s, "tz_project", { project: "levee", action: "survey" });
  assert.throws(() =>
    act(s, "tz_project", { project: "levee", action: "propose" }),
  );
});
test("伪造钱粮、安置人口、越期在途和工程阶段均拒绝，不修改导入对象", () => {
  for (const mutate of [
    (q) => q.silver++,
    (q) => q.affected++,
    (q) => q.pending.push({ kind: "buy", due: 999, amount: 120 }),
    (q) => (q.projects.levee.status = "complete"),
    (q) => (q.counties.linhe.vulnerable = 100),
  ]) {
    const s = start();
    mutate(s.tongzhi);
    const snapshot = structuredClone(s);
    assert.throws(() => validateSave(s));
    assert.deepEqual(s, snapshot);
  }
});
test("完整第三任逐周存取，三次汛情与八份公文，旧任快照保持不变", () => {
  let s = start();
  const old = structuredClone(s.prefecture);
  const seen = new Set();
  while (!s.tongzhi.finished) {
    if (s.tongzhi.event) seen.add(s.tongzhi.event);
    s = resolve(s);
    let q = s.tongzhi;
    // One funding decision and then use remaining attention on works or resettlement.
    if (q.ap && q.grain < 160 && q.turn - q.lastAid >= 13 && q.turn < 153)
      s = act(s, "tz_supply", { kind: "aid" });
    for (const d of TZ_PROJECTS) {
      q = s.tongzhi;
      if (!q.ap) break;
      const p = q.projects[d.id];
      let action =
        p.status === "planned"
          ? p.surveyed
            ? "propose"
            : "survey"
          : p.status === "approved"
            ? "start"
            : p.status === "ready"
              ? !p.inspected
                ? "inspect"
                : p.quality < 70
                  ? "rework"
                  : "accept"
              : p.status === "complete" && p.condition < 65
                ? "maintain"
                : null;
      if (
        action &&
        q.turn < 140 &&
        !(
          action === "start" &&
          Object.values(q.projects).filter((x) =>
            ["building", "reworking"].includes(x.status),
          ).length >= 2
        )
      )
        s = act(s, "tz_project", { project: d.id, action });
    }
    for (const d of Object.values(s.tongzhi.counties)) {
      q = s.tongzhi;
      if (
        q.ap &&
        q.turn < 154 &&
        q.silver >= 12 &&
        q.grain >= 8 &&
        availableResettlers(q, d.id) > 0
      )
        s = act(s, "tz_settle", { county: d.id });
    }
    s = next(s);
    s = validateSave(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(s.prefecture, old);
  }
  assert.equal(s.turn + s.prefecture.turn + s.tongzhi.turn, 468);
  assert.equal(seen.size, 8);
  assert.equal(s.tongzhi.floods.length, 3);
  assert.equal(s.tongzhi.outcome.rating, "称职");
  assert.equal(s.tongzhi.outcome.candidate, true);
  assert.equal(s.tongzhi.resettled, s.tongzhi.affected);
  assert.throws(() => act(s, "tz_advance"));
  assert(s.tongzhi.ledger.length < 2500);
});
test("不实质量记录形成候查，后续成果不能抹去责任", () => {
  let s = start();
  while (s.tongzhi.turn < 13) s = next(s);
  s = act(s, "tz_event", { choice: "cover" });
  while (!s.tongzhi.finished) s = next(s);
  assert.equal(s.tongzhi.outcome.rating, "候查");
  assert.equal(validateSave(s).tongzhi.outcome.candidate, false);
});
test("八份公文的全部处置可结算读档，漏救者不被计为实际安置", () => {
  let timeline = start();
  for (const event of TZ_EVENTS) {
    while (timeline.tongzhi.turn < event.week) timeline = next(timeline);
    for (const choice of event.options) {
      const result = act(timeline, "tz_event", { choice: choice.id });
      assert.doesNotThrow(() => validateSave(result));
      if (["expel", "exclude"].includes(choice.special)) {
        assert.equal(result.tongzhi.resettled, timeline.tongzhi.resettled);
        assert(result.tongzhi.excluded > timeline.tongzhi.excluded);
        assert(result.tongzhi.misconduct);
      }
    }
    timeline = resolve(timeline);
  }
});
