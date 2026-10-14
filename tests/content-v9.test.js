import { familyRecovery } from "../src/county-content.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  dispatch,
  validateSave,
  VERSION,
  budgetForecast,
} from "../src/engine.js";
import { countyEvent, caseChoices } from "../src/county-content.js";
import {
  countyCase,
  zhifuCase,
  CASE_VARIANTS,
  chooseCaseVariant,
} from "../src/case-content.js";
import { ACTIONS, CASES } from "../src/data.js";
import { ZF_CASES, ZF_EVENTS } from "../src/zhifu-data.js";
import { adminCost, canFinish } from "../src/rules.js";
import { actionUsable, projectBenefit } from "../src/county-rules.js";
import { prefAssessment } from "../src/prefecture.js";
import { auditCost, zfAssessment } from "../src/zhifu.js";
import {
  act,
  completedPrefecture,
  completedTongzhi,
} from "./helpers/career.js";
function week(s) {
  for (const row of [...s.events].filter((e) => e.mandatory)) {
    const e = countyEvent(s, row.id),
      o = e.options.find((o) =>
        Object.entries(o.cost).every(([k, v]) => s[k] >= v),
      );
    s = act(s, "event", { event: row.id, choice: o.id });
  }
  return act(s, "advance");
}
function countyAt(turn) {
  let s = createGame({ difficulty: "standard" });
  while (s.turn < turn) s = week(s);
  return s;
}
function residentState(count, grain) {
  let s = createGame({ difficulty: "standard" });
  s.events = [];
  s.turn = 1;
  s.displaced = count;
  s.populationLedger.opening = count;
  s.grain = grain;
  return validateSave(s);
}
test("断粮不伪减人口，口粮与回访、政策和救济保留可核对去向", () => {
  let s = residentState(20, 0),
    n = act(s, "advance");
  assert.equal(n.displaced, 20);
  assert.equal(n.populationLedger.settled, 0);
  assert(n.populationLedger.shortage > 0);
  assert.deepEqual(validateSave(n), n);
  s = residentState(20, 10);
  n = act(s, "advance");
  assert.equal(n.displaced, 18);
  assert.equal(n.populationLedger.settled, 2);
  assert.match(n.receipts[0].notes.join(" "), /回访核验2人/);
  s = residentState(1, 20);
  n = act(s, "relief");
  assert.equal(n.displaced, 0);
  assert.equal(n.populationLedger.settled, 1);
  assert.match(n.receipts[0].notes.join(" "), /落实1人/);
  assert.deepEqual(validateSave(n), n);
  s = residentState(3, 20);
  s = act(s, "policy", { category: "relief", choice: "kitchen" });
  n = act(s, "advance");
  assert.equal(n.populationLedger.settled, 3);
  assert.equal(n.displaced, 0);
  assert.deepEqual(validateSave(n), n);
  const bad = structuredClone(n);
  bad.populationLedger.settled++;
  assert.throws(() => validateSave(bad), /人口/);
});

test("缺药登记不提前安置居民，真实照护只结算现有人数", () => {
  let s = residentState(20, 0);
  s.turn = 130;
  s.events = [{ id: "X13", mandatory: true }];
  const n = act(s, "event", { event: "X13", choice: "request" });
  assert.equal(n.displaced, 20);
  assert.equal(n.populationLedger.settled, 0);
  assert.deepEqual(validateSave(n), n);
  s.grain = 30;
  const care = act(s, "event", { event: "X13", choice: "water" });
  assert.equal(care.displaced, 0);
  assert.equal(care.populationLedger.settled, 20);
  assert.deepEqual(validateSave(care), care);
});

test("上下限动作不扣无效精力，汛前准备封顶且汛后不再虚增", () => {
  let s = createGame({ difficulty: "standard" });
  s.events = [];
  s.order = 100;
  s.patrol = 3;
  s.turn = 100;
  const before = structuredClone(s);
  assert.equal(actionUsable(s, "patrol"), false);
  assert.throws(() => act(s, "action", { action: "patrol" }), /新增收益/);
  assert.deepEqual(s, before);
  s.order = 99;
  let n = act(s, "action", { action: "patrol" });
  assert(n.order > 99);
  assert.equal(n.patrol, 3);
  assert.match(n.receipts[0].notes.join(" "), /不再积累/);
  s.turn = 20;
  s.order = 100;
  s.patrol = 2;
  n = act(s, "action", { action: "patrol" });
  assert.equal(n.patrol, 3);
  assert.equal(n.order, 100);
  s.fatigue = 0;
  assert.equal(actionUsable(s, "rest"), false);
});

test("地方督办和修护正文按实际封顶差值说明", () => {
  let s = createGame({ difficulty: "standard" });
  s.events = [];
  s.governance.districts.fields.livelihood = 99;
  s.governance.relations.farmer = 99;
  let n = act(s, "district", { district: "fields", kind: "livelihood" });
  assert.match(n.receipts[0].notes.join(" "), /99 → 100，实际增加1/);
  assert(!n.receipts[0].notes.join(" ").includes("生计+10"));
  s.projects = [
    {
      id: "canal",
      status: "complete",
      remaining: 0,
      condition: 95,
      started: 0,
    },
  ];
  n = act(s, "repair", { project: "canal" });
  assert.match(n.receipts[0].notes.join(" "), /实际恢复5点/);
});

test("工程状况折算防洪、秋收与商路收入，旧交付不会重播", () => {
  const flood = (condition) => {
    let s = createGame({ difficulty: "standard" });
    s.turn = 65;
    s.events = [{ id: "X12", mandatory: true }];
    s.projects = [
      {
        id: "embankment",
        status: "complete",
        condition,
        remaining: 0,
        started: 0,
      },
    ];
    s.projectsCompleted = 1;
    return act(s, "event", { event: "X12", choice: "evacuate" });
  };
  assert(flood(1).displaced > flood(50).displaced);
  assert(flood(50).displaced > flood(100).displaced);
  let s = createGame({ difficulty: "standard" });
  s.events = [];
  s.projects = [
    { id: "road", status: "complete", condition: 50, remaining: 0, started: 0 },
  ];
  s.projectsCompleted = 1;
  assert.equal(projectBenefit(s, "road"), 0.5);
  let before = budgetForecast(s).income;
  s.projects[0].condition = 100;
  assert(budgetForecast(s).income > before);
  const harvest = (condition) => {
    let s = createGame({ difficulty: "standard" });
    s.events = [];
    s.turn = 38;
    s.projects = [
      { id: "canal", status: "complete", condition, remaining: 0, started: 0 },
    ];
    s.projectsCompleted = 1;
    return act(s, "advance").grain - s.grain;
  };
  assert.equal(harvest(100) - harvest(50), 60);
});

test("县任和知府拟判同时留足四周，界面与引擎一致", () => {
  for (const turn of [152, 153, 154]) {
    let s = createGame({ difficulty: "standard" });
    s.events = [];
    s.turn = turn;
    s.cases.boundary = {
      id: "boundary",
      clues: CASES[0].clues.map((c) => c.id),
      status: "open",
      judgment: null,
      due: null,
    };
    const buttons = [];
    caseChoices(
      s,
      CASES[0],
      s.cases.boundary,
      (label, action, attrs, cls, disabled) => {
        if (attrs?.includes('data-choice="good"')) buttons.push(disabled);
        return "";
      },
    );
    assert.equal(buttons[0], !canFinish(turn, 4));
    if (turn === 152)
      assert.equal(
        act(s, "judge", { case: "boundary", choice: "good" }).cases.boundary
          .status,
        "review",
      );
    else
      assert.throws(
        () => act(s, "judge", { case: "boundary", choice: "good" }),
        /4周/,
      );
    let z = act(completedTongzhi(), "zf_appoint");
    z.zhifu.turn = turn;
    z.zhifu.event = null;
    z.zhifu.cases.water = {
      id: "water",
      clues: ZF_CASES[0].clues.map((c) => c.id),
      status: "open",
      due: null,
    };
    if (turn === 152)
      assert.equal(
        act(z, "zf_case", { case: "water", action: "review" }).zhifu.cases.water
          .status,
        "review",
      );
    else
      assert.throws(
        () => act(z, "zf_case", { case: "water", action: "review" }),
        /4周/,
      );
  }
});

test("156周来信内容每版至多一次，有新县情才续发，展示及跳过均持久退场", () => {
  let s = createGame({ difficulty: "standard" }),
    seen = new Set(),
    count = 0;
  while (!s.finished) {
    for (const row of s.events.filter((e) => e.id.startsWith("W"))) {
      assert(row.contentKey);
      assert(!seen.has(row.contentKey));
      seen.add(row.contentKey);
      count++;
    }
    s = validateSave(week(s));
  }
  assert(count >= 8 && count <= 16);
  assert.equal(Object.keys(s.contentSeen).length, count);
  let n = countyAt(9);
  assert(!n.events.some((e) => e.id === "W02"));
  n.projects.push({
    id: "road",
    status: "complete",
    remaining: 0,
    condition: 100,
    started: 0,
  });
  n.projectsCompleted = 1;
  let found = false;
  while (n.turn < 30) {
    n = week(n);
    const row = n.events.find((e) => e.id === "W02");
    if (row) {
      assert.equal(row.contentKey, "W02.next");
      assert.match(countyEvent(n, "W02").text, /修整/);
      found = true;
      break;
    }
  }
  assert(found);
});

test("没有待安置居民不强发赈棚拥挤事件，仍有居民时保留照护", () => {
  for (const count of [0, 100]) {
    let s = residentState(count, 100);
    s.turn = 129;
    s.flags.reliefCamp = true;
    const n = act(s, "advance");
    assert.equal(
      n.events.some((e) => e.id === "X13"),
      count > 0,
    );
    assert.equal(
      n.events.some((e) => e.id === "G06"),
      count === 0,
    );
  }
});

test("18种案情保持证据与处置独立，选择后读档不换案情", () => {
  const names = new Set();
  for (const variant of CASE_VARIANTS) {
    for (const base of CASES) {
      let s = createGame({ difficulty: "standard" });
      s.cases[base.id] = { variant };
      const d = countyCase(s, base.id);
      names.add(d.name);
      assert.equal(d.clues.length, base.clues.length);
      assert.equal(new Set(d.clues.map((c) => c.id)).size, d.clues.length);
      assert(d.good && d.bad && d.good !== d.bad);
    }
    for (const base of ZF_CASES) {
      const q = { cases: { [base.id]: { variant } } },
        d = zhifuCase(q, base.id);
      names.add(d.name);
      assert.equal(d.clues.length, 2);
      assert(d.finding);
    }
  }
  assert.equal(names.size, 18);
  const variants = new Set(
    Array.from({ length: 30 }, (_, i) => chooseCaseVariant(i, "boundary")),
  );
  assert.equal(variants.size, 3);
  let s = createGame({ difficulty: "standard", seed: 78 });
  while (s.turn < 5) s = week(s);
  const d = countyCase(s, "boundary");
  assert.deepEqual(countyCase(validateSave(s), "boundary"), d);
  const v = s.cases.boundary.variant;
  s.seed = 99;
  assert.equal(s.cases.boundary.variant, v);
  assert.deepEqual(countyCase(s, "boundary"), d);
});

test("v8迁移保留人口期初、正在办理的来信和原案事实，不补造旧收益", () => {
  let s = countyAt(5);
  const old = structuredClone(s);
  old.version = 8;
  delete old.contentSeen;
  delete old.populationLedger;
  for (const file of Object.values(old.cases)) delete file.variant;
  for (const row of old.events) delete row.contentKey;
  const next = validateSave(old);
  assert.equal(next.version, VERSION);
  assert.equal(next.populationLedger.opening, old.displaced);
  assert.equal(next.populationLedger.settled, 0);
  assert.equal(next.cases.boundary.variant, "original");
  assert.equal(next.silver, old.silver);
  assert(
    next.events.every(
      (row) => !row.id.startsWith("W") || row.contentKey === "legacy",
    ),
  );
  assert.deepEqual(old.version, 8);
  let complete = completedPrefecture();
  const score = complete.prefecture.outcome.score;
  complete.version = 8;
  delete complete.contentSeen;
  delete complete.populationLedger;
  const migrated = validateSave(complete);
  assert.equal(migrated.prefecture.outcome.score, score);
  assert.equal(prefAssessment(migrated.prefecture).score, score);
});

test("信任只优惠差费而不增加考绩，F04底册优惠恰好两次不重复抵扣", () => {
  let p = act(completedTongzhi(), "zf_appoint");
  const q = p.zhifu;
  assert.equal(adminCost({ trust: 74 }, 12), 12);
  assert.equal(adminCost({ trust: 75 }, 12), 10);
  assert.equal(
    zfAssessment({ ...q, trust: 0 }).score,
    zfAssessment({ ...q, trust: 100 }).score,
  );
  q.event = "F04";
  q.trust = 75;
  const silver = q.silver;
  p = act(p, "zf_event", { choice: "sample" });
  assert.equal(p.zhifu.silver, silver - 8);
  assert.equal(p.zhifu.auditCredits, 2);
  assert.equal(auditCost(p.zhifu), 6);
  for (let i = 0; i < 3; i++) {
    p.zhifu.tasks.push({
      id: 100 + i,
      status: "reported",
      county: "qinghe",
      kind: "economy",
      actual: 8,
      diverted: 0,
      official: "许明远",
    });
    p.zhifu.ap = 3;
    const before = p.zhifu.silver,
      fee = i < 2 ? 6 : 10;
    p = act(p, "zf_audit", { idTask: 100 + i });
    assert.equal(p.zhifu.silver, before - fee);
    p.zhifu.tasks.at(-1).status = "verified";
    assert.equal(p.zhifu.auditCredits, Math.max(0, 1 - i));
  }
});

test("所有18种案情均可按证据完成复核执行，读档不重放结案", () => {
  const seedFor = (id, variant) => {
    if (variant === "original") return 314159;
    for (let seed = 0; seed < 1000; seed++)
      if (chooseCaseVariant(seed, id) === variant) return seed;
    throw Error("missing seed");
  };
  for (const variant of CASE_VARIANTS)
    for (const base of CASES) {
      let s = createGame({ difficulty: "standard", seed: seedFor(base.id, variant) });
      while (s.turn < base.open) s = week(s);
      const pinned = countyCase(s, base.id);
      for (const clue of pinned.clues) {
        if (!s.ap) s = week(s);
        s = act(s, "investigate", { case: base.id, clue: clue.id });
      }
      s = act(s, "judge", { case: base.id, choice: "good" });
      s = week(week(s));
      s = act(s, "enforce", { case: base.id });
      s = week(week(s));
      assert.equal(s.cases[base.id].execution.status, "done");
      assert.deepEqual(countyCase(validateSave(s), base.id), pinned);
      assert.throws(() => act(s, "enforce", { case: base.id }), /无需/);
    }
  const start = completedTongzhi();
  const zweek = (s) => {
    if (s.zhifu.event) {
      const e = ZF_EVENTS.find((e) => e.id === s.zhifu.event),
        o = e.options.find((o) =>
          Object.entries(o.cost).every(([k, v]) => s.zhifu[k] >= v),
        );
      s = act(s, "zf_event", { choice: o.id });
    }
    return act(s, "zf_advance");
  };
  for (const variant of CASE_VARIANTS)
    for (const base of ZF_CASES) {
      let s = act(
        { ...structuredClone(start), seed: seedFor(base.id, variant) },
        "zf_appoint",
      );
      while (s.zhifu.turn < base.week) s = zweek(s);
      const pinned = zhifuCase(s.zhifu, base.id);
      for (const clue of pinned.clues)
        s = act(s, "zf_case", { case: base.id, action: "clue", clue: clue.id });
      s = act(s, "zf_case", { case: base.id, action: "review" });
      s = zweek(zweek(s));
      s = act(s, "zf_case", { case: base.id, action: "execute" });
      s = zweek(zweek(s));
      assert.equal(s.zhifu.cases[base.id].status, "closed");
      assert.deepEqual(zhifuCase(validateSave(s).zhifu, base.id), pinned);
      assert.throws(
        () => act(s, "zf_case", { case: base.id, action: "execute" }),
        /先完成/,
      );
    }
});

test("去重后的家书仍能实达到家计关系阈值", () => {
  let s = createGame({ difficulty: "standard" });
  while (s.turn < 80) {
    if (s.events.some((row) => row.id === "G02"))
      s = act(s, "event", {
        event: "G02",
        choice: countyEvent(s, "G02").options[0].id,
      });
    const mail = s.events.find(
      (row) => row.id === "W08" && row.contentKey === "W08.next",
    );
    if (mail) {
      const before = s.family;
      s = act(s, "event", {
        event: "W08",
        choice: countyEvent(s, "W08").options[0].id,
      });
      assert.equal(s.family - before, 5);
      assert(s.family >= 75);
      assert.equal(familyRecovery(s), 1);
      return;
    }
    s = week(s);
  }
  throw Error("后续家书未出现");
});
