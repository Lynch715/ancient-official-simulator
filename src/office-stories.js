import { syncChallenge } from "./career-difficulty.js";
import { XF_STORIES } from "./xunfu-stories.js";
import { XF_SOURCE_CASES } from "./xunfu-cases.js";
import { BZ_STORIES } from "./buzheng-stories.js";
import { BZ_SOURCE_CASES } from "./buzheng-cases.js";
import { CZ_STORIES } from "./canzheng-stories.js";
import { CZ_SOURCE_CASES } from "./canzheng-cases.js";
import { IN_STORIES } from "./inspector-stories.js";
import { IN_SOURCE_CASES } from "./inspector-cases.js";
import { PREF_STORIES } from "./prefecture-stories.js";
import { TZ_STORIES } from "./tongzhi-stories.js";
import { ZF_STORIES } from "./zhifu-stories.js";
import { PREF_SOURCE_CASES, TZ_SOURCE_CASES, ZF_SOURCE_CASES } from "./office-case-data.js";

export const OFFICE_CONTENT = {
  xunfu: { label: "奉命巡抚", title: "一纸敕，万家灯", events: XF_STORIES, cases: XF_SOURCE_CASES },
  buzheng: { label: "布政使", title: "一省秋秤", events: BZ_STORIES, cases: BZ_SOURCE_CASES },
  canzheng: { label: "布政司参政", title: "三府一秤", events: CZ_STORIES, cases: CZ_SOURCE_CASES },
  inspector: { label: "按察司副使", title: "山河有卷", events: IN_STORIES, cases: IN_SOURCE_CASES },
  prefecture: { label: "通判", title: "一舟粮，几家命", events: PREF_STORIES, cases: PREF_SOURCE_CASES },
  tongzhi: { label: "同知", title: "水来之前", events: TZ_STORIES, cases: TZ_SOURCE_CASES },
  zhifu: { label: "知府", title: "堂前灯，堂外人", events: ZF_STORIES, cases: ZF_SOURCE_CASES },
};
export const blankOfficeStories = () => ({ version: 1, offices: {}, counts: {}, sources: {} });
export const activeOffice = (s) => s.xunfu ? "xunfu" : s.buzheng ? "buzheng" : s.canzheng ? "canzheng" : s.inspector ? "inspector" : s.zhifu ? "zhifu" : s.tongzhi ? "tongzhi" : s.prefecture ? "prefecture" : null;
const int = (n, min = 0, max = 156) => Number.isInteger(n) && n >= min && n <= max;
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));
const own = (o, key) => Object.hasOwn(o, key);
const CASE_ASSISTS = {
  XC01: ["XF02", "e1"], XC02: ["XF05", "e1"], XC03: ["XF08", "e1"], XC04: ["XF12", "e1"],
  BC01: ["BZ02", "e1"], BC02: ["BZ05", "e1"], BC03: ["BZ08", "e1"], BC04: ["BZ12", "e1"],
  CC01: ["CZ02", "e1"], CC02: ["CZ05", "e2"], CC03: ["CZ08", "e1"], CC04: ["CZ12", "e1"],
  IC01: ["IN02", "e2"], IC02: ["IN04", "e3"], IC03: ["IN07", "e2"], IC04: ["IN11", "e1"],
  PC01: ["TP01", "e2"], PC02: ["TP03", "e2"], PC03: ["TP08", "e2"], PC04: ["TP12", "e3"],
  TC01: ["TZ02", "e3"], TC02: ["TZ05", "e2"], TC03: ["TZ08", "e1"], TC04: ["TZ12", "e1"],
  FC01: ["ZF02", "e3"], FC02: ["ZF04", "e2"], FC03: ["ZF07", "e2"], FC04: ["ZF12", "e2"],
};
export function sourceClueCost(s, key, caseId, clueId) {
  const assist = CASE_ASSISTS[caseId];
  const supported = assist && assist[1] === clueId && s.officeStories.offices[key]?.events[assist[0]]?.status === "done";
  return { silver: supported ? 2 : 4, ap: 1 };
}
function note(q, text) {
  q.logs.unshift({ ...(Number.isInteger(q.nextLog) ? { id: q.nextLog++ } : {}), turn: q.turn, text });
  q.logs = q.logs.slice(0, 300);
}
function scheduleEvents(s, key) {
  // 叙事有独立的排程种子，不消费经营随机数。浮动只在三周内，并与邻项保持八周内间隔。
  const defs = OFFICE_CONTENT[key].events;
  const out = {};
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i], q = s[key];
    const noise = q.hard ? Math.abs((s.seed ^ ((i + 1) * 2654435761) ^ key.length) | 0) % 3 - 1 : 0;
    const lo = i ? out[defs[i - 1].id] + 1 : 1;
    out[d.id] = Math.max(lo, Math.min(150, d.week + noise));
  }
  if (!s[key].hard) return out;
  // 先在实际公文与立案周之间补足最长八周间隔，再把余下叙事安放到邻近原窗口。
  // 两类队列可以同周，所有来件仍有独立状态；取证和公文不互相覆盖。
  const anchors = [...new Set([0, 156, ...Object.values(s[key].hard.weeks), ...OFFICE_CONTENT[key].cases.map((d) => d.week)])].sort((a,b) => a-b);
  const slots = new Set();
  for (let i = 1; i < anchors.length; i++) {
    const left = anchors[i - 1], length = anchors[i] - left, pieces = Math.ceil(length / 8);
    for (let j = 1; j < pieces; j++) slots.add(left + Math.round(length * j / pieces));
  }
  if (slots.size > defs.length) throw Error("叙事数量不足以覆盖本任排程。");
  for (const d of defs) {
    if (slots.size === defs.length) break;
    if (!anchors.includes(out[d.id])) slots.add(out[d.id]);
  }
  for (let week = 3; slots.size < defs.length && week < 151; week += 4)
    if (!anchors.includes(week)) slots.add(week);
  const ordered = [...slots].sort((a,b) => a-b);
  return Object.fromEntries(defs.map((d,i) => [d.id, ordered[i]]));
}
function initialize(s, key, legacy = false) {
  const q = s[key], defs = OFFICE_CONTENT[key];
  const book = { since: legacy ? q.turn : 0, legacy, schedule: scheduleEvents(s, key), events: {}, queue: [], cases: {}, retiredCases: [], main: {} };
  if (legacy) {
    for (const d of defs.events)
      if (q.finished || book.schedule[d.id] <= q.turn) book.events[d.id] = { status: "retired" };
    for (const d of defs.cases)
      if (q.finished || d.week <= q.turn) book.retiredCases.push(d.id);
  }
  s.officeStories.offices[key] = book;
  return book;
}
export function migrateOfficeStories(s) {
  s.officeStories = blankOfficeStories();
  for (const key of Object.keys(OFFICE_CONTENT)) if (s[key]) initialize(s, key, true);
}
function gain(q, d, change) {
  for (const [key, amount] of Object.entries(change)) {
    const account = ["people", "cooperation"].includes(key) ? q.counties[d.county] : q;
    account[key] = clamp(account[key] + amount);
  }
}
function pay(q, cost, title) {
  for (const [key, amount] of Object.entries(cost))
    if (!Number.isFinite(q[key]) || q[key] < amount) throw Error(key === "ap" ? "本周精力不足。" : "可用公银或公粮不足。");
  q.ap -= cost.ap || 0;
  const delta = {};
  for (const key of ["silver", "grain"]) if (cost[key]) { q[key] = Math.round((q[key] - cost[key]) * 100) / 100; delta[key] = -cost[key]; }
  if (Object.keys(delta).length) {
    const row = { turn: q.turn, title, ...delta };
    q.ledger.push(row); q.lastLedger.push(row);
  }
}
export function syncOfficeStories(s, before = null, command = null) {
  const key = activeOffice(s);
  if (!key) return;
  const q = s[key], defs = OFFICE_CONTENT[key];
  const b = s.officeStories.offices[key] || initialize(s, key);
  if (command && before?.[key]?.event && ["pref_event", "tz_event", "zf_event", "in_event", "cz_event", "bz_event", "xf_event"].includes(command.type)) {
    const id = before[key].event;
    if (own(b.main, id)) throw Error("这份主线公文已经办过。");
    b.main[id] = { turn: before[key].turn, choice: command.choice };
  }
  for (const d of defs.events) {
    let row = b.events[d.id];
    if (!row && !q.finished && b.schedule[d.id] <= q.turn) {
      if ((s.officeStories.counts[d.id] || 0) >= d.maxAppearances) throw Error("剧情重复入队。");
      row = b.events[d.id] = { status: "pending", opened: q.turn, choice: null, due: null, settled: false };
      s.officeStories.counts[d.id] = (s.officeStories.counts[d.id] || 0) + 1;
      b.queue.push(d.id);
      note(q, `${d.title}送到案头，可在剧情与案牍中办理。`);
    }
    if (!row || row.status === "retired") continue;
    if (row.status === "working" && row.due <= q.turn) {
      const o = d.options.find((o) => o.id === row.choice);
      gain(q, d, o.gain);
      row.status = "done"; row.settled = true; row.completed = q.turn; row.due = null;
      note(q, `${d.title}回报：${storyResult(d, o)}${gainText(o.gain)}`);
    }
    if (row.status === "pending" && (q.finished || q.turn >= row.opened + 8)) {
      row.status = "delegated"; row.choice = "delegate"; row.completed = q.turn;
      b.queue = b.queue.filter((id) => id !== d.id);
      note(q, `${d.title}已交属员按常例办理，无新增查验结果，不计奖励。`);
    }
  }
  for (const d of defs.cases) {
    let file = b.cases[d.id];
    if (!file && !q.finished && d.week <= q.turn && !b.retiredCases.includes(d.id)) {
      if (own(s.officeStories.sources, d.source.key)) throw Error("来源案件已经用过。");
      file = b.cases[d.id] = { id: d.id, opened: q.turn, status: "open", clues: [], choice: null, due: null, reviews: [], executed: null };
      s.officeStories.sources[d.source.key] = d.id;
      note(q, `${d.name}立卷。须逐项核证，通判、同知依授权保全移送，未经复核不算结案。`);
    }
    if (!file) continue;
    if (file.due !== null && file.due <= q.turn) {
      if (file.status === "review") {
        const approved = file.choice === "evidence" && file.clues.length === d.clues.length;
        file.reviews.push({ submitted: file.submitted, reviewed: q.turn, choice: file.choice, approved });
        file.status = approved ? "approved" : "returned";
        note(q, approved ? `${d.name}复核通过：${d.finding}须另行督促交还或移送回报。` : `${d.name}退回补查：处置没有逐项排除另一解释，不能凭单一迹象或人数定案。已核证据保留。`);
      } else if (file.status === "executing") {
        file.status = "closed"; file.closed = q.turn;
        gain(q, d, { cooperation: 2, trust: 1 });
        note(q, `${d.name}：交还、纠正或正式移送回报已核验，案卷归档；地方协作+2，上级信任+1。`);
      }
      file.due = null;
    }
    if (q.finished && file.status !== "closed") { file.status = "handover"; file.due = null; note(q, `${d.name}未竟事项原状交接，不计结案。`); }
  }
  syncChallenge(s,key);
}
export function storyResult(d, o) {
  return o.result;
}
export function gainText(g) {
  const names = { cooperation: "地方协作", people: "地方民生", integrity: "吏治", trust: "上级信任" };
  return Object.keys(g).length ? "（" + Object.entries(g).map(([k, v]) => `${names[k]}+${v}`).join("、") + "，以实际上限结算。）" : "";
}
export function officeStoryCommand(s, c) {
  const key = activeOffice(s), q = s[key], b = s.officeStories.offices[key], defs = OFFICE_CONTENT[key];
  if (!q || !b || q.finished) throw Error("本任已封卷或尚未任命。");
  q.lastLedger = [];
  if (c.type === "office_story") {
    const d = defs.events.find((d) => d.id === c.event), row = d && b.events[d.id], o = d?.options.find((o) => o.id === c.choice);
    if (!d || !o || row?.status !== "pending" || !b.queue.includes(d.id)) throw Error("当前来件或处置无效。");
    if (q.turn + o.after > 156) throw Error("本任已无足够时间查验，请交属员留卷。");
    pay(q, o.cost, d.title + "办理");
    row.choice = o.id; row.decided = q.turn;
    row.status = o.after ? "working" : "delegated"; row.due = o.after ? q.turn + o.after : null;
    if (!o.after) row.completed = q.turn;
    b.queue = b.queue.filter((id) => id !== d.id);
    note(q, `${d.title}：${o.label}。${o.after ? `${o.after}周后回报，不提前计效。` : o.result}`);
    return;
  }
  const d = defs.cases.find((d) => d.id === c.case), f = d && b.cases[d.id];
  if (!d || !f) throw Error("此案尚未立卷。");
  if (c.action === "clue") {
    const clue = d.clues.find((x) => x.id === c.clue);
    if (!clue || !["open", "returned"].includes(f.status) || f.clues.some((x) => x.id === clue.id)) throw Error("此项证据已核或当前不能取证。");
    const cost = sourceClueCost(s, key, d.id, clue.id);
    pay(q, cost, `${d.name} · ${clue.name}`);
    f.clues.push({ id: clue.id, turn: q.turn });
    note(q, `${d.name} · ${clue.name}：${clue.text}`);
    if (cost.silver === 2) note(q, "前事已查验留档，证人或凭据去向有据可循，本项寻访差费由4两减为2两；案情事实不变。");
  } else if (c.action === "review") {
    if (!["open", "returned"].includes(f.status) || !d.options.some((o) => o.id === c.choice)) throw Error("当前不能呈报此案。");
    if (c.choice === "recheck") { note(q, `${d.name}保留疑点，继续核证；没有结案或数值奖励。`); return; }
    if (q.turn + 4 > 156) throw Error("本任已无足够时间复核和执行，须交接留卷。");
    if (c.choice === "evidence" && f.clues.length !== d.clues.length) throw Error("仍须逐项取得证据，不能提前呈报结论。");
    if (f.reviews.some((r) => !r.approved && r.choice === c.choice)) throw Error("这一推断已被退回，请补查并改变处置依据。");
    pay(q, { ap: 1 }, d.name + "呈报");
    f.status = "review"; f.choice = c.choice; f.submitted = q.turn; f.due = q.turn + 2;
    note(q, `${d.name}呈报复核，两周后回报；处置：${d.options.find((o) => o.id === c.choice).label}。`);
  } else if (c.action === "execute") {
    if (f.status !== "approved") throw Error("须复核通过后督促交还或移送。");
    if (f.executed !== null || f.closed !== undefined) throw Error("此案已经安排过执行，不能重复取效。");
    if (q.turn + 2 > 156) throw Error("本任已无足够执行时间。");
    pay(q, { silver: 6, ap: 1 }, d.name + "执行与移送");
    f.status = "executing"; f.executed = q.turn; f.due = q.turn + 2;
    note(q, `${d.name}已督促执行或正式移送，两周后核验回报。`);
  } else throw Error("案件操作无效。");
}
export function officeStoryReceipt(before, after, c) {
  const key = activeOffice(after), a = before[key], b = after[key];
  const names = { silver: "官银", grain: "仓粮", private: "私产", ap: "精力", trust: "上级信任", integrity: "吏治" };
  return { id: c.id, turn: a.turn, chapter: OFFICE_CONTENT[key].label, policies: [], title: c.type === "office_story" ? "剧情处置" : "案卷办理", changes: Object.entries(names).filter(([k]) => a[k] !== b[k]).map(([k, name]) => ({ name, before: a[k], after: b[k], delta: Math.round((b[k] - a[k]) * 100) / 100 })), ledger: b.lastLedger, notes: b.logs.filter((x) => !a.logs.some((old) => old.turn === x.turn && old.text === x.text)).slice(0, 12).reverse().map((x) => x.text) };
}
export function validateOfficeStories(s) {
  const all = s.officeStories, fail = () => { throw Error("府任剧情或来源案卷记录异常。"); };
  if (!all || all.version !== 1 || !all.offices || !all.counts || !all.sources || Array.isArray(all.offices) || Object.keys(all.offices).some((k) => !own(OFFICE_CONTENT, k))) fail();
  const expectedCounts = {}, expectedSources = {};
  for (const [key, defs] of Object.entries(OFFICE_CONTENT)) {
    const q = s[key], b = all.offices[key];
    if (!q) { if (b) fail(); continue; }
    if (!b || !int(b.since, 0, q.turn) || typeof b.legacy !== "boolean" || !Array.isArray(b.queue) || !Array.isArray(b.retiredCases) || new Set(b.queue).size !== b.queue.length || !b.main || !b.events || !b.cases) fail();
    if (JSON.stringify(b.schedule) !== JSON.stringify(scheduleEvents(s, key))) fail();
    const past = defs.events.filter((d) => b.schedule[d.id] <= q.turn);
    if (Object.keys(b.events).length !== past.length || Object.keys(b.events).some((id) => !defs.events.some((d) => d.id === id))) fail();
    for (const d of past) {
      const r = b.events[d.id];
      if (!r) fail();
      if (r.status === "retired") { if (!b.legacy || b.schedule[d.id] > b.since) fail(); continue; }
      if (!int(r.opened, b.schedule[d.id], q.turn) || !["pending", "working", "done", "delegated"].includes(r.status) || typeof r.settled !== "boolean") fail();
      expectedCounts[d.id] = 1;
      const o = d.options.find((o) => o.id === r.choice);
      if (r.status === "pending") { if (q.finished || r.choice !== null || r.due !== null || r.settled || !b.queue.includes(d.id) || q.turn >= r.opened + 8) fail(); }
      else {
        if (!o || b.queue.includes(d.id)) fail();
        if (r.status === "working") { if (!int(r.decided, r.opened, q.turn) || r.due !== r.decided + o.after || r.due <= q.turn || r.due > 156 || r.settled || !o.after) fail(); }
        else if (r.status === "done") { if (!r.settled || !int(r.decided, r.opened, q.turn) || r.completed !== r.decided + o.after || !o.after || r.due !== null) fail(); }
        else if (r.choice !== "delegate" || r.settled || !int(r.completed, r.opened, q.turn) || r.due !== null) fail();
      }
    }
    if (b.queue.some((id) => b.events[id]?.status !== "pending")) fail();
    if (new Set(b.retiredCases).size !== b.retiredCases.length || b.retiredCases.some((id) => !b.legacy || !defs.cases.some((d) => d.id === id && d.week <= b.since))) fail();
    const expectedCases = defs.cases.filter((d) => d.week <= q.turn && !b.retiredCases.includes(d.id));
    if (Object.keys(b.cases).length !== expectedCases.length) fail();
    for (const d of expectedCases) {
      const f = b.cases[d.id];
      if (!f || f.id !== d.id || !int(f.opened, d.week, q.turn) || !Array.isArray(f.clues) || !Array.isArray(f.reviews) || new Set(f.clues.map((x) => x.id)).size !== f.clues.length || f.clues.some((x) => !d.clues.some((c) => c.id === x.id) || !int(x.turn, f.opened, q.turn)) || !["open", "returned", "review", "approved", "executing", "closed", "handover"].includes(f.status)) fail();
      expectedSources[d.source.key] = d.id;
      for (const r of f.reviews) if (!int(r.submitted, f.opened, q.turn) || r.reviewed !== r.submitted + 2 || r.reviewed > q.turn || !["evidence", "hasty"].includes(r.choice) || r.approved !== (r.choice === "evidence") || f.clues.some((x) => r.approved && x.turn > r.submitted)) fail();
      const approved = f.reviews.some((r) => r.approved);
      if (f.status !== "closed" && f.closed !== undefined) fail();
      if (!["executing", "closed"].includes(f.status) && f.executed !== null) fail();
      if (f.status === "open" && (f.choice !== null || f.submitted !== undefined || f.reviews.length)) fail();
      if (f.status === "returned" && !f.reviews.some((r) => !r.approved)) fail();
      if (["approved", "executing", "closed"].includes(f.status) && (!approved || f.clues.length !== d.clues.length || f.choice !== "evidence")) fail();
      if (["approved", "executing", "closed"].includes(f.status) && (!f.reviews.at(-1)?.approved || f.reviews.at(-1).submitted !== f.submitted)) fail();
      if (["review", "executing"].includes(f.status)) {
        const began = f.status === "review" ? f.submitted : f.executed;
        if (!int(began, f.opened, q.turn) || f.due !== began + 2 || f.due <= q.turn || f.due > 156 || (f.status === "review" && (!d.options.some((o) => o.id === f.choice && o.id !== "recheck") || (f.choice === "evidence" && f.clues.length !== d.clues.length)))) fail();
        if (f.status === "executing" && began < f.reviews.at(-1).reviewed) fail();
      } else if (f.due !== null) fail();
      if (f.status === "closed" && (!int(f.executed, f.opened, q.turn) || f.closed !== f.executed + 2 || f.closed > q.turn)) fail();
      if (f.status === "handover" && !q.finished) fail();
      if (q.finished && !["handover", "closed"].includes(f.status)) fail();
    }
    for (const [id, r] of Object.entries(b.main)) if (!/^[TDFACBU]0[1-8]$/.test(id) || !int(r.turn, 0, q.turn) || typeof r.choice !== "string") fail();
  }
  if (Object.keys(all.counts).length !== Object.keys(expectedCounts).length || Object.entries(all.counts).some(([id, n]) => n !== expectedCounts[id] || n > 2)) fail();
  if (Object.keys(all.sources).length !== Object.keys(expectedSources).length || Object.entries(all.sources).some(([id, n]) => n !== expectedSources[id])) fail();
}
