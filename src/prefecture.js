import { contentAssessment } from "./career-difficulty.js";
import { MAINLINE_TEXT } from "./office-mainline.js";
import { adminCost } from "./rules.js";
import { familyAllowance } from "./county-content.js";
import { termLabel } from "./rules.js";
import { qualified } from "./accountability.js";
import {
  OFFICE_HARD,
  prefHard,
  prefRequest,
  eventAt,
  eventWeek,
  officeDrift,
  blendLife,
  blendIntegrity,
  validateOfficeHard,
  passLine,
  transitLoss,
} from "./office-hard.js";
// 府通判篇：独立公账与任期，县任状态原样留作交接。
export const PREF_TERM = 156;
export const COUNTIES = [
  {
    id: "qinghe",
    name: "清河县",
    person: "deputy",
    scene: "scene_fields_canal",
    desc: "你曾经治理的地方，旧任成效随交接保留。",
  },
  {
    id: "linhe",
    name: "临河县",
    person: "boatman",
    scene: "scene_river_ferry",
    desc: "沿河运输便利，低洼田多，常需调粮接济。",
  },
  {
    id: "yongning",
    name: "永宁县",
    person: "merchant",
    scene: "scene_market",
    desc: "商贸较旺，仓储较足，账册却有待核之处。",
  },
];
const option = (id, label, desc, cost = {}, effect = {}, special = "") => ({
  id,
  label,
  desc,
  cost,
  effect,
  special,
});
export const PREF_EVENTS = [
  {
    id: "T01",
    week: 0,
    title: "两县争粮额",
    scene: "scene_study_day",
    text: "临河田薄，永宁仓足，两县对原定输粮安排争执不下。知府交你先核实余缺，永久改额仍须另行呈批。",
    options: [
      option(
        "verify",
        "实核后呈请调整",
        "支出12两；两周后获批80石周转粮。",
        { silver: 12, ap: 1 },
        { trust: 3 },
        "aid",
      ),
      option(
        "coordinate",
        "先以现粮协调",
        "按现有调粮权限办事，后续自行安排运输。",
        {},
        { trust: 1 },
      ),
      option(
        "press",
        "照旧催办",
        "催解省事，但临河民生下降8。",
        {},
        { trust: -2 },
        "press",
      ),
    ],
  },
  {
    id: "T02",
    week: 13,
    title: "湿粮抵仓",
    scene: "scene_granary",
    text: "一批新粮含水偏高，收讫前要决定是否晾晒复验。急于入账，损失可能落到以后。",
    options: [
      option(
        "dry",
        "分批晾晒复验",
        "支出18两，避免后续损耗。",
        { silver: 18, ap: 1 },
        { integrity: 3 },
      ),
      option(
        "reject",
        "退回不合格部分",
        "暂缓接收，实际府仓扣除退运粮20石。",
        { grain: 20 },
        { trust: -1 },
      ),
      option(
        "accept",
        "先收讫再说",
        "三周后霉变最多损耗60石，按当时实粮扣除。",
        {},
        { integrity: -5 },
        "mold",
      ),
    ],
  },
  {
    id: "T03",
    week: 26,
    title: "运输损耗异常",
    scene: "scene_river_ferry",
    text: "同一路线的装卸记录与沿途凭据不符。凭据固定显示承运队私售部分粮食，须核对之后才能追究。",
    options: [
      option(
        "inspect",
        "调阅并保全凭据",
        "支出8两，核实承运责任；两周后追缴40石入仓。",
        { silver: 8, ap: 1 },
        { integrity: 4 },
        "recover",
      ),
      option(
        "replace",
        "换队承运，原卷呈查",
        "支出20两，先恢复运输，旧案随卷呈查。",
        { silver: 20 },
        { trust: 2 },
      ),
      option(
        "allow",
        "容许扩大报损",
        "留下包庇责任，任满进入核查。",
        {},
        { integrity: -12 },
        "misconduct",
      ),
    ],
  },
  {
    id: "T04",
    week: 39,
    title: "富县拖解",
    scene: "scene_study_day",
    text: "永宁称修渠占用了应解钱粮，请求调整时限。通判可协调分期，不能自行免除应解义务。",
    options: [
      option(
        "audit",
        "核账并呈报知府",
        "支出10两，核清责任；提高永宁协作5。",
        { silver: 10, ap: 1 },
        { integrity: 3 },
        "cooperate",
      ),
      option(
        "instalment",
        "协调合法分期",
        "先登记未解20石，三周后实际到仓。",
        {},
        { trust: 2 },
        "instalment",
      ),
      option(
        "force",
        "催齐眼前份额",
        "永宁粮转府仓40石，地方民生下降5。",
        {},
        {},
        "force",
      ),
    ],
  },
  {
    id: "T05",
    week: 52,
    title: "河浅船滞",
    scene: "scene_river_ferry",
    text: "枯水令航道受阻。受阻将持续六周，新运次若仍走常路，要多等两周。",
    options: [
      option(
        "relay",
        "修整接驳栈道",
        "支出45两；六周内恢复常路通行。",
        { silver: 45, ap: 1 },
        { trust: 2 },
        "clear",
      ),
      option(
        "report",
        "据实申报延误",
        "不虚报交付；六周内常路运次增加两周，急运不受影响。",
        {},
        { integrity: 2 },
        "blocked",
      ),
    ],
  },
  {
    id: "T06",
    week: 78,
    title: "旧仓新价",
    scene: "scene_granary",
    text: "府仓屋面渗水，材料报价却在上涨。先修险处，可以减少后续霉损。",
    options: [
      option(
        "repair",
        "先修漏雨险处",
        "支出35两，恢复仓况30。",
        { silver: 35, ap: 1 },
        { condition: 30 },
      ),
      option(
        "full",
        "核价后全面修缮",
        "支出70两，恢复仓况60。",
        { silver: 70, ap: 1 },
        { condition: 60, integrity: 2 },
      ),
      option(
        "wait",
        "缓修，登记风险",
        "仓况下降15，低于40后每周损耗府粮5石。",
        {},
        { condition: -15 },
      ),
    ],
  },
  {
    id: "T07",
    week: 104,
    title: "双份收据",
    scene: "scene_study_day",
    text: "一笔粮税出现不同收讫联。原始两联显示同笔已缴，再次追缴将加重纳粮户负担。",
    options: [
      option(
        "compare",
        "对账停止重复追缴",
        "支出6两，临河民生增加6。",
        { silver: 6, ap: 1 },
        { integrity: 4 },
        "correct",
      ),
      option(
        "freeze",
        "停追争议部分，呈请复核",
        "先保护役户，待府里进一步核验。",
        {},
        { trust: 1 },
      ),
      option(
        "collect",
        "只认底簿再追缴",
        "临河转府仓30石，民生下降10，留下重复征收责任。",
        {},
        { integrity: -10 },
        "collect",
      ),
    ],
  },
  {
    id: "T08",
    week: 143,
    title: "缺口如实报",
    scene: "scene_study_day",
    text: "任期将尽，知府要看实存、在途和实际交付。未到货的运次不能写作已入仓。",
    options: [
      option(
        "truth",
        "逐项列明实际缺口",
        "保留原账，按实际运输与地方状况考评。",
        {},
        { integrity: 3, trust: 2 },
      ),
      option(
        "remedy",
        "呈报补救计划",
        "支出15两，二周后获准援粮60石，仍须自行安排送达。",
        { silver: 15, ap: 1 },
        { trust: 3 },
        "remedy",
      ),
      option(
        "inflate",
        "把在途也写成实到",
        "留下虚报责任，运输奖励不会提前结算。",
        {},
        { integrity: -15 },
        "misconduct",
      ),
    ],
  },
];
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));
const round = (n) => Math.round(n * 100) / 100;
export const prefLabel = (p) => termLabel(p.turn, "通判");
function log(p, text) {
  p.logs.unshift({ turn: p.turn, text });
  p.logs = p.logs.slice(0, 300);
}
function cash(p, title, delta, countyId = null) {
  const account = countyId ? p.counties[countyId] : p;
  for (const [k, v] of Object.entries(delta))
    if (
      !["silver", "grain", "private"].includes(k) ||
      !Number.isFinite(v) ||
      !Number.isFinite(account[k]) ||
      account[k] + v < 0
    )
      throw Error("府任账目无效。");
  for (const [k, v] of Object.entries(delta))
    account[k] = round(account[k] + v);
  const row = {
    turn: p.turn,
    title,
    ...delta,
    ...(countyId ? { county: countyId } : {}),
  };
  p.ledger.push(row);
  p.lastLedger.push(row);
}
function reliefFlow(p, county, amount, shipment = null) {
  const r = p.request;
  if (!r || r.county !== county || r.status === "missed" || p.turn > r.due)
    return;
  const rows = p.shipments.filter((x) => x.creditPeriod === r.due);
  const before = r.creditOpening + rows.reduce((n, x) => n + x.credited, 0);
  r.netReceived += amount;
  r.received = Math.max(0, r.netReceived);
  const target = Math.min(r.need, r.received);
  if (target > before && shipment) {
    shipment.creditPeriod = r.due;
    shipment.credited += target - before;
  } else if (target < before) {
    let remove = before - target;
    const opening = Math.min(remove, r.creditOpening);
    r.creditOpening -= opening;
    p.effectiveOpening -= opening;
    remove -= opening;
    for (const x of rows.reverse()) {
      const n = Math.min(remove, x.credited);
      x.credited -= n;
      remove -= n;
    }
  }
  p.effectiveDelivered += target - before;
  if (r.status === "met" && r.received < r.need) {
    r.status = "active";
    p.met--;
    change(p, { trust: -2 });
    if (p.hard) p.counties[r.county].people = clamp(p.counties[r.county].people - 2);
    log(p, `当期受济县再次解出粮食，净接济不足${r.need}石，撤回本项达标及信任奖励。`);
  } else if (r.status === "active" && r.received >= r.need) {
    r.status = "met";
    p.met++;
    change(p, { trust: 2 });
    if (p.hard) p.counties[r.county].people = clamp(p.counties[r.county].people + 2);
    log(p, `${place(p, r.county)}当期净接济达${r.need}石，信任增加2。`);
  }
}
export function migratePrefecture(s) {
  const p = s.prefecture;
  if (!p) return;
  if (p.request) {
    p.request.netReceived ??= p.request.received;
    p.request.creditOpening ??= p.request.status === "met" ? 60 : 0;
  }
  if (Array.isArray(p.ledger) && p.effectiveDelivered !== undefined) return;
  p.assessmentMode = p.finished ? "legacy" : "effective";
  p.effectiveOpening = Math.min(p.delivered, p.met * 60);
  p.effectiveDelivered = p.effectiveOpening;
  p.ledger = [];
  p.lastLedger = [];
  cash(p, "旧府账期初余额（更早流水未留存）", {
    silver: 0,
    grain: 0,
    private: 0,
  });
  Object.assign(p.ledger[0], {
    silver: p.silver,
    grain: p.grain,
    private: p.private,
    opening: true,
  });
  for (const d of COUNTIES) {
    cash(p, d.name + "旧县仓期初余额", { grain: 0 }, d.id);
    Object.assign(p.ledger.at(-1), {
      grain: p.counties[d.id].grain,
      opening: true,
    });
  }
  for (const x of p.shipments) x.credited = 0;
}
function pay(p, cost, title = "府署差事支出") {
  for (const [k, v] of Object.entries(cost))
    if (p[k] < v)
      throw Error(k === "ap" ? "本周精力不足。" : "可用府银或府粮不足。");
  if (cost.ap) p.ap -= cost.ap;
  const delta = Object.fromEntries(
    Object.entries(cost)
      .filter(([k]) => k !== "ap")
      .map(([k, v]) => [k, -v]),
  );
  if (Object.keys(delta).length) cash(p, title, delta);
}
function change(p, e) {
  for (const [k, v] of Object.entries(e))
    p[k] = ["silver", "grain"].includes(k)
      ? Math.max(0, round(p[k] + v))
      : clamp(p[k] + v);
}
function open(p) {
  p.ap = 3;
  p.event = eventAt(p, PREF_EVENTS)?.id || null;
  if (p.turn % 13 === 0) {
    const sorted = COUNTIES.map((d) => p.counties[d.id]).sort(
      (a, b) => a.grain - b.grain,
    );
    const plan = p.hard
      ? prefRequest(p, sorted)
      : { county: sorted[0].id, need: 60, due: Math.min(156, p.turn + 13) };
    p.request = {
      county: plan.county,
      need: plan.need,
      received: 0,
      netReceived: 0,
      creditOpening: 0,
      due: plan.due,
      status: "active",
    };
    log(
      p,
      `${p.counties[plan.county].name}申请调粮${plan.need}石，限${plan.due - p.turn}周内送达。`,
    );
  }
}
export function appoint(s) {
  if (s.prefecture) throw Error("已办理府级任命。");
  if (
    !s.finished ||
    (s.outcome?.rating !== "称职" && !qualified(s, "county")) ||
    s.outcome.misconduct
  )
    throw Error("须知县考满称职且无待查责任，方可进入府级候选任命。");
  s.outcome.choice = "promotion";
  const hard = s.difficulty === "hard",
    startSilver = hard ? OFFICE_HARD.pref.silver : 600,
    startGrain = hard ? OFFICE_HARD.pref.grain : 600;
  s.prefecture = {
    turn: 0,
    finished: false,
    ap: 3,
    silver: startSilver,
    grain: startGrain,
    private: s.private,
    trust: Math.max(40, Math.min(75, s.trust)),
    integrity: s.integrity,
    condition: 85,
    delivered: 0,
    effectiveDelivered: 0,
    effectiveOpening: 0,
    assessmentMode: "effective",
    ledger: [],
    lastLedger: [],
    met: 0,
    missed: 0,
    loss: 0,
    misconduct: false,
    blockedUntil: 0,
    event: null,
    request: null,
    shipments: [],
    pending: [],
    logs: [],
    nextShipment: 1,
    outcome: null,
    countyRecord: {
      score: s.outcome.score,
      rating: s.outcome.rating,
      silver: s.silver,
      grain: s.grain,
      projects: s.projectsCompleted,
      cases: s.wellJudged,
    },
    counties: {
      qinghe: {
        id: "qinghe",
        name: "清河县",
        grain: s.grain,
        people: s.people,
        cooperation: 60,
        discrepancy: 0,
        audited: false,
        lastAudit: -4,
      },
      linhe: {
        id: "linhe",
        name: "临河县",
        grain: 95,
        people: 46,
        cooperation: 45,
        discrepancy: 24,
        audited: false,
        lastAudit: -4,
      },
      yongning: {
        id: "yongning",
        name: "永宁县",
        grain: 300,
        people: 65,
        cooperation: 55,
        discrepancy: 38,
        audited: false,
        lastAudit: -4,
      },
    },
  };
  const p = s.prefecture;
  p.ledger.push({
    turn: 0,
    title: "通判开任核拨及承接私产",
    silver: startSilver,
    grain: startGrain,
    private: p.private,
    opening: true,
  });
  for (const d of COUNTIES)
    p.ledger.push({
      turn: 0,
      title: d.name + "县仓期初实粮",
      grain: p.counties[d.id].grain,
      county: d.id,
      opening: true,
    });
  p.lastLedger = [...p.ledger];
  if (hard) p.hard = prefHard(s.seed, PREF_EVENTS);
  open(s.prefecture);
  log(
    s.prefecture,
    `获授永平府通判，分管粮储与运输。府库核拨官银${startSilver}两、实粮${startGrain}石，前任清河公款全部留县交接。${hard ? "每期调粮数额与期限不一，府款每周核拨较薄。" : ""}`,
  );
}
export function transportTerms(p, route, from = null, to = null) {
  if (!["normal", "urgent"].includes(route)) throw Error("运路无效。");
  const discount = [from, to].some((id) => p.counties[id]?.cooperation >= 60)
    ? 2
    : 0;
  return route === "urgent"
    ? { silver: 18 - discount, weeks: 1 }
    : { silver: 8 - discount, weeks: 3 + (p.blockedUntil > p.turn ? 2 : 0) };
}
export function prefAssessment(p) {
  const life = Object.values(p.counties).reduce((n, c) => n + c.people, 0) / 3;
  const score = p.hard
    ? Math.round(
        blendLife(p, life) * 0.3 +
          blendIntegrity(p) * 0.3 +
          Math.min(100, (p.met / 12) * 100) * 0.25 +
          Math.min(100, (p.effectiveDelivered / Math.max(1, p.hard.needTotal)) * 100) * 0.15,
      )
    : Math.round(
    life * 0.3 +
      p.integrity * 0.3 +
      Math.min(100, (p.met / 12) * 100) * 0.25 +
      Math.min(
        100,
        ((p.assessmentMode === "legacy" ? p.delivered : p.effectiveDelivered) /
          720) *
          100,
      ) *
        0.15,
      );
  return contentAssessment(p, {
    score,
    rating: p.misconduct
      ? "候查"
      : score >= passLine(p)
        ? "称职"
        : score >= 50
          ? "平常"
          : "不称职",
    summary: `运输到货${p.delivered}石，有效接济${p.effectiveDelivered}石，完成调粮要务${p.met}项，未达${p.missed}项。`,
    candidate: !p.misconduct && score >= passLine(p),
  });
}
export function prefectureCommand(s, c) {
  const p = s.prefecture;
  if (!p) throw Error("尚未获授府级职务。");
  if (p.finished) throw Error("通判本任已满。");
  p.lastLedger = [];
  if (c.type === "pref_transfer") {
    const terms = transportTerms(p, c.route, c.from, c.to);
    if (
      !["府仓", ...COUNTIES.map((d) => d.id)].includes(c.from) ||
      !["府仓", ...COUNTIES.map((d) => d.id)].includes(c.to) ||
      c.from === c.to ||
      ![60, 120].includes(c.amount)
    )
      throw Error("调粮安排无效。");
    if (p.turn + terms.weeks > PREF_TERM)
      throw Error("此运次无法在本任结束前到达，请改选急运或停止新调拨。");
    const src = c.from === "府仓" ? p : p.counties[c.from];
    if (src.grain < c.amount) throw Error("起运仓实粮不足；请先核实余粮。");
    pay(p, { silver: terms.silver, ap: 1 }, "第" + p.nextShipment + "运次运费");
    cash(
      p,
      "第" + p.nextShipment + "运次起运",
      { grain: -c.amount },
      c.from === "府仓" ? null : c.from,
    );
    if (c.from !== "府仓") reliefFlow(p, c.from, -c.amount);
    const row = {
      id: p.nextShipment++,
      from: c.from,
      to: c.to,
      amount: c.amount,
      depart: p.turn,
      due: p.turn + terms.weeks,
      status: "transit",
      route: c.route,
      credited: 0,
    };
    p.shipments.push(row);
    log(
      p,
      `${place(p, c.from)}起运${c.amount}石至${place(p, c.to)}，运费${terms.silver}两，${terms.weeks}周后交验。在途粮尚未记入收仓。`,
    );
    return;
  }
  if (c.type === "pref_audit") {
    const d = p.counties[c.county];
    if (!d) throw Error("属县无效。");
    if (p.turn - d.lastAudit < 4) throw Error("同县核账须间隔4周。");
    pay(p, { silver: adminCost(p, 6), ap: 1 }, d.name + "核账差费");
    d.audited = true;
    d.lastAudit = p.turn;
    log(
      p,
      `${d.name}实存${d.grain}石；账面比实粮多记${d.discrepancy}石。${d.discrepancy ? "须督促改正虚记，不把账面数字视为到粮。" : "账实相符。"}`,
    );
    return;
  }
  if (c.type === "pref_rectify") {
    const d = p.counties[c.county];
    if (!d?.audited || d.discrepancy <= 0) throw Error("须先核得实际账差。");
    pay(p, { ap: 1 });
    const gap = d.discrepancy;
    d.discrepancy = 0;
    d.cooperation = clamp(d.cooperation + 6);
    change(p, { integrity: 2, trust: 1 });
    log(p, `${d.name}纠正虚记${gap}石，实存粮不变，地方协作提高6。`);
    return;
  }
  if (c.type === "pref_repair") {
    if (p.condition >= 100) throw Error("府仓无需修缮。");
    pay(p, { silver: 30, ap: 1 }, "府仓修缮");
    change(p, { condition: 25 });
    log(p, "府仓修缮支出30两，仓况恢复25，上限100。");
    return;
  }
  if (c.type === "pref_event") {
    const e = PREF_EVENTS.find((e) => e.id === p.event),
      o = e?.options.find((o) => o.id === c.choice);
    if (!o) throw Error("当前公文或处置无效。");
    pay(p, o.cost, e.title);
    change(p, o.effect);
    const q = (after, kind, amount) =>
      p.pending.push({ due: p.turn + after, kind, amount });
    switch (o.special) {
      case "aid":
        q(2, "援粮实到", 80);
        break;
      case "recover":
        q(2, "追缴粮实到", 40);
        break;
      case "instalment":
        q(3, "分期应解粮实到", 20);
        p.pending.at(-1).from = "yongning";
        break;
      case "remedy":
        q(2, "补救援粮实到", 60);
        break;
      case "mold":
        q(3, "湿粮霉损", -60);
        break;
      case "press":
        p.counties.linhe.people = clamp(p.counties.linhe.people - 8);
        break;
      case "cooperate":
        p.counties.yongning.cooperation = clamp(
          p.counties.yongning.cooperation + 5,
        );
        break;
      case "force":
      case "collect": {
        const d = p.counties[o.special === "force" ? "yongning" : "linhe"],
          amount = Math.min(d.grain, o.special === "force" ? 40 : 30);
        cash(p, e.title + "属县解粮", { grain: -amount }, d.id);
        reliefFlow(p, d.id, -amount);
        cash(p, e.title + "府仓收粮", { grain: amount });
        d.people = clamp(d.people - (o.special === "force" ? 5 : 10));
        if (o.special === "collect") p.misconduct = true;
        break;
      }
      case "clear":
        p.blockedUntil = 0;
        break;
      case "blocked":
        p.blockedUntil = p.turn + (p.hard ? p.hard.blockLength : 6);
        break;
      case "correct":
        p.counties.linhe.people = clamp(p.counties.linhe.people + 6);
        break;
      case "misconduct":
        p.misconduct = true;
        break;
    }
    p.event = null;
    log(p, `${e.title}：${o.label}。${o.desc}`);
    return;
  }
  if (c.type !== "pref_advance") throw Error("府级操作无效。");
  if (p.event) throw Error("请先处理本周府署公文。");
  cash(p, "府署每周核拨", { silver: p.hard ? OFFICE_HARD.pref.allot : 12 });
  cash(p, "府署例费", { silver: -7 });
  cash(p, "俸入与家计净额", { private: 1 + familyAllowance(s) });
  p.condition = clamp(p.condition - 0.35);
  if (p.condition < 40) {
    const loss = Math.min(p.grain, 5);
    cash(p, "府仓失修损耗", { grain: -loss });
    p.loss += loss;
    log(p, `府仓失修，本周实粮损失${loss}石。`);
  }
  for (const d of Object.values(p.counties)) {
    const want = p.hard ? OFFICE_HARD.pref.use[d.id] : 2;
    const used = Math.min(want, d.grain);
    cash(p, d.name + "周转口粮", { grain: -used }, d.id);
    if (used < want) d.people = clamp(d.people - 2);
    else if (p.hard && d.grain < OFFICE_HARD.pref.lowStock)
      d.people = clamp(d.people - 0.1);
    else if (d.grain >= 50 && !p.hard) d.people = clamp(d.people + 0.08);
    if (p.turn % 52 === 38) {
      const lean =
        p.hard &&
        p.hard.lean.county === d.id &&
        p.hard.lean.year === Math.floor(p.turn / 52);
      const kept = lean ? 50 : 100;
      cash(p, d.name + "年度留仓粮", { grain: kept }, d.id);
      log(
        p,
        lean
          ? `${d.name}今年歉收，依法留仓粮只收得${kept}石。`
          : `${d.name}本年依法留仓粮100石已实收。`,
      );
    }
  }
  if (p.hard) {
    officeDrift(p, Object.values(p.counties));
    if (p.turn === p.hard.shoal.week) {
      p.blockedUntil = Math.max(p.blockedUntil, p.turn + p.hard.shoal.length);
      log(
        p,
        `入冬水落，河道又现浅滩，${p.hard.shoal.length}周内常路运次多等两周。`,
      );
    }
  }
  p.turn++;
  for (const x of p.pending.filter((x) => x.due <= p.turn)) {
    const actual = x.from
      ? Math.min(p.counties[x.from].grain, x.amount)
      : x.amount < 0
        ? -Math.min(p.grain, -x.amount)
        : x.amount;
    if (x.from) {
      cash(p, x.kind + "起运县交粮", { grain: -actual }, x.from);
      reliefFlow(p, x.from, -actual);
    }
    cash(p, x.kind, { grain: actual });
    if (actual < 0) p.loss -= actual;
    log(p, `${x.kind}：府仓${actual >= 0 ? "+" : ""}${actual}石。`);
  }
  p.pending = p.pending.filter((x) => x.due > p.turn);
  for (const x of p.shipments.filter(
    (x) => x.status === "transit" && x.due <= p.turn,
  )) {
    const dest = x.to === "府仓" ? p : p.counties[x.to];
    const lost = transitLoss(p, x),
      got = x.amount - lost;
    if (lost) x.lost = lost;
    cash(
      p,
      "第" + x.id + "运次实到",
      { grain: got },
      x.to === "府仓" ? null : x.to,
    );
    x.status = "arrived";
    p.delivered += got;
    if (lost) p.loss += lost;
    if (x.to !== "府仓") {
      dest.cooperation = clamp(dest.cooperation + 2);
      reliefFlow(p, x.to, got, x);
    }
    log(
      p,
      `第${x.id}运次交验：${place(p, x.to)}实收${got}石${lost ? `，沿途霉湿短少${lost}石` : ""}，在途转实仓。`,
    );
  }
  const r = p.request;
  if (r?.status === "active" && r.received >= r.need) {
    r.status = "met";
    p.met++;
    change(p, { trust: 2 });
    if (p.hard) p.counties[r.county].people = clamp(p.counties[r.county].people + 2);
    log(p, `${place(p, r.county)}本阶段调粮已实际送达，信任增加2。`);
  }
  if (r?.status === "active" && p.turn >= r.due) {
    r.status = "missed";
    p.missed++;
    change(p, { trust: -2 });
    if (p.hard) p.counties[r.county].people = clamp(p.counties[r.county].people - 4);
    log(p, "调粮期限届满，未按量到仓，记一次未达；在途粮仍继续运输。");
  }
  if (p.turn === PREF_TERM) {
    p.finished = true;
    p.ap = 0;
    p.outcome = prefAssessment(p);
    log(p, `通判三年考满：${p.outcome.rating}，${p.outcome.score}分。`);
  } else open(p);
}
export const place = (p, id) =>
  id === "府仓" ? "府仓" : p.counties[id]?.name || id;
export function prefectureReceipt(before, after, c) {
  const a = before.prefecture,
    b = after.prefecture;
  const changes = [];
  const add = (name, x, y) => {
    if (x !== y)
      changes.push({ name, before: x, after: y, delta: round(y - x) });
  };
  if (a) {
    for (const [k, name] of Object.entries({
      silver: "府银",
      grain: "府粮",
      private: "私产",
      ap: "精力",
      integrity: "吏治",
      trust: "上级信任",
      condition: "府仓状况",
      delivered: "运输到货",
      effectiveDelivered: "有效接济",
    }))
      add(name, a[k], b[k]);
    for (const d of COUNTIES)
      for (const [k, name] of Object.entries({
        grain: "实粮",
        people: "民生",
        cooperation: "协作",
        discrepancy: "账差",
      }))
        add(d.name + " · " + name, a.counties[d.id][k], b.counties[d.id][k]);
  }
  if (!a) {
    add("新任府银", 0, b.silver);
    add("新任府粮", 0, b.grain);
  }
  const notes =
    c.type === "appointment"
      ? [
          "清河公款留县交接；独立开立府账600两、600石。人物私产原数承接。",
          "获授永平府通判，正六品，分管粮储与运输。",
        ]
      : b.logs
          .filter(
            (x) =>
              !a.logs.some((old) => old.turn === x.turn && old.text === x.text),
          )
          .slice(0, 12)
          .reverse()
          .map((x) => x.text);
  return {
    id: c.id,
    turn: a?.turn || 0,
    chapter: "府任",
    title:
      c.type === "appointment"
        ? "新任命已生效"
        : c.type === "pref_advance"
          ? "府任本周结算"
          : "府署事务回执",
    changes,
    notes,
    policies: [],
    ledger: b.lastLedger,
  };
}
export function validatePrefecture(s) {
  const p = s.prefecture;
  if (p === null) return;
  if (
    !p ||
    !s.finished ||
    (s.outcome?.rating !== "称职" && !qualified(s, "county")) ||
    s.outcome?.choice !== "promotion"
  )
    throw Error("府级任命记录无效。");
  if (
    !Number.isInteger(p.turn) ||
    p.turn < 0 ||
    p.turn > PREF_TERM ||
    p.finished !== (p.turn === PREF_TERM)
  )
    throw Error("府任时间异常。");
  for (const k of [
    "silver",
    "grain",
    "private",
    "ap",
    "trust",
    "integrity",
    "condition",
    "delivered",
    "met",
    "missed",
    "loss",
    "blockedUntil",
    "nextShipment",
  ])
    if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1e9)
      throw Error("府任数值异常。");
  if (
    p.ap > 3 ||
    ["trust", "integrity", "condition"].some((k) => p[k] > 100) ||
    typeof p.misconduct !== "boolean"
  )
    throw Error("府任指标异常。");
  if (
    p.event !== null &&
    !PREF_EVENTS.some((e) => e.id === p.event && eventWeek(p, e) === p.turn)
  )
    throw Error("府署公文异常。");
  for (const k of ["shipments", "pending", "logs"])
    if (!Array.isArray(p[k]) || p[k].length > 2000)
      throw Error("府任记录异常。");
  for (const d of COUNTIES) {
    const x = p.counties?.[d.id];
    if (
      !x ||
      x.id !== d.id ||
      x.name !== d.name ||
      !["grain", "people", "cooperation", "discrepancy", "lastAudit"].every(
        (k) => Number.isFinite(x[k]),
      ) ||
      x.grain < 0 ||
      x.discrepancy < 0 ||
      x.people < 0 ||
      x.people > 100 ||
      x.cooperation < 0 ||
      x.cooperation > 100 ||
      typeof x.audited !== "boolean"
    )
      throw Error("属县记录异常。");
  }
  for (const x of p.shipments) {
    if (
      !Number.isInteger(x.id) ||
      x.id < 1 ||
      x.id >= p.nextShipment ||
      !["府仓", ...COUNTIES.map((d) => d.id)].includes(x.from) ||
      !["府仓", ...COUNTIES.map((d) => d.id)].includes(x.to) ||
      x.from === x.to ||
      ![60, 120].includes(x.amount) ||
      !["transit", "arrived"].includes(x.status) ||
      !Number.isInteger(x.due) ||
      !Number.isInteger(x.depart) ||
      x.due <= x.depart ||
      x.due > 156 ||
      x.depart > p.turn ||
      !["normal", "urgent"].includes(x.route) ||
      (x.status === "transit" && x.due <= p.turn) ||
      (x.status === "arrived" && x.due > p.turn)
    )
      throw Error("运次记录异常。");
  }
  if (new Set(p.shipments.map((x) => x.id)).size !== p.shipments.length)
    throw Error("运次编号重复。");
  for (const x of p.pending)
    if (
      !Number.isInteger(x.due) ||
      x.due <= p.turn ||
      ![-60, 20, 40, 60, 80].includes(x.amount) ||
      typeof x.kind !== "string" ||
      (x.from !== undefined && x.from !== "yongning")
    )
      throw Error("府任在途事务异常。");
  if (
    p.logs.some(
      (x) =>
        !x ||
        typeof x.text !== "string" ||
        !Number.isInteger(x.turn) ||
        x.turn < 0 ||
        x.turn > p.turn,
    )
  )
    throw Error("府任日录异常。");
  const r = p.request;
  if (
    !r ||
    !COUNTIES.some((d) => d.id === r.county) ||
    (p.hard ? !OFFICE_HARD.pref.needs.includes(r.need) : r.need !== 60) ||
    !Number.isFinite(r.received) ||
    r.received < 0 ||
    !Number.isInteger(r.netReceived) ||
    r.received !== Math.max(0, r.netReceived) ||
    !Number.isInteger(r.creditOpening) ||
    r.creditOpening < 0 ||
    r.creditOpening > r.need ||
    !Number.isInteger(r.due) ||
    r.due > 156 ||
    !["active", "met", "missed"].includes(r.status)
  )
    throw Error("调粮要务异常。");
  if (
    !p.countyRecord ||
    p.countyRecord.silver !== s.silver ||
    p.countyRecord.grain !== s.grain
  )
    throw Error("交接记录异常。");
  if (
    !["effective", "legacy"].includes(p.assessmentMode) ||
    !Number.isInteger(p.effectiveOpening) ||
    p.effectiveOpening < 0 ||
    !Number.isInteger(p.effectiveDelivered) ||
    p.effectiveDelivered < 0 ||
    p.effectiveDelivered > (p.hard ? p.hard.needTotal : 720) ||
    p.effectiveDelivered !==
      p.effectiveOpening + p.shipments.reduce((n, x) => n + x.credited, 0) ||
    p.shipments.some(
      (x) =>
        !Number.isInteger(x.credited) ||
        x.credited < 0 ||
        x.credited > (p.hard ? x.amount : Math.min(60, x.amount)) ||
        (x.lost !== undefined && (!p.hard || !Number.isInteger(x.lost) || x.lost < 0 || x.lost > x.amount)) ||
        (x.status === "transit" && x.credited !== 0),
    )
  )
    throw Error("有效接济记录异常。");
  for (const key of ["ledger", "lastLedger"])
    if (
      !Array.isArray(p[key]) ||
      p[key].length > 5000 ||
      p[key].some(
        (l) =>
          !Number.isInteger(l.turn) ||
          l.turn < 0 ||
          l.turn > p.turn ||
          typeof l.title !== "string" ||
          (l.county && !p.counties[l.county]) ||
          ["silver", "grain", "private"].some(
            (k) => l[k] !== undefined && !Number.isFinite(l[k]),
          ),
      )
    )
      throw Error("府任流水异常。");
  for (const key of ["silver", "grain", "private"])
    if (
      Math.abs(
        round(
          p.ledger
            .filter((l) => !l.county)
            .reduce((n, l) => n + (l[key] || 0), 0),
        ) - p[key],
      ) > 0.01
    )
      throw Error("府仓账目与余额不符。");
  for (const d of COUNTIES)
    if (
      Math.abs(
        round(
          p.ledger
            .filter((l) => l.county === d.id)
            .reduce((n, l) => n + (l.grain || 0), 0),
        ) - p.counties[d.id].grain,
      ) > 0.01
    )
      throw Error("县仓账目与余额不符。");
  validateOfficeHard(p);
  if (p.finished) p.outcome = prefAssessment(p);
}

for (const event of PREF_EVENTS) event.text = MAINLINE_TEXT[event.id] ?? event.text;
