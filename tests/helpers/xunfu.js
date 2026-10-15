import { act } from './career.js';
import { buzhengPrevious,bzPlay } from './buzheng.js';
import { XF_MISSIONS,xfTeams,xfDuration,xfBudget } from '../../src/xunfu.js';
import { OFFICE_CONTENT } from '../../src/office-stories.js';
export const xunfuPrevious=(hard=false)=>bzPlay(act(buzhengPrevious(hard),'bz_appoint'));
export function xfNext(s,choice='verify'){if(s.xunfu.event)s=act(s,'xf_event',{choice});return act(s,'xf_advance');}
export function xfPlay(s,{until=156,policy='help',plan='joint',onStep=()=>{}}={}){
 const call=(type,args)=>{s=act(s,type,args);onStep(s,type);};
 while(s.xunfu.turn<until&&!s.xunfu.finished){
  if(s.xunfu.event)call('xf_event',{choice:'verify'});
  for(const id of [...s.officeStories.offices.xunfu.queue]){if(!s.xunfu.ap&&policy!=='delegate')break;call('office_story',{event:id,choice:policy});}
  for(let i=0;i<3&&s.xunfu.ap;i++){
   const q=s.xunfu,items=Object.values(q.missions);let r=items.find(r=>r.status==='ready');
   if(r){call('xf_mission',{mission:r.id,action:'close'});continue;}
   r=items.find(r=>r.status==='reported'&&q.silver>=4&&q.turn+3<=155);if(r){call('xf_mission',{mission:r.id,action:'verify'});continue;}
   const f=Object.values(s.officeStories.offices.xunfu.cases).find(f=>['open','returned','approved'].includes(f.status));
   if(f){const d=OFFICE_CONTENT.xunfu.cases.find(d=>d.id===f.id),clue=d.clues.find(e=>!f.clues.some(x=>x.id===e.id));call('office_case',{case:f.id,action:f.status==='approved'?'execute':clue?'clue':'review',clue:clue?.id,choice:'evidence'});continue;}
   r=items.find(r=>{const b=xfBudget(XF_MISSIONS.find(d=>d.id===r.id),plan);return r.status==='readyToSend'&&xfTeams(q)<2&&q.silver>=b.silver+(q.turn<140?24:8)&&q.grain>=b.grain&&q.turn+xfDuration(q,plan)+3<=155;});
   if(r){call('xf_mission',{mission:r.id,action:'dispatch',plan});continue;}
   r=items.find(r=>r.sent===null&&!r.petition&&XF_MISSIONS.find(d=>d.id===r.id).scope==='cross'&&q.turn+3+xfDuration(q,'urgent')+3<=155);
   if(r){call('xf_mission',{mission:r.id,action:'petition'});continue;}
   r=items.find(r=>r.sent===null&&Object.keys(r.reports).length<2&&q.silver>=3&&q.turn+2+xfDuration(q,'urgent')+3<=155);
   if(r){call('xf_mission',{mission:r.id,action:'consult',agency:XF_MISSIONS.find(d=>d.id===r.id).agencies.find(a=>!r.reports[a.id]).id});continue;}
   break;
  }call('xf_advance',{});
 }return s;
}
