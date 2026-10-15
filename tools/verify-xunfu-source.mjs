import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {XF_SOURCE_CASES} from '../src/xunfu-cases.js';
const root=resolve(process.argv[2]||'outputs/qa/v0.19/source-KR3c0007');
const commit=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const rows=XF_SOURCE_CASES.map(d=>{const bytes=readFileSync(resolve(root,d.source.file)),sha256=createHash('sha256').update(bytes).digest('hex'),excerpt=bytes.toString('utf8').split('\n').slice(d.source.lines[0]-1,d.source.lines[1]).join('\n');if(commit!==d.source.commit||sha256!==d.source.sha256||!excerpt.includes(d.source.chapter))throw Error(d.id+' source mismatch');return {id:d.id,name:d.name,chapter:d.source.chapter,file:d.source.file,lines:d.source.lines,commit,sha256,verified:true,excerpt};});
console.log(JSON.stringify(rows,null,2));
