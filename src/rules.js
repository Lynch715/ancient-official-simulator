export const TERM_WEEKS = 156;
export const WEEKS_PER_YEAR = 52;
export const WEEKS_PER_SEASON = 13;

export function termLabel(turn, office = "") {
  const week = Math.max(0, Math.min(turn, TERM_WEEKS - 1));
  const season = ["春", "夏", "秋", "冬"][
    Math.floor(week / WEEKS_PER_SEASON) % 4
  ];
  return `${office}第${Math.floor(week / WEEKS_PER_YEAR) + 1}年 · ${season}季第${(week % WEEKS_PER_SEASON) + 1}周`;
}

export function requireTime(turn, weeks, term = TERM_WEEKS) {
  if (turn + weeks > term)
    throw Error(`本任余期不足${weeks}周，无法完成交验；请列入交接。`);
  return turn + weeks;
}

export const canFinish = (turn, weeks, term = TERM_WEEKS) =>
  turn + weeks <= term;
export const adminCost = (s, amount) =>
  Math.max(0, amount - (s.trust >= 75 ? 2 : 0));
