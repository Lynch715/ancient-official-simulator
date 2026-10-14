import { writeFileSync, mkdirSync } from "node:fs";
import { completedTongzhi, act } from "../tests/helpers/career.js";
const old = completedTongzhi();
old.name = "知府体验";
mkdirSync(new URL("../outputs/", import.meta.url), { recursive: true });
const save = (name, state) =>
  writeFileSync(
    new URL("../outputs/" + name, import.meta.url),
    JSON.stringify(state, null, 2),
  );
save("永平府_知府开局体验履历.json", act(old, "zf_appoint"));
const legacy = structuredClone(old);
legacy.version = 5;
delete legacy.zhifu;
save("同知考满_v5升级验收.json", legacy);
