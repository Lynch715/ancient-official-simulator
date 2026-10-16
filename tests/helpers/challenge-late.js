// Deterministic player: obeys visible costs, waits when funds are short, never edits game state.
import {act} from './career.js';
import {IN_DOCKETS,inTeams,inTravel} from '../../src/inspector.js';
import {CZ_PROJECTS,CZ_PLANS,czTeams,czTravel,czBudget} from '../../src/canzheng.js';
import {BZ_PROMISES,bzTeams,bzTravel,bzAvailable} from '../../src/buzheng.js';
import {XF_MISSIONS,xfTeams,xfDuration,xfBudget} from '../../src/xunfu.js';
import {OFFICE_CONTENT} from '../../src/office-stories.js';
export function inPlay(s, { until = 156, policy = "help", onStep = () => {} } = {}) {
  const call=(type,args)=>{try{s=act(s,type,args);onStep(s,type);return true;}catch(e){if(!/余期不足|足够时间|钱粮不足|公银或公粮不足|巡察差费不足|公银不足|官银不足|银不足/.test(e.message))throw e;if(type==='in_event'){s=act(s,type,{choice:'refer'});onStep(s,type);}return false;}};
  while (s.inspector.turn < until && !s.inspector.finished) {
    if (s.inspector.event) call("in_event", { choice: "verify" });
    let q = s.inspector;
    for (const id of [...s.officeStories.offices.inspector.queue]) {
      if (!q.ap && policy !== "delegate") break;
      call("office_story", { event: id, choice: policy }); q = s.inspector;
    }
    // 先验收腾出巡察人手，再取证、呈核和派出；案件与剧情使用同一周精力。
    for (let i = 0; i < 3 && s.inspector.ap; i++) {
      q = s.inspector;
      const items = Object.values(q.dockets);
      let r = items.find((r) => r.status === "ready");
      if (r) { call("in_docket", { docket: r.id, action: "accept" }); continue; }
      r = items.find((r) => r.status === "onsite");
      if (r) {
        const d = IN_DOCKETS.find((d) => d.id === r.id), clue = d.evidence.find((e) => !r.clues.some((x) => x.id === e.id));
        call("in_docket", { docket: r.id, action: clue ? "clue" : "submit", clue: clue?.id }); continue;
      }
      r = items.find((r) => r.status === "approved");
      if (r && inTeams(q) < 2) { call("in_docket", { docket: r.id, action: "execute" }); continue; }
      const f = Object.values(s.officeStories.offices.inspector.cases).find((f) => ["open", "returned", "approved"].includes(f.status));
      if (f) {
        const d = OFFICE_CONTENT.inspector.cases.find((d) => d.id === f.id), clue = d.clues.find((e) => !f.clues.some((x) => x.id === e.id));
        call("office_case", { case: f.id, action: f.status === "approved" ? "execute" : clue ? "clue" : "review", clue: clue?.id, choice: "evidence" }); continue;
      }
      r = items.find((r) => r.status === "open");
      if (r && inTeams(q) < 2 && q.turn + inTravel(q, IN_DOCKETS.find((d) => d.id === r.id)) + 6 <= 156) { call("in_docket", { docket: r.id, action: "visit", route: "ordinary" }); continue; }
      break;
    }
    call("in_advance", {});
  }
  return s;
}

export function czPlay(s,{until=156,policy="help",plan="adapt",onStep=()=>{}}={}) {
  const call=(type,args)=>{try{s=act(s,type,args);onStep(s,type);return true;}catch(e){if(!/余期不足|足够时间|钱粮不足|公银或公粮不足|巡察差费不足|公银不足|官银不足|银不足/.test(e.message))throw e;if(type==='cz_event'){s=act(s,type,{choice:'refer'});onStep(s,type);}return false;}};
  while(s.canzheng.turn<until&&!s.canzheng.finished) {
    if(s.canzheng.event)call("cz_event",{choice:"verify"});
    for(const id of [...s.officeStories.offices.canzheng.queue]) {if(!s.canzheng.ap&&policy!=="delegate")break;call("office_story",{event:id,choice:policy});}
    for(let i=0;i<3&&s.canzheng.ap;i++) {
      const q=s.canzheng,items=Object.values(q.projects); let r=items.find(r=>r.status==="ready");
      if(r) {call("cz_project",{project:r.id,action:"accept"});continue;}
      const f=Object.values(s.officeStories.offices.canzheng.cases).find(f=>["open","returned","approved"].includes(f.status));
      if(f) {
        const d=OFFICE_CONTENT.canzheng.cases.find(d=>d.id===f.id),clue=d.clues.find(e=>!f.clues.some(x=>x.id===e.id));
        call("office_case",{case:f.id,action:f.status==="approved"?"execute":clue?"clue":"review",clue:clue?.id,choice:"evidence"});continue;
      }
      r=items.find(r=>r.status==="approved"&&czTeams(q)<2&&q.turn+czTravel(q,CZ_PROJECTS.find(d=>d.id===r.id))+CZ_PLANS[r.plan].weeks<=155);
      if(r) {const b=czBudget(CZ_PROJECTS.find(d=>d.id===r.id),r.plan);if(q.silver>=b.silver&&q.grain>=b.grain){call("cz_project",{project:r.id,action:"dispatch"});continue;}}
      r=items.find(r=>r.status==="surveyed"&&q.turn+2+czTravel(q,CZ_PROJECTS.find(d=>d.id===r.id))+CZ_PLANS[plan].weeks<=155);
      if(r) {call("cz_project",{project:r.id,action:"propose",plan});continue;}
      r=items.find(r=>r.status==="open");
      if(r&&q.silver>=4) {call("cz_project",{project:r.id,action:"survey"});continue;}
      break;
    }
    call("cz_advance",{});
  }
  return s;
}

export function bzPlay(s,{until=156,policy="help",onStep=()=>{}}={}){
 const call=(type,args)=>{try{s=act(s,type,args);onStep(s,type);return true;}catch(e){if(!/余期不足|足够时间|钱粮不足|公银或公粮不足|巡察差费不足|公银不足|官银不足|银不足/.test(e.message))throw e;if(type==='bz_event'){s=act(s,type,{choice:'refer'});onStep(s,type);}return false;}};
 while(s.buzheng.turn<until&&!s.buzheng.finished){
  if(s.buzheng.event)call("bz_event",{choice:"verify"});
  for(const id of [...s.officeStories.offices.buzheng.queue]){if(!s.buzheng.ap&&policy!=="delegate")break;call("office_story",{event:id,choice:policy});}
  for(let i=0;i<3&&s.buzheng.ap;i++){
   const q=s.buzheng,items=Object.values(q.promises);let r=items.find(r=>r.status==="received");
   if(r){call("bz_promise",{promise:r.id,action:"verify"});continue;}
   const f=Object.values(s.officeStories.offices.buzheng.cases).find(f=>["open","returned","approved"].includes(f.status));
   if(f){const d=OFFICE_CONTENT.buzheng.cases.find(d=>d.id===f.id),clue=d.clues.find(e=>!f.clues.some(x=>x.id===e.id));call("office_case",{case:f.id,action:f.status==="approved"?"execute":clue?"clue":"review",clue:clue?.id,choice:"evidence"});continue;}
   r=items.find(r=>["reserved","partial"].includes(r.status)&&bzTeams(q)<2&&q.turn+bzTravel(q,BZ_PROMISES.find(d=>d.id===r.id))*(2-r.shipments.length)<=155);
   if(r){call("bz_promise",{promise:r.id,action:"dispatch"});continue;}
   r=items.find(r=>{const d=BZ_PROMISES.find(d=>d.id===r.id),a=bzAvailable(q,d.fund);return r.status==="approved"&&a.silver>=d.silver&&a.grain>=d.grain&&q.turn+2*bzTravel(q,d)<=155;});
   if(r){call("bz_promise",{promise:r.id,action:"reserve"});continue;}
   r=items.find(r=>r.status==="audited"&&q.turn+2+2*bzTravel(q,BZ_PROMISES.find(d=>d.id===r.id))<=155);
   if(r){call("bz_promise",{promise:r.id,action:"request"});continue;}
   r=items.find(r=>r.status==="open");if(r&&q.silver>=4){call("bz_promise",{promise:r.id,action:"audit"});continue;}
   break;
  }call("bz_advance",{});
 }return s;
}

export function xfPlay(s,{until=156,policy='help',plan='joint',onStep=()=>{}}={}){
 const call=(type,args)=>{try{s=act(s,type,args);onStep(s,type);return true;}catch(e){if(!/余期不足|足够时间|钱粮不足|公银或公粮不足|巡察差费不足|公银不足|官银不足|银不足/.test(e.message))throw e;if(type==='xf_event'){s=act(s,type,{choice:'refer'});onStep(s,type);}return false;}};
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

