import { IN_REGIONS, IN_EVENTS, IN_DOCKETS } from "./inspector-data.js";
import { qualified } from "./accountability.js";
import { zfAssessment } from "./zhifu.js";
import { termLabel } from "./rules.js";
import { familyAllowance } from "./county-content.js";
import { roll } from "./county-hard.js";
import { eventAt, eventWeek, officeDrift, blendIntegrity } from "./office-hard.js";
export { IN_REGIONS, IN_EVENTS, IN_DOCKETS };
export const inLabel = (q) => termLabel(q.turn, "按察司副使");
const round = (n) => Math.round(n * 100) / 100;
const clamp = (n) => Math.max(0, Math.min(100, round(n)));
const log = (q, text) => { q.logs.unshift({ id: q.nextLog++, turn: q.turn, text }); q.logs = q.logs.slice(0, 300); };
function money(q, title, delta) {
  for (const [k, v] of Object.entries(delta)) if (!["silver", "private"].includes(k) || !Number.isFinite(v) || q[k] + v < 0) throw Error("巡察差费不足。");
  for (const [k, v] of Object.entries(delta)) q[k] = round(q[k] + v);
  const row = { turn: q.turn, title, ...delta }; q.ledger.push(row); q.lastLedger.push(row);
}
function pay(q, silver = 0, ap = 1, title = "巡察办理") {
  if (q.silver < silver || q.ap < ap) throw Error(q.ap < ap ? "本周精力不足。" : "巡察差费不足。");
  q.ap -= ap;
  if (silver) money(q, title, { silver: -silver });
}
function due(q, weeks) { if (q.turn + weeks > 156) throw Error("本任余期不足，须据实交接。"); return q.turn + weeks; }
export const inTeams = (q) => Object.values(q.dockets).filter((r) => ["travelling", "onsite", "executing", "ready"].includes(r.status)).length;
export const inTravel = (q, d) => IN_REGIONS.find((r) => r.id === d.region).days + (q.hard ? 1 : 0);
export function inspectorHard(seed) {
  return { seed, weeks: Object.fromEntries(IN_EVENTS.map((e) => [e.id, e.week === 0 || e.week >= 140 ? e.week : e.week + Math.floor(roll(seed, `in:${e.id}`) * 9) - 4])), lifeSum: 0, integritySum: 0, weeksCounted: 0 };
}
function open(q) {
  q.event = eventAt(q, IN_EVENTS)?.id || null;
  for (const d of IN_DOCKETS) if (d.week === q.turn && !q.dockets[d.id]) {
    q.dockets[d.id] = { id: d.id, status: "open", opened: q.turn, clues: [], route: null, started: null, arrived: null, submitted: null, approved: null, executed: null, ready: null, closed: null, due: null };
    log(q, `${IN_REGIONS.find((x) => x.id === d.region).name} · ${d.title}列入巡察。${d.urgent ? "涉及人身处境，超过26周仍未验收会持续影响民生。" : "须核原件与现场，回报不能代替验收。"}`);
  }
}
export function appointInspector(s) {
  const p = s.zhifu;
  if (s.inspector) throw Error("按察司副使任命已办理。");
  if (!p?.finished || (!zfAssessment(p).candidate && !qualified(s, "zhifu"))) throw Error("须知府考满称职，或复考恢复资格，才可转任分巡。");
  const q = s.inspector = {
    turn: 0, finished: false, ap: 3, silver: 0, grain: 0, private: p.private,
    integrity: p.integrity, trust: p.trust, misconduct: false, event: null,
    nextLog: 1, logs: [], ledger: [], lastLedger: [], dockets: {}, outcome: null,
    record: { silver: p.silver, grain: p.grain, private: p.private, score: p.outcome.score },
    counties: Object.fromEntries(IN_REGIONS.map((d) => [d.id, { id: d.id, name: d.name, people: 65, cooperation: 55 }])),
    hard: s.difficulty === "hard" && p.hard ? inspectorHard(s.seed) : null,
  };
  money(q, "分巡专项差费正式核拨", { silver: q.hard ? 320 : 480 });
  open(q);
  log(q, "转任按察司副使，正四品，奉命分巡北陵、南泽、西原三府。与知府同品而职责不同；原府公账留交接，新任差费另拨，私产承接。巡察可查证、催办并呈请处置，不兼领兵备提学，不自行终审重案。");
}
export function inspectorAssessment(s) {
  const q = s.inspector, rows = Object.values(q.dockets), closed = rows.filter((r) => r.status === "closed"), timely = closed.filter((r) => r.closed <= r.opened + 26).length;
  const cases = Object.values(s.officeStories.offices.inspector?.cases || {}).filter((r) => r.status === "closed").length;
  const score = Math.round(closed.length / 12 * 50 + cases / 4 * 25 + timely / 12 * 10 + blendIntegrity(q) * .15);
  const candidate = !q.misconduct && score >= (q.hard ? 75 : 70);
  return { score, rating: q.misconduct ? "候查" : candidate ? "称职" : score >= 50 ? "平常" : "不称职", candidate, summary: `巡察验收${closed.length}/12项，其中26周内验收${timely}项；来源案实际归档${cases}/4件。未竟事项原状交接，不以呈报代替完成。` };
}
export function finalizeInspector(s) {
  if (!s.inspector?.finished) return;
  s.inspector.outcome = inspectorAssessment(s);
}
export function inspectorCommand(s, c) {
  const q = s.inspector;
  if (!q || q.finished) throw Error("尚未任命或本任已经考满。");
  q.lastLedger = [];
  if (c.type === "in_event") {
    const e = IN_EVENTS.find((d) => d.id === q.event), o = e?.options.find((d) => d.id === c.choice);
    if (!o) throw Error("本周分巡公文或处置无效。");
    pay(q, o.cost.silver || 0, o.cost.ap || 0, e.title);
    for (const [key, n] of Object.entries(o.effect)) q[key] = clamp(q[key] + n);
    if (o.misconduct) q.misconduct = true;
    q.event = null; log(q, `${e.title}：${o.label}。巡案仍按实际流程查验。`); return;
  }
  if (c.type === "in_docket") {
    const d = IN_DOCKETS.find((d) => d.id === c.docket), r = q.dockets[c.docket];
    if (!d || !r) throw Error("此项巡案尚未列入差遣。");
    if (c.action === "visit") {
      if (r.status !== "open" || inTeams(q) >= 2) throw Error("巡案已派办，或两组巡察人手均在外。");
      if (!["ordinary", "direct"].includes(c.route)) throw Error("巡察路线无效。");
      const travel = c.route === "direct" ? Math.max(1, inTravel(q, d) - 1) : inTravel(q, d);
      due(q, travel + 6); // 两周呈核、三周落实，留最后一周验收。
      pay(q, c.route === "direct" ? 16 : 8, 1, d.title + "出巡差费");
      Object.assign(r, { status: "travelling", route: c.route, started: q.turn, due: q.turn + travel });
      log(q, `${d.title}派员${c.route === "direct" ? "直赴现场" : "循驿前往"}，${travel}周到达；路线只影响差费与时间，不改变案情。`);
    } else if (c.action === "clue") {
      const e = d.evidence.find((e) => e.id === c.clue);
      if (r.status !== "onsite" || !e || r.clues.some((x) => x.id === e.id)) throw Error("须到场后查证，证据不得重复领取。");
      pay(q, 4, 1, d.title + " · " + e.name); r.clues.push({ id: e.id, turn: q.turn }); log(q, `${d.title}：${e.text}`);
    } else if (c.action === "submit") {
      if (r.status !== "onsite" || r.clues.length !== d.evidence.length) throw Error("须核齐两项独立凭据才能呈请处置。");
      due(q, 6); pay(q, 0, 1); Object.assign(r, { status: "review", submitted: q.turn, due: q.turn + 2 });
      log(q, `${d.title}呈报司中与有权机关，2周后复核；出巡组归署候差，未计纠正成果。`);
    } else if (c.action === "execute") {
      if (r.status !== "approved" || inTeams(q) >= 2) throw Error("须取得批复且有空闲巡察组，方可督促落实。");
      due(q, 4); const end = q.turn + 3; pay(q, 12, 1, d.title + "督催与复验差费"); Object.assign(r, { status: "executing", executed: q.turn, due: end });
      log(q, `${d.title}按批复督催落实，3周后取得回报，仍须亲自核验；${d.remedy}`);
    } else if (c.action === "accept") {
      if (r.status !== "ready") throw Error("尚未收到落实回报，或已经验收。");
      pay(q, 0, 1); Object.assign(r, { status: "closed", closed: q.turn });
      const region = q.counties[d.region]; region.people = clamp(region.people + 3); region.cooperation = clamp(region.cooperation + 4); q.integrity = clamp(q.integrity + 2);
      log(q, `${d.title}已核验签收和实际处境，正式归卷；${d.remedy}民生+3、协作+4、吏治+2，以上限内实际变化计。`);
    } else throw Error("巡案操作无效。");
    return;
  }
  if (c.type !== "in_advance") throw Error("分巡操作无效。");
  if (q.event) throw Error("请先处置本周分巡公文。");
  money(q, "分巡每周核拨与署务净额", { silver: q.hard ? 3 : 5 });
  money(q, "副使俸入与家计净额", { private: 1.5 + familyAllowance(s) });
  q.turn++;
  for (const d of IN_DOCKETS) {
    const r = q.dockets[d.id]; if (!r) continue;
    if (r.due !== null && r.due <= q.turn) {
      if (r.status === "travelling") { r.status = "onsite"; r.arrived = q.turn; log(q, `${d.title}巡察人员已到，可核原件和现场。`); }
      else if (r.status === "review") { r.status = "approved"; r.approved = q.turn; log(q, `${d.title}复核准予依查明范围催办：${d.finding}`); }
      else if (r.status === "executing") { r.status = "ready"; r.ready = q.turn; log(q, `${d.title}落实回报已至，待核验签收，不提前记成效。`); }
      r.due = null;
    }
    if (d.urgent && r.status !== "closed" && q.turn > r.opened + 26) q.counties[d.region].people = clamp(q.counties[d.region].people - .3);
  }
  if (q.hard) officeDrift(q, Object.values(q.counties), { people: [55, .006], integrity: [60, .006] });
  if (q.turn === 156) {
    q.finished = true; q.ap = 0;
    for (const r of Object.values(q.dockets)) if (r.status !== "closed") { r.handoverFrom = r.status; r.status = "handover"; r.due = null; }
    log(q, "分巡三年任满，已验与未竟分别归卷，来源案到期回报并入本次考评。");
  } else { q.ap = 3; open(q); }
}
export function inspectorReceipt(before, after, c) {
  const a = before.inspector, b = after.inspector, changes = [];
  const add = (name, x, y) => { if (x !== y) changes.push({ name, before: x, after: y, delta: round(y - x) }); };
  if (a) {
    for (const [key, name] of Object.entries({ silver: "巡察官银", private: "私产", ap: "精力", integrity: "吏治", trust: "上级信任" })) add(name, a[key], b[key]);
    for (const d of IN_REGIONS) for (const [key, name] of Object.entries({ people: "民生", cooperation: "协作" })) add(d.name + " · " + name, a.counties[d.id][key], b.counties[d.id][key]);
  } else add("分巡专项核拨", 0, b.silver);
  return { id: c.id, chapter: "按察司副使", turn: a?.turn || 0, title: c.type === "in_appoint" ? "分巡任命已生效" : c.type === "in_advance" ? "分巡本周结算" : "巡察办理回执", changes, notes: b.logs.filter((x) => x.id >= (a?.nextLog || 1)).reverse().map((x) => x.text), policies: [], ledger: b.lastLedger };
}

export function validateInspector(s) {
  const q = s.inspector; if (q === null) return;
  const fail = () => { throw Error("分巡履历结构、账目或时序异常。"); };
  const num = (x, a = 0, b = 1e9) => Number.isFinite(x) && x >= a && x <= b;
  const int = (x, a = 0, b = 156) => Number.isInteger(x) && num(x, a, b);
  if (!q || !s.zhifu?.finished || (!zfAssessment(s.zhifu).candidate && !qualified(s, "zhifu")) || !int(q.turn) || q.finished !== (q.turn === 156) || !int(q.ap, 0, 3) || (q.finished && q.ap !== 0) || typeof q.misconduct !== "boolean") fail();
  for (const k of ["silver", "private", "grain", "trust", "integrity", "nextLog"]) if (!num(q[k], 0, ["trust", "integrity"].includes(k) ? 100 : 1e9)) fail();
  if (q.grain !== 0 || !q.record || q.record.private !== s.zhifu.private || q.record.silver !== s.zhifu.silver || q.record.grain !== s.zhifu.grain || q.record.score !== s.zhifu.outcome.score) fail();
  if (q.hard) {
    if (s.difficulty !== "hard" || !s.zhifu.hard || q.hard.seed !== s.seed || JSON.stringify(q.hard.weeks) !== JSON.stringify(inspectorHard(s.seed).weeks) || q.hard.weeksCounted !== q.turn || !num(q.hard.lifeSum, 0, q.turn * 100) || !num(q.hard.integritySum, 0, q.turn * 100)) fail();
  } else if (q.hard !== null || (s.difficulty === "hard" && s.zhifu.hard)) fail();
  if (q.event !== null && (!IN_EVENTS.some((e) => e.id === q.event && eventWeek(q, e) === q.turn) || q.finished)) fail();
  const main = s.officeStories.offices.inspector?.main;
  if (!main) fail();
  for (const e of IN_EVENTS) {
    const week = eventWeek(q, e), r = main[e.id];
    if (week <= q.turn && q.event !== e.id) {
      if (!r || r.turn !== week || !e.options.some((o) => o.id === r.choice)) fail();
    } else if (r) fail();
  }
  if (Object.keys(main).some((id) => !IN_EVENTS.some((e) => e.id === id))) fail();
  if (!q.counties || Object.keys(q.counties).length !== 3) fail();
  for (const d of IN_REGIONS) { const r = q.counties[d.id]; if (!r || r.id !== d.id || r.name !== d.name || !num(r.people, 0, 100) || !num(r.cooperation, 0, 100)) fail(); }
  if (!q.dockets || Object.keys(q.dockets).length !== IN_DOCKETS.filter((d) => d.week <= q.turn).length || inTeams(q) > 2) fail();
  for (const [id, r] of Object.entries(q.dockets)) {
    const d = IN_DOCKETS.find((d) => d.id === id);
    if (!d || d.week > q.turn || r.id !== id || r.opened !== d.week || !Array.isArray(r.clues) || new Set(r.clues.map((c) => c.id)).size !== r.clues.length || !["open", "travelling", "onsite", "review", "approved", "executing", "ready", "closed", "handover"].includes(r.status)) fail();
    if (r.status === "handover" ? !q.finished || !["open", "travelling", "onsite", "review", "approved", "executing", "ready"].includes(r.handoverFrom) : q.finished && r.status !== "closed") fail();
    const status = r.status === "handover" ? r.handoverFrom : r.status;
    const phase = ["open", "travelling", "onsite", "review", "approved", "executing", "ready", "closed"].indexOf(status);
    if (r.clues.some((c) => !d.evidence.some((e) => e.id === c.id) || r.arrived === null || !int(c.turn, r.arrived, q.turn)) || (phase < 2 && r.clues.length) || (phase >= 3 && r.clues.length !== 2)) fail();
    if (phase === 0 ? r.route !== null || r.started !== null : !["ordinary", "direct"].includes(r.route) || !int(r.started, r.opened, q.turn)) fail();
    const travel = r.route === "direct" ? Math.max(1, inTravel(q, d) - 1) : inTravel(q, d);
    for (const [key, minPhase, earliest] of [["arrived", 2, r.started + travel], ["submitted", 3, r.arrived], ["approved", 4, r.submitted + 2], ["executed", 5, r.approved], ["ready", 6, r.executed + 3], ["closed", 7, r.ready]]) {
      if (phase >= minPhase ? !int(r[key], earliest, q.turn) : r[key] !== null) fail();
    }
    if (phase >= 2 && r.arrived !== r.started + travel || phase >= 4 && r.approved !== r.submitted + 2 || phase >= 6 && r.ready !== r.executed + 3 || phase >= 3 && r.clues.some((c) => c.turn > r.submitted)) fail();
    const expectedDue = status === "travelling" ? r.started + travel : status === "review" ? r.submitted + 2 : status === "executing" ? r.executed + 3 : null;
    if (r.status === "handover" ? r.due !== null : r.due !== expectedDue || (r.due !== null && !int(r.due, q.turn + 1, 156))) fail();
  }
  if (!Array.isArray(q.logs) || !Array.isArray(q.ledger) || !Array.isArray(q.lastLedger) || q.logs.length > 300 || q.ledger.length > 5000 || q.lastLedger.length > 100 || q.logs.some((r) => !int(r.id, 1, q.nextLog - 1) || !int(r.turn, 0, q.turn) || typeof r.text !== "string") || new Set(q.logs.map((r) => r.id)).size !== q.logs.length) fail();
  for (const r of [...q.ledger, ...q.lastLedger]) if (!r || !int(r.turn, 0, q.turn) || typeof r.title !== "string" || ["silver", "private", "grain"].some((k) => r[k] !== undefined && !num(r[k], -1e9))) fail();
  for (const k of ["silver", "private"]) if (Math.abs(round(q.ledger.reduce((n, r) => n + (r[k] || 0), k === "private" ? q.record.private : 0)) - q[k]) > .01) fail();
  if (q.finished) q.outcome = inspectorAssessment(s); else if (q.outcome !== null) fail();
}
