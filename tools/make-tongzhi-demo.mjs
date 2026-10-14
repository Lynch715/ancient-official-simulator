import { writeFileSync, mkdirSync } from "node:fs";
import { completedPrefecture, act } from "../tests/helpers/career.js";
const old = completedPrefecture();
old.name = "同知体验";
mkdirSync(new URL("../outputs/", import.meta.url), { recursive: true });
const save = (name, state) =>
  writeFileSync(
    new URL("../outputs/" + name, import.meta.url),
    JSON.stringify(state, null, 2),
  );
save("永平府_同知开局体验履历.json", act(old, "tz_appoint"));
const legacy = structuredClone(old);
legacy.version = 4;
delete legacy.tongzhi;
save("通判考满_v4升级验收.json", legacy);
