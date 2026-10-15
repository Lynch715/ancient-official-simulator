import { writeFileSync,mkdirSync } from "node:fs";
import { canzhengPrevious,czPlay } from "../tests/helpers/canzheng.js";
import { act } from "../tests/helpers/career.js";
import { validateSave } from "../src/engine.js";
const dir=new URL("../outputs/v0.18/",import.meta.url);mkdirSync(dir,{recursive:true});
for(const hard of [false,true]) {
 const label=hard?"严苛":"常例",start=act(canzhengPrevious(hard),"cz_appoint");
 writeFileSync(new URL(`布政司参政_${label}_开局.json`,dir),JSON.stringify(validateSave(start),null,2));
 const last=czPlay(start);writeFileSync(new URL(`布政司参政_${label}_考满.json`,dir),JSON.stringify(validateSave(last),null,2));
 console.log(`${label}：${last.canzheng.outcome.summary}考语${last.canzheng.outcome.rating}，${last.canzheng.outcome.score}分。`);
}
