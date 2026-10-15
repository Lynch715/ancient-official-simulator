import { act } from "./career.js";
import { inspectorPrevious, inPlay } from "./inspector.js";
import { CZ_PROJECTS, CZ_PLANS, czTeams, czTravel, czBudget } from "../../src/canzheng.js";
import { OFFICE_CONTENT } from "../../src/office-stories.js";
export const canzhengPrevious = (hard=false) => inPlay(act(inspectorPrevious(hard),"in_appoint"));
export function czNext(s,choice="verify") { if(s.canzheng.event)s=act(s,"cz_event",{choice});return act(s,"cz_advance"); }
export function czPlay(s,{until=156,policy="help",plan="adapt",onStep=()=>{}}={}) {
  const call=(type,args)=>{s=act(s,type,args);onStep(s,type);};
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
