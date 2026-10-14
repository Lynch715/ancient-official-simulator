import { CASES } from "./data.js";
export function countyDuties(s) {
  if (s.countyPacing === "legacy") return [];
  return CASES.filter((d) => {
    const c = s.cases[d.id];
    return (
      !c ||
      c.status !== "closed" ||
      !["done", "legacy"].includes(c.execution?.status)
    );
  }).map((d) => d.id);
}
