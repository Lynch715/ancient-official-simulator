import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EVENTS, PEOPLE } from "../src/data.js";
import { TZ_EVENTS, TZ_PROJECTS } from "../src/tongzhi.js";
import { ZF_EVENTS } from "../src/zhifu.js";
import { OFFICIALS } from "../src/officials.js";

test("event speakers, independent officials and all wardrobe slots have declared runtime art", () => {
  const assets = JSON.parse(
    fs.readFileSync(new URL("../assets/art/manifest.json", import.meta.url)),
  ).assets;
  for (const event of [...Object.values(EVENTS), ...TZ_EVENTS, ...ZF_EVENTS])
    if (event.speaker) {
      assert(
        PEOPLE.some((p) => p.id === event.speaker),
        `unknown speaker ${event.speaker}`,
      );
      assert(
        assets["avatar_" + event.speaker],
        `missing speaker art ${event.speaker}`,
      );
    }
  for (const person of Object.values(OFFICIALS))
    assert(assets["avatar_" + person.id]);
  for (const appearance of ["a", "b", "c"])
    for (const role of ["prefecture", "tongzhi", "zhifu"])
      assert(assets[`portrait_player_${appearance}_${role}`]);
  assert(assets.scene_prefecture_hall);
  assert(assets.scene_embankment_calm);
  for (const project of TZ_PROJECTS) assert(assets[project.scene]);
});
