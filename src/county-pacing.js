import { countyCase } from "./case-content.js";
import { AFFAIRS } from "./county-affairs.js";
import { PROJECTS } from "./data.js";
export function routineStop(s) {
  if (s.finished || s.prefecture || s.accountability.current)
    return "当前任期或考课已有新的程序。";
  if (s.events.length) return "先处理或亲自交办眼前来信。";
  if (
    Object.values(s.cases).some(
      (c) =>
        ["open", "returned"].includes(c.status) ||
        ["awaiting", "overdue"].includes(c.execution?.status),
    )
  )
    return "案卷有待查证或待执行事项。";
  if (s.displaced > 0) return "仍有居民待安置，先看供粮与救济安排。";
  if (s.flags.arrears || s.fatigue >= 65) return "当前欠付或疲劳须先查看。";
  const m = s.governance.mandate;
  if (
    m?.status === "active" &&
    (m.mode === "verified"
      ? !m.checked || !m.ordered
      : s.governance.districts[m.district][m.metric] < m.target)
  )
    return "本阶段地方要务仍需亲自安排。";
  return "";
}
export function routineBoundary(before, after) {
  if (after.finished || after.accountability.current)
    return "本任考满，进入任用或考课程序。";
  if (after.events.length) return "新来信已经送到案头。";
  for (const [id, c] of Object.entries(after.cases)) {
    const old = before.cases[id];
    if (
      !old ||
      old.status !== c.status ||
      old.execution?.status !== c.execution?.status
    )
      return `${countyCase(after, id).name}有新的核办进展。`;
  }
  for (const p of after.projects)
    if (p.status !== before.projects.find((x) => x.id === p.id)?.status)
      return `${PROJECTS.find((d) => d.id === p.id).name}已交付。`;
  if (before.pending.some((p) => p.due <= after.turn))
    return "在途钱粮或到期事项已经核验。";
  if (
    before.governance.pendingWorks.length !==
    after.governance.pendingWorks.length
  )
    return "地方在办事项已交验。";
  if (
    before.countyAffairs.pending.length !== after.countyAffairs.pending.length
  ) {
    const p = before.countyAffairs.pending.find(
      (p) => !after.countyAffairs.pending.some((q) => q.id === p.id),
    );
    return `${p ? AFFAIRS[p.id].title : "阶段事务"}已到期核验。`;
  }
  if (after.turn % 52 === 39) return "本年秋收入仓，先核对新账。";
  if (
    before.governance.mandate?.started !== after.governance.mandate?.started ||
    before.governance.mandate?.status !== after.governance.mandate?.status
  )
    return "地方要务已核定或进入新阶段。";
  if (
    after.hard &&
    (after.hard.owedSilver > (before.hard?.owedSilver || 0) ||
      after.hard.owedGrain > (before.hard?.owedGrain || 0))
  )
    return "季末上解不足，已记欠解。";
  if (after.hard && after.turn % 13 === 0) return "季末上解已结算，先核对新账。";
  if (
    after.flags.arrears ||
    after.populationLedger.shortage > before.populationLedger.shortage
  )
    return "本周收支或供粮出现缺口。";
  return routineStop(after);
}
