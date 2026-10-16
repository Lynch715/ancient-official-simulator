import fs from 'node:fs';
import assert from 'node:assert/strict';
import {run} from '../tests/helpers/challenge-county.js';
import {runPref,runTz,runZf} from '../tests/helpers/challenge-career.js';
import {inPlay,czPlay,bzPlay,xfPlay} from '../tests/helpers/challenge-late.js';
import {recover} from '../tests/helpers/challenge-recovery.js';
import {act} from '../tests/helpers/career.js';
import {validateSave} from '../src/engine.js';
import {OFFICE_CONTENT} from '../src/office-stories.js';
import {XF_ENDINGS} from '../src/xunfu-data.js';
const dir='outputs/qa/v0.21-review';fs.mkdirSync(dir,{recursive:true});
const rows=[];
for(const family of ['humble','scholar','gentry']) for(const seed of [314159,101,8,13]) {
  let s=run('careful',seed,family);
  const r={family,seed,scores:[],recovered:[],content:{}};
  const finish=role=>{
    const q=role==='county'?s:s[role]; assert.equal(q.turn,156);
    r.scores.push(q.outcome.score);
    if(role!=='county') {
      const b=s.officeStories.offices[role];
      assert.equal(Object.keys(b.main).length,8);
      assert.equal(Object.keys(b.events).length,18);
      assert.equal(Object.keys(b.cases).length,4);
      for(const d of OFFICE_CONTENT[role].events)assert.equal(s.officeStories.counts[d.id],1);
      r.content[role]={stories:q.challenge.stories,cases:q.challenge.cases};
      const workKey={inspector:'dockets',canzheng:'projects',buzheng:'promises',xunfu:'missions'}[role];
      if(workKey)assert.equal(Object.keys(q[workKey]).length,12);
    }
    if(q.outcome.rating!=='称职'){s=recover(s);r.recovered.push(role);}
    assert.deepEqual(validateSave(JSON.parse(JSON.stringify(s))),JSON.parse(JSON.stringify(s)));
  };
  finish('county');
  for(const [role,play]of [['prefecture',runPref],['tongzhi',runTz],['zhifu',runZf]]){s=play(s,'diligent');finish(role);}
  for(const [role,prefix,play]of [['inspector','in',inPlay],['canzheng','cz',czPlay],['buzheng','bz',bzPlay],['xunfu','xf',xfPlay]]){
    s=act(s,prefix+'_appoint');s=play(s,{policy:'check',onStep:(n,type)=>{if(type===prefix+'_advance'&&n[role].turn%13===0)assert.deepEqual(validateSave(JSON.parse(JSON.stringify(n))),JSON.parse(JSON.stringify(n)));}});finish(role);
  }
  s=act(s,'xf_ending',{choice:Object.keys(XF_ENDINGS)[0]});assert(s.xunfu.ending);validateSave(s);
  r.ending=s.xunfu.ending.choice;r.extraWeeks=s.accountability.totalWeeks;
  rows.push(r);fs.writeFileSync(`${dir}/careers.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(r));
}
