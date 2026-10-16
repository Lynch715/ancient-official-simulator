// 模仿“认真读界面的普通玩家”的程序：优先亲自办（花精力不花银），银子留给灾情与上解。
import { createGame, dispatch } from "../../src/engine.js";
import { countyEvent } from "../../src/county-content.js";
import { countyCase } from "../../src/case-content.js";
import { ACTIONS, CASES } from "../../src/data.js";
import { actionUsable } from "../../src/county-rules.js";
import { droughtNeed, HARD } from "../../src/county-hard.js";
import { interventionCost } from "../../src/governance.js";
let n = 0;
const act = (s, type, a = {}) => dispatch(s, { id: `u${n++}`, type, ...a });
const tryAct = (s, type, a) => { try { return act(s, type, a); } catch { return s; } };
const can = (s, c = {}) => Object.entries(c).every(([k, v]) => s[k] >= v);
const bad = (o) => o.flags?.bribe || o.flags?.concealed || o.flags?.destroyed || o.id === "levy";
function choose(s, id) {
  const d = countyEvent(s, id), ok = d.options.filter((o) => can(s, o.cost) && !bad(o));
  const pick = (ids) => ids.map((x) => ok.find((o) => o.id === x)).find(Boolean);
  if (id === "X04") { const need = droughtNeed(s); return (s.grain >= need + 40 ? pick(["request", "grain"]) : null) || pick(["buy", "minimal", "petition"]); }
  if (id === "X12" || id === "H12") return pick(["evacuate", "protect", "appeal"]);
  if (id === "H01" || id === "H03") return (s.silver >= s.hard.levy[id] + 40 ? pick(["pay"]) : null) || pick(["appeal", "pay"]) || d.options.find((o) => o.id === "levy");
  if (id === "H02") return s.grain >= 120 ? pick(["bounty", "organize"]) : pick(["organize", "pray"]);
  const apOnly = ok.find((o) => o.cost.ap && Object.keys(o.cost).length === 1);
  if (apOnly) return apOnly;
  const order = (d.options).map((o) => o.id);
  const cheap = ok.filter((o) => (o.cost.silver || 0) <= Math.max(0, s.silver - 120) && (o.cost.grain || 0) <= Math.max(0, s.grain - 200));
  const designer = (x) => [...x].sort((a, b) => (EVENT_ORDER[id]?.indexOf(a.id) ?? 0) - (EVENT_ORDER[id]?.indexOf(b.id) ?? 0));
  return designer(cheap.filter((o) => Object.keys(o.cost).length))[0] || designer(ok.filter((o) => !Object.keys(o.cost).length))[0] || ok[0];
}
import { EVENTS } from "../../src/data.js";
const EVENT_ORDER = Object.fromEntries(Object.entries(EVENTS).map(([k, e]) => [k, e.options.map((o) => o.id)]));
export function run(style, seed, family = "scholar") {
  let s = createGame({ seed, family });
  for (const [p, t] of Object.entries({ clerk: "ledger", dianshi: "ledger", captain: "patrol", advisor: "care", deputy: "works" })) s = act(s, "staff", { person: p, task: t });
  while (!s.finished) {
    for (const e of [...s.events]) s = act(s, "event", { event: e.id, choice: choose(s, e.id).id });
    if (s.hard.owedSilver || s.hard.owedGrain) s = tryAct(s, "hard_remit");
    if (!s.projects.length) s = tryAct(s, "project", { project: "canal" });
    else if (!s.projects.some((p) => p.id === "embankment") && !s.projects.some((p) => p.status === "building") && s.silver >= 220) s = tryAct(s, "project", { project: "embankment" });
    for (const c of CASES) {
      const f = s.cases[c.id]; if (!f) continue; const d = countyCase(s, c.id);
      if (["open", "returned"].includes(f.status)) { for (const cl of d.clues) if (!s.cases[c.id].clues.includes(cl.id) && s.ap) s = tryAct(s, "investigate", { case: c.id, clue: cl.id }); if (s.cases[c.id].clues.length === d.clues.length) s = tryAct(s, "judge", { case: c.id, choice: "good" }); }
      const ex = s.cases[c.id].execution?.status;
      if ((ex === "awaiting" && style === "careful") || ex === "overdue") s = tryAct(s, "enforce", { case: c.id });
    }
    const m = s.governance.mandate;
    if (style === "careful" && m?.status === "active") {
      if (m.mode === "verified" && !m.checked && s.ap) s = tryAct(s, "action", { action: "inspect" });
      else if (!m.ordered && s.ap && s.silver >= interventionCost(s, m.district, m.metric).silver + 40) s = tryAct(s, "district", { district: m.district, kind: m.metric });
    }
    for (const id of ["patrol", "farm", "inspect"]) if (s.ap && actionUsable(s, ACTIONS.find((a) => a.id === id)) && !s.actions.includes(id)) s = tryAct(s, "action", { action: id });
    s = act(s, "advance");
  }
  const o = s.outcome;
  return s;
}
