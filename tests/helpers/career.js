import fs from'node:fs';
import{dispatch,validateSave}from'../../src/engine.js';
import{PREF_EVENTS}from'../../src/prefecture.js';
let id=0;
export const act=(s,type,args={})=>dispatch(s,{id:`career-helper-${id++}`,type,...args});
export function completedPrefecture(){let s=validateSave(JSON.parse(fs.readFileSync(new URL('../fixtures/quarter-v1-finished.json',import.meta.url))));s=act(s,'appointment');while(!s.prefecture.finished){let p=s.prefecture;if(p.event){const e=PREF_EVENTS.find(e=>e.id===p.event);s=act(s,'pref_event',{choice:e.options[0].id});p=s.prefecture;}if(p.request.status==='active'&&!p.shipments.some(x=>x.status==='transit'&&x.to===p.request.county)&&p.ap&&p.turn<153){s=act(s,'pref_transfer',{from:p.grain>=60?'府仓':'qinghe',to:p.request.county,amount:60,route:'normal'});p=s.prefecture;}if(p.condition<65&&p.ap)s=act(s,'pref_repair');s=act(s,'pref_advance');}return validateSave(s);}
