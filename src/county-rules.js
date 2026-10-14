import { ACTIONS } from "./data.js";
import { canPrepare, preparation, nextFloodWeek, isHard } from "./county-hard.js";
export function actionContext(s, action) {
  const id = typeof action === "string" ? action : action.id,
    m = s.governance?.mandate;
  if (
    id === "inspect" &&
    m?.status === "active" &&
    m.mode === "verified" &&
    !m.checked
  )
    return { kind: "survey", mandate: m };
  const kinds =
    id === "farm"
      ? ["livelihood", "commerce"]
      : id === "patrol"
        ? ["security"]
        : [];
  const work = s.governance?.pendingWorks.find(
    (p) => kinds.includes(p.kind) && !p.expedited && p.due >= s.turn + 2,
  );
  return work ? { kind: "follow", work } : null;
}
export function applyActionContext(s, a, log) {
  const c = actionContext(s, a);
  if (c?.kind === "survey") {
    c.mandate.checked = true;
    log(
      s,
      "要务现场核实",
      "本阶段地方要务已现场核实，可据此安排投入；核实本身不提前记交付成果。",
      "decision",
    );
  }
  if (c?.kind === "follow") {
    c.work.expedited = true;
    c.work.due--;
    log(
      s,
      "亲自跟办交验",
      "已协调本项人手与现场查验，核验提前一周；尚未增加交付指标。",
      "decision",
    );
  }
}
export function projectBenefit(s, id) {
  const p = s.projects.find((p) => p.id === id && p.status === "complete");
  return p ? Math.max(0, Math.min(1, p.condition / 100)) : 0;
}
export function actionUsable(s, action) {
  const a =
    typeof action === "string" ? ACTIONS.find((a) => a.id === action) : action;
  if (!a) return false;
  return (
    !!actionContext(s, a) ||
    (a.id === "patrol" && canPrepare(s)) ||
    Object.entries(a.effect).some(([key, delta]) =>
      delta > 0 ? s[key] < 100 : delta < 0 && s[key] > 0,
    )
  );
}
export function actionDescription(s, a) {
  if (!actionUsable(s, a)) return "该项已无新增收益，先安排其他待办。";
  const c = actionContext(s, a);
  if (c?.kind === "survey")
    return "核实本阶段地方要务，为后续投入与交验留下现场记录。";
  if (c?.kind === "follow")
    return "跟办地方在办事项，核验提前一周；成果仍在到期查验时入账。";
  if (a.id === "patrol")
    return canPrepare(s) || (isHard(s) && s.turn <= 141)
      ? `改善治安；汛前准备${Math.min(3, preparation(s))}/3${preparation(s) >= 3 ? "，已备足" : "，本次补一次巡查"}${isHard(s) ? "。汛期何时到来，要看天时" : ""}。`
      : isHard(s)
        ? "改善治安。"
        : "汛期已过，本次巡守改善治安，不再积累汛前准备。";
  return a.desc;
}
export function reliefMove(s, delta) {
  const n = delta >= 0 ? delta : -Math.min(s.displaced, -delta);
  s.displaced += n;
  if (n >= 0) s.populationLedger.arrived += n;
  else s.populationLedger.settled -= n;
  return n;
}
