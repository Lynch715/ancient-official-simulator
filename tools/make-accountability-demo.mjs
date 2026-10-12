import fs from'node:fs';
import{createGame,validateSave}from'../src/engine.js';import{EVENTS}from'../src/data.js';import{PREF_EVENTS}from'../src/prefecture.js';import{act}from'../tests/helpers/career.js';
fs.mkdirSync(new URL('../outputs/qa/',import.meta.url),{recursive:true});
const write=(name,s)=>fs.writeFileSync(new URL('../outputs/'+name,import.meta.url),JSON.stringify(validateSave(s),null,2));
let s=createGame({name:'整改体验'});while(!s.finished){for(const row of s.events){const o=EVENTS[row.id].options.toReversed().find(o=>Object.entries(o.cost).every(([k,v])=>s[k]>=v)&&!o.flags?.bribe&&!o.flags?.destroyed&&!o.flags?.concealed);if(o)s=act(s,'event',{event:row.id,choice:o.id});}s=act(s,'advance');}if(!s.accountability.current)throw Error('体验档未触发整改');write('考课_整改开局体验履历.json',s);
s=act(s,'ac_begin');while(s.accountability.current.status!=='cleared'){let p=s.accountability.current;for(const t of p.targets){if(p.ap&&p.pending.length<2&&t.done+p.pending.filter(x=>x.topic===t.id).length<t.required&&p.week+2<=p.deadline){s=act(s,'ac_work',{topic:t.id});p=s.accountability.current;}}if(p.status==='retest'&&p.week===p.deadline-1)write('qa/考课_复考将满.json',s);s=act(s,'ac_advance');}
write('qa/考课_复考通过.json',s);
let c=validateSave(JSON.parse(fs.readFileSync(new URL('../tests/fixtures/quarter-v1-finished.json',import.meta.url))));c.name='查案体验';c=act(c,'appointment');while(!c.prefecture.finished){const p=c.prefecture;if(p.event){const e=PREF_EVENTS.find(e=>e.id===p.event);c=act(c,'pref_event',{choice:e.id==='T03'?'allow':e.options[0].id});}c=act(c,'pref_advance');}write('考课_查案申辩体验履历.json',c);
console.log('整改与查案体验履历已按正式流程生成。');
