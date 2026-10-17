import test from "node:test";
import assert from "node:assert/strict";
import {guideContent} from "../src/guide.js";
import {OFFICE_CONTENT, storyResult} from "../src/office-stories.js";

test("guide follows the office's saved rules, including legacy hard careers", () => {
  for (const balanceVersion of [0, 1]) {
    const hard = guideContent({difficulty: "hard", balanceVersion, prefecture: {hard: {}}});
    assert.match(hard, /每期申请60至140石、限7至12周/);
    assert.doesNotMatch(hard, /每期最多60石|每13周有一县申请60石/);
    const river = guideContent({difficulty: "hard", balanceVersion, prefecture: {hard: {}}, tongzhi: {hard: {}}});
    assert.match(river, /按县情中的汛期预报提前备防/);
    assert.doesNotMatch(river, /每年夏季末有汛情/);
  }
  const standard = guideContent({difficulty: "standard", balanceVersion: 0, prefecture: {}});
  assert.match(standard, /每期最多60石/);
  assert.doesNotMatch(standard, /每期申请60至140石/);
});

test("each check has its own report and the displayed result is the settled result", () => {
  const events = Object.values(OFFICE_CONTENT).flatMap(o => o.events);
  const results = events.map(e => storyResult(e, e.options.find(o => o.id === "check")));
  assert.equal(results.length, 126);
  assert.equal(new Set(results).size, 126);
  for (const e of events) for (const o of e.options) {
    assert.equal(storyResult(e, o), o.result);
    assert.equal(typeof o.result, "string");
    assert(o.result.length > 10);
  }
  const first = events.find(e => e.id === "TP01");
  assert.match(storyResult(first, first.options[1]), /落水地点/);
});
