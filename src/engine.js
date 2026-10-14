import {
  countyCase,
  chooseCaseVariant,
  CASE_VARIANTS,
} from "./case-content.js";
import { countyDuties } from "./county-duties.js";
import {
  AFFAIRS,
  blankAffairs,
  nextAffair,
  resolveAffair,
  skipAffair,
  settleAffairs,
  validateAffairs,
} from "./county-affairs.js";
import { selectCountyMail } from "./mail-content.js";
import {
  projectBenefit,
  actionUsable,
  actionDescription,
  applyActionContext,
  reliefMove,
} from "./county-rules.js";
import {
  countyEvent,
  STAFF_PROFILES,
  staffWorkBonus,
  familyRecovery,
} from "./county-content.js";
import {
  blankAccountability,
  trackAccountability,
  migrateAccountability,
  accountabilityCommand,
  accountabilityReceipt,
  validateAccountability,
  qualified,
  hasActiveReview,
  ensureReview,
} from "./accountability.js";
import {
  appointZhifu,
  zhifuCommand,
  zhifuReceipt,
  validateZhifu,
} from "./zhifu.js";
import {
  appointTongzhi,
  tongzhiCommand,
  tongzhiReceipt,
  validateTongzhi,
} from "./tongzhi.js";
import { migratePrefecture } from "./prefecture.js";
import {
  isHard,
  blankHard,
  mainEvent,
  canPrepare,
  preparation,
  droughtScale,
  droughtNeed,
  floodSeverity,
  recordDisaster,
  hardResolveEvent,
  hardWeek,
  harvestFactor,
  afterHarvest,
  staffFactor,
  householdCost,
  weeklyAp,
  hardCommand,
  caseSettlement,
  weakJudgment,
  hardScores,
  validateHard,
  HARD,
} from "./county-hard.js";
import { termLabel, requireTime } from "./rules.js";
import {
  appoint,
  prefectureCommand,
  prefectureReceipt,
  validatePrefecture,
} from "./prefecture.js";
import {
  initializeGovernance,
  governanceCommand,
  applyPolicyWeek,
  settleGovernance,
  regionalEvent,
  regionalProject,
  constructionSpeed,
  commerceBonus,
  districtIncomeFactor,
  applyLocalChange,
  executionPenalty,
  validateGovernance,
  DISTRICTS,
  LOCAL_METRICS,
} from "./governance.js";
import {
  FAMILIES,
  PROJECTS,
  CASES,
  EVENTS,
  ACTIONS,
  EVENT_WEEKS,
  EXTRA_WEEKS,
  TERM_WEEKS,
  WEEKS_PER_YEAR,
  WEEKS_PER_SEASON,
} from "./data.js";
export const VERSION = 11;
const clone = (x) => structuredClone(x),
  clamp = (x, min = 0, max = 100) => Math.max(min, Math.min(max, x));
export const seasonIndex = (turn) =>
  Math.floor(Math.min(turn, TERM_WEEKS - 1) / WEEKS_PER_SEASON) % 4;
export const weekLabel = (turn) => termLabel(turn);
export const label = (s) =>
  s.finished ? "三年任满" : `入仕${weekLabel(s.turn)}`;
const weekly = (e) =>
  Object.fromEntries(
    Object.entries(e).map(([k, v]) => [
      k,
      k === "fatigue" ? v : v / WEEKS_PER_SEASON,
    ]),
  );
function log(s, title, text, kind = "normal") {
  s.logs.unshift({ id: `l${s.nextLog++}`, turn: s.turn, title, text, kind });
}
function ledger(s, title, delta) {
  let entries = {};
  for (const [k, v] of Object.entries(delta || {})) {
    if (typeof v !== "number" || !Number.isFinite(v)) throw Error("无效账目");
    if (["silver", "grain", "private"].includes(k)) {
      s[k] = Math.round((s[k] + v) * 100) / 100;
      entries[k] = v;
    } else if (
      [
        "people",
        "economy",
        "order",
        "integrity",
        "trust",
        "education",
        "family",
        "fatigue",
      ].includes(k)
    )
      s[k] = Math.round(clamp(s[k] + v) * 10000) / 10000;
  }
  if (Object.keys(entries).length)
    s.ledger.unshift({
      id: `b${s.nextLedger++}`,
      turn: s.turn,
      title,
      ...entries,
    });
}
const weeklyPortion = (amount, turn) =>
  (Math.round((amount * 100 * ((turn % 13) + 1)) / 13) -
    Math.round((amount * 100 * (turn % 13)) / 13)) /
  100;
function pay(s, cost = {}) {
  for (const [k, v] of Object.entries(cost)) {
    if (v < 0 || !Number.isFinite(v) || typeof s[k] !== "number" || s[k] < v)
      throw Error(
        k === "ap"
          ? "本周督办精力不足。"
          : `可用${{ silver: "官银", grain: "仓粮", private: "私产" }[k] || k}不足。`,
      );
  }
  let delta = {};
  for (const [k, v] of Object.entries(cost)) {
    if (k === "ap") s.ap -= v;
    else delta[k] = -v;
  }
  return delta;
}
export function affordability(s, cost = {}) {
  for (const [k, v] of Object.entries(cost))
    if (s[k] < v)
      return k === "ap"
        ? "精力不足"
        : `${{ silver: "官银", grain: "仓粮", private: "私产" }[k]}不足`;
  return "";
}
export function projectActive(s, id) {
  return s.projects.some(
    (p) => p.id === id && p.status === "complete" && p.condition > 0,
  );
}
function queue(s, id, mandatory = false) {
  if (
    (!id.startsWith("W") && s.doneEvents.includes(id)) ||
    s.events.some((x) => x.id === id)
  )
    return;
  s.events.push({ id, mandatory });
}
function openWeek(s) {
  s.ap = weeklyAp(s);
  s.overworked = false;
  s.actions = [];
  s.events = [];
  s.relievedThisTurn = false;
  const main = mainEvent(s);
  if (main === "X13" && s.displaced === 0) {
    queue(s, "G06", true);
  } else if (main) queue(s, main, true);
  // 劳瘁来信只在确有疲劳时送到，免得出现三项一样的空抉择。
  if (EXTRA_WEEKS[s.turn] && !(EXTRA_WEEKS[s.turn] === "G05" && s.fatigue < 10))
    queue(s, EXTRA_WEEKS[s.turn]);
  if (!main) {
    const mail = selectCountyMail(s);
    if (mail) {
      queue(s, mail.id);
      s.events.at(-1).contentKey = mail.key;
      s.contentSeen[mail.key] = true;
    }
    const affair = nextAffair(s);
    if (affair && s.events.length < 2) {
      queue(s, affair);
      s.countyAffairs.retired[affair] = true;
    }
  }
  for (const c of CASES)
    if (s.turn >= c.open && !s.cases[c.id]) {
      s.cases[c.id] = {
        id: c.id,
        variant: chooseCaseVariant(s.seed, c.id),
        opened: s.turn,
        clues: [],
        status: "open",
        truth: "fixed-v1",
        judgment: null,
        due: null,
        result: null,
      };
      log(s, "新案入牍", `${countyCase(s, c.id).name}已立卷。可在案牍中逐项调查。`, "case");
    }
  log(s, "本周开衙", `${label(s)}。先看本周要事，再安排工程与调查。`);
}
export function createGame({
  name = "沈知行",
  family = "humble",
  appearance = "player_a",
  seed = 314159,
  difficulty = "hard",
} = {}) {
  const hard = difficulty !== "standard";
  const f = Object.hasOwn(FAMILIES, family)
    ? FAMILIES[family]
    : FAMILIES.humble;
  const s = {
    version: VERSION,
    difficulty: hard ? "hard" : "standard",
    hard: null,
    countyRules: "current",
    countyPacing: "current",
    countyAffairs: blankAffairs(),
    routines: {},
    contentSeen: {},
    populationLedger: { opening: 0, arrived: 0, settled: 0, shortage: 0 },
    accountability: blankAccountability(),
    zhifu: null,
    tongzhi: null,
    prefecture: null,
    revision: 0,
    seed: Number.isInteger(seed) ? seed : 314159,
    name: String(name).trim().slice(0, 12) || "沈知行",
    familyId: Object.hasOwn(FAMILIES, family) ? family : "humble",
    appearance: ["player_a", "player_b", "player_c"].includes(appearance)
      ? appearance
      : "player_a",
    turn: 0,
    finished: false,
    ap: 3,
    silver: hard ? HARD.silver : 900,
    grain: hard ? HARD.grain : 800,
    private: f.private,
    people: f.people,
    economy: 48,
    order: 54,
    integrity: f.integrity,
    trust: 50,
    education: 40,
    family: 65,
    fatigue: 0,
    population: 4800,
    displaced: 0,
    grainPrice: 1,
    projects: [],
    cases: {},
    events: [],
    doneEvents: [],
    flags: {},
    pending: [],
    actions: [],
    staffAssignments: {},
    patrol: 0,
    actionsTotal: 0,
    projectsCompleted: 0,
    wellJudged: 0,
    badJudged: 0,
    avoidableLoss: 0,
    logs: [],
    ledger: [],
    history: [],
    completedCommands: [],
    nextLog: 1,
    nextLedger: 1,
    outcome: null,
    base: { people: f.people, economy: 48, order: 54, integrity: f.integrity },
  };
  if (hard) s.hard = blankHard(s.seed);
  initializeGovernance(s);
  openWeek(s);
  log(
    s,
    "履任清河",
    `${s.name}，二十六岁，进士出身，外授清河县知县。可用官银${s.silver}两，实存粮${s.grain}石。`,
  );
  return s;
}
function effect(s, e) {
  ledger(s, "处置结果", e);
}
function schedule(s, after, kind, payload) {
  s.pending.push({ due: s.turn + after, kind, payload });
}
function resolveEvent(s, id, choice) {
  const row = s.events.find((e) => e.id === id);
  if (!row) throw Error("此事项已处理或尚未发生。");
  const def = countyEvent(s, id),
    o = def?.options.find((x) => x.id === choice);
  if (!o) throw Error("无效处置。");
  const delta = pay(s, o.cost);
  ledger(s, def.title, delta);
  effect(s, o.effect);
  Object.assign(s.flags, o.flags);
  if (o.flags.grainPrice) s.grainPrice = o.flags.grainPrice;
  s.events = s.events.filter((x) => x.id !== id);
  s.doneEvents.push(id);
  if (id.startsWith("W"))
    s.routines[id] = {
      count: (s.routines[id]?.count || 0) + 1,
      lastChoice: choice,
      lastTurn: s.turn,
      by: "player",
    };
  s.actionsTotal++;
  if (AFFAIRS[id]) resolveAffair(s, id, choice, { log });
  let extra = "";
  if (id === "X04") {
    s.flags.reliefCamp = true;
    s.flags.drought = true;
    const k = droughtScale(s),
      need = isHard(s) ? droughtNeed(s) : 360;
    reliefMove(
      s,
      Math.round(
        (choice === "minimal" ? 160 : choice === "petition" ? 280 : 40) * k,
      ),
    );
    s.flags.reliefHouseholds = Math.round(
      (choice === "minimal" ? 100 : choice === "petition" ? 0 : 300) * k,
    );
    if (choice === "request")
      schedule(s, 2, "aid", { grain: isHard(s) ? Math.round(need / 3) : 180 });
    if (choice === "buy") schedule(s, 1, "purchase", { grain: need });
    if (choice === "petition")
      schedule(s, 2, "aid", { grain: isHard(s) ? Math.round(need / 3) : 160 });
    const canal = projectBenefit(s, "canal");
    effect(s, { economy: -3 + 6 * canal });
    extra = canal
      ? `南渠按养护状况发挥${Math.round(canal * 100)}%抗旱效力。`
      : "支渠尚未形成抗旱效力，春旱影响收成。";
  }
  if (id === "X12" || id === "H12") {
    const defended = projectBenefit(s, "embankment");
    const prep = Math.min(preparation(s), 3);
    const severity = Math.ceil(
      Math.max(
        0,
        floodSeverity(s, id) -
          defended * 10 -
          prep * 2 -
          (choice === "evacuate" ? 5 : choice === "protect" ? 2 : 0),
      ),
    );
    effect(s, { economy: -severity, people: -Math.ceil(severity / 2) });
    reliefMove(s, severity * 9);
    s.avoidableLoss += severity;
    s.flags.floodResolved = true;
    s.flags.reliefCamp = s.displaced > 0 || !!s.flags.reliefCamp;
    extra = `东堤防护按现有状况折算${Math.round(defended * 100)}%；此前巡查${prep}次，本次新增待安置${severity * 9}人。`;
    log(s, "汛情结算", extra, "warning");
  }
  recordDisaster(s, id, choice);
  const hardNote = isHard(s)
    ? hardResolveEvent(s, id, choice, { effect, log, schedule, reliefMove })
    : "";
  if (hardNote) extra = extra ? `${extra} ${hardNote}` : hardNote;
  if (o.flags.settle) schedule(s, 4, "settlement", {});
  if (o.flags.publicDonation)
    log(s, "捐输入公账", "六十两已记入官库，不增加私人家资。");
  if (id === "X13" && o.flags.healthCare) reliefMove(s, -110);
  if (id === "G07" && o.flags.responded) {
    if (s.flags.bribe || s.flags.concealed) {
      effect(s, { trust: -7 });
      extra = "账证显示本任确有待查事项，不能以说明代替查核。";
    } else {
      effect(s, { trust: 4 });
      extra = "原始账目相符，指控中的不实部分已有依据澄清。";
    }
  }
  regionalEvent(s, id, choice);
  log(
    s,
    def.title,
    `${o.label}。${o.desc}${extra ? " " + extra : ""}`,
    "decision",
  );
}
function resolvePending(s) {
  let due = s.pending.filter((p) => p.due <= s.turn);
  s.pending = s.pending.filter((p) => p.due > s.turn);
  for (const p of due) {
    if (p.kind === "aid") {
      ledger(s, "府仓协济实到", { grain: p.payload.grain });
      log(
        s,
        "协济粮到仓",
        `${p.payload.grain}石实粮已经抵达，现可使用。`,
        "gain",
      );
    }
    if (p.kind === "purchase") {
      ledger(s, "购粮到货并发放", { grain: p.payload.grain });
      ledger(s, "登记人口领取口粮", { grain: -p.payload.grain });
      reliefMove(s, -40);
      log(
        s,
        "购粮送抵赈场",
        `${p.payload.grain}石按登记发放；收货和发放分别入账。`,
        "gain",
      );
    }
    if (p.kind === "buy") {
      ledger(s, "籴粮到仓", { grain: p.payload.grain });
      log(s, "籴粮到仓", `${p.payload.grain}石已经入仓。`, "gain");
    }
    if (p.kind === "settlement") {
      effect(s, { economy: 5, people: 2 });
      reliefMove(s, -80);
      log(
        s,
        "荒田复耕有了回音",
        "先行安置的家庭开始耕作，商农景气提高，待安置人数下降。",
        "gain",
      );
    }
    if (p.kind === "case") {
      const c = s.cases[p.payload.id];
      if (!c || c.status !== "review") continue;
      const def = countyCase(s, c.id);
      if (c.judgment === "good" && c.weak !== false) {
        delete c.weak;
        c.status = "closed";
        c.result = "复核认可，待落实执行";
        s.wellJudged++;
        effect(s, { people: 3, integrity: 2, trust: 2 });
        log(
          s,
          "案卷获准结案",
          `${def.name}：证据与结论相符，须安排执行并查验结果。`,
          "gain",
        );
      } else {
        const weak = c.weak === false;
        delete c.weak;
        c.status = "returned";
        c.result = weak ? "证据不足，退回补查" : "退回补查";
        s.badJudged++;
        effect(s, { people: -4, trust: -3 });
        log(
          s,
          "案卷退回",
          weak
            ? `${def.name}：结论或许不错，但证据链未齐，复核不予认可，须补查后重新提交。`
            : `${def.name}：关键证据不足，须补查后重新提交。`,
          "warning",
        );
      }
    }
  }
  settleAffairs(s, { log, local: applyLocalChange, effect });
}
function assess(s) {
  let judicial = clamp(
    55 +
      s.wellJudged * 9 -
      s.badJudged * 10 -
      executionPenalty(s) -
      Object.values(s.cases).filter((c) => c.status !== "closed").length * 3,
  );
  let scores = isHard(s) ? hardScores(s, { executionPenalty }) : {
    people: clamp(
      60 + (s.people - s.base.people) * 1.2 - s.avoidableLoss * 0.25,
    ),
    finance: clamp(
      60 + (s.economy - s.base.economy) + Math.min(s.silver / 80, 12),
    ),
    judicial,
    integrity: s.integrity,
    mission: clamp(
      40 +
        s.projectsCompleted * 10 +
        (s.flags.relief ? 10 : 0) +
        (s.flags.floodResolved ? 10 : 0) +
        (s.flags.handoverFinal ? 5 : 0) +
        (s.countyRules === "current"
          ? Math.min(6, Math.max(0, (s.education - 40) / 5))
          : 0) +
        Math.min(12, s.governance.mandatesMet * 2) -
        Math.min(6, s.governance.mandatesMissed),
    ),
  };
  let score = Math.round(
    scores.people * 0.25 +
      scores.finance * 0.25 +
      scores.judicial * 0.2 +
      scores.integrity * (isHard(s) ? 0.15 : 0.2) +
      scores.mission * (isHard(s) ? 0.15 : 0.1),
  );
  let misconduct = !!(s.flags.bribe || s.flags.concealed || s.flags.destroyed);
  const duties = countyDuties(s);
  let rating = misconduct
    ? "候查"
    : score >= 75 && duties.length === 0
      ? "称职"
      : score >= 55
        ? "平常"
        : "不称职";
  let title = misconduct
    ? "先理清这一任的账"
    : duties.length && score >= 75
      ? "先完成积案与执行复查"
      : rating === "称职"
        ? "一方有治，候选新任"
        : rating === "平常"
          ? "留任清河，再修其政"
          : "整顿未竟，待议任用";
  let routes = misconduct
    ? [
        {
          id: "investigation",
          name: "据实接受核查",
          desc: "查核、申辩和复核将在考课附卷中办理。",
        },
      ]
    : rating === "称职"
      ? [
          {
            id: "promotion",
            name: "候选府通判",
            desc: "钱粮与协调履历进入府级候选名册，可办理分管粮运通判任命。",
          },
          {
            id: "remain",
            name: "登记留任意愿",
            desc: "仅登记任用建议，本局暂不重开三年县任。",
          },
        ]
      : [
          {
            id: "remain",
            name: "登记改进意愿",
            desc: "保留本任得失，形成下一阶段的任用建议。",
          },
        ];
  return {
    score,
    scores,
    rating,
    title,
    routes,
    choice: null,
    misconduct,
    duties,
    summary: `完成工程${s.projectsCompleted}项，复核结案${s.wellJudged}件，现存官银${Math.round(s.silver)}两、粮${Math.round(s.grain)}石。${duties.length ? `尚有${duties.length}宗案卷未完成查证与执行，须在考课附卷补查并核准移交。` : ""}`,
  };
}
function advance(s) {
  if (s.events.some((e) => e.mandatory))
    throw Error("请先处理本周要事；额外来信可留待记录。");
  for (const e of s.events) {
    if (AFFAIRS[e.id]) skipAffair(s, e.id);
    if (e.id.startsWith("W")) {
      const option = EVENTS[e.id].options.find(
        (o) => !Object.keys(o.cost).length,
      );
      s.routines[e.id] = {
        count: (s.routines[e.id]?.count || 0) + 1,
        lastChoice: option.id,
        lastTurn: s.turn,
        by: "staff",
      };
    }
    log(
      s,
      "交属员循例办理",
      `${countyEvent(s, e.id).title}留入任职记录，由属员按常例处理。`,
    );
  }
  s.events = [];
  applyPolicyWeek(s, { ledger, pay, log, effect });
  for (const [id, task] of Object.entries(s.staffAssignments)) {
    const efficiency =
      (STAFF_PROFILES[id]?.tasks[task] ?? 1) * staffFactor(s);
    if (task === "ledger") effect(s, weekly({ integrity: efficiency }));
    if (task === "patrol") effect(s, weekly({ order: efficiency }));
    if (task === "care") effect(s, weekly({ people: efficiency }));
    if (task === "works")
      for (const p of s.projects)
        if (p.status === "building") p.bonus = staffWorkBonus(s, p.id);
  }
  const income = Math.max(
    0,
    Math.round(
      (((86 + s.economy * 0.7 + 25 * projectBenefit(s, "road")) / 13) *
        districtIncomeFactor(s) +
        commerceBonus(s)) *
        100,
    ) / 100,
  );
  const upkeep = s.projects
    .filter((p) => p.status === "complete" && p.condition > 0)
    .reduce(
      (n, p) => n + (PROJECTS.find((x) => x.id === p.id)?.upkeep || 0),
      0,
    );
  const expenses = Math.round(((75 + upkeep) / 13) * 100) / 100;
  if ((s.turn + 1) % 13 === 0 && !isHard(s))
    s.ledger.unshift({
      id: `b${s.nextLedger++}`,
      turn: s.turn,
      title: "按额上解钱粮（过账）",
      silver: 0,
      grain: 0,
      note: "本周按额上解180两；未列入可支配收入，不重复扣除。",
    });
  ledger(s, "本周合法可用收入", { silver: income });
  if (s.silver >= expenses) {
    ledger(s, "例行公费与项目维护", { silver: -expenses });
  } else {
    const paid = s.silver;
    ledger(s, "公费仅支付可用部分", { silver: -paid });
    effect(s, weekly({ order: -5 }));
    s.flags.arrears = (s.flags.arrears || 0) + expenses - paid;
    log(s, "公费出现欠付", `尚欠${expenses - paid}两，已记录，`, "warning");
  }
  ledger(s, "俸禄入私账", { private: weeklyPortion(18, s.turn) });
  ledger(s, "家庭与幕友例行支出", {
    private: -Math.min(s.private, weeklyPortion(householdCost(s), s.turn)),
  });
  for (const p of s.projects) {
    if (p.status === "building") {
      p.remaining = Math.max(
        0,
        Math.round(
          (p.remaining -
            (1 + (typeof p.bonus === "number" ? p.bonus : p.bonus ? 1 : 0)) *
              constructionSpeed(s)) *
            10000,
        ) / 10000,
      );
      delete p.bonus;
      if (p.remaining === 0) {
        p.status = "complete";
        p.condition = 100;
        p.completedAt = s.turn;
        s.projectsCompleted++;
        regionalProject(s, p.id);
        effect(s, { trust: 2, education: p.id === "school" ? 8 : 0 });
        log(
          s,
          "工程验收完毕",
          `${PROJECTS.find((x) => x.id === p.id).name}已完工。收益按下一适用生产环节生效。`,
          "gain",
        );
      }
    } else if (p.status === "complete") {
      p.condition = Math.max(
        0,
        Math.round((p.condition - (s.flags.arrears ? 15 / 13 : 0.08)) * 100) /
          100,
      );
    }
  }
  if (s.turn % WEEKS_PER_YEAR === 38) {
    const harvest = Math.round(
      (220 + s.economy * 2 + 120 * projectBenefit(s, "canal")) *
        harvestFactor(s),
    );
    afterHarvest(s);
    ledger(s, "秋收后依法入仓", { grain: harvest });
    log(
      s,
      "秋收回报",
      `本周依法入仓${harvest}石。${projectActive(s, "canal") ? `南渠按状况增收入仓${Math.round(120 * projectBenefit(s, "canal"))}石。` : "农户与市场的收成不全部计入官仓。"}`,
      "gain",
    );
  }
  if (s.displaced > 0) {
    const demand = Math.min(90, Math.ceil((s.displaced * 0.3) / 13));
    const used = Math.min(demand, s.grain);
    ledger(s, "后续临时安置口粮", { grain: -used });
    if (used < demand) {
      s.populationLedger.shortage =
        Math.round((s.populationLedger.shortage + demand - used) * 100) / 100;
      effect(s, weekly({ people: -3 }));
      log(
        s,
        "善后口粮不足",
        `应供${demand}石、实供${used}石；人数仍待核验，不因断粮减少。`,
        "warning",
      );
    } else {
      const settled = -reliefMove(s, -2);
      log(
        s,
        "常例善后回访",
        `口粮足额，回访核验${settled}人恢复生计；仍有${s.displaced}人待安置。`,
      );
    }
  }
  s.fatigue = clamp(
    s.fatigue + (s.overworked ? 10 : 0) - 3 - familyRecovery(s),
  );
  hardWeek(s, { ledger, log, effect });
  s.history.push({
    integrity: s.integrity,
    turn: s.turn,
    silver: s.silver,
    grain: s.grain,
    people: s.people,
    economy: s.economy,
    order: s.order,
  });
  if (s.turn === TERM_WEEKS - 1) {
    s.turn = TERM_WEEKS;
    resolvePending(s);
    settleGovernance(s, { ledger, pay, log, effect });
    s.finished = true;
    s.outcome = assess(s);
    log(
      s,
      "三年考满",
      `${s.outcome.rating}，评议${s.outcome.score}分。${s.outcome.summary}`,
      "gain",
    );
    return;
  }
  s.turn++;
  resolvePending(s);
  settleGovernance(s, { ledger, pay, log, effect });
  openWeek(s);
}
export function dispatch(state, command) {
  if (!state || state.version !== VERSION || !command?.id)
    throw Error("存档版本或操作编号无效。");
  if (state.completedCommands.includes(command.id)) return state;
  if (command.type?.startsWith("ac_")) {
    const n = clone(state);
    accountabilityCommand(n, command);
    n.receipts.unshift(accountabilityReceipt(state, n, command));
    n.receipts = n.receipts.slice(0, 24);
    n.revision++;
    n.completedCommands.push(command.id);
    n.completedCommands = n.completedCommands.slice(-1500);
    return n;
  }
  if (
    hasActiveReview(state) &&
    !(
      command.type === "ending" &&
      ["notice", "inquiry"].includes(state.accountability.current.status)
    )
  )
    throw Error("当前须先办理考课或处分附卷，不能绕过程序升任。");
  const n = coreDispatch(state, command);
  trackAccountability(state, n, command);
  return n;
}
function coreDispatch(state, command) {
  if (!state || state.version !== VERSION) throw Error("存档版本不兼容。");
  if (!command.id) throw Error("操作缺少编号。");
  if (state.completedCommands.includes(command.id)) return state;
  if (command.type.startsWith("zf_")) {
    const n = clone(state);
    if (command.type === "zf_appoint") appointZhifu(n);
    else zhifuCommand(n, command);
    n.receipts.unshift(zhifuReceipt(state, n, command));
    n.receipts = n.receipts.slice(0, 24);
    n.revision++;
    n.completedCommands.push(command.id);
    n.completedCommands = n.completedCommands.slice(-1500);
    return n;
  }
  if (state.zhifu) throw Error("同知本任已交接，请办理知府事务。");
  if (command.type.startsWith("tz_")) {
    const n = clone(state);
    if (command.type === "tz_appoint") appointTongzhi(n);
    else tongzhiCommand(n, command);
    n.receipts.unshift(tongzhiReceipt(state, n, command));
    n.receipts = n.receipts.slice(0, 24);
    n.revision++;
    n.completedCommands.push(command.id);
    n.completedCommands = n.completedCommands.slice(-1500);
    return n;
  }
  if (state.tongzhi) throw Error("通判本任已交接，请办理同知事务。");
  if (command.type === "appointment" || command.type.startsWith("pref_")) {
    const n = clone(state);
    if (command.type === "appointment") appoint(n);
    else prefectureCommand(n, command);
    n.receipts.unshift(prefectureReceipt(state, n, command));
    n.receipts = n.receipts.slice(0, 24);
    n.revision++;
    n.completedCommands.push(command.id);
    n.completedCommands = n.completedCommands.slice(-1500);
    return n;
  }
  if (state.prefecture) throw Error("县任已交接，请在府署办理当前事务。");
  if (state.finished && command.type !== "ending")
    throw Error("这一任已经结束。");
  const s = clone(state);
  switch (command.type) {
    case "policy":
    case "district":
    case "enforce":
    case "arrears":
    case "repair":
      governanceCommand(s, command, { ledger, pay, log, effect });
      break;
    case "event":
      resolveEvent(s, command.event, command.choice);
      break;
    case "action": {
      const a = ACTIONS.find((x) => x.id === command.action);
      if (!a) throw Error("未知事务。");
      if (s.actions.includes(a.id)) throw Error("本周已督办此事务。");
      if (!actionUsable(s, a))
        throw Error("该项已无新增收益，请安排其他待办。");
      ledger(s, a.name, pay(s, a.cost));
      effect(s, weekly(a.effect));
      applyActionContext(s, a, log);
      s.actions.push(a.id);
      s.actionsTotal++;
      if (a.id === "patrol" && canPrepare(s)) {
        if (isHard(s)) s.hard.prep++;
        if (s.patrol < 3) s.patrol++;
      }
      log(s, a.name, actionDescription(state, a), "decision");
      break;
    }
    case "project": {
      const p = PROJECTS.find((x) => x.id === command.project);
      if (!p) throw Error("未知工程。");
      if (s.projects.some((x) => x.id === p.id)) throw Error("工程已经立项。");
      ledger(s, p.name, pay(s, { silver: p.cost, ap: 1 }));
      s.projects.push({
        id: p.id,
        status: "building",
        remaining: p.duration,
        condition: 0,
        started: s.turn,
      });
      log(
        s,
        "工程立项",
        `${p.name}支出${p.cost}两，预计${p.duration}周完工。`,
        "decision",
      );
      break;
    }
    case "investigate": {
      const c = s.cases[command.case],
        def = countyCase(s, command.case);
      const clue = def?.clues.find((x) => x.id === command.clue);
      if (!c || !clue || !["open", "returned"].includes(c.status))
        throw Error("此案当前不能调查。");
      if (c.clues.includes(clue.id)) throw Error("这项证据已核实。");
      pay(s, { ap: 1 });
      c.clues.push(clue.id);
      log(s, `${def.name} · ${clue.name}`, clue.text, "case");
      break;
    }
    case "judge": {
      const c = s.cases[command.case],
        def = countyCase(s, command.case);
      if (!c || !["open", "returned"].includes(c.status))
        throw Error("此案已提交。");
      if (!["good", "bad", "defer", "settle"].includes(command.choice))
        throw Error("无效拟判。");
      if (command.choice === "settle") {
        caseSettlement(s, c.id, { log, effect });
        break;
      }
      if (command.choice === "defer") {
        if (c.deferred === s.turn) throw Error("本周已登记继续调查。");
        c.deferred = s.turn;
        log(s, def.name, "继续调查，不为结案数量草率定论。", "case");
        break;
      }
      if (
        command.choice !== "defer" &&
        (isHard(s) ? c.clues.length < 1 : command.choice === "good" && c.clues.length < def.clues.length)
      )
        throw Error(isHard(s) ? "至少核实一项线索后才能拟判。" : "独立证据尚未齐备，先调查或暂缓。");
      requireTime(s.turn, 4);
      if (command.choice === "good") {
        const weak = weakJudgment(s, c.id, c.clues.length, def.clues.length);
        if (weak !== null) c.weak = weak;
      }
      c.judgment = command.choice;
      c.status = "review";
      c.due = s.turn + 2;
      c.result = "已呈复核";
      schedule(s, 2, "case", { id: c.id });
      log(
        s,
        def.name,
        command.choice === "good" ? def.goodText : def.badText,
        "case",
      );
      break;
    }
    case "staff": {
      if (
        !["deputy", "dianshi", "clerk", "captain", "advisor"].includes(
          command.person,
        ) ||
        !["", "ledger", "patrol", "care", "works"].includes(command.task)
      )
        throw Error("无法安排这项任务。");
      if (
        command.task &&
        !Object.hasOwn(STAFF_PROFILES[command.person].tasks, command.task)
      )
        throw Error("这项差事不在此人的分工内。");
      const maximum = command.task === "works" ? 1 : 2;
      if (
        command.task &&
        Object.entries(s.staffAssignments).filter(
          ([id, task]) => id !== command.person && task === command.task,
        ).length >= maximum
      )
        throw Error(`这项差事最多安排${maximum}人；请先撤回已有安排。`);
      if (command.task) s.staffAssignments[command.person] = command.task;
      else delete s.staffAssignments[command.person];
      break;
    }
    case "overwork":
      if (s.fatigue >= 85) throw Error("疲劳已达85，须先休养，不能继续透支。");
      if (s.overworked) throw Error("本周已透支一次。");
      s.overworked = true;
      s.ap += 1;
      s.fatigue = clamp(s.fatigue + 8);
      log(
        s,
        "额外督办",
        "本周精力增加1，疲劳增加8；持续透支会影响任职状态。",
        "warning",
      );
      break;
    case "relief":
      if (s.displaced <= 0) throw Error("当前没有待安置居民。");
      if (s.relievedThisTurn) throw Error("本周已追加救济。");
      ledger(s, "追加安置粮", pay(s, { grain: 15 }));
      const settled = -reliefMove(s, -18);
      effect(s, { people: 0.5 });
      s.relievedThisTurn = true;
      log(
        s,
        "赈济续办",
        `追加十五石口粮，核验落实${settled}人恢复生计，仍有${s.displaced}人待安置。`,
        "gain",
      );
      break;
    case "advance":
      advance(s);
      break;
    case "hard_hire":
    case "hard_donate":
    case "hard_remit":
    case "hard_buy":
      hardCommand(s, command, { ledger, pay, log, schedule });
      break;
    case "ending":
      if (!s.outcome?.routes.some((r) => r.id === command.choice))
        throw Error("任用选择无效。");
      s.outcome.choice = command.choice;
      break;
    default:
      throw Error("操作无效。");
  }
  recordReceipt(state, s, command);
  s.revision++;
  s.completedCommands.push(command.id);
  if (s.completedCommands.length > 1500)
    s.completedCommands = s.completedCommands.slice(-1500);
  return s;
}
export function validateSave(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("这不是有效的清河存档。");
  if (raw.version === 1) return validateSave(migrateQuarterSave(raw));
  if (raw.version === 2) {
    const upgraded = clone(raw);
    upgraded.version = 3;
    initializeGovernance(upgraded, true);
    return validateSave(upgraded);
  }
  if (raw.version === 3) {
    const upgraded = clone(raw);
    upgraded.version = 4;
    upgraded.prefecture = null;
    return validateSave(upgraded);
  }
  if (raw.version === 4) {
    const upgraded = clone(raw);
    upgraded.version = 5;
    upgraded.tongzhi = null;
    return validateSave(upgraded);
  }
  if (raw.version === 5) {
    const upgraded = clone(raw);
    upgraded.version = 6;
    upgraded.zhifu = null;
    return validateSave(upgraded);
  }
  if (raw.version === 6) {
    const upgraded = clone(raw);
    upgraded.version = 7;
    migrateAccountability(upgraded);
    return validateSave(upgraded);
  }
  if (raw.version === 7) {
    const upgraded = clone(raw);
    upgraded.version = 8;
    upgraded.countyRules ??= upgraded.finished ? "legacy" : "current";
    upgraded.routines ??= {};
    migratePrefecture(upgraded);
    if (upgraded.zhifu)
      for (const t of upgraded.zhifu.tasks || []) {
        if (t.plannedActual !== undefined) continue;
        t.plannedActual = t.actual;
        t.actualBasis = t.status === "working" ? "pending" : "legacy";
        t.deliveryBefore = null;
        t.deliveryAfter = null;
      }
    return validateSave(upgraded);
  }
  if (raw.version === 8) {
    const upgraded = clone(raw);
    upgraded.version = 9;
    upgraded.contentSeen ??= {};
    for (const id of Object.keys(upgraded.routines || {}))
      upgraded.contentSeen[id + ".first"] = true;
    for (const row of upgraded.events || [])
      if (row.id.startsWith("W")) {
        row.contentKey ??= "legacy";
        upgraded.contentSeen[row.id + ".first"] = true;
      }
    upgraded.populationLedger ??= {
      opening: upgraded.displaced,
      arrived: 0,
      settled: 0,
      shortage: 0,
    };
    for (const file of Object.values(upgraded.cases || {}))
      file.variant ??= "original";
    if (upgraded.zhifu) {
      upgraded.zhifu.contentSeed ??= upgraded.seed;
      upgraded.zhifu.auditCredits ??= 0;
      for (const file of Object.values(upgraded.zhifu.cases || {}))
        file.variant ??= "original";
    }
    return validateSave(upgraded);
  }
  if (raw.version === 9) {
    const upgraded = clone(raw);
    upgraded.version = 10;
    upgraded.countyPacing = upgraded.finished ? "legacy" : "current";
    upgraded.countyAffairs = blankAffairs();
    for (const [id, d] of Object.entries(AFFAIRS))
      if (d.release < upgraded.turn) upgraded.countyAffairs.retired[id] = true;
    upgraded.governance.pendingWorks = [];
    upgraded.governance.nextWork = 1;
    upgraded.governance.mandate &&
      (upgraded.governance.mandate.mode = "immediate");
    for (const p of [
      ...upgraded.accountability.history,
      ...(upgraded.accountability.current
        ? [upgraded.accountability.current]
        : []),
    ])
      p.caseReviews ??= {};
    return validateSave(upgraded);
  }
  if (raw.version === 10) {
    const upgraded = clone(raw);
    upgraded.version = 11;
    upgraded.difficulty = "standard";
    upgraded.hard = null;
    return validateSave(upgraded);
  }
  if (raw.version !== VERSION) throw Error("存档版本不兼容。");
  const base = createGame();
  for (const k of Object.keys(base))
    if (!(k in raw)) throw Error(`存档缺少字段：${k}`);
  if (
    typeof raw.name !== "string" ||
    raw.name.length > 12 ||
    !["player_a", "player_b", "player_c"].includes(raw.appearance)
  )
    throw Error("人物信息无效。");
  for (const k of [
    "turn",
    "revision",
    "ap",
    "silver",
    "grain",
    "private",
    "people",
    "economy",
    "order",
    "integrity",
    "trust",
    "education",
    "family",
    "fatigue",
    "population",
    "displaced",
    "nextLog",
    "nextLedger",
  ])
    if (!Number.isFinite(raw[k]) || raw[k] < 0 || raw[k] > 1e9)
      throw Error("存档数值无效。");
  if (
    !Number.isInteger(raw.turn) ||
    raw.turn > TERM_WEEKS ||
    typeof raw.finished !== "boolean" ||
    raw.finished !== (raw.turn === TERM_WEEKS)
  )
    throw Error("存档时序无效。");
  for (const key of [
    "projects",
    "events",
    "doneEvents",
    "pending",
    "actions",
    "logs",
    "ledger",
    "history",
    "completedCommands",
  ])
    if (!Array.isArray(raw[key]) || raw[key].length > 5000)
      throw Error("存档结构异常。");
  if (
    !raw.cases ||
    typeof raw.cases !== "object" ||
    !raw.flags ||
    typeof raw.flags !== "object"
  )
    throw Error("存档记录异常。");
  for (const c of Object.values(raw.cases)) {
    if (
      !CASES.some((x) => x.id === c.id) ||
      !Array.isArray(c.clues) ||
      !["open", "returned", "review", "closed"].includes(c.status)
    )
      throw Error("案卷记录异常。");
  }
  for (const p of raw.projects)
    if (
      !PROJECTS.some((x) => x.id === p.id) ||
      !["building", "complete"].includes(p.status) ||
      !Number.isFinite(p.remaining) ||
      !Number.isFinite(p.condition)
    )
      throw Error("工程记录异常。");
  if (
    raw.flags.arrears !== undefined &&
    (!Number.isFinite(raw.flags.arrears) || raw.flags.arrears < 0)
  )
    throw Error("欠付记录异常。");
  for (const e of raw.events)
    if (!Object.hasOwn(EVENTS, e.id) || typeof e.mandatory !== "boolean")
      throw Error("事件记录异常。");
  if (raw.finished && (!raw.outcome || !Array.isArray(raw.outcome.routes)))
    throw Error("结局记录不完整。");
  for (const k of ["staffAssignments", "base"])
    if (!raw[k] || typeof raw[k] !== "object" || Array.isArray(raw[k]))
      throw Error("存档记录异常。");
  if (!Object.hasOwn(FAMILIES, raw.familyId)) throw Error("出身记录异常。");
  for (const c of Object.values(raw.cases)) {
    const def = countyCase(raw, c.id);
    if (
      c.clues.some((id) => !def.clues.some((x) => x.id === id)) ||
      new Set(c.clues).size !== c.clues.length
    )
      throw Error("证据记录异常。");
  }
  for (const p of raw.pending)
    if (
      !p ||
      !["aid", "purchase", "settlement", "case", "buy"].includes(p.kind) ||
      !Number.isInteger(p.due) ||
      p.due < 0 ||
      !p.payload ||
      (p.kind === "case" && !CASES.some((c) => c.id === p.payload.id)) ||
      (["aid", "purchase", "buy"].includes(p.kind) &&
        (!Number.isFinite(p.payload.grain) ||
          (raw.difficulty === "hard"
            ? p.payload.grain <= 0 || p.payload.grain > 2000
            : p.kind === "buy" ||
              (p.kind === "aid"
                ? ![160, 180].includes(p.payload.grain)
                : p.payload.grain !== 360))))
    )
      throw Error("待办记录异常。");
  for (const l of [...raw.logs, ...raw.ledger])
    if (
      !l ||
      typeof l.title !== "string" ||
      !Number.isInteger(l.turn) ||
      l.turn < 0 ||
      l.turn > TERM_WEEKS
    )
      throw Error("流水记录异常。");
  for (const [id, task] of Object.entries(raw.staffAssignments))
    if (
      !["deputy", "dianshi", "clerk", "captain", "advisor"].includes(id) ||
      !["ledger", "patrol", "care", "works"].includes(task)
    )
      throw Error("差事记录异常。");
  if (
    [
      "actionsTotal",
      "projectsCompleted",
      "wellJudged",
      "badJudged",
      "patrol",
      "avoidableLoss",
    ].some((k) => !Number.isInteger(raw[k]) || raw[k] < 0 || raw[k] > 10000)
  )
    throw Error("履职计数异常。");
  const metrics = [
    "people",
    "economy",
    "order",
    "integrity",
    "trust",
    "education",
    "family",
    "fatigue",
  ];
  if (
    metrics.some((k) => raw[k] > 100) ||
    !Number.isInteger(raw.ap) ||
    raw.ap > 3 + (raw.overworked ? 1 : 0) + (raw.difficulty === "hard" ? 1 : 0) ||
    ["revision", "population", "displaced", "nextLog", "nextLedger"].some(
      (k) => !Number.isInteger(raw[k]),
    ) ||
    raw.nextLog < 1 ||
    raw.nextLedger < 1
  )
    throw Error("指标或精力超出范围。");
  if (
    ["people", "economy", "order", "integrity"].some(
      (k) =>
        !Number.isFinite(raw.base[k]) || raw.base[k] < 0 || raw.base[k] > 100,
    )
  )
    throw Error("存档评分基线不完整。");
  if (
    !Number.isFinite(raw.grainPrice) ||
    raw.grainPrice < 0.5 ||
    raw.grainPrice > 3 ||
    !Number.isInteger(raw.seed) ||
    !["current", "legacy"].includes(raw.countyRules) ||
    !["current", "legacy"].includes(raw.countyPacing) ||
    (raw.countyPacing === "legacy" && !raw.finished) ||
    !raw.routines ||
    typeof raw.routines !== "object" ||
    Array.isArray(raw.routines)
  )
    throw Error("县任记录异常。");
  for (const [id, r] of Object.entries(raw.routines))
    if (
      !id.startsWith("W") ||
      !EVENTS[id] ||
      !Number.isInteger(r.count) ||
      r.count < 1 ||
      r.count > 156 ||
      !Number.isInteger(r.lastTurn) ||
      r.lastTurn < 0 ||
      r.lastTurn > raw.turn ||
      !EVENTS[id].options.some((o) => o.id === r.lastChoice)
    )
      throw Error("日常记录异常。");
  if (
    new Set(raw.projects.map((p) => p.id)).size !== raw.projects.length ||
    new Set(raw.events.map((e) => e.id)).size !== raw.events.length
  )
    throw Error("工程或事项重复。");
  for (const p of raw.projects) {
    const def = PROJECTS.find((x) => x.id === p.id);
    if (
      p.remaining < 0 ||
      p.remaining > def.duration ||
      p.condition < 0 ||
      p.condition > 100 ||
      (p.status === "complete" && p.remaining !== 0)
    )
      throw Error("工程进度异常。");
  }
  for (const [id, c] of Object.entries(raw.cases)) {
    if (id !== c.id) throw Error("案卷编号不符。");
    if (
      c.status === "review" &&
      (!Number.isInteger(c.due) ||
        c.due <= raw.turn ||
        !["good", "bad"].includes(c.judgment) ||
        raw.pending.filter(
          (p) => p.kind === "case" && p.payload.id === id && p.due === c.due,
        ).length !== 1)
    )
      throw Error("案卷复核与待办不符。");
  }
  for (const p of raw.pending)
    if (
      p.due <= raw.turn ||
      (p.kind === "case" &&
        (raw.cases[p.payload.id]?.status !== "review" ||
          raw.cases[p.payload.id].due !== p.due))
    )
      throw Error("待办时序异常。");
  const pop = raw.populationLedger;
  if (
    !pop ||
    ["opening", "arrived", "settled"].some(
      (k) => !Number.isInteger(pop[k]) || pop[k] < 0,
    ) ||
    !Number.isFinite(pop.shortage) ||
    pop.shortage < 0 ||
    pop.opening + pop.arrived - pop.settled !== raw.displaced
  )
    throw Error("县任人口去向不符。");
  if (
    !raw.contentSeen ||
    typeof raw.contentSeen !== "object" ||
    Array.isArray(raw.contentSeen) ||
    Object.entries(raw.contentSeen).some(
      ([key, value]) => !/^W0[1-8]\.(first|next)$/.test(key) || value !== true,
    )
  )
    throw Error("来信展示记录异常。");
  for (const row of raw.events)
    if (
      row.contentKey !== undefined &&
      row.contentKey !== "legacy" &&
      row.contentKey !== row.id + ".first" &&
      row.contentKey !== row.id + ".next"
    )
      throw Error("来信版本异常。");
  if (
    Object.values(raw.cases).some(
      (file) =>
        file.variant !== undefined && !CASE_VARIANTS.includes(file.variant),
    )
  )
    throw Error("案情版本异常。");
  validateHard(raw);
  validateGovernance(raw);
  validateAffairs(raw);
  const clean = clone(raw);
  if (clean.finished) {
    const choice = clean.outcome.choice;
    clean.outcome = assess(clean);
    if (
      clean.outcome.routes.some((r) => r.id === choice) ||
      (choice === "promotion" && qualified(clean, "county"))
    )
      clean.outcome.choice = choice;
  }
  validatePrefecture(clean);
  validateTongzhi(clean);
  validateZhifu(clean);
  ensureReview(clean);
  validateAccountability(clean);
  return clean;
}

function migrateQuarterSave(raw) {
  if (
    !Number.isInteger(raw.turn) ||
    raw.turn < 0 ||
    raw.turn > 12 ||
    raw.finished !== (raw.turn === 12)
  )
    throw Error("旧存档时序无效。");
  const s = clone(raw);
  s.version = 2;
  s.turn *= 13;
  for (const key of ["logs", "ledger", "history", "pending", "projects"])
    if (!Array.isArray(s[key])) throw Error("旧存档记录异常。");
  for (const list of [s.logs, s.ledger, s.history])
    for (const row of list) row.turn *= 13;
  for (const p of s.pending) p.due *= 13;
  for (const p of s.projects) {
    p.remaining *= 13;
    for (const k of ["started", "completedAt"]) if (p[k] != null) p[k] *= 13;
  }
  if (!s.cases || typeof s.cases !== "object") throw Error("旧存档案卷异常。");
  for (const c of Object.values(s.cases))
    for (const k of ["opened", "due", "deferred"]) if (c[k] != null) c[k] *= 13;
  // 旧版每季3次巡查机会换成周制后仍保留已做准备；历史记录不重放。
  return s;
}

export function budgetForecast(s) {
  const planned = clone(s);
  applyPolicyWeek(planned, { ledger, pay, log, effect });
  const costs = {
    silver: Math.round((s.silver - planned.silver) * 100) / 100,
    grain: Math.round((s.grain - planned.grain) * 100) / 100,
  };
  const upkeep = s.projects
    .filter((p) => p.status === "complete" && p.condition > 0)
    .reduce(
      (sum, p) => sum + (PROJECTS.find((d) => d.id === p.id)?.upkeep || 0),
      0,
    );
  const income = Math.max(
    0,
    Math.round(
      (((86 + planned.economy * 0.7 + 25 * projectBenefit(planned, "road")) /
        13) *
        districtIncomeFactor(planned) +
        commerceBonus(planned)) *
        100,
    ) / 100,
  );
  const baseExpense = Math.round(((75 + upkeep) / 13) * 100) / 100;
  const paid = Math.min(baseExpense, planned.silver + income);
  const demand =
    planned.displaced > 0
      ? Math.min(90, Math.ceil((planned.displaced * 0.3) / 13))
      : 0;
  return {
    income,
    expense: Math.round((paid + costs.silver) * 100) / 100,
    grain: costs.grain + Math.min(demand, planned.grain),
    grainDemand: costs.grain + demand,
    unpaid: Math.round((baseExpense - paid) * 100) / 100,
    net: Math.round((income - paid - costs.silver) * 100) / 100,
  };
}
function recordReceipt(before, after, command) {
  const labels = {
    silver: "官银",
    grain: "仓粮",
    private: "私产",
    ap: "精力",
    people: "民生",
    economy: "农商",
    order: "治安",
    integrity: "吏治",
    trust: "上级信任",
    education: "文教",
    family: "家人关系",
    fatigue: "疲劳",
    displaced: "待安置居民",
  };
  const changes = [];
  for (const [key, name] of Object.entries(labels)) {
    const delta = Math.round((after[key] - before[key]) * 10000) / 10000;
    if (delta !== 0)
      changes.push({ name, before: before[key], after: after[key], delta });
  }
  for (const d of DISTRICTS)
    for (const [key, name] of Object.entries(LOCAL_METRICS)) {
      const a = before.governance.districts[d.id][key],
        b = after.governance.districts[d.id][key];
      if (a !== b)
        changes.push({
          name: d.name + " · " + name,
          before: a,
          after: b,
          delta: Math.round((b - a) * 10000) / 10000,
        });
    }
  for (const p of after.projects) {
    const old = before.projects.find((x) => x.id === p.id);
    if (old && old.condition !== p.condition)
      changes.push({
        name: (PROJECTS.find((x) => x.id === p.id)?.name || p.id) + " · 养护",
        before: old.condition,
        after: p.condition,
        delta: Math.round((p.condition - old.condition) * 10000) / 10000,
      });
  }
  const people = {
    farmer: "陈望田",
    merchant: "许丰年",
    boatman: "方长水",
    widow: "林秋娘",
    gentry: "沈廷礼",
    prefect: "知府",
  };
  for (const [id, a] of Object.entries(before.governance.relations)) {
    const b = after.governance.relations[id];
    if (a !== b)
      changes.push({
        name: people[id] + " · 互信",
        before: a,
        after: b,
        delta: Math.round((b - a) * 10000) / 10000,
      });
  }
  const names = {
    event: "事项处置",
    action: "亲自督办",
    project: "工程立项",
    investigate: "调查取证",
    judge: "拟议呈审",
    advance: "本周结算",
    staff: "属员差事",
    overwork: "额外督办",
    relief: "追加救济",
    policy: "县政调整",
    district: "地方督办",
    enforce: "判后执行",
    arrears: "清偿欠付",
    repair: "工程修复",
    ending: "任用选择",
    hard_hire: "私聘书启",
    hard_donate: "捐俸助公",
    hard_remit: "补解欠项",
    hard_buy: "籴粮",
  };
  const rows = after.ledger.filter(
    (l) => Number(l.id.slice(1)) >= before.nextLedger,
  );
  const notes = after.logs
    .filter((l) => Number(l.id.slice(1)) >= before.nextLog)
    .slice(0, 8)
    .reverse()
    .map((l) => l.text);
  after.receipts.unshift({
    id: command.id,
    turn: before.turn,
    title: names[command.type] || "事务已记",
    changes,
    ledger: rows,
    notes,
    policies:
      command.type === "advance" ? [...after.governance.lastWeekly] : [],
  });
  after.receipts = after.receipts.slice(0, 24);
}
