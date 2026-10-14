// 严苛难度：通判、同知、知府三任（v0.13）。
// 只在严苛知县升任时生成 hard 记录；旧档与常例难度的府任不受影响。
// 所有随机量由存档种子推导，同一存档重放结果不变。
import { roll } from "./county-hard.js";

export const OFFICE_HARD = {
  pref: { silver: 300, grain: 400, allot: 8, use: { qinghe: 4, linhe: 5, yongning: 4 }, needs: [60, 60, 80, 100, 120, 120], lowStock: 80 },
  tz: { silver: 780, grain: 420, net: 6, people: [53, 0.006], integrity: [56, 0.009] },
  zf: { silver: 920, grain: 480, net: 8, economyDrift: 0.16, orderDrift: 0.18, goalStep: 6, people: [53, 0.006], integrity: [56, 0.009] },
  integrity: [52, 0.009],
  people: [45, 0.006],
};
const between = (seed, key, min, max) => min + Math.floor(roll(seed, key) * (max - min + 1));
const scale = (seed, key, a, b) => Math.round((a + roll(seed, key) * (b - a)) * 100) / 100;
const round = (n) => Math.round(n * 100) / 100;
const clamp = (n) => Math.max(0, Math.min(100, round(n)));

// 公文周次在原周前后浮动，开任首周与任末交接公文不动。
function jitter(seed, tag, events) {
  const used = new Set(),
    weeks = {};
  for (const e of events) {
    if (e.week === 0 || e.week >= 140) {
      weeks[e.id] = e.week;
      used.add(e.week);
      continue;
    }
    let w = e.week;
    for (let i = 0; i < 20; i++) {
      w = Math.max(1, Math.min(139, e.week + between(seed, `${tag}:${e.id}:${i}`, -5, 5)));
      if (!used.has(w)) break;
    }
    weeks[e.id] = w;
    used.add(w);
  }
  return weeks;
}
export const passLine = (q) => (q?.hard ? 75 : 70);
export const transitLoss = (p, x) =>
  p.hard && x.route === "normal" ? Math.round(x.amount * roll(p.hard.seed, `loss:${x.id}`) * 0.12) : 0;
export const eventWeek = (q, e) => (q.hard?.weeks?.[e.id] ?? e.week);
export const eventAt = (q, list) => list.find((e) => eventWeek(q, e) === q.turn);
export function officeEvent(q, e) {
  if (!q?.hard || !e) return e;
  const seed = q.hard.seed;
  let out = { ...e, options: [...e.options].sort((a, b) => roll(seed, `${e.id}:${a.id}`) - roll(seed, `${e.id}:${b.id}`)) };
  if (e.id === "F02" && q.hard.corrupt) {
    const d = q.counties[q.hard.corrupt[0]];
    const name = d.name.replace("县", "");
    out = {
      ...out,
      text: `${name}知县${d.official.name}素称能办事，账房却发现领款与实际交付可能不符。线索不足以直接定案，须派员调查后报有权机关处置；别县是否干净，也只能查了才知道。`,
      options: out.options.map((o) => (o.id === "separate" ? { ...o, desc: `记下${name}核查线索，吏治增2；调查与接任须在属官卡中实际办理。` } : o)),
    };
  }
  return out;
}

// 每周：吏治与属县民生向常态回落，并累计全任均值。
export function officeDrift(q, peopleRows, anchors = {}) {
  const [ia, ir] = anchors.integrity || OFFICE_HARD.integrity;
  q.integrity = clamp(q.integrity - (q.integrity - ia) * ir);
  const [pa, pr] = anchors.people || OFFICE_HARD.people;
  for (const c of peopleRows) c.people = clamp(c.people - (c.people - pa) * pr);
  q.hard.lifeSum = round(q.hard.lifeSum + peopleRows.reduce((n, c) => n + c.people, 0) / peopleRows.length);
  q.hard.integritySum = round(q.hard.integritySum + q.integrity);
  q.hard.weeksCounted++;
}
export const blendLife = (q, now) => (q.hard?.weeksCounted ? 0.5 * (q.hard.lifeSum / q.hard.weeksCounted) + 0.5 * now : now);
export const blendIntegrity = (q) => (q.hard?.weeksCounted ? 0.5 * (q.hard.integritySum / q.hard.weeksCounted) + 0.5 * q.integrity : q.integrity);
const base = (seed) => ({ seed, lifeSum: 0, integritySum: 0, weeksCounted: 0 });

// —— 通判 ——
export function prefHard(seed, events) {
  const h = base(seed);
  h.weeks = jitter(seed, "pref", events);
  h.needs = Array.from({ length: 12 }, (_, i) => OFFICE_HARD.pref.needs[between(seed, `need:${i}`, 0, OFFICE_HARD.pref.needs.length - 1)]);
  h.spans = Array.from({ length: 12 }, (_, i) => between(seed, `span:${i}`, 8, 13));
  h.second = Array.from({ length: 12 }, (_, i) => roll(seed, `second:${i}`) < 0.35);
  h.lean = { year: between(seed, "lean-year", 0, 2), county: ["qinghe", "linhe", "yongning"][between(seed, "lean-county", 0, 2)] };
  h.shoal = { week: between(seed, "shoal", 140, 150), length: between(seed, "shoal-len", 4, 8) };
  h.blockLength = between(seed, "t05-len", 6, 10);
  h.needTotal = 0;
  return h;
}
export function prefRequest(p, sorted) {
  const i = Math.floor(p.turn / 13),
    h = p.hard;
  const c = h.second[i] ? sorted[1] : sorted[0];
  const need = h.needs[i];
  h.needTotal += need;
  return { county: c.id, need, due: Math.min(156, p.turn + h.spans[i]) };
}

// —— 同知 ——
export function tzHard(seed, events) {
  const h = base(seed);
  h.weeks = jitter(seed, "tz", events);
  h.floods = [
    [20, 30],
    [72, 82],
    [124, 134],
  ].map(([a, b], y) => ({ turn: between(seed, `tz-flood:${y}`, a, b), pressure: 70 + y * 8 + between(seed, `tz-press:${y}`, -6, 12) }));
  h.quality = {
    drain: roll(seed, "q-drain") < 0.35 ? 60 : 85,
    ferry: roll(seed, "q-ferry") < 0.25 ? 65 : 85,
  };
  h.arrivals = { D03: between(seed, "d03", 40, 66), D06: between(seed, "d06", 18, 36) };
  return h;
}
export const tzFloodTurns = (q) => (q.hard ? q.hard.floods.map((f) => f.turn) : [26, 78, 130]);
export const tzPressure = (q, turn) =>
  q.hard ? q.hard.floods.find((f) => f.turn === turn).pressure : 62 + Math.floor(turn / 52) * 6;
export const tzNextFlood = (q) => tzFloodTurns(q).find((t) => t > q.turn) ?? null;

// —— 知府 ——
export function zfHard(seed, events) {
  const h = base(seed);
  h.weeks = jitter(seed, "zf", events);
  const ids = ["qinghe", "linhe", "yongning"];
  const first = ids[between(seed, "corrupt", 0, 2)];
  h.corrupt = [first];
  if (roll(seed, "corrupt2") < 0.35) h.corrupt.push(ids.filter((x) => x !== first)[between(seed, "corrupt2-who", 0, 1)]);
  h.floods = [
    [20, 30],
    [72, 82],
    [124, 134],
  ].map(([a, b], y) => ({ turn: between(seed, `zf-flood:${y}`, a, b), base: between(seed, `zf-sev:${y}`, 18, 34) }));
  return h;
}
export const zfFloodTurns = (q) => (q.hard ? q.hard.floods.map((f) => f.turn) : [26, 78, 130]);
export const zfFloodBase = (q, turn) => (q.hard ? q.hard.floods.find((f) => f.turn === turn).base : 24);
export const isCorrupt = (q, id) => (q.hard ? q.hard.corrupt.includes(id) : id === "linhe");

export function validateOfficeHard(q) {
  const h = q.hard;
  if (h === undefined || h === null) return;
  if (typeof h !== "object" || !Number.isInteger(h.seed) || !h.weeks || typeof h.weeks !== "object") throw Error("严苛府任记录异常。");
  for (const k of ["lifeSum", "integritySum", "weeksCounted"]) if (!Number.isFinite(h[k]) || h[k] < 0) throw Error("严苛府任记录异常。");
  for (const w of Object.values(h.weeks)) if (!Number.isInteger(w) || w < 0 || w > 156) throw Error("严苛府任公文周次异常。");
}
// 只给出八周的大致窗口，窗口位置按种子偏移，不以中点泄露实际汛期。
export function tzFloodWindow(q) {
  const flood = tzNextFlood(q);
  if (flood === null) return null;
  const offset = between(q.hard.seed, `tz-window:${flood}`, 1, 7),
    lo = Math.max(1, flood - offset - q.turn);
  return [lo, Math.max(lo, flood - offset + 8 - q.turn)];
}
