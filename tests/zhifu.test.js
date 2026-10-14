import test from "node:test";
import assert from "node:assert/strict";
import { createGame, validateSave, dispatch, VERSION } from "../src/engine.js";
import {
  ZF_EVENTS,
  ZF_CASES,
  ZF_TASKS,
  activeTask,
  inspectorCount,
  projectPlan,
} from "../src/zhifu.js";
import { completedTongzhi, act } from "./helpers/career.js";
const previous = completedTongzhi();
const start = () => act(previous, "zf_appoint");
function resolve(s) {
  const q = s.zhifu;
  if (!q.event) return s;
  const e = ZF_EVENTS.find((e) => e.id === q.event),
    o = e.options.find((o) =>
      Object.entries(o.cost).every(([k, v]) => q[k] >= v),
    );
  return act(s, "zf_event", { choice: o.id });
}
const next = (s) => act(resolve(s), "zf_advance");
const weeks = (s, n) => {
  for (let i = 0; i < n; i++) s = next(s);
  return s;
};
test("知府任命承接私产、居民和物理设施，公账另拨且旧任冻结", () => {
  assert.throws(() => act(createGame({ difficulty: "standard" }), "zf_appoint"));
  const command = { id: "zf-once", type: "zf_appoint" },
    s = dispatch(previous, command);
  assert.equal(s.zhifu.silver, 1200);
  assert.equal(s.zhifu.grain, 600);
  assert.equal(s.zhifu.private, previous.tongzhi.private);
  assert.deepEqual(s.zhifu.projects, previous.tongzhi.projects);
  assert.deepEqual(s.tongzhi, previous.tongzhi);
  assert.equal(dispatch(s, command), s);
  assert.throws(() => act(s, "zf_appoint"));
  assert.throws(() => act(s, "tz_advance"));
  assert.deepEqual(validateSave(s), s);
});
test("v5旧档升级只补新章字段，不重放结算，任满直接开放知府", () => {
  for (const state of [createGame({ difficulty: "standard" }), previous]) {
    const old = structuredClone(state);
    old.version = 5;
    delete old.zhifu;
    const migrated = validateSave(old);
    assert.equal(migrated.version, VERSION);
    assert.equal(migrated.zhifu, null);
    assert.deepEqual(migrated.tongzhi, old.tongzhi);
    assert.equal(migrated.silver, old.silver);
    assert.equal(old.version, 5);
  }
  const old = structuredClone(previous);
  old.version = 5;
  delete old.zhifu;
  assert.equal(act(validateSave(old), "zf_appoint").zhifu.turn, 0);
});
test("差事拨款立即入账，四周交付，无重复拨款或提前成果", () => {
  let s = resolve(start()),
    before = structuredClone(s.zhifu);
  s = act(s, "zf_task", { county: "qinghe", kind: "economy" });
  assert.equal(s.zhifu.silver, before.silver - 40);
  assert.equal(s.zhifu.counties.qinghe.economy, before.counties.qinghe.economy);
  assert.throws(() => act(s, "zf_task", { county: "qinghe", kind: "economy" }));
  s = weeks(s, 3);
  assert.equal(s.zhifu.tasks[0].status, "working");
  s = next(validateSave(s));
  assert.equal(s.zhifu.tasks[0].status, "reported");
  assert.equal(s.zhifu.counties.qinghe.economy, 62.6);
  assert.deepEqual(validateSave(s), s);
});
test("临河报称与实效分离，核验两周后取得证据且不虚增追回款", () => {
  let s = act(resolve(start()), "zf_task", {
    county: "linhe",
    kind: "economy",
  });
  s = weeks(s, 4);
  assert.equal(s.zhifu.tasks[0].reported, 8);
  assert.equal(s.zhifu.tasks[0].actual, 4);
  assert.equal(s.zhifu.counties.linhe.economy, 48.6);
  assert.equal(s.zhifu.counties.linhe.official.evidence, false);
  assert.equal(s.zhifu.tasks[0].diverted, 9);
  s = act(s, "zf_audit", { idTask: 1 });
  assert.equal(s.zhifu.tasks[0].status, "checking");
  s = next(s);
  assert.equal(s.zhifu.counties.linhe.official.evidence, false);
  const silver = s.zhifu.silver;
  s = next(s);
  assert.equal(s.zhifu.tasks[0].status, "verified");
  assert(s.zhifu.counties.linhe.official.evidence);
  assert.equal(s.zhifu.silver, silver + 5);
  assert.throws(() => act(s, "zf_audit", { idTask: 1 }));
});
test("调查需要证据程序，接任暂停旧差事，新差事由新属官落实", () => {
  let s = resolve(start());
  assert.throws(() =>
    act(s, "zf_official", { county: "linhe", action: "replace" }),
  );
  s = act(s, "zf_task", { county: "linhe", kind: "order" });
  s = act(s, "zf_official", { county: "linhe", action: "investigate" });
  s = weeks(s, 2);
  assert(s.zhifu.counties.linhe.official.evidence);
  s = act(s, "zf_official", { county: "linhe", action: "replace" });
  const remaining = s.zhifu.tasks[0].remaining;
  s = weeks(s, 3);
  assert.equal(s.zhifu.tasks[0].remaining, remaining);
  assert(s.zhifu.counties.linhe.official.replaced);
  s = weeks(s, remaining);
  assert.equal(s.zhifu.tasks[0].actual, 5);
  s = act(s, "zf_task", { county: "linhe", kind: "order" });
  s = weeks(s, 4);
  assert.equal(s.zhifu.tasks[1].actual, 10);
  assert.doesNotThrow(() => validateSave(s));
});
test("调查清白者不凭猜测定责，调查与核验共用两组人手", () => {
  let s = resolve(start());
  s = act(s, "zf_official", { county: "qinghe", action: "investigate" });
  s = act(s, "zf_official", { county: "yongning", action: "investigate" });
  assert.equal(inspectorCount(s.zhifu), 2);
  assert.throws(() =>
    act(s, "zf_official", { county: "linhe", action: "investigate" }),
  );
  s = weeks(s, 2);
  assert(s.zhifu.counties.qinghe.official.exonerated);
  assert(!s.zhifu.counties.qinghe.official.evidence);
  assert.throws(() =>
    act(s, "zf_official", { county: "qinghe", action: "replace" }),
  );
});
test("旧任未竟工程和待安置人口保留，续办按预算施工后才能交付", () => {
  const old = structuredClone(previous);
  const p = old.tongzhi.projects.ferry;
  Object.assign(p, {
    status: "building",
    progress: 4,
    condition: 0,
    acceptedAt: null,
  });
  old.tongzhi.affected += 12;
  old.tongzhi.counties.qinghe.displaced += 12;
  old.tongzhi.counties.qinghe.vulnerable += 4;
  let s = act(validateSave(old), "zf_appoint");
  assert.equal(s.zhifu.record.displaced, 12);
  assert.equal(s.zhifu.projects.ferry.progress, 4);
  const plan = projectPlan(s.zhifu, "ferry");
  assert.equal(plan.weeks, 6);
  s = act(resolve(s), "zf_project", { project: "ferry", action: "propose" });
  s = weeks(s, 2);
  s = act(s, "zf_project", { project: "ferry", action: "start" });
  s = weeks(s, 6);
  assert.equal(s.zhifu.projects.ferry.status, "building");
  s = act(s, "zf_project", { project: "ferry", action: "accept" });
  assert.equal(s.zhifu.projects.ferry.condition, 85);
  assert.equal(s.tongzhi.projects.ferry.status, "building");
  assert.doesNotThrow(() => validateSave(s));
});
test("口粮不足不会消除居民，安置未交付不提前扣人口", () => {
  let s = weeks(start(), 26);
  s = resolve(s);
  const d = s.zhifu.counties.yongning;
  assert(d.displaced > 0);
  const n = d.displaced;
  s = act(s, "zf_task", { county: "yongning", kind: "relief" });
  assert.equal(s.zhifu.counties.yongning.displaced, n);
  s = weeks(s, 2);
  assert.equal(s.zhifu.counties.yongning.displaced, n);
  s = next(s);
  assert.equal(s.zhifu.counties.yongning.displaced, Math.max(0, n - 24));
  assert.equal(
    s.zhifu.affected,
    s.zhifu.settled +
      Object.values(s.zhifu.counties).reduce((n, c) => n + c.displaced, 0),
  );
  s.zhifu.grain = 0;
  const total = Object.values(s.zhifu.counties).reduce(
    (n, c) => n + c.displaced,
    0,
  );
  s = next(s);
  assert(s.zhifu.shortage > 0);
  assert.equal(
    Object.values(s.zhifu.counties).reduce((n, c) => n + c.displaced, 0),
    total,
  );
});
test("采购先付后到，实际回执与公私账一致", () => {
  let s = resolve(start());
  for (const [type, args] of [
    ["zf_supply", {}],
    ["zf_advance", {}],
    ["zf_advance", {}],
  ]) {
    const before = s.zhifu;
    s = act(s, type, args);
    for (const k of ["silver", "grain", "private"])
      assert(
        Math.abs(
          s.zhifu[k] -
            before[k] -
            s.receipts[0].ledger.reduce((n, l) => n + (l[k] || 0), 0),
        ) < 0.001,
      );
    assert.deepEqual(validateSave(s), s);
  }
  assert.equal(s.zhifu.grain, 720);
  assert.equal(s.zhifu.private, previous.tongzhi.private + 3);
  assert.equal(
    s.zhifu.counties.linhe.people,
    Math.round((previous.tongzhi.counties.linhe.people + 0.12) * 100) / 100,
  );
  assert.throws(() => act(s, "zf_supply"));
});
test("阶段要务只读真实指标，临河虚报8点不能替代4点实绩", () => {
  let s = resolve(start());
  assert.equal(s.zhifu.goal.county, "linhe");
  s = act(s, "zf_task", { county: "linhe", kind: "economy" });
  s = weeks(s, 13);
  assert.equal(s.zhifu.goals[0].met, false);
  assert.equal(s.zhifu.goals[0].actual, 47.7);
  assert.equal(s.zhifu.goals[0].target, 51);
});
test("案卷证据、核办和执行分阶段，不能用立案或报办代替归档", () => {
  let s = resolve(weeks(start(), 26));
  assert.throws(() => act(s, "zf_case", { case: "water", action: "review" }));
  for (const clue of ["deed", "site"])
    s = act(s, "zf_case", { case: "water", action: "clue", clue });
  s = act(s, "zf_case", { case: "water", action: "review" });
  assert.equal(s.zhifu.cases.water.status, "review");
  s = weeks(s, 2);
  assert.equal(s.zhifu.cases.water.status, "approved");
  s = act(s, "zf_case", { case: "water", action: "execute" });
  s = next(s);
  assert.equal(s.zhifu.cases.water.status, "executing");
  s = next(validateSave(s));
  assert.equal(s.zhifu.cases.water.status, "closed");
  assert.throws(() => act(s, "zf_case", { case: "water", action: "execute" }));
});
test("经费不足或任末无法交验时拒绝操作且原状态不变", () => {
  let s = resolve(start());
  s.zhifu.silver = 0;
  let before = structuredClone(s);
  assert.throws(() => act(s, "zf_task", { county: "qinghe", kind: "economy" }));
  assert.deepEqual(s, before);
  s = resolve(weeks(start(), 155));
  before = structuredClone(s);
  for (const [type, args] of [
    ["zf_task", { county: "qinghe", kind: "order" }],
    ["zf_audit", { idTask: 1 }],
    ["zf_supply", {}],
    ["zf_project", { project: "levee", action: "propose" }],
  ])
    assert.throws(() => act(s, type, args));
  assert.deepEqual(s, before);
});
test("任末接任导致的未竟差事保留剩余工期，不凭空完成", () => {
  let s = resolve(weeks(start(), 150));
  s = act(s, "zf_official", { county: "linhe", action: "investigate" });
  s = weeks(s, 2);
  s = act(s, "zf_task", { county: "linhe", kind: "order" });
  s = act(s, "zf_official", { county: "linhe", action: "replace" });
  s = weeks(s, 4);
  assert.equal(s.zhifu.tasks[0].status, "working");
  assert.equal(s.zhifu.tasks[0].remaining, 3);
  assert.deepEqual(validateSave(s), s);
});
test("三次汛情读取承接设施，读档不重放灾情或交付", () => {
  const a = weeks(start(), 26),
    b = validateSave(a);
  assert.deepEqual(b, a);
  const damaged = start();
  for (const p of Object.values(damaged.zhifu.projects)) p.condition = 0;
  const c = weeks(damaged, 26);
  assert(c.zhifu.affected > a.zhifu.affected);
});
test("篡改府库、人口、证据、重复差事和越期事项均拒绝导入", () => {
  for (const mutate of [
    (q) => q.silver++,
    (q) => q.affected++,
    (q) => q.pending.push({ kind: "grain", amount: 120, due: 999 }),
    (q) => (q.counties.linhe.official.status = "replacing"),
    (q) => (q.projectJobs.fake = {}),
    (q) =>
      (q.cases.water = { id: "water", status: "closed", clues: [], due: null }),
  ]) {
    const s = start();
    mutate(s.zhifu);
    const before = structuredClone(s);
    assert.throws(() => validateSave(s));
    assert.deepEqual(s, before);
  }
});
test("八份知府公文全部选项可结算、读档，违规不能以政绩抵销", () => {
  let s = start();
  for (const e of ZF_EVENTS) {
    s = weeks(s, e.week - s.zhifu.turn);
    for (const o of e.options) {
      const v = act(s, "zf_event", { choice: o.id });
      assert.doesNotThrow(() => validateSave(v));
      if (o.special === "misconduct") assert(v.zhifu.misconduct);
    }
    s = resolve(s);
  }
  let bad = start();
  bad.zhifu.misconduct = true;
  bad = weeks(bad, 156);
  assert.equal(bad.zhifu.outcome.candidate, false);
  assert.equal(bad.zhifu.outcome.rating, "候查");
});
export function playZhifu(s = start()) {
  const seen = new Set();
  while (!s.zhifu.finished) {
    if (s.zhifu.event) seen.add(s.zhifu.event);
    s = resolve(s);
    let q = s.zhifu;
    const call = (type, args) => {
      s = act(s, type, args);
      q = s.zhifu;
    };
    const o = q.counties.linhe.official;
    if (q.ap && q.turn < 140 && !o.replaced) {
      if (!o.evidence && o.status === "serving")
        call("zf_official", { county: "linhe", action: "investigate" });
      else if (o.evidence && o.status === "serving")
        call("zf_official", { county: "linhe", action: "replace" });
    }
    for (const d of ZF_CASES) {
      const a = q.cases[d.id];
      if (!a || !q.ap) continue;
      if (a.status === "open") {
        const clue = d.clues.find((c) => !a.clues.includes(c.id));
        call(
          "zf_case",
          clue
            ? { case: d.id, action: "clue", clue: clue.id }
            : { case: d.id, action: "review" },
        );
      } else if (a.status === "approved")
        call("zf_case", { case: d.id, action: "execute" });
    }
    if (q.ap && q.grain < 100 && q.turn - q.lastBuy >= 4 && q.turn <= 154)
      call("zf_supply", {});
    for (const c of Object.values(q.counties)) {
      if (!q.ap) break;
      if (
        q.turn < 149 &&
        !activeTask(q, c.id) &&
        q.turn - c.lastTask >= 4 &&
        c.official.status !== "replacing"
      ) {
        const goal = q.goal;
        const kind = c.displaced
          ? "relief"
          : goal.county === c.id && c[goal.metric] < goal.target + 2
            ? goal.metric
            : c.order < 60
              ? "order"
              : c.economy < 65
                ? "economy"
                : null;
        if (kind && q.silver >= ZF_TASKS[kind].cost && q.grain > 8)
          call("zf_task", { county: c.id, kind });
      }
    }
    for (const t of q.tasks.filter((t) => t.status === "reported"))
      if (q.ap && q.silver >= 12 && q.turn <= 154 && inspectorCount(q) < 2)
        call("zf_audit", { idTask: t.id });
    for (const [id, p] of Object.entries(q.projects)) {
      if (!q.ap || q.turn >= 145) break;
      const j = q.projectJobs[id];
      if (!j && p.condition < 65)
        call("zf_project", { project: id, action: "propose" });
      else if (j?.status === "approved" && q.silver >= j.cost)
        call("zf_project", { project: id, action: "start" });
      else if (j?.status === "ready" && q.silver >= 10)
        call("zf_project", { project: id, action: "accept" });
    }
    s = validateSave(next(s));
  }
  return { s, seen };
}
test("完整第四任156周逐周存取，四任624周、两案归档和称职候选", () => {
  const { s, seen } = playZhifu();
  assert.equal(seen.size, 8);
  assert.equal(s.turn + s.prefecture.turn + s.tongzhi.turn + s.zhifu.turn, 624);
  assert.equal(s.zhifu.goals.length, 12);
  assert.equal(s.zhifu.outcome.rating, "称职");
  assert(s.zhifu.outcome.candidate);
  assert.equal(
    Object.values(s.zhifu.cases).filter((c) => c.status === "closed").length,
    2,
  );
  assert.equal(s.zhifu.affected, s.zhifu.settled);
  assert.deepEqual(s.tongzhi, previous.tongzhi);
  assert.throws(() => act(s, "zf_advance"));
  assert(JSON.stringify(s).length < 2e6);
});
