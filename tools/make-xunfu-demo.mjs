import {writeFileSync,mkdirSync} from 'node:fs';
import {xunfuPrevious,xfPlay} from '../tests/helpers/xunfu.js';
import {act} from '../tests/helpers/career.js';
import {validateSave} from '../src/engine.js';
const dir=new URL('../outputs/v0.20/',import.meta.url);mkdirSync(dir,{recursive:true});
for(const hard of [false,true]){const label=hard?'严苛':'常例',start=act(xunfuPrevious(hard),'xf_appoint');writeFileSync(new URL(`奉命巡抚_${label}_开局.json`,dir),JSON.stringify(validateSave(start),null,2));const last=xfPlay(start);writeFileSync(new URL(`奉命巡抚_${label}_复命.json`,dir),JSON.stringify(validateSave(last),null,2));console.log(`${label}：${last.xunfu.outcome.summary}考语${last.xunfu.outcome.rating}，${last.xunfu.outcome.score}分。`);}
