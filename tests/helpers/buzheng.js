import { act } from "./career.js";
import { canzhengPrevious,czPlay } from "./canzheng.js";
import { BZ_PROMISES,bzTeams,bzTravel,bzAvailable } from "../../src/buzheng.js";
import { OFFICE_CONTENT } from "../../src/office-stories.js";
export const buzhengPrevious=(hard=false)=>czPlay(act(canzhengPrevious(hard),"cz_appoint"));
export function bzNext(s,choice="verify"){if(s.buzheng.event)s=act(s,"bz_event",{choice});return act(s,"bz_advance");}
export function bzPlay(s,{until=156,policy="help",onStep=()=>{}}={}){
 const call=(type,args)=>{s=act(s,type,args);onStep(s,type);};
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
