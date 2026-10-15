import { ZF_EVENTS, ZF_CASES, ZF_TASKS, activeTask, inspectorCount } from "../../src/zhifu.js";
import {
  TZ_EVENTS,
  TZ_PROJECTS,
  availableResettlers,
} from "../../src/tongzhi.js";
import fs from "node:fs";
import { dispatch, validateSave } from "../../src/engine.js";
import { PREF_EVENTS } from "../../src/prefecture.js";
let id = 0;
export const act = (s, type, args = {}) =>
  dispatch(s, { id: `career-helper-${s.revision}-${id++}`, type, ...args });
export function completedPrefecture() {
  let s = validateSave(
    JSON.parse(
      fs.readFileSync(
        new URL("../fixtures/quarter-v1-finished.json", import.meta.url),
      ),
    ),
  );
  s = act(s, "appointment");
  while (!s.prefecture.finished) {
    let p = s.prefecture;
    if (p.event) {
      const e = PREF_EVENTS.find((e) => e.id === p.event);
      s = act(s, "pref_event", { choice: e.options[0].id });
      p = s.prefecture;
    }
    if (
      p.request.status === "active" &&
      !p.shipments.some(
        (x) => x.status === "transit" && x.to === p.request.county,
      ) &&
      p.ap &&
      p.turn < 153
    ) {
      s = act(s, "pref_transfer", {
        from: p.grain >= 60 ? "府仓" : "qinghe",
        to: p.request.county,
        amount: 60,
        route: "normal",
      });
      p = s.prefecture;
    }
    if (p.condition < 65 && p.ap) s = act(s, "pref_repair");
    s = act(s, "pref_advance");
  }
  return validateSave(s);
}

export function completedTongzhi() {
  let s = act(completedPrefecture(), "tz_appoint");
  while (!s.tongzhi.finished) {
    let q = s.tongzhi;
    if (q.event) {
      const e = TZ_EVENTS.find((e) => e.id === q.event),
        o = e.options.find((o) =>
          Object.entries(o.cost).every(([k, v]) => q[k] >= v),
        );
      s = act(s, "tz_event", { choice: o.id });
    }
    q = s.tongzhi;
    if (q.ap && q.grain < 160 && q.turn - q.lastAid >= 13 && q.turn < 153)
      s = act(s, "tz_supply", { kind: "aid" });
    for (const d of TZ_PROJECTS) {
      q = s.tongzhi;
      if (!q.ap) break;
      const p = q.projects[d.id];
      const action =
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
    s = act(s, "tz_advance");
  }
  return validateSave(s);
}

export function completedZhifu(s = act(completedTongzhi(), "zf_appoint")) {
  const resolve = (state) => state.zhifu.event ? act(state, "zf_event", { choice: ZF_EVENTS.find((e) => e.id === state.zhifu.event).options[0].id }) : state;
  const next = (state) => act(resolve(state), "zf_advance");
  const seen = new Set();
  while (!s.zhifu.finished) {
    if (s.zhifu.event) seen.add(s.zhifu.event);
    s = resolve(s);
    let q = s.zhifu;
    const call = (type, args) => {
      s = act(s, type, args);
      q = s.zhifu;
    };
    for (const d of Object.values(q.counties)) {
      const o = d.official;
      if (q.ap && q.turn < 140 && !o.replaced && !o.exonerated && inspectorCount(q) < 2) {
        if (!o.evidence && o.status === "serving") call("zf_official", { county: d.id, action: "investigate" });
        else if (o.evidence && o.status === "serving") call("zf_official", { county: d.id, action: "replace" });
      }
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
  return s;
}
