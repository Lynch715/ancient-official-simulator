import { OFFICE_CONTENT } from "../../src/office-stories.js";
// 府任三任的模拟玩家：idle（只办公文）、diligent（按设计正解办事）。
import { dispatch, validateSave } from "../../src/engine.js";
import { PREF_EVENTS } from "../../src/prefecture.js";
import { TZ_EVENTS, TZ_PROJECTS, availableResettlers } from "../../src/tongzhi.js";
import { ZF_EVENTS, ZF_CASES, ZF_TASKS, activeTask, inspectorCount } from "../../src/zhifu.js";
import * as hardPref from "../../src/office-hard.js";

let n = 0;
const RUN = "challenge";
export const act = (s, type, args = {}) => dispatch(s, { id: `c${RUN}-${n++}`, type, ...args });
const tryAct = (s, type, args) => { try { return act(s, type, args); } catch { return s; } };
const can = (q, c = {}) => Object.entries(c).every(([k, v]) => q[k] >= v);
const bad = (o) => ["misconduct", "collect", "expel", "exclude"].includes(o.special);
function pick(q, list, mode, eventId) {
  const e = list.find((e) => e.id === eventId);
  const def = hardPref.officeEvent ? hardPref.officeEvent(q, e) : e;
  const ok = def.options.filter((o) => can(q, o.cost) && !bad(o));
  if (mode === "idle") return (ok.filter((o) => !Object.keys(o.cost).length).at(-1) || ok.at(-1)).id;
  const order = e.options.map((o) => o.id);
  return [...ok].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))[0].id;
}

export function runPref(s, mode) {
  s = act(s, "appointment");
  while (!s.prefecture.finished) {
    let p = s.prefecture;
    if (p.event) s = act(s, "pref_event", { choice: pick(p, PREF_EVENTS, mode, p.event) });
    p = s.prefecture;
    if (mode === "diligent") {
      const r = p.request;
      const inTransit = p.shipments.filter((x) => x.status === "transit" && x.to === r.county).reduce((n, x) => n + x.amount, 0);
      const need = (r.need ?? 60) - r.received - inTransit;
      if (r.status === "active" && need > 0 && p.ap && p.turn < 153) {
        const amount = need > 60 ? 120 : 60;
        const weeksLeft = r.due - p.turn;
        const src = p.grain >= amount ? "府仓" : Object.values(p.counties).filter((c) => c.id !== r.county && c.grain >= amount + 30).sort((a, b) => b.grain - a.grain)[0]?.id;
        const route = weeksLeft <= 3 + (p.blockedUntil > p.turn ? 2 : 0) ? "urgent" : "normal";
        if (src) s = tryAct(s, "pref_transfer", { from: src, to: r.county, amount, route });
        p = s.prefecture;
      }
      for (const c of Object.values(p.counties)) {
        if (!p.ap) break;
        if (c.discrepancy > 0 && !c.audited && p.turn - c.lastAudit >= 4) s = tryAct(s, "pref_audit", { county: c.id });
        p = s.prefecture;
        if (p.counties[c.id].audited && p.counties[c.id].discrepancy > 0 && p.ap) s = tryAct(s, "pref_rectify", { county: c.id });
        p = s.prefecture;
      }
      if (p.condition < 65 && p.ap) s = tryAct(s, "pref_repair");
      p = s.prefecture;
      // 粮食均衡：低于60的县从富县补
      for (const c of Object.values(p.counties)) {
        if (!p.ap || p.turn > 150) break;
        if (c.grain < 45 && !p.shipments.some((x) => x.status === "transit" && x.to === c.id)) {
          const src = p.grain >= 60 ? "府仓" : Object.values(p.counties).filter((d) => d.id !== c.id && d.grain >= 120).sort((a, b) => b.grain - a.grain)[0]?.id;
          if (src) s = tryAct(s, "pref_transfer", { from: src, to: c.id, amount: 60, route: "normal" });
          p = s.prefecture;
        }
      }
      if (hardPref.prefExtras) s = hardPref.prefExtras(s, act, tryAct);
    }
    if(mode==="diligent")s=content(s,"prefecture");
    s = act(s, "pref_advance");
  }
  return s;
}

export function runTz(s, mode) {
  s = act(s, "tz_appoint");
  while (!s.tongzhi.finished) {
    let q = s.tongzhi;
    if (q.event) s = act(s, "tz_event", { choice: pick(q, TZ_EVENTS, mode, q.event) });
    q = s.tongzhi;
    if (mode === "diligent") {
      if (q.ap && q.grain < 200 && q.turn - q.lastAid >= 13 && q.turn < 153) s = tryAct(s, "tz_supply", { kind: "aid" });
      q = s.tongzhi;
      const displacedNow = Object.values(q.counties).reduce((n, c) => n + c.displaced, 0);
      if (q.ap && q.grain < 60 + displacedNow / 3 && q.silver > 75 && q.turn - q.lastBuy >= 4 && q.turn < 153) s = tryAct(s, "tz_supply", { kind: "buy" });
      for (const d of Object.values(s.tongzhi.counties)) {
        q = s.tongzhi;
        if (q.ap && q.turn < 154 && q.silver >= 12 && q.grain >= 8 && availableResettlers(q, d.id) > 0) s = tryAct(s, "tz_settle", { county: d.id });
      }
      q = s.tongzhi;
      {
        const fl = hardPref.tzNextFlood ? hardPref.tzNextFlood(q) : [26, 78, 130].find((t) => t > q.turn);
        const lowest = Math.min(...Object.values(q.projects).filter((p) => p.status === "complete").map((p) => p.condition), 100);
        const want = (!!fl && fl - q.turn <= 22) || lowest < 60 || q.turn > 118;
        if (q.maintenance !== want) s = tryAct(s, "tz_maintenance", { enabled: want });
      }
      for (const d of TZ_PROJECTS) {
        q = s.tongzhi;
        if (!q.ap) break;
        const p = q.projects[d.id];
        const action = p.status === "planned" ? (p.surveyed ? "propose" : "survey") : p.status === "approved" ? "start" : p.status === "ready" ? (!p.inspected ? "inspect" : p.quality < 70 ? "rework" : "accept") : p.status === "complete" && p.condition < 65 && q.silver > 30 ? "maintain" : null;
        if (action && (q.turn < 140 || action === "maintain") && !(action === "start" && Object.values(q.projects).filter((x) => ["building", "reworking"].includes(x.status)).length >= 2)) s = tryAct(s, "tz_project", { project: d.id, action });
      }
      for (const d of Object.values(s.tongzhi.counties)) {
        q = s.tongzhi;
        if (q.ap && q.turn < 154 && q.silver >= 12 && q.grain >= 8 && availableResettlers(q, d.id) > 0) s = tryAct(s, "tz_settle", { county: d.id });
      }
      for (const d of Object.values(s.tongzhi.counties)) {
        q = s.tongzhi;
        const flood = hardPref.tzNextFlood ? hardPref.tzNextFlood(q) : [26, 78, 130].find((t) => t > q.turn);
        if (q.ap && flood && flood - q.turn <= 10 && d.prepared < 36 && q.turn - d.lastVisit >= 4 && q.silver > 40) s = tryAct(s, "tz_prepare", { county: d.id });
      }
      if (hardPref.tzExtras) s = hardPref.tzExtras(s, act, tryAct);
    }
    if(mode==="diligent")s=content(s,"tongzhi");
    s = act(s, "tz_advance");
  }
  return s;
}

export function runZf(s, mode) {
  s = act(s, "zf_appoint");
  while (!s.zhifu.finished) {
    let q = s.zhifu;
    if (q.event) s = act(s, "zf_event", { choice: pick(q, ZF_EVENTS, mode, q.event) });
    q = s.zhifu;
    if (mode === "diligent") {
      const call = (type, args) => { s = tryAct(s, type, args); q = s.zhifu; };
      const suspect = q.hard ? q.hard.corrupt[0] : "linhe";
      for (const cid of Object.keys(q.counties)) {
        const o = q.counties[cid].official;
        if (!q.ap || q.turn >= 140 || o.replaced || o.status !== "serving") continue;
        if (o.evidence) call("zf_official", { county: cid, action: "replace" });
        else if (cid === suspect && !o.exonerated && inspectorCount(q) < 2 && q.turn >= 13) call("zf_official", { county: cid, action: "investigate" });
      }
      for (const d of ZF_CASES) {
        const a = q.cases[d.id];
        if (!a || !q.ap) continue;
        if (a.status === "open") {
          const clue = d.clues.find((c) => !a.clues.includes(c.id));
          call("zf_case", clue ? { case: d.id, action: "clue", clue: clue.id } : { case: d.id, action: "review" });
        } else if (a.status === "approved") call("zf_case", { case: d.id, action: "execute" });
      }
      if (q.ap && q.grain < 100 && q.turn - q.lastBuy >= 4 && q.turn <= 154 && q.silver > 70) call("zf_supply", {});
      {
        const g = q.goal, c = q.counties[g.county];
        if (q.ap && q.turn < 149 && !activeTask(q, c.id) && q.turn - c.lastTask >= 4 && c.official.status !== "replacing" && c[g.metric] < g.target + 2 && q.silver >= ZF_TASKS[g.metric].cost + 20) call("zf_task", { county: c.id, kind: g.metric });
      }
      for (const c of Object.values(q.counties)) {
        if (!q.ap) break;
        if (q.turn < 149 && !activeTask(q, c.id) && q.turn - c.lastTask >= 4 && c.official.status !== "replacing") {
          const goal = q.goal;
          const kind = c.displaced ? "relief" : goal.county === c.id && c[goal.metric] < goal.target + 2 ? goal.metric : c.order < 60 ? "order" : c.economy < 65 ? "economy" : null;
          if (kind && q.silver >= ZF_TASKS[kind].cost + 40 && q.grain > 8) call("zf_task", { county: c.id, kind });
        }
      }
      for (const t of q.tasks.filter((t) => t.status === "reported"))
        if (q.ap && q.silver >= 12 && q.turn <= 154 && inspectorCount(q) < 2) call("zf_audit", { idTask: t.id });
      for (const [id, p] of Object.entries(q.projects)) {
        if (!q.ap || q.turn >= 145) break;
        const j = q.projectJobs[id];
        if (!j && p.condition < 65) call("zf_project", { project: id, action: "propose" });
        else if (j?.status === "approved" && q.silver >= j.cost + 40) call("zf_project", { project: id, action: "start" });
        else if (j?.status === "ready" && q.silver >= 10) call("zf_project", { project: id, action: "accept" });
      }
      if (hardPref.zfExtras) s = hardPref.zfExtras(s, act, tryAct);
    }
    if(mode==="diligent")s=content(s,"zhifu");
    s = act(s, "zf_advance");
  }
  return s;
}

const short = (o, extra = "") => `${o.score} ${o.rating}${extra}`;

function content(s,key){
 const defs=OFFICE_CONTENT[key];
 for(const id of [...s.officeStories.offices[key].queue])if(s[key].ap)s=act(s,'office_story',{event:id,choice:'check'});
 for(const d of defs.cases){let r=s.officeStories.offices[key].cases[d.id];if(!r)continue;
 while(['open','returned'].includes(r.status)&&s[key].ap&&s[key].silver>=4){const clue=d.clues.find(c=>!r.clues.some(e=>e.id===c.id));s=act(s,'office_case',{case:d.id,action:clue?'clue':'review',clue:clue?.id,choice:'evidence'});r=s.officeStories.offices[key].cases[d.id];}
 if(r.status==='approved'&&s[key].ap&&s[key].silver>=6)s=act(s,'office_case',{case:d.id,action:'execute'});
 }return s;
}
