import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch, validateSave, VERSION } from "../src/engine.js";
import { IN_DOCKETS, IN_EVENTS, inspectorAssessment, inspectorHard, inTeams } from "../src/inspector.js";
import { OFFICE_CONTENT, blankOfficeStories, syncOfficeStories } from "../src/office-stories.js";
import { act } from "./helpers/career.js";
import { inspectorPrevious, inNext, inPlay } from "./helpers/inspector.js";
import { inspectorView } from "../src/inspector-view.js";
import { guideContent } from "../src/guide.js";
const previous = inspectorPrevious(), hardPrevious = inspectorPrevious(true);
const start = (hard = false) => act(hard ? hardPrevious : previous, "in_appoint");
const weeks = (s, n) => { for (let i = 0; i < n; i++) s = inNext(s); return s; };
const roundtrip = (s) => { const json = JSON.parse(JSON.stringify(s)); assert.deepEqual(validateSave(json), json); assert.equal(dispatch(s, { id: s.completedCommands.at(-1), type: "in_advance" }), s); };

test("副使平级转任完整承接私产，旧任公账冻结且任命幂等", () => {
  assert.throws(() => act(createGame(), "in_appoint"));
  const c = { id: "in-once", type: "in_appoint" }, s = dispatch(previous, c);
  assert.equal(s.inspector.silver, 480); assert.equal(s.inspector.private, previous.zhifu.private);
  for (const key of ["prefecture", "tongzhi", "zhifu"]) assert.deepEqual(s[key], previous[key]);
  assert.equal(dispatch(s, c), s);
  for (const type of ["in_appoint", "zf_advance", "zf_appoint", "tz_advance", "pref_advance", "advance"]) assert.throws(() => act(s, type));
  roundtrip(s); assert.equal(start(true).inspector.silver, 320);
});
test("v12升级仅增副使空字段；原三任书卷、钱粮与旧考语原样保留", () => {
  for (const original of [previous, hardPrevious, createGame()]) {
    const old = structuredClone(original); old.version = 12; delete old.inspector; delete old.balanceVersion;
    const copy = structuredClone(old), n = validateSave(old);
    assert.equal(n.version, VERSION); assert.equal(n.inspector, null);
    const stripped = structuredClone(n); stripped.version = 12; delete stripped.inspector; assert.equal(n.balanceVersion, 0); delete stripped.balanceVersion;
    assert.deepEqual(stripped, old); assert.deepEqual(old, copy);
    if (n.zhifu) roundtrip(act(n, "in_appoint"));
  }
});
test("两条巡路只改变时间与费用，两组上限、到场及独立证据不可跳过", () => {
  let s = act(start(), "in_event", { choice: "verify" });
  const pre = structuredClone(s), initial = s.inspector.silver;
  assert.throws(() => act(s, "in_docket", { docket: "IR01", action: "clue", clue: "p1" }));
  s = act(s, "in_docket", { docket: "IR01", action: "visit", route: "direct" });
  assert.equal(s.inspector.dockets.IR01.due, 1); assert.equal(s.inspector.silver, initial - 16);
  s = act(s, "in_docket", { docket: "IR02", action: "visit", route: "ordinary" });
  assert.equal(inTeams(s.inspector), 2);
  assert.throws(() => act(s, "in_docket", { docket: "IR03", action: "visit", route: "ordinary" }));
  s = inNext(s); assert.equal(s.inspector.dockets.IR01.status, "onsite");
  assert.throws(() => act(s, "in_docket", { docket: "IR01", action: "submit" }));
  s = act(s, "in_docket", { docket: "IR01", action: "clue", clue: "p1" });
  assert.throws(() => act(s, "in_docket", { docket: "IR01", action: "clue", clue: "p1" }));
  s = act(s, "in_docket", { docket: "IR01", action: "clue", clue: "p2" });
  s = act(s, "in_docket", { docket: "IR01", action: "submit" }); roundtrip(s);
  s = weeks(s, 2); assert.equal(s.inspector.dockets.IR01.status, "approved");
  s = act(s, "in_docket", { docket: "IR01", action: "execute" });
  const score = inspectorAssessment(s).score;
  s = weeks(s, 3); assert.equal(s.inspector.dockets.IR01.status, "ready"); assert.equal(inspectorAssessment(s).score, score);
  s = act(s, "in_docket", { docket: "IR01", action: "accept" });
  assert(inspectorAssessment(s).score > score);
  assert.throws(() => act(s, "in_docket", { docket: "IR01", action: "accept" }));
  assert.throws(() => act(s, "in_docket", { docket: "IR01", action: "visit", route: "direct" })); roundtrip(s);
  assert.equal(pre.inspector.silver, initial);
});
for (const hard of [false, true]) for (const policy of ["help", "check", "delegate"]) {
  test(`${hard ? "严苛" : "常例"}完整第五任 ${policy}：156周、8主线、18剧情、12验收和4案归档`, () => {
    const old = hard ? hardPrevious : previous;
    const s = inPlay(start(hard), { policy, onStep: roundtrip });
    assert.equal(s.inspector.turn, 156); assert(s.inspector.outcome.candidate);
    assert.equal(Object.values(s.inspector.dockets).filter((r) => r.status === "closed").length, 12);
    const b = s.officeStories.offices.inspector;
    assert.equal(Object.keys(b.main).length, 8); assert.equal(Object.keys(b.events).length, 18);
    assert.equal(Object.values(b.cases).filter((r) => r.status === "closed").length, 4);
    for (const d of OFFICE_CONTENT.inspector.events) assert.equal(s.officeStories.counts[d.id], 1);
    for (const key of ["prefecture", "tongzhi", "zhifu"]) assert.deepEqual(s[key], old[key]);
    assert.throws(() => act(s, "in_advance"));
    assert.deepEqual(s.inspector.outcome, inspectorAssessment(s));
  });
}
test("八份主线的全部选项可存取，违规留下对应证据且任满启动查核", () => {
  let s = start();
  for (const e of IN_EVENTS) {
    s = weeks(s, e.week - s.inspector.turn);
    for (const o of e.options) {
      const n = act(s, "in_event", { choice: o.id }); roundtrip(n);
      if (o.misconduct) assert(n.accountability.incidents.some((i) => i.role === "inspector" && i.week === e.week));
    }
    s = act(s, "in_event", { choice: "verify" });
  }
  let bad = act(start(), "in_event", { choice: "shortcut" }); bad = weeks(bad, 156);
  assert.equal(bad.inspector.outcome.rating, "候查"); assert.equal(bad.accountability.current.status, "inquiry"); roundtrip(bad);
});
test("四案草率推断退回，补全证据后执行；关闭后不能换编号重领", () => {
  let s = start();
  for (const d of OFFICE_CONTENT.inspector.cases) {
    s = weeks(s, d.week - s.inspector.turn);
    s = act(s, "office_case", { case: d.id, action: "review", choice: "hasty" }); s = weeks(s, 2);
    assert.equal(s.officeStories.offices.inspector.cases[d.id].status, "returned");
    assert.throws(() => act(s, "office_case", { case: d.id, action: "review", choice: "hasty" }));
    for (const clue of d.clues) s = act(s, "office_case", { case: d.id, action: "clue", clue: clue.id });
    s = inNext(s); s = act(s, "office_case", { case: d.id, action: "review", choice: "evidence" }); s = weeks(s, 2);
    s = act(s, "office_case", { case: d.id, action: "execute" }); s = weeks(s, 2);
    assert.equal(s.officeStories.offices.inspector.cases[d.id].status, "closed");
    assert.throws(() => act(s, "office_case", { case: d.id, action: "execute" })); roundtrip(s);
  }
});
test("任末最晚呈核150、督催152、验收155，来源案156到期计入考语", () => {
  let s = start(); s = act(s, "in_event", { choice: "verify" });
  s = act(s, "in_docket", { docket: "IR01", action: "visit", route: "ordinary" }); s = weeks(s, 150);
  for (const clue of ["p1", "p2"]) s = act(s, "in_docket", { docket: "IR01", action: "clue", clue });
  s = act(s, "in_docket", { docket: "IR01", action: "submit" }); s = weeks(s, 2);
  s = act(s, "in_docket", { docket: "IR01", action: "execute" });
  s = act(s, "in_event", { choice: "refer" });
  for (const clue of ["e1", "e2"]) s = act(s, "office_case", { case: "IC04", action: "clue", clue });
  // 另一分支把案件在152周呈核，154周执行，156周归档。
  let terminal = weeks(start(), 151);
  for (const clue of ["e1", "e2", "e3"]) terminal = act(terminal, "office_case", { case: "IC04", action: "clue", clue });
  terminal = inNext(terminal); terminal = act(terminal, "in_event", { choice: "refer" });
  terminal = act(terminal, "office_case", { case: "IC04", action: "review", choice: "evidence" }); terminal = weeks(terminal, 2);
  terminal = act(terminal, "office_case", { case: "IC04", action: "execute" }); terminal = weeks(terminal, 2);
  assert.equal(terminal.officeStories.offices.inspector.cases.IC04.status, "closed");
  assert.match(terminal.inspector.outcome.summary, /归档1\/4/); roundtrip(terminal);
  s = weeks(s, 3); s = act(s, "in_docket", { docket: "IR01", action: "accept" }); s = inNext(s);
  assert.equal(s.inspector.dockets.IR01.status, "closed"); roundtrip(s);
  const late = weeks(start(), 153);
  assert.throws(() => act(late, "in_docket", { docket: "IR03", action: "visit", route: "direct" }));
});
test("未办理任满不虚构成果，全部未竟移交，低分进入非刑事复考", () => {
  const s = weeks(start(), 156);
  assert(Object.values(s.inspector.dockets).every((r) => r.status === "handover"));
  assert(Object.values(s.officeStories.offices.inspector.events).every((r) => r.status === "delegated"));
  assert(Object.values(s.officeStories.offices.inspector.cases).every((r) => r.status === "handover"));
  assert.equal(s.accountability.current.status, "notice"); assert.equal(s.accountability.incidents.length, 0); roundtrip(s);
});
test("公账、重复证据、提前批复与漏主线存档均拒绝；无副作用", () => {
  const s = inPlay(start(), { until: 20 });
  for (const mutate of [n => n.inspector.silver++, n => n.inspector.dockets.IR01.clues.push({ id: "p1", turn: 2 }), n => n.inspector.dockets.IR01.approved--, n => delete n.officeStories.offices.inspector.main.A01, n => n.inspector.dockets.IR01.status = "approved"]) {
    const n = structuredClone(s); mutate(n); const copy = structuredClone(n); assert.throws(() => validateSave(n)); assert.deepEqual(n, copy);
  }
});
test("一千个严苛排程覆盖156周，剧情最多一次、相邻叙事入口不超8周", () => {
  for (let seed = 1; seed <= 1000; seed++) {
    const s = { seed, officeStories: blankOfficeStories(), inspector: { turn: 0, finished: false, logs: [], nextLog: 1, hard: inspectorHard(seed) } };
    syncOfficeStories(s);
    const values = Object.values(s.officeStories.offices.inspector.schedule);
    assert.equal(new Set(values).size, 18);
    const anchors = [...new Set([0,156,...values,...Object.values(s.inspector.hard.weeks),...OFFICE_CONTENT.inspector.cases.map(d=>d.week)])].sort((a,b)=>a-b);
    for(let i=1;i<anchors.length;i++) assert(anchors[i]-anchors[i-1]<=8);
  }
});
test("全部新旧剧情标题与来源不重复，新章渲染及指南覆盖实际操作", () => {
  const events = Object.values(OFFICE_CONTENT).flatMap((d) => d.events), sources = Object.values(OFFICE_CONTENT).flatMap(d=>d.cases.map(c=>c.source.key));
  for (const key of ["id", "title", "text"]) assert.equal(new Set(events.map(e=>e[key])).size,events.length);
  assert.equal(new Set(sources).size,sources.length);
  const h = { esc: String, num: String, scene:()=>"", portrait:()=>"", avatar:()=>"", icon:()=>"", btn:(label)=>label };
  assert.match(inspectorView(start(),h), /两项证据/); assert.match(guideContent(start()),/十二项巡案/);
});
