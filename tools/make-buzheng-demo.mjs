import {writeFileSync,mkdirSync} from 'node:fs';
import {buzhengPrevious,bzPlay} from '../tests/helpers/buzheng.js';
import {act} from '../tests/helpers/career.js';
import {validateSave} from '../src/engine.js';
const dir=new URL('../outputs/v0.19/',import.meta.url);mkdirSync(dir,{recursive:true});
for(const hard of [false,true]){const label=hard?'严苛':'常例',start=act(buzhengPrevious(hard),'bz_appoint');writeFileSync(new URL(`布政使_${label}_开局.json`,dir),JSON.stringify(validateSave(start),null,2));const last=bzPlay(start);writeFileSync(new URL(`布政使_${label}_考满.json`,dir),JSON.stringify(validateSave(last),null,2));console.log(`${label}：${last.buzheng.outcome.summary}考语${last.buzheng.outcome.rating}，${last.buzheng.outcome.score}分。`);}
