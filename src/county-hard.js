// 严苛难度（v0.11 新开知县任期）：随机灾情、季末上解、指标回落、私聘书启、案件和息与逾限、无封顶考评。
// 全部随机量都由存档种子推导，同一存档重放结果不变。
import { EVENTS, EVENT_WEEKS, EXTRA_WEEKS, WEEKS_PER_YEAR } from "./data.js";

export const HARD = {
  silver: 450,
  grain: 500,
  remit: { silver: 34, grain: [20, 20, 140, 20] },
  drift: {
    people: [45, 0.006],
    economy: [42, 0.006],
    order: [45, 0.006],
    integrity: [55, 0.009],
    trust: [50, 0.004],
  },
  districtDrift: [42, 0.004],
  staffFactor: 0.6,
  householdCost: 15,
  hireCost: 2,
  donate: 20,
  caseLimit: 16,
  settleCases: ["boundary", "inheritance"],
  buyAmount: 60,
};

export const remitGrain = (turn) =>
  HARD.remit.grain[Math.floor((turn % WEEKS_PER_YEAR) / 13)];
export const isHard = (s) => s?.difficulty === "hard";

export function roll(seed, key) {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const between = (seed, key, min, max) =>
  min + Math.floor(roll(seed, key) * (max - min + 1));
const scale = (seed, key, a, b) =>
  Math.round((a + roll(seed, key) * (b - a)) * 100) / 100;
const round = (n) => Math.round(n * 100) / 100;

const DISASTERS = ["X04", "X12"];
function freeWeek(seed, key, min, max, used) {
  for (let i = 0; i < 40; i++) {
    const w = between(seed, `${key}:${i}`, min, max);
    if (!used.has(w)) {
      used.add(w);
      return w;
    }
  }
  for (let w = min; w <= max; w++)
    if (!used.has(w)) {
      used.add(w);
      return w;
    }
  throw Error("严苛日程无法安排。");
}

export function blankHard(seed) {
  const used = new Set(
    Object.entries(EVENT_WEEKS)
      .filter(([, id]) => !DISASTERS.includes(id))
      .map(([w]) => Number(w)),
  );
  for (const w of Object.keys(EXTRA_WEEKS)) used.add(Number(w));
  const schedule = {};
  const put = (id, key, min, max) => (schedule[freeWeek(seed, key, min, max, used)] = id);
  put("X04", "drought", 52, 62);
  put("X12", "flood", 65, 77);
  if (roll(seed, "flood2") < 0.45) put("H12", "flood2", 131, 141);
  put("H01", "levy1", 60, 100);
  if (roll(seed, "levy2") < 0.6) put("H03", "levy2", 105, 150);
  if (roll(seed, "locust") < 0.55)
    roll(seed, "locust-year") < 0.5
      ? put("H02", "locust1", 66, 78)
      : put("H02", "locust2", 118, 129);
  return {
    schedule,
    droughtSev: scale(seed, "drought-sev", 0.75, 1.4),
    floodSev: scale(seed, "flood-sev", 0.85, 1.45),
    flood2Sev: scale(seed, "flood2-sev", 0.7, 1.2),
    levy: {
      H01: 5 * between(seed, "levy1-amt", 8, 17),
      H03: 5 * between(seed, "levy2-amt", 9, 18),
    },
    harvestMult: 1,
    prep: 0,
    owedSilver: 0,
    owedGrain: 0,
    remitDue: 0,
    remitPaid: 0,
    remitMissed: 0,
    hired: false,
    hireWeeks: 0,
    donatedTurn: -1,
    donated: 0,
    overdue: 0,
    settled: [],
    attempts: {},
    reliefQuality: null,
    floodQuality: [],
    levyOnPeople: 0,
  };
}

export const mainEvent = (s) => {
  if (!isHard(s)) return EVENT_WEEKS[s.turn];
  const fixed = EVENT_WEEKS[s.turn];
  return s.hard.schedule[s.turn] || (DISASTERS.includes(fixed) ? undefined : fixed);
};

export function nextFloodWeek(s) {
  if (!isHard(s)) return s.turn < 65 ? 65 : null;
  const weeks = Object.entries(s.hard.schedule)
    .filter(([w, id]) => ["X12", "H12"].includes(id) && Number(w) >= s.turn && !s.doneEvents.includes(id))
    .map(([w]) => Number(w));
  return weeks.length ? Math.min(...weeks) : null;
}
export const canPrepare = (s) => {
  if (!isHard(s)) return s.turn < 65 && s.patrol < 3;
  return nextFloodWeek(s) !== null && s.hard.prep < 3;
};
export const preparation = (s) => (isHard(s) ? s.hard.prep : s.patrol);

const households = (s) => Math.round((300 * s.hard.droughtSev) / 10) * 10;
export const droughtNeed = (s) => Math.round(households(s) * 1.2);

// 新事件：府檄摊派、蝻子出土、秋汛又至。
const levy = (title, text) => ({
  title,
  tag: "上解",
  speaker: "prefect",
  scene: "scene_prefecture_hall",
  text,
  options: [
    { id: "pay", label: "如数解府", desc: "按限期解足，府里记下清河的担当。", cost: {}, effect: { trust: 2 }, flags: {} },
    { id: "appeal", label: "据实陈明县力，先解一半", desc: "带账册赴府面陈，余数并入下季上解。", cost: { ap: 1 }, effect: { trust: -2 }, flags: {} },
    { id: "levy", label: "按亩加派里甲", desc: "官库不动，摊派落在农户身上。", cost: {}, effect: { people: -6, integrity: -6, economy: -2 }, flags: {} },
  ],
});
Object.assign(EVENTS, {
  H01: levy("府檄摊派", "府里为修城与军需摊派各县，清河应解银若干，限一月内起解。"),
  H03: levy("又一道摊派", "边饷吃紧，府里再次行文摊派。县丞翻着账册，没有说话。"),
  H02: {
    title: "蝻子出土",
    tag: "虫灾",
    speaker: "farmer",
    scene: "scene_village_drought",
    text: "田埂下翻出成片蝻子，再过十来天就要长翅。陈望田说，捕早一日，秋后就少损一分。",
    options: [
      { id: "organize", label: "停讼十日，组织乡夫捕蝗", desc: "开沟扑打，县里出钱粮雇夫。", cost: { ap: 1, silver: 20, grain: 15 }, effect: { economy: -1 }, flags: {} },
      { id: "bounty", label: "以粮易蝗，按斗收买", desc: "乡民自捕，县仓按斗给粮。", cost: { grain: 45 }, effect: { people: 1 }, flags: {} },
      { id: "pray", label: "设坛祈禳，听其自去", desc: "不费钱粮，收成看天。", cost: {}, effect: { economy: -4, people: -2 }, flags: {} },
    ],
  },
  H12: {
    ...structuredClone(EVENTS.X12),
    title: "秋汛又至",
    text: "入秋连雨，河水又涨到险段。罗行舟说，这回水势不及上次，可堤脚经过一场大水，未必还像从前牢靠。",
  },
});
const HARVEST = { organize: 0.9, bounty: 0.85, pray: 0.6 };

export function hardEventDefinition(s, id, event) {
  if (!isHard(s)) return event;
  if (id === "H01" || id === "H03") {
    const amt = s.hard.levy[id];
    event.text += ` 本次应解${amt}两。`;
    event.options[0].cost = { silver: amt };
    event.options[1].cost = { silver: Math.round(amt / 2), ap: 1 };
    event.options[1].desc = `先解${Math.round(amt / 2)}两，余${amt - Math.round(amt / 2)}两并入下季上解。`;
  }
  if (id === "X04") {
    const h = households(s),
      need = droughtNeed(s);
    event.text = `春旱之后，${h}户缺了一个月口粮。按当前登记共需${need}石。救助要及时，来年的种粮也不能全吃空。`;
    for (const o of event.options) {
      if (o.cost.grain === 360) o.cost.grain = need;
      if (o.id === "minimal") o.cost.grain = Math.round(need / 3);
    }
    const g = event.options.find((o) => o.id === "grain");
    if (g) g.desc = `用粮${need}石、配送20两。已核实的急需者先领。`;
    const r = event.options.find((o) => o.id === "request");
    if (r) r.desc = `开仓${need}石、配送20两，追加督办整理核灾材料。`;
    const b = event.options.find((o) => o.id === "buy");
    if (b) {
      b.cost.silver = Math.round((need * s.grainPrice + 20) * 100) / 100;
      b.desc = `${need}石按每石${round(s.grainPrice)}两采购，配送20两，合计${b.cost.silver}两；1周后到货发放。`;
    }
    const m = event.options.find((o) => o.id === "minimal");
    if (m) m.label = `先救最急的${Math.round(h / 3)}户，呈报缺口`;
  }
  // 选项次序按局打乱，不以先后暗示得失。
  event.options = [...event.options].sort(
    (a, b) => roll(s.seed, `${id}:${a.id}`) - roll(s.seed, `${id}:${b.id}`),
  );
  return event;
}

// 事件结算的严苛部分；返回附加说明。
export function hardResolveEvent(s, id, choice, ctx) {
  const { effect, log, schedule, reliefMove } = ctx;
  if (id === "H01" || id === "H03") {
    const amt = s.hard.levy[id];
    if (choice === "appeal") s.hard.owedSilver = round(s.hard.owedSilver + amt - Math.round(amt / 2));
    if (choice === "levy") {
      s.hard.levyOnPeople++;
      s.governance.relations.farmer = Math.max(0, s.governance.relations.farmer - 6);
      s.governance.districts.fields.livelihood = Math.max(0, s.governance.districts.fields.livelihood - 5);
    }
    return choice === "appeal" ? `余${amt - Math.round(amt / 2)}两并入下季上解。` : "";
  }
  if (id === "H02") {
    s.hard.harvestMult = Math.min(s.hard.harvestMult, HARVEST[choice] ?? 1);
    return `本年秋收按${Math.round(s.hard.harvestMult * 100)}%入仓。`;
  }
  return "";
}

export const droughtScale = (s) => (isHard(s) ? s.hard.droughtSev : 1);
export const floodSeverity = (s, id) =>
  !isHard(s) ? 17 : 17 * (id === "H12" ? s.hard.flood2Sev : s.hard.floodSev);
export function recordDisaster(s, id, choice) {
  if (!isHard(s)) return;
  if (id === "X04")
    s.hard.reliefQuality = { grain: 8, request: 8, buy: 7, minimal: 3, petition: 0 }[choice] ?? 0;
  if (id === "X12" || id === "H12") {
    s.hard.floodQuality.push({ evacuate: 8, protect: 4, appeal: 0 }[choice] ?? 0);
    s.hard.prep = 0;
  }
}

// 每周结算：指标回落、季末上解、粮价、私聘书启、案件逾限。
export function hardWeek(s, ctx) {
  if (!isHard(s)) return;
  const { ledger, log, effect } = ctx,
    h = s.hard,
    before = Object.fromEntries(Object.keys(HARD.drift).map((k) => [k, s[k]]));
  for (const [k, [anchor, rate]] of Object.entries(HARD.drift)) {
    const d = -(s[k] - anchor) * rate;
    s[k] = Math.round(Math.max(0, Math.min(100, s[k] + d)) * 10000) / 10000;
  }
  const moved = Object.entries(HARD.drift)
    .map(([k]) => [k, s[k] - before[k]])
    .filter(([, d]) => Math.abs(d) >= 0.05);
  if (moved.length)
    s.governance.lastWeekly.push(
      `各项向常态回落：${moved.map(([k, d]) => `${{ people: "民生", economy: "农商", order: "治安", integrity: "吏治", trust: "上级信任" }[k]}${d > 0 ? "+" : ""}${Math.round(d * 100) / 100}`).join("、")}。`,
    );
  const [anchor, rate] = HARD.districtDrift;
  for (const d of Object.values(s.governance.districts))
    for (const k of Object.keys(d))
      d[k] = Math.round(Math.max(0, Math.min(100, d[k] - (d[k] - anchor) * rate)) * 10000) / 10000;
  if (h.hired) {
    if (s.private >= HARD.hireCost) {
      ledger(s, "私聘书启束脩", { private: -HARD.hireCost });
      h.hireWeeks++;
    } else {
      h.hired = false;
      log(s, "书启辞馆", "私产不足以支付束脩，书启已辞去；下周起少一点精力。", "warning");
    }
  }
  if ((s.turn + 1) % 13 === 0) {
    const quotaG = remitGrain(s.turn),
      dueS = HARD.remit.silver + h.owedSilver,
      dueG = quotaG + h.owedGrain,
      paidS = round(Math.min(Math.max(0, s.silver), dueS)),
      paidG = round(Math.min(Math.max(0, s.grain), dueG));
    ledger(s, "季末实解府库", { silver: -paidS, grain: -paidG });
    h.remitDue = round(h.remitDue + HARD.remit.silver + quotaG);
    h.remitPaid = round(h.remitPaid + Math.min(paidS, HARD.remit.silver) + Math.min(paidG, quotaG));
    h.owedSilver = round(dueS - paidS);
    h.owedGrain = round(dueG - paidG);
    if (h.owedSilver > 0 || h.owedGrain > 0) {
      h.remitMissed++;
      effect(s, { trust: -3 });
      log(s, "上解不足", `应解银${round(dueS)}两、粮${round(dueG)}石，实解${paidS}两、${paidG}石；欠解记入下季，上级信任下降。`, "warning");
    } else log(s, "季末上解", `实解银${paidS}两、粮${paidG}石，本季无欠解。`);
  }
  const season = Math.floor((s.turn % WEEKS_PER_YEAR) / 13);
  const target = [1.15, 1.25, 0.9, 1.05][season];
  const noise = (roll(s.seed, `price:${s.turn}`) - 0.5) * 0.12;
  s.grainPrice = round(Math.max(0.6, Math.min(2.5, s.grainPrice + (target - s.grainPrice) * 0.12 + noise)));
  for (const c of Object.values(s.cases))
    if (["open", "returned"].includes(c.status) && !c.overdue && s.turn + 1 - c.opened >= HARD.caseLimit) {
      c.overdue = true;
      h.overdue++;
      effect(s, { trust: -2, people: -1 });
      log(s, "案卷逾限", `立卷已满${HARD.caseLimit}周仍未呈审，记逾限一次；仍须查证办结。`, "warning");
    }
}

export const harvestFactor = (s) => (isHard(s) ? s.hard.harvestMult : 1);
export function afterHarvest(s) {
  if (isHard(s)) s.hard.harvestMult = 1;
}
export const staffFactor = (s) => (isHard(s) ? HARD.staffFactor : 1);
export const householdCost = (s) => (isHard(s) ? HARD.householdCost : 12);
export const weeklyAp = (s) => (s.fatigue >= 65 ? 2 : 3) + (isHard(s) && s.hard.hired ? 1 : 0);

// 严苛专属操作。
export function hardCommand(s, c, ctx) {
  if (!isHard(s)) throw Error("当前任期按常例规则，不能办理此项。");
  const { ledger, pay, log, schedule } = ctx,
    h = s.hard;
  if (c.type === "hard_hire") {
    if (h.hired) {
      h.hired = false;
      log(s, "辞去书启", "下周起不再支付束脩，精力恢复常例。");
      return;
    }
    if (s.private < HARD.hireCost) throw Error("私产不足以支付书启束脩。");
    h.hired = true;
    log(s, "私聘书启", `以私产每周${HARD.hireCost}两延请书启代拟文移，下周起每周多1点精力。`, "decision");
    return;
  }
  if (c.type === "hard_donate") {
    if (h.donatedTurn === s.turn) throw Error("本周已捐俸一次。");
    ledger(s, "捐俸入公账", pay(s, { private: HARD.donate }));
    ledger(s, "捐俸入公账", { silver: HARD.donate });
    h.donatedTurn = s.turn;
    h.donated += HARD.donate;
    log(s, "捐俸助公", `私产${HARD.donate}两捐入官库，入账备查，不换取考绩。`);
    return;
  }
  if (c.type === "hard_remit") {
    const silver = round(Math.min(s.silver, h.owedSilver)),
      grain = round(Math.min(s.grain, h.owedGrain));
    if (silver <= 0 && grain <= 0) throw Error(h.owedSilver || h.owedGrain ? "钱粮不足，无法补解。" : "当前没有欠解。");
    ledger(s, "补解欠项", { silver: -silver, grain: -grain });
    h.owedSilver = round(h.owedSilver - silver);
    h.owedGrain = round(h.owedGrain - grain);
    log(s, "补解欠项", `补解银${silver}两、粮${grain}石${h.owedSilver || h.owedGrain ? `，仍欠${h.owedSilver}两、${h.owedGrain}石` : "，欠解已清"}。`);
    return;
  }
  if (c.type === "hard_buy") {
    if (s.pending.some((p) => p.kind === "buy")) throw Error("上一批籴粮尚未到仓。");
    const cost = buyCost(s);
    ledger(s, "籴粮付款", pay(s, { silver: cost, ap: 1 }));
    schedule(s, 1, "buy", { grain: HARD.buyAmount });
    log(s, "籴粮", `按每石${s.grainPrice}两籴粮${HARD.buyAmount}石，付银${cost}两，下周到仓。`, "decision");
    return;
  }
  throw Error("操作无效。");
}
export const buyCost = (s) => Math.round((HARD.buyAmount * s.grainPrice + 4) * 100) / 100;

// 案件：和息、证据不全的拟判。
export function caseSettlement(s, id, ctx) {
  const { log, effect } = ctx,
    c = s.cases[id];
  if (!isHard(s) || !HARD.settleCases.includes(id)) throw Error("此案不能和息。");
  if (!c || !["open", "returned"].includes(c.status)) throw Error("此案当前不能和息。");
  c.status = "closed";
  c.result = "两造和息，具结销案";
  c.execution = { status: "done", deadline: null, due: null };
  c.settled = true;
  s.hard.settled.push(id);
  const g = s.governance;
  if (id === "boundary") {
    g.relations.farmer = Math.max(0, g.relations.farmer - 6);
    effect(s, { people: 0.5 });
    log(s, "和息销案", "两家各让一步，按现耕地暂定界址。陈家心有不甘，旧契的疑点没有写进结论。", "case");
  } else {
    g.relations.widow = Math.max(0, g.relations.widow - 10);
    g.districts.hills.livelihood = Math.max(0, g.districts.hills.livelihood - 4);
    effect(s, { people: -1 });
    log(s, "和息销案", "族中长辈出面作保，叔父答应补些用度。林秋娘签了字，侄女该得的田产却没有写明。", "case");
  }
}
export function weakJudgment(s, id, clues, total) {
  if (!isHard(s) || clues >= total) return null;
  const n = (s.hard.attempts[id] = (s.hard.attempts[id] || 0) + 1);
  return roll(s.seed, `weak:${id}:${n}`) < 0.3 + 0.4 * (clues / total);
}

// 严苛考评：全任平均与期末各半，不设参与分；无数值在中途封顶。
export function hardScores(s, ctx) {
  const h = s.hard,
    hist = s.history;
  const blend = (k) => {
    const rows = hist.filter((r) => Number.isFinite(r[k]));
    const avg = rows.length ? rows.reduce((n, r) => n + r[k], 0) / rows.length : s[k];
    return 0.5 * avg + 0.5 * s[k];
  };
  const clamp = (x) => Math.max(0, Math.min(100, x));
  const remitRate = h.remitDue ? h.remitPaid / h.remitDue : 1;
  const floods = h.floodQuality.length ? h.floodQuality.reduce((a, b) => a + b, 0) / h.floodQuality.length : 0;
  const open = Object.values(s.cases).filter((c) => c.status !== "closed").length;
  return {
    people: clamp(
      30 + (blend("people") - 45) * 1.35 - s.avoidableLoss * 0.5 -
        s.populationLedger.shortage * 0.05 - h.levyOnPeople * 8 -
        (h.reliefQuality === null ? 0 : (8 - h.reliefQuality) * 2.2) -
        (h.floodQuality.length ? (8 - floods) * 1.5 : 0),
    ),
    finance: clamp(25 + (blend("economy") - 42) * 1.4 + remitRate * 25 - Math.min(15, h.remitMissed * 3)),
    judicial: clamp(42 + s.wellJudged * 9 - s.badJudged * 8 - ctx.executionPenalty(s) - open * 6 - h.overdue * 5 + h.settled.length * 4),
    integrity: clamp(blend("integrity")),
    mission: clamp(
      33 + s.projectsCompleted * 9 +
        (s.flags.handoverFinal ? 4 : 0) +
        Math.min(6, Math.max(0, (s.education - 40) / 5)) +
        Math.min(12, s.governance.mandatesMet * 1.5) -
        Math.min(9, s.governance.mandatesMissed * 1.5),
    ),
  };
}

export function validateHard(s) {
  if (s.difficulty !== "hard") {
    if (s.difficulty !== "standard" || s.hard !== null) throw Error("难度记录异常。");
    return;
  }
  const h = s.hard;
  if (!h || typeof h !== "object" || !h.schedule || typeof h.schedule !== "object") throw Error("严苛记录异常。");
  for (const [w, id] of Object.entries(h.schedule))
    if (!Number.isInteger(Number(w)) || Number(w) < 0 || Number(w) > 155 || !EVENTS[id]) throw Error("严苛日程异常。");
  for (const k of ["droughtSev", "floodSev", "flood2Sev", "harvestMult", "prep", "owedSilver", "owedGrain", "remitDue", "remitPaid", "remitMissed", "hireWeeks", "donated", "overdue", "levyOnPeople"])
    if (!Number.isFinite(h[k]) || h[k] < 0 || h[k] > 1e6) throw Error("严苛数值异常。");
  if (typeof h.hired !== "boolean" || !Array.isArray(h.settled) || !Array.isArray(h.floodQuality) || !h.attempts || !h.levy) throw Error("严苛记录异常。");
}
