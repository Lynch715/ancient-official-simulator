import { contentAssessment } from "./career-difficulty.js";
import { zhifuCase, chooseCaseVariant, CASE_VARIANTS } from "./case-content.js";
import { adminCost, canFinish } from "./rules.js";
import { termLabel } from "./rules.js";
import { familyAllowance } from "./county-content.js";
import { qualified } from "./accountability.js";
import { COUNTIES } from "./prefecture.js";
import { TZ_PROJECTS, tzAssessment } from "./tongzhi.js";
import { ZF_TERM, ZF_TASKS, ZF_EVENTS, ZF_CASES } from "./zhifu-data.js";
import {
  OFFICE_HARD,
  zfHard,
  zfFloodTurns,
  zfFloodBase,
  isCorrupt,
  eventAt,
  eventWeek,
  officeDrift,
  blendLife,
  blendIntegrity,
  passLine,
  validateOfficeHard,
} from "./office-hard.js";
export { ZF_TERM, ZF_TASKS, ZF_EVENTS, ZF_CASES };
const round = (n) => Math.round(n * 100) / 100,
  clamp = (n) => Math.max(0, Math.min(100, round(n)));
export const zfLabel = (q) => termLabel(q.turn, "知府");
const log = (q, text) => {
  q.logs.unshift({ id: q.nextLog++, turn: q.turn, text });
  q.logs = q.logs.slice(0, 300);
};
function money(q, title, delta) {
  for (const [k, v] of Object.entries(delta))
    if (
      !["silver", "grain", "private"].includes(k) ||
      !Number.isFinite(v) ||
      q[k] + v < 0
    )
      throw Error("府库银粮不足。");
  for (const [k, v] of Object.entries(delta)) q[k] = round(q[k] + v);
  const row = { turn: q.turn, title, ...delta };
  q.ledger.push(row);
  q.lastLedger.push(row);
}
function pay(q, cost, title) {
  for (const [k, v] of Object.entries(cost))
    if (!Number.isFinite(v) || v < 0 || q[k] < v)
      throw Error(k === "ap" ? "本周统筹精力不足。" : "府库银粮不足。");
  if (cost.ap) q.ap -= cost.ap;
  const delta = Object.fromEntries(
    Object.entries(cost)
      .filter(([k]) => k !== "ap")
      .map(([k, v]) => [k, -v]),
  );
  if (Object.keys(delta).length) money(q, title, delta);
}
const change = (q, e) => {
  for (const [k, v] of Object.entries(e)) q[k] = clamp(q[k] + v);
};
const county = (q, id) => {
  if (!q.counties[id]) throw Error("属县无效。");
  return q.counties[id];
};
function due(q, weeks) {
  if (q.turn + weeks > 156) throw Error("本任余期不足以交验此项。");
  return q.turn + weeks;
}
export const activeTask = (q, id) =>
  q.tasks.find((t) => t.county === id && t.status === "working");
export const auditCost = (q) =>
  Math.max(0, adminCost(q, 12) - (q.auditCredits > 0 ? 4 : 0));
export const inspectorCount = (q) =>
  q.tasks.filter((t) => t.status === "checking").length +
  Object.values(q.counties).filter((c) => c.official.status === "investigating")
    .length;
export const taskCost = (q, id, kind) =>
  ZF_TASKS[kind].cost - (q.counties[id].cooperation >= 80 ? 4 : 0);
function newGoal(q) {
  const metric = Math.floor(q.turn / 13) % 2 ? "order" : "economy",
    c = Object.values(q.counties).reduce((a, b) =>
      a[metric] <= b[metric] ? a : b,
    );
  q.goal = {
    county: c.id,
    metric,
    baseline: c[metric],
    target: Math.min(90, round(c[metric] + (q.hard ? OFFICE_HARD.zf.goalStep : 6))),
    due: Math.min(156, q.turn + 13),
  };
}
function open(q) {
  q.ap = 3;
  q.event = eventAt(q, ZF_EVENTS)?.id || null;
  for (const d of ZF_CASES)
    if (d.week === q.turn)
      q.cases[d.id] = {
        id: d.id,
        variant: chooseCaseVariant(q.contentSeed, d.id),
        clues: [],
        status: "open",
        due: null,
      };
}
export function appointZhifu(s) {
  const p = s.tongzhi;
  if (s.zhifu) throw Error("知府任命已办理。");
  if (!p?.finished || (!tzAssessment(p).candidate && !qualified(s, "tongzhi")))
    throw Error("须同知考满称职且无待查责任，才可获授知府。");
  const q = (s.zhifu = {
    turn: 0,
    finished: false,
    ap: 3,
    silver: 0,
    grain: 0,
    private: p.private,
    trust: p.trust,
    integrity: p.integrity,
    misconduct: false,
    event: null,
    nextLog: 1,
    nextTask: 1,
    logs: [],
    ledger: [],
    lastLedger: [],
    tasks: [],
    contentSeed: s.seed,
    auditCredits: 0,
    pending: [],
    cases: {},
    goals: [],
    goal: null,
    settled: 0,
    affected: 0,
    shortage: 0,
    handover: false,
    lastBuy: -4,
    outcome: null,
    record: {
      silver: p.silver,
      grain: p.grain,
      private: p.private,
      score: tzAssessment(p).score,
      displaced: Object.values(p.counties).reduce((n, c) => n + c.displaced, 0),
    },
    projects: structuredClone(p.projects),
    projectJobs: {},
    counties: Object.fromEntries(
      COUNTIES.map((d, i) => {
        const c = p.counties[d.id];
        return [
          d.id,
          {
            id: d.id,
            name: d.name,
            people: c.people,
            cooperation: c.cooperation,
            economy: [55, 45, 65][i],
            order: [62, 50, 60][i],
            displaced: c.displaced,
            vulnerable: c.vulnerable,
            official: {
              name: ["许明远", "韩成", "顾允中"][i],
              status: "serving",
              evidence: false,
              exonerated: false,
              due: null,
              replaced: false,
            },
            lastTask: -4,
          },
        ];
      }),
    ),
  });
  q.affected = q.record.displaced;
  const hard = s.difficulty === "hard" && !!p.hard,
    grantS = hard ? OFFICE_HARD.zf.silver : 1200,
    grantG = hard ? OFFICE_HARD.zf.grain : 600;
  if (hard) q.hard = zfHard(s.seed, ZF_EVENTS);
  money(q, "府政统筹款正式核拨", { silver: grantS, grain: grantG });
  newGoal(q);
  open(q);
  log(
    q,
    `获授永平府知府，正四品。三县居民与三项设施按实接收；原专项银${p.silver}两、粮${p.grain}石留旧账，另核拨统筹银${grantS}两、粮${grantG}石。${hard ? "属官里谁手脚不干净，只有查了才知道；汛期早晚亦难预料。" : ""}`,
  );
}
export function zfAssessment(q) {
  const avg = (k) =>
    Object.values(q.counties).reduce((n, c) => n + c[k], 0) / 3;
  const verified = q.tasks.filter((t) => t.status === "verified").length,
    reports = q.tasks.filter((t) => t.status !== "working").length,
    met = q.goals.filter((g) => g.met).length,
    closed = Object.values(q.cases).filter((c) => c.status === "closed").length,
    facilities =
      Object.values(q.projects).reduce(
        (n, p) => n + (p.status === "complete" ? p.condition : 0),
        0,
      ) / 3;
  const score = Math.round(
    (q.hard ? blendLife(q, avg("people")) : avg("people")) * 0.15 +
      avg("economy") * 0.15 +
      avg("order") * 0.15 +
      (q.hard ? blendIntegrity(q) : q.integrity) * 0.15 +
      (reports ? (verified / reports) * 100 : 0) * 0.1 +
      (q.goals.length ? (met / q.goals.length) * 100 : 0) * 0.1 +
      (q.affected ? (q.settled / q.affected) * 100 : 100) * 0.05 +
      (closed / 2) * 100 * 0.1 +
      facilities * 0.05,
  );
  return contentAssessment(q, {
    score,
    rating: q.misconduct
      ? "候查"
      : score >= passLine(q)
        ? "称职"
        : score >= 50
          ? "平常"
          : "不称职",
    candidate: !q.misconduct && score >= passLine(q),
    summary: `核验差事${verified}/${reports}份，阶段要务${met}/${q.goals.length}项，执行归档${closed}/2案，实际安置${q.settled}/${q.affected}人；未完差事${q.tasks.filter((t) => t.status === "working").length}项。`,
  });
}
export function projectPlan(q, id) {
  const p = q.projects[id],
    d = TZ_PROJECTS.find((d) => d.id === id);
  if (!p || !d) throw Error("设施无效。");
  if (p.status === "complete" && p.quality >= 70)
    return { kind: "repair", cost: 40, weeks: 2, name: "修护" };
  const remaining = Math.max(0, d.weeks - p.progress);
  return {
    kind: "renew",
    cost:
      (["planned", "approved"].includes(p.status) ? d.cost : 0) +
      remaining * d.weekly +
      40,
    weeks: Math.max(2, Math.ceil(remaining) + 2),
    name: "续办并复验",
  };
}
export function zhifuCommand(s, c) {
  const q = s.zhifu;
  if (!q) throw Error("尚未获授知府。");
  if (q.finished) throw Error("知府本任已经考满。");
  q.lastLedger = [];
  if (c.type === "zf_task") {
    const d = county(q, c.county),
      def = ZF_TASKS[c.kind];
    if (!def) throw Error("差事无效。");
    if (
      activeTask(q, d.id) ||
      q.turn - d.lastTask < 4 ||
      d.official.status === "replacing"
    )
      throw Error("该县差事未交付、间隔不足4周，或正在接任。");
    due(q, def.weeks);
    if (c.kind === "relief" && !d.displaced)
      throw Error("该县没有待安置居民。");
    const cost = taskCost(q, d.id, c.kind);
    pay(
      q,
      { silver: cost, grain: def.grain || 0, ap: 1 },
      d.name + def.name + "全额拨款",
    );
    const dishonest = isCorrupt(q, d.id) && !d.official.replaced;
    const amount = c.kind === "relief" ? Math.min(24, d.displaced) : def.gain;
    const t = {
      id: q.nextTask++,
      county: d.id,
      kind: c.kind,
      status: "working",
      remaining: def.weeks,
      started: q.turn,
      reported: amount,
      actual: dishonest ? Math.floor(amount / 2) : amount,
      plannedActual: dishonest ? Math.floor(amount / 2) : amount,
      actualBasis: "pending",
      deliveryBefore: null,
      deliveryAfter: null,
      diverted: dishonest ? Math.floor(cost / 4) : 0,
      official: d.official.name,
      delivered: null,
      due: null,
    };
    q.tasks.push(t);
    d.lastTask = q.turn;
    log(
      q,
      `${d.name}${def.name}已全额拨付${cost}两${def.grain ? "、" + def.grain + "石" : ""}，${def.weeks}周后交付；未到期不增加成果。`,
    );
    return;
  }
  if (c.type === "zf_audit") {
    const t = q.tasks.find((t) => t.id === c.idTask);
    if (!t || t.status !== "reported")
      throw Error("此报告尚未交付或已在核验。");
    if (inspectorCount(q) >= 2) throw Error("两组巡察人手均在外。");
    const end = due(q, 2);
    pay(q, { silver: auditCost(q), ap: 1 }, "差事现场核验");
    if (q.auditCredits > 0) q.auditCredits--;
    t.status = "checking";
    t.due = end;
    log(
      q,
      `${county(q, t.county).name}第${t.id}号报告派员核验，2周后返回；目前不记核验成绩。`,
    );
    return;
  }
  if (c.type === "zf_official") {
    const d = county(q, c.county),
      o = d.official;
    if (c.action === "investigate") {
      if (o.status !== "serving" || o.evidence || o.exonerated || o.replaced)
        throw Error("当前无需重复调查该属官。");
      if (inspectorCount(q) >= 2) throw Error("两组巡察人手均在外。");
      const end = due(q, 2);
      pay(q, { silver: 16, ap: 1 }, d.name + "属官账证调查");
      o.status = "investigating";
      o.due = end;
      log(q, `${d.name}派员调取领款账证，2周后出具结论；现有差事继续办理。`);
    } else if (c.action === "replace") {
      if (!o.evidence || o.status !== "serving" || o.replaced)
        throw Error("须取得账证并完成调查，才可报请处置接任。");
      const end = due(q, 3);
      pay(q, { silver: 12, ap: 1 }, d.name + "报请处置与接任");
      o.status = "replacing";
      o.due = end;
      log(
        q,
        `${d.name}查实材料已报有权机关，3周后批复接任；期间该县在办差事暂停，已拨资金和成果不清零。`,
      );
    } else throw Error("属官操作无效。");
    return;
  }
  if (c.type === "zf_project") {
    const p = q.projects[c.project],
      d = TZ_PROJECTS.find((d) => d.id === c.project);
    if (!p || !d) throw Error("设施无效。");
    let j = q.projectJobs[c.project];
    if (c.action === "propose") {
      if (j) throw Error("本项已有待办。");
      const plan = projectPlan(q, d.id);
      if (plan.kind === "repair" && p.condition >= p.quality)
        throw Error("设施暂无损耗。");
      const end = due(q, 2 + plan.weeks);
      pay(q, { ap: 1 }, "报请续办预算");
      q.projectJobs[d.id] = {
        ...plan,
        status: "approval",
        due: q.turn + 2,
        remaining: plan.weeks,
      };
      log(
        q,
        `${d.name}${plan.name}报批，2周后批复；预计${plan.cost}两、${plan.weeks}周工期，尚未支出。`,
      );
    } else if (c.action === "start") {
      if (j?.status !== "approved") throw Error("须先取得预算批复。");
      due(q, j.weeks);
      pay(q, { silver: j.cost, ap: 1 }, d.name + j.name + "全额工程款");
      j.status = "working";
      j.due = null;
      if (j.kind === "renew") {
        p.status = "building";
        p.condition = 0;
      }
      log(q, `${d.name}已付${j.cost}两，委由同知督办，${j.weeks}周后待验收。`);
    } else if (c.action === "accept") {
      if (j?.status !== "ready") throw Error("尚未完成施工与复验。");
      pay(q, { silver: 10, ap: 1 }, d.name + "交付核验");
      if (j.kind === "repair")
        p.condition = Math.min(p.quality, round(p.condition + 30));
      else
        Object.assign(p, {
          status: "complete",
          progress: d.weeks,
          condition: 85,
          quality: 85,
          surveyed: true,
          inspected: true,
          due: null,
          acceptedAt: q.turn,
        });
      delete q.projectJobs[d.id];
      log(q, `${d.name}核验交付，真实状况${p.condition}；原任记录保持原样。`);
    } else throw Error("设施操作无效。");
    return;
  }
  if (c.type === "zf_case") {
    const d = zhifuCase(q, c.case),
      a = q.cases[c.case];
    if (!d || !a) throw Error("本案尚未立卷。");
    if (c.action === "clue") {
      if (a.status !== "open") throw Error("案卷已进入后续程序。");
      const clue = d.clues.find((x) => x.id === c.clue);
      if (!clue || a.clues.includes(clue.id)) throw Error("证据无效或已取得。");
      pay(q, { silver: 6, ap: 1 }, d.name + "查证");
      a.clues.push(clue.id);
      log(q, clue.text);
    } else if (c.action === "review") {
      if (a.status !== "open" || a.clues.length !== d.clues.length)
        throw Error("须查齐两项相互印证的证据。");
      if (!canFinish(q.turn, 4))
        throw Error("余期不足4周，无法完成核办与执行。");
      const end = due(q, 2);
      pay(q, { ap: 1 }, "案卷核办");
      a.status = "review";
      a.due = end;
      log(q, `${d.name}按证据报办，2周后收到核办结果。`);
    } else if (c.action === "execute") {
      if (a.status !== "approved") throw Error("须先完成核办。");
      const end = due(q, 2);
      pay(q, { silver: 10, ap: 1 }, d.name + "督促执行");
      a.status = "executing";
      a.due = end;
      log(q, `${d.name}已安排执行，2周后查验；当前尚未归档。`);
    } else throw Error("案卷操作无效。");
    return;
  }
  if (c.type === "zf_supply") {
    if (q.turn - q.lastBuy < 4) throw Error("采购须间隔4周。");
    const end = due(q, 2);
    pay(q, { silver: 50, ap: 1 }, "采购赈粮预付款");
    q.pending.push({ kind: "grain", amount: 120, due: end });
    q.lastBuy = q.turn;
    log(q, "采购120石，已付50两；2周后实到，不提前入仓。");
    return;
  }
  if (c.type === "zf_event") {
    const e = ZF_EVENTS.find((e) => e.id === q.event),
      o = e?.options.find((o) => o.id === c.choice);
    if (!o) throw Error("本周公文或处置无效。");
    pay(q, o.cost, e.title);
    change(q, o.effect);
    if (o.special === "misconduct") q.misconduct = true;
    if (o.special === "handover") q.handover = true;
    if (o.special === "auditPrep") q.auditCredits = 2;
    for (const d of Object.values(q.counties)) {
      if (["cooperate", "divide", "listen"].includes(o.special))
        d.cooperation = clamp(
          d.cooperation +
            (o.special === "cooperate" ? 6 : o.special === "divide" ? -6 : 2),
        );
      if (["patrol", "borders"].includes(o.special))
        d.order = clamp(d.order + (o.special === "patrol" ? 3 : -5));
    }
    q.event = null;
    log(q, `${e.title}：${o.label}。`);
    return;
  }
  if (c.type !== "zf_advance") throw Error("知府操作无效。");
  if (q.event) throw Error("请先处置本周知府公文。");
  advance(q, familyAllowance(s));
}
function advance(q, familyBonus = 0) {
  money(
    q,
    "府政每周核拨22两、署务14两",
    { silver: q.hard ? OFFICE_HARD.zf.net : 8 },
  );
  money(q, "知府俸入与家计净额", { private: 1.5 + familyBonus });
  for (const d of Object.values(q.counties)) {
    d.economy = clamp(d.economy - (q.hard ? OFFICE_HARD.zf.economyDrift : 0.1));
    d.order = clamp(d.order - (q.hard ? OFFICE_HARD.zf.orderDrift : 0.12));
    if (d.order < 40) d.people = clamp(d.people - 0.15);
    if (d.displaced) {
      const need = Math.ceil(d.displaced / 6),
        actual = Math.min(need, q.grain);
      money(q, d.name + "待安置口粮", { grain: -actual });
      q.shortage += need - actual;
      if (actual < need) {
        d.people = clamp(d.people - 1);
        log(
          q,
          `${d.name}应供${need}石，实供${actual}石，缺供${need - actual}石；待安置人数不因断粮减少。`,
        );
      }
    }
  }
  for (const d of TZ_PROJECTS) {
    const p = q.projects[d.id];
    if (p.status === "complete") {
      const funded = q.silver >= 1;
      if (funded) money(q, d.name + "常例养护", { silver: -1 });
      p.condition = Math.max(0, round(p.condition - (funded ? 0.15 : 0.8)));
    }
  }
  if (
    q.projects.ferry.status === "complete" &&
    q.projects.ferry.condition >= 40
  )
    for (const d of Object.values(q.counties))
      d.people = clamp(d.people + 0.06);
  for (const t of q.tasks.filter((t) => t.status === "working")) {
    const d = q.counties[t.county];
    if (d.official.status === "replacing") {
      log(q, `${d.name}接任期间第${t.id}号差事暂停，剩余${t.remaining}周。`);
      continue;
    }
    t.remaining--;
    if (t.remaining === 0) {
      const def = ZF_TASKS[t.kind];
      if (t.kind === "relief") {
        d.displaced -= t.actual;
        d.vulnerable = Math.min(
          d.displaced,
          Math.max(0, d.vulnerable - Math.ceil(t.actual / 3)),
        );
        q.settled += t.actual;
        d.people = clamp(d.people + 2);
      } else {
        t.deliveryBefore = d[def.metric];
        d[def.metric] = clamp(d[def.metric] + t.plannedActual);
        t.deliveryAfter = d[def.metric];
        t.actual = round(t.deliveryAfter - t.deliveryBefore);
      }
      t.actualBasis = "measured";
      t.status = "reported";
      t.delivered = q.turn + 1;
      log(
        q,
        `${d.name}${def.name}交付：报称${t.reported}${t.kind === "relief" ? "人" : "点"}，实际${t.actual}${t.kind === "relief" ? "人安置" : "点改善（指标受上限约束）"}；须现场核验后方计核验成绩。`,
      );
    }
  }
  for (const j of Object.values(q.projectJobs))
    if (j.status === "working" && --j.remaining === 0) j.status = "ready";
  if (q.hard) officeDrift(q, Object.values(q.counties), OFFICE_HARD.zf);
  q.turn++;
  for (const t of q.tasks.filter(
    (t) => t.status === "checking" && t.due <= q.turn,
  )) {
    t.status = "verified";
    t.due = null;
    const d = q.counties[t.county];
    if (t.diverted) {
      if (d.official.name === t.official && !d.official.replaced)
        d.official.evidence = true;
      log(
        q,
        `${d.name}第${t.id}号核验：报称${t.reported}，实成${t.actual}，原承办${t.official}侵渔${t.diverted}两，材料已留卷；未追回款项不虚增府库。`,
      );
    } else
      log(q, `${d.name}第${t.id}号核验：账实相符，实成${t.actual}，列入履历。`);
  }
  for (const d of Object.values(q.counties)) {
    const o = d.official;
    if (o.due !== null && o.due <= q.turn) {
      if (o.status === "investigating") {
        o.evidence = isCorrupt(q, d.id) && !o.replaced;
        o.exonerated = !o.evidence;
        o.status = "serving";
        log(
          q,
          `${d.name}调查结果：${o.evidence ? "领款账与交付记录证实侵渔，可报请处置接任" : "未发现侵渔证据，不凭猜测定责"}。`,
        );
      } else {
        const old = o.name;
        o.name = "署理·" + d.name[0] + "守正";
        o.status = "serving";
        o.replaced = true;
        log(
          q,
          `${d.name}已获批由${o.name}接任；${old}移交核处。旧差事实效仍按原承办记录，新拨差事由接任者办理。`,
        );
      }
      o.due = null;
    }
  }
  for (const j of Object.values(q.projectJobs))
    if (j.status === "approval" && j.due <= q.turn) {
      j.status = "approved";
      j.due = null;
      log(q, "设施续办或修护预算已批，可以正式拨款。");
    }
  for (const a of Object.values(q.cases))
    if (a.due !== null && a.due <= q.turn) {
      const d = zhifuCase(q, a.id);
      if (a.status === "review") {
        a.status = "approved";
        log(q, `${d.name}核办通过：${d.finding}须安排执行。`);
      } else {
        a.status = "closed";
        q.counties[d.county].people = clamp(q.counties[d.county].people + 3);
        log(q, `${d.name}执行结果查验完成，正式归档。`);
      }
      a.due = null;
    }
  for (const p of q.pending.filter((p) => p.due <= q.turn)) {
    money(q, "赈粮实际到仓", { grain: p.amount });
    log(q, `${p.amount}石采购粮已入仓。`);
  }
  q.pending = q.pending.filter((p) => p.due > q.turn);
  if (zfFloodTurns(q).includes(q.turn)) {
    for (const d of Object.values(q.counties)) {
      const shield = TZ_PROJECTS.reduce(
        (n, p) =>
          n +
          (q.projects[p.id].status === "complete"
            ? (p.defence[d.id] * q.projects[p.id].condition) / 100
            : 0),
        0,
      );
      const n = Math.max(0, Math.ceil(zfFloodBase(q, q.turn) - shield * 0.6));
      d.displaced += n;
      d.vulnerable += Math.ceil(n / 3);
      q.affected += n;
      d.people = clamp(d.people - n * 0.1);
      log(
        q,
        `${d.name}本年汛情：承接设施防护${round(shield)}，新增待安置${n}人，其中病弱${Math.ceil(n / 3)}人。`,
      );
    }
  }
  if (q.turn === q.goal.due) {
    const d = q.counties[q.goal.county],
      actual = d[q.goal.metric],
      met = actual >= q.goal.target;
    q.goals.push({ ...q.goal, actual, met });
    change(q, { trust: met ? 2 : -1 });
    log(
      q,
      `${d.name}阶段${q.goal.metric === "economy" ? "农商" : "治安"}要务：目标${q.goal.target}，实绩${actual}，${met ? "达标" : "未达标"}；不以报称代替。`,
    );
    if (q.turn < 156) newGoal(q);
  }
  if (q.turn === 156) {
    q.finished = true;
    q.ap = 0;
    q.outcome = zfAssessment(q);
    log(
      q,
      `知府三年考满：${q.outcome.rating}，${q.outcome.score}分。${q.outcome.summary}未验报告、未完工程和未结案卷据实交接。`,
    );
  } else open(q);
}
export function zhifuReceipt(before, after, c) {
  const a = before.zhifu,
    b = after.zhifu,
    changes = [],
    add = (name, x, y) => {
      if (x !== y)
        changes.push({ name, before: x, after: y, delta: round(y - x) });
    };
  if (a) {
    for (const [k, n] of Object.entries({
      silver: "府政官银",
      grain: "府仓实粮",
      private: "私产",
      ap: "精力",
      trust: "上级信任",
      integrity: "吏治",
      settled: "实际复耕安置",
      shortage: "累计缺供粮",
    }))
      add(n, a[k], b[k]);
    for (const d of COUNTIES)
      for (const [k, n] of Object.entries({
        people: "民生",
        economy: "农商",
        order: "治安",
        displaced: "待安置",
        cooperation: "协作",
      }))
        add(d.name + " · " + n, a.counties[d.id][k], b.counties[d.id][k]);
    for (const d of TZ_PROJECTS)
      add(
        d.name + " · 状况",
        a.projects[d.id].condition,
        b.projects[d.id].condition,
      );
  } else {
    add("新核拨府政官银", 0, b.silver);
    add("新核拨府仓实粮", 0, b.grain);
  }
  return {
    id: c.id,
    chapter: "知府",
    turn: a?.turn || 0,
    title:
      c.type === "zf_appoint"
        ? "知府任命已生效"
        : c.type === "zf_advance"
          ? "知府本周结算"
          : "府政督办回执",
    changes,
    notes: b.logs
      .filter((x) => x.id >= (a?.nextLog || 1))
      .reverse()
      .map((x) => x.text),
    policies: [],
    ledger: b.lastLedger,
  };
}
export function validateZhifu(s) {
  const q = s.zhifu;
  if (q === null) return;
  const fail = () => {
    throw Error("知府履历结构、账目或时序异常。");
  };
  validateOfficeHard(q);
  const num = (v, a = 0, b = 1e9) => Number.isFinite(v) && v >= a && v <= b,
    int = (v, a = 0, b = 1e9) => Number.isInteger(v) && num(v, a, b);
  if (
    !q ||
    !s.tongzhi?.finished ||
    (!tzAssessment(s.tongzhi).candidate && !qualified(s, "tongzhi")) ||
    !int(q.turn, 0, 156) ||
    q.finished !== (q.turn === 156) ||
    !int(q.ap, 0, 3) ||
    (q.finished && q.ap !== 0)
  )
    fail();
  for (const k of [
    "silver",
    "grain",
    "private",
    "affected",
    "settled",
    "shortage",
  ])
    if (!num(q[k])) fail();
  if (
    !Number.isInteger(q.contentSeed) ||
    !Number.isInteger(q.auditCredits) ||
    q.auditCredits < 0 ||
    q.auditCredits > 2 ||
    Object.values(q.cases).some(
      (file) =>
        file.variant !== undefined && !CASE_VARIANTS.includes(file.variant),
    )
  )
    fail();
  for (const k of ["trust", "integrity"]) if (!num(q[k], 0, 100)) fail();
  for (const k of ["misconduct", "handover"])
    if (typeof q[k] !== "boolean") fail();
  if (
    !int(q.nextLog, 1) ||
    !int(q.nextTask, 1) ||
    !int(q.lastBuy, -4, q.turn) ||
    !["affected", "settled", "shortage"].every((k) => int(q[k]))
  )
    fail();
  for (const k of ["logs", "ledger", "lastLedger", "tasks", "pending", "goals"])
    if (!Array.isArray(q[k]) || q[k].length > 4000) fail();
  if (
    (q.event !== null &&
      !ZF_EVENTS.some((e) => e.id === q.event && eventWeek(q, e) === q.turn)) ||
    (q.finished && q.event !== null)
  )
    fail();
  if (
    !q.record ||
    ["silver", "grain", "private"].some((k) => q.record[k] !== s.tongzhi[k]) ||
    q.record.score !== tzAssessment(s.tongzhi).score ||
    q.record.displaced !==
      Object.values(s.tongzhi.counties).reduce((n, d) => n + d.displaced, 0)
  )
    fail();
  if (!q.counties || Object.keys(q.counties).length !== 3) fail();
  for (const d of COUNTIES) {
    const x = q.counties[d.id],
      o = x?.official;
    if (
      !x ||
      x.id !== d.id ||
      x.name !== d.name ||
      ["people", "economy", "order", "cooperation"].some(
        (k) => !num(x[k], 0, 100),
      ) ||
      !int(x.displaced) ||
      !int(x.vulnerable, 0, x.displaced) ||
      !int(x.lastTask, -4, q.turn) ||
      !o ||
      typeof o.name !== "string" ||
      !["serving", "investigating", "replacing"].includes(o.status) ||
      ["evidence", "exonerated", "replaced"].some(
        (k) => typeof o[k] !== "boolean",
      )
    )
      fail();
    if (o.status === "serving" ? o.due !== null : !int(o.due, q.turn + 1, 156))
      fail();
    if (o.status === "replacing" && !o.evidence) fail();
  }
  if (
    q.affected !==
    q.settled + Object.values(q.counties).reduce((n, c) => n + c.displaced, 0)
  )
    fail();
  const ids = new Set();
  for (const t of q.tasks) {
    const def = ZF_TASKS[t.kind];
    if (
      !def ||
      !q.counties[t.county] ||
      !int(t.id, 1, q.nextTask - 1) ||
      ids.has(t.id) ||
      !["working", "reported", "checking", "verified"].includes(t.status) ||
      !int(t.remaining, 0, def.weeks) ||
      !int(t.started, 0, q.turn) ||
      typeof t.official !== "string" ||
      !int(t.reported, 1, def.gain) ||
      !num(t.actual, 0, t.reported) ||
      !int(t.plannedActual, 0, t.reported) ||
      !["pending", "measured", "legacy"].includes(t.actualBasis) ||
      !int(t.diverted, 0, def.cost)
    )
      fail();
    if (
      (t.actualBasis === "pending" && t.status !== "working") ||
      (t.status === "working" && t.actualBasis !== "pending")
    )
      fail();
    if (
      t.kind !== "relief" &&
      t.actualBasis === "measured" &&
      (!num(t.deliveryBefore, 0, 100) ||
        !num(t.deliveryAfter, 0, 100) ||
        round(t.deliveryAfter - t.deliveryBefore) !== t.actual)
    )
      fail();
    if (t.kind === "relief" && !int(t.actual, 0, t.reported)) fail();
    ids.add(t.id);
    if (
      t.status === "working"
        ? t.remaining === 0 || t.delivered !== null
        : t.remaining !== 0 || !int(t.delivered, t.started + def.weeks, q.turn)
    )
      fail();
    if (t.status === "checking" ? !int(t.due, q.turn + 1, 156) : t.due !== null)
      fail();
    if (
      t.kind === "relief" &&
      t.status === "working" &&
      t.reported > q.counties[t.county].displaced
    )
      fail();
  }
  if (q.tasks.length !== q.nextTask - 1) fail();
  for (const d of COUNTIES)
    if (
      q.tasks.filter((t) => t.county === d.id && t.status === "working")
        .length > 1
    )
      fail();
  if (inspectorCount(q) > 2) fail();
  if (!q.projects || Object.keys(q.projects).length !== 3 || !q.projectJobs)
    fail();
  for (const d of TZ_PROJECTS) {
    const p = q.projects[d.id],
      j = q.projectJobs[d.id];
    if (
      !p ||
      p.id !== d.id ||
      !["planned", "approved", "building", "ready", "complete"].includes(
        p.status,
      ) ||
      !num(p.progress, 0, d.weeks) ||
      ![55, 85].includes(p.quality) ||
      !num(p.condition, 0, p.quality) ||
      (p.status !== "complete" && p.condition !== 0)
    )
      fail();
    if (
      j &&
      (!["repair", "renew"].includes(j.kind) ||
        !["approval", "approved", "working", "ready"].includes(j.status) ||
        !int(j.weeks, 2, 14) ||
        !num(j.cost, 0, 500) ||
        !int(j.remaining, 0, j.weeks) ||
        (j.status === "approval"
          ? !int(j.due, q.turn + 1, 156)
          : j.due !== null) ||
        (j.status === "ready" && j.remaining !== 0) ||
        (j.status === "working" && j.remaining === 0))
    )
      fail();
  }
  if (Object.keys(q.projectJobs).some((id) => !q.projects[id])) fail();
  if (
    !q.cases ||
    Object.keys(q.cases).length !==
      ZF_CASES.filter((d) => d.week <= q.turn).length
  )
    fail();
  for (const [id, a] of Object.entries(q.cases)) {
    const d = ZF_CASES.find((d) => d.id === id);
    if (
      !d ||
      d.week > q.turn ||
      a.id !== id ||
      !Array.isArray(a.clues) ||
      new Set(a.clues).size !== a.clues.length ||
      a.clues.some((id) => !d.clues.some((c) => c.id === id)) ||
      !["open", "review", "approved", "executing", "closed"].includes(
        a.status,
      ) ||
      (a.status !== "open" && a.clues.length !== 2)
    )
      fail();
    if (
      ["review", "executing"].includes(a.status)
        ? !int(a.due, q.turn + 1, 156)
        : a.due !== null
    )
      fail();
  }
  const goalValid = (g) =>
    g &&
    q.counties[g.county] &&
    ["economy", "order"].includes(g.metric) &&
    num(g.baseline, 0, 100) &&
    num(g.target, 0, 100) &&
    int(g.due, 13, 156) &&
    g.due % 13 === 0;
  if (
    !goalValid(q.goal) ||
    q.goals.length !== Math.floor(q.turn / 13) ||
    q.goal.due !== (q.finished ? 156 : (Math.floor(q.turn / 13) + 1) * 13)
  )
    fail();
  for (const [g, i] of q.goals.map((g, i) => [g, i]))
    if (
      !goalValid(g) ||
      g.due !== (i + 1) * 13 ||
      !num(g.actual, 0, 100) ||
      g.met !== g.actual >= g.target
    )
      fail();
  for (const p of q.pending)
    if (p.kind !== "grain" || p.amount !== 120 || !int(p.due, q.turn + 1, 156))
      fail();
  if (
    q.logs.some(
      (x) =>
        !int(x.id, 1, q.nextLog - 1) ||
        !int(x.turn, 0, q.turn) ||
        typeof x.text !== "string",
    ) ||
    new Set(q.logs.map((x) => x.id)).size !== q.logs.length
  )
    fail();
  for (const row of [...q.ledger, ...q.lastLedger])
    if (
      !row ||
      !int(row.turn, 0, q.turn) ||
      typeof row.title !== "string" ||
      ["silver", "grain", "private"].some(
        (k) => row[k] !== undefined && !num(row[k], -1e9, 1e9),
      )
    )
      fail();
  for (const k of ["silver", "grain", "private"])
    if (
      Math.abs(
        round(
          (k === "private" ? q.record.private : 0) +
            q.ledger.reduce((n, r) => n + (r[k] || 0), 0),
        ) - q[k],
      ) > 0.01
    )
      fail();
  if (q.finished) q.outcome = zfAssessment(q);
  else if (q.outcome !== null) fail();
}
