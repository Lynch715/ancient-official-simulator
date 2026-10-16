import { initChallenge, challenged, weeklyAP, CHALLENGE, lateAssessment } from "./career-difficulty.js";
import { BZ_REGIONS, BZ_EVENTS, BZ_PROMISES, BZ_FUNDS, BZ_INITIAL, BZ_WEEKLY } from "./buzheng-data.js";
import { qualified } from "./accountability.js";
import { canzhengAssessment } from "./canzheng.js";
import { termLabel } from "./rules.js";
import { familyAllowance } from "./county-content.js";
import { roll } from "./county-hard.js";
import { eventAt, eventWeek, officeDrift, blendIntegrity } from "./office-hard.js";
export { BZ_REGIONS, BZ_EVENTS, BZ_PROMISES, BZ_FUNDS };
export const bzLabel=q=>termLabel(q.turn,"布政使");
const round=n=>Math.round(n*100)/100,clamp=n=>Math.max(0,Math.min(100,round(n)));
const log=(q,text)=>{q.logs.unshift({id:q.nextLog++,turn:q.turn,text});q.logs=q.logs.slice(0,300);};
const budget=d=>({silver:d.silver,grain:d.grain});
export const bzBatch=(d,index)=>Object.fromEntries(Object.entries(budget(d)).map(([k,v])=>[k,index===0?Math.ceil(v/2):Math.floor(v/2)]));
export const bzTravel=(q,d)=>BZ_REGIONS.find(x=>x.id===d.region).days+(q.hard?1:0);
export const bzTeams=q=>Object.values(q.promises).filter(r=>["transit","received"].includes(r.status)).length;
export function bzAvailable(q,fund) {
 const held={silver:0,grain:0};
 for(const d of BZ_PROMISES.filter(d=>d.fund===fund)) {const r=q.promises[d.id];if(r?.reserved!==null&&r?.reserved!==undefined)for(const k of ["silver","grain"])held[k]+=d[k]-r.shipments.reduce((n,b)=>n+b.amount[k],0);}
 return {silver:round(q.funds[fund].silver-held.silver),grain:round(q.funds[fund].grain-held.grain),held};
}
function money(q,title,delta,fund) {
 const account=fund?q.funds[fund]:q;
 for(const [k,v]of Object.entries(delta))if(!["silver","grain",...(fund?[]:["private"])].includes(k)||!Number.isFinite(v)||account[k]+v<0)throw Error("该账户可用钱粮不足。");
 for(const [k,v]of Object.entries(delta))account[k]=round(account[k]+v);
 const row={turn:q.turn,title,...delta,...(fund?{fund}:{})};q.ledger.push(row);q.lastLedger.push(row);
}
function pay(q,silver=0,grain=0,ap=1,title="省署核办") {
 if(q.ap<ap||q.silver<silver||q.grain<grain)throw Error(q.ap<ap?"本周精力不足。":"日常公账钱粮不足。");
 q.ap-=ap;if(silver||grain)money(q,title,{silver:-silver,grain:-grain});
}
const enoughTime=(q,n)=>{if(q.turn+n>155)throw Error("本任余期不足以完成两批核收，须据实交接。");};
export const buzhengHard=seed=>({seed,weeks:Object.fromEntries(BZ_EVENTS.map(e=>[e.id,e.week===0||e.week>=140?e.week:e.week+Math.floor(roll(seed,`bz:${e.id}`)*9)-4])),lifeSum:0,integritySum:0,weeksCounted:0});
function open(q) {
 q.event=eventAt(q,BZ_EVENTS)?.id||null;
 for(const d of BZ_PROMISES)if(d.week===q.turn&&!q.promises[d.id]){q.promises[d.id]={id:d.id,opened:q.turn,status:"open",audited:null,requested:null,approved:null,reserved:null,closed:null,shipments:[]};log(q,`${d.title}到卷，拟用${BZ_FUNDS[d.fund]}银${d.silver}两、粮${d.grain}石。须核需、呈准、登记承诺，再分两批拨运核收。`);}
}
export function appointBuzheng(s) {
 const p=s.canzheng;if(s.buzheng)throw Error("布政使任命已办理。");
 if(!p?.finished||(!canzhengAssessment(s).candidate&&!qualified(s,"canzheng")))throw Error("须参政称职，或复考恢复资格，才可升任布政使。");
 const q=s.buzheng={turn:0,finished:false,ap:3,silver:0,grain:0,private:p.private,integrity:p.integrity,trust:p.trust,misconduct:false,event:null,nextLog:1,logs:[],ledger:[],lastLedger:[],promises:{},funds:Object.fromEntries(Object.keys(BZ_FUNDS).map(k=>[k,{silver:0,grain:0}])),adjustments:{},outcome:null,record:{silver:p.silver,grain:p.grain,private:p.private,score:p.outcome.score},counties:Object.fromEntries(BZ_REGIONS.map(d=>[d.id,{id:d.id,name:d.name,people:p.counties[d.id]?.people??65,cooperation:p.counties[d.id]?.cooperation??55,receivedSilver:0,receivedGrain:0}])),hard:s.difficulty==="hard"&&p.hard?buzhengHard(s.seed):null};
 initChallenge(s,q,"buzheng");
 money(q,"省署日常公账核拨",{silver:challenged(q)?CHALLENGE.buzheng.silver:q.hard?100:150,grain:q.hard?40:80});
 for(const [id,d]of Object.entries(BZ_INITIAL[q.hard?"hard":"standard"]))money(q,BZ_FUNDS[id]+"开任核拨",challenged(q)?Object.fromEntries(Object.entries(d).map(([k,v])=>[k,Math.round(v*.85)])):d,id);
 open(q);log(q,"领从二品布政使印，统筹四府钱粮。前六任公账封存，私产与原三府民生协作承接。三项专款独立，可用额须扣已登记未拨承诺；两批均经核收才记一项实绩。依法办理财赋，重大更制须呈准，刑案移交承审。 ");
}
export function buzhengAssessment(s) {
 const q=s.buzheng,closed=Object.values(q.promises).filter(r=>r.status==="closed"),timely=closed.filter(r=>r.closed<=r.opened+36).length;
 const perFund=Object.fromEntries(Object.keys(BZ_FUNDS).map(f=>[f,closed.filter(r=>BZ_PROMISES.find(d=>d.id===r.id).fund===f).length]));
 if(challenged(q))return lateAssessment(q,closed,()=>1,blendIntegrity(q),Object.values(perFund).every(n=>n>=2));
 const cases=Object.values(s.officeStories.offices.buzheng?.cases||{}).filter(r=>r.status==="closed").length;
 const score=Math.round(closed.length/12*50+timely/12*10+cases/4*25+blendIntegrity(q)*.15);
 const candidate=!q.misconduct&&closed.length>=8&&Object.values(perFund).every(n=>n>=2)&&score>=(q.hard?75:70);
 return {score,candidate,rating:q.misconduct?"候查":candidate?"称职":score>=50?"平常":"不称职",summary:`两批均核收${closed.length}/12项，36周内交清${timely}项，来源案归档${cases}/4件。赈济、河工、公用供给分别交清${perFund.relief}、${perFund.river}、${perFund.supply}项；称职须至少8项且每项专款至少2项。余款、未拨承诺与在途逐笔交接。`};
}
export function finalizeBuzheng(s){if(s.buzheng?.finished)s.buzheng.outcome=buzhengAssessment(s);}
export function buzhengCommand(s,c) {
 const q=s.buzheng;if(!q||q.finished)throw Error("尚未任命或布政使本任已经考满。");q.lastLedger=[];
 if(c.type==="bz_event") {
  const e=BZ_EVENTS.find(e=>e.id===q.event),o=e?.options.find(o=>o.id===c.choice);if(!o)throw Error("本周省署公文或处置无效。");
  pay(q,o.cost.silver||0,0,o.cost.ap||0,e.title);for(const[k,v]of Object.entries(o.effect))q[k]=clamp(q[k]+v);if(o.misconduct)q.misconduct=true;q.event=null;log(q,`${e.title}：${o.label}。文书决定已留卷，承诺与实际收支另行记录。`);return;
 }
 if(c.type==="bz_adjust") {
  if(!Object.hasOwn(BZ_FUNDS,c.fund)||q.adjustments[c.fund])throw Error("调剂专款无效，或该项一次额度已经申请。");
  enoughTime(q,2);pay(q,60,40,1,BZ_FUNDS[c.fund]+"调剂暂存");q.adjustments[c.fund]={requested:q.turn,approved:null};
  log(q,`申请将日常余款银60两、粮40石转入${BZ_FUNDS[c.fund]}。已扣日常公账，列待批暂存，2周获准后才可承诺使用；每种专款仅一次。`);return;
 }
 if(c.type==="bz_promise") {
  const d=BZ_PROMISES.find(d=>d.id===c.promise),r=q.promises[c.promise];if(!d||!r)throw Error("该事项尚未到卷。");
  if(c.action==="audit") {
   if(r.status!=="open")throw Error("需求已核，不可重复。");pay(q,4,0,1,d.title+"核需");r.audited=q.turn;r.status="audited";log(q,`${d.title}核需：${d.audit}`);
  }else if(c.action==="request") {
   if(r.status!=="audited")throw Error("须先核需再呈准。");enoughTime(q,2+2*bzTravel(q,d));pay(q);r.requested=q.turn;r.status="review";log(q,`${d.title}呈准，2周回批；尚未占用额度。`);
  }else if(c.action==="reserve") {
   if(r.status!=="approved")throw Error("须先获准，且承诺只能登记一次。");enoughTime(q,2*bzTravel(q,d));const available=bzAvailable(q,d.fund);
   if(available.silver<d.silver||available.grain<d.grain)throw Error("该专款可用额度不足，不能将已承诺钱粮再次许出。");
   pay(q);r.reserved=q.turn;r.status="reserved";log(q,`${d.title}登记承诺：占用${BZ_FUNDS[d.fund]}银${d.silver}两、粮${d.grain}石。余额未减，可用额度已扣；尚未拨运。`);
  }else if(c.action==="dispatch") {
   if(!["reserved","partial"].includes(r.status)||bzTeams(q)>=2)throw Error("须登记承诺或核完首批，并有空闲运验组。");enoughTime(q,bzTravel(q,d)*(2-r.shipments.length));
   const index=r.shipments.length,amount=bzBatch(d,index);pay(q);money(q,`${d.id}第${index+1}批拨运`,{silver:-amount.silver,grain:-amount.grain},d.fund);
   r.shipments.push({index,sent:q.turn,arrived:null,verified:null,amount});r.status="transit";log(q,`${d.title}第${index+1}批拨出银${amount.silver}两、粮${amount.grain}石，${bzTravel(q,d)}周后到达。实扣专款并相应解除占用，可用额不虚增。`);
  }else if(c.action==="verify") {
   if(r.status!=="received")throw Error("须待该批实到，且不可重复核收。");pay(q);r.shipments.at(-1).verified=q.turn;
   if(r.shipments.length===2){r.status="closed";r.closed=q.turn;const region=q.counties[d.region];region.people=clamp(region.people+3);region.cooperation=clamp(region.cooperation+2);q.integrity=clamp(q.integrity+1);log(q,`${d.title}两批核收完毕：${d.result}记一项实绩，民生+3、协作+2、吏治+1（以实际变化为准）。`);}else{r.status="partial";log(q,`${d.title}首批核收完成，仍有第二批承诺待拨，本项尚不计完整实绩。`);}
  }else throw Error("承诺办理无效。");return;
 }
 if(c.type!=="bz_advance")throw Error("布政使操作无效。");if(q.event)throw Error("请先处置本周省署公文。");
 money(q,"省署日常每周核拨",{silver:challenged(q)?CHALLENGE.buzheng.weeklySilver:q.hard?2:3,grain:1});for(const [f,d]of Object.entries(BZ_WEEKLY))money(q,BZ_FUNDS[f]+"每周核拨",challenged(q)?Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v*.8])):d,f);money(q,"布政使俸入与家计净额",{private:2.5+familyAllowance(s)});q.turn++;
 for(const [f,r]of Object.entries(q.adjustments))if(r.approved===null&&r.requested+2===q.turn){r.approved=q.turn;money(q,BZ_FUNDS[f]+"调剂获准入账",{silver:60,grain:40},f);log(q,`${BZ_FUNDS[f]}调剂获准，暂存银60两、粮40石正式入专款，可登记承诺。`);}
 for(const d of BZ_PROMISES){const r=q.promises[d.id];if(!r)continue;if(r.status==="review"&&r.requested+2===q.turn){r.approved=q.turn;r.status="approved";log(q,`${d.title}获准，须登记承诺才能拨运。`);}const b=r.shipments.at(-1);if(r.status==="transit"&&b.sent+bzTravel(q,d)===q.turn){b.arrived=q.turn;r.status="received";for(const k of ["silver","grain"])q.counties[d.region][k==="silver"?"receivedSilver":"receivedGrain"]+=b.amount[k];log(q,`${d.title}第${b.index+1}批实到，等手动核收，仍占一组运验人手。`);}}
 if(q.hard)officeDrift(q,Object.values(q.counties),{people:[55,.006],integrity:[60,.006]});
 if(q.turn===156){q.finished=true;q.ap=0;for(const r of Object.values(q.promises))if(r.status!=="closed"){r.handoverFrom=r.status;r.status="handover";}log(q,"布政使三年任满。专款余额、尚占用的承诺、已拨未核收各有明细，未竟不提前销号；来源案本周到期回报并入考满。");}else{q.ap=weeklyAP(q);open(q);}
}
export function buzhengReceipt(before,after,c) {
 const a=before.buzheng,b=after.buzheng,changes=[],add=(name,x,y)=>{if(x!==y)changes.push({name,before:x,after:y,delta:round(y-x)});};
 for(const[k,name]of Object.entries({silver:"日常官银",grain:"日常公粮",private:"私产",ap:"精力",integrity:"吏治",trust:"上级信任"}))add(name,a?.[k]??(["private","integrity","trust"].includes(k)?b[k]:0),b[k]);
 for(const[f,name]of Object.entries(BZ_FUNDS))for(const[k,label]of [["silver","银"],["grain","粮"]]){add(name+"余额"+label,a?.funds[f][k]||0,b.funds[f][k]);add(name+"可用"+label,a?bzAvailable(a,f)[k]:0,bzAvailable(b,f)[k]);}
 if(a)for(const d of BZ_REGIONS)for(const[k,name]of Object.entries({people:"民生",cooperation:"协作",receivedSilver:"累计实收银",receivedGrain:"累计实收粮"}))add(d.name+" · "+name,a.counties[d.id][k],b.counties[d.id][k]);
 return {id:c.id,chapter:"布政使",turn:a?.turn||0,title:c.type==="bz_appoint"?"布政使任命已生效":c.type==="bz_advance"?"省署本周结算":"省署办理回执",changes,notes:b.logs.filter(x=>x.id>=(a?.nextLog||1)).reverse().map(x=>x.text),policies:[],ledger:b.lastLedger};
}
function phase(r) {if(r.audited===null)return"open";if(r.requested===null)return"audited";if(r.approved===null)return"review";if(r.reserved===null)return"approved";if(!r.shipments.length)return"reserved";const b=r.shipments.at(-1);return b.arrived===null?"transit":b.verified===null?"received":r.shipments.length===1?"partial":"closed";}
export function validateBuzheng(s) {
 const q=s.buzheng;if(q===null)return;const fail=()=>{throw Error("布政使履历结构、专款承诺或核收时序异常。");};
 const num=(x,a=0,b=1e9)=>Number.isFinite(x)&&x>=a&&x<=b,int=(x,a=0,b=156)=>Number.isInteger(x)&&num(x,a,b);
 if(!q||!s.canzheng?.finished||(!canzhengAssessment(s).candidate&&!qualified(s,"canzheng"))||!int(q.turn)||q.finished!==(q.turn===156)||!int(q.ap,0,3)||(q.finished&&q.ap!==0)||typeof q.misconduct!=="boolean")fail();
 for(const k of ["silver","grain","private","integrity","trust","nextLog"])if(!num(q[k],0,["integrity","trust"].includes(k)?100:1e9))fail();
 if(!q.record||["silver","grain","private"].some(k=>q.record[k]!==s.canzheng[k])||q.record.score!==s.canzheng.outcome.score)fail();
 if(q.hard){if(s.difficulty!=="hard"||!s.canzheng.hard||q.hard.seed!==s.seed||JSON.stringify(q.hard.weeks)!==JSON.stringify(buzhengHard(s.seed).weeks)||q.hard.weeksCounted!==q.turn||!num(q.hard.lifeSum,0,q.turn*100)||!num(q.hard.integritySum,0,q.turn*100))fail();}else if(q.hard!==null||(s.difficulty==="hard"&&s.canzheng.hard))fail();
 const main=s.officeStories.offices.buzheng?.main;if(!main||(q.event!==null&&(!BZ_EVENTS.some(e=>e.id===q.event&&eventWeek(q,e)===q.turn)||q.finished)))fail();
 for(const e of BZ_EVENTS){const w=eventWeek(q,e),r=main[e.id];if(w<=q.turn&&q.event!==e.id){if(!r||r.turn!==w||!e.options.some(o=>o.id===r.choice))fail();}else if(r)fail();}if(Object.keys(main).some(id=>!BZ_EVENTS.some(e=>e.id===id)))fail();
 if(!q.counties||Object.keys(q.counties).length!==4||!q.promises||Object.keys(q.promises).length!==BZ_PROMISES.filter(d=>d.week<=q.turn).length||bzTeams(q)>2||!q.funds||Object.keys(q.funds).length!==3||!q.adjustments||Object.keys(q.adjustments).some(f=>!Object.hasOwn(BZ_FUNDS,f)))fail();
 for(const [id,r]of Object.entries(q.promises)){
  const d=BZ_PROMISES.find(d=>d.id===id);if(!d||r.id!==id||r.opened!==d.week||d.week>q.turn||!Array.isArray(r.shipments)||r.shipments.length>2)fail();
  let prior=d.week;
  for(const key of ["audited","requested","approved","reserved","closed"]){if(r[key]!==null){if(!int(r[key],prior,Math.min(q.turn,155)))fail();prior=r[key];}}
  if(r.requested!==null&&(r.audited===null||r.requested+2+2*bzTravel(q,d)>155)||r.approved!==null&&(r.requested===null||r.approved!==r.requested+2)||r.requested!==null&&((q.turn>=r.requested+2)!==(r.approved!==null))||r.reserved!==null&&(r.approved===null||r.reserved+2*bzTravel(q,d)>155)||r.shipments.length&&r.reserved===null)fail();
  for(let i=0;i<r.shipments.length;i++){const b=r.shipments[i],expected=bzBatch(d,i);if(b.index!==i||!int(b.sent,i?r.shipments[i-1].verified:r.reserved,155)||i&&r.shipments[i-1].verified===null||b.sent+bzTravel(q,d)*(2-i)>155||!b.amount||Object.keys(b.amount).length!==2||Object.keys(expected).some(k=>b.amount[k]!==expected[k]))fail();if((b.sent+bzTravel(q,d)<=q.turn)!==(b.arrived!==null)||b.arrived!==null&&b.arrived!==b.sent+bzTravel(q,d)||b.verified!==null&&(b.arrived===null||!int(b.verified,b.arrived,Math.min(q.turn,155))))fail();}
  const expected=phase(r);if(q.finished&&expected!=="closed"?r.status!=="handover"||r.handoverFrom!==expected:r.status!==expected||r.handoverFrom!==undefined)fail();if((expected==="closed")!==(r.closed!==null)||r.closed!==null&&r.closed!==r.shipments[1].verified)fail();
 }
 for(const d of BZ_REGIONS){const r=q.counties[d.id];if(!r||r.id!==d.id||r.name!==d.name||["people","cooperation"].some(k=>!num(r[k],0,100)))fail();for(const[k,a]of [["receivedSilver","silver"],["receivedGrain","grain"]]){const total=BZ_PROMISES.filter(p=>p.region===d.id).flatMap(p=>q.promises[p.id]?.shipments||[]).filter(b=>b.arrived!==null).reduce((n,b)=>n+b.amount[a],0);if(r[k]!==total)fail();}}
 for(const[f,r]of Object.entries(q.adjustments))if(!int(r.requested,0,Math.min(q.turn,153))||(q.turn>=r.requested+2?r.approved!==r.requested+2:r.approved!==null))fail();
 if(!Array.isArray(q.logs)||!Array.isArray(q.ledger)||!Array.isArray(q.lastLedger)||q.logs.length>300||q.ledger.length>5000||q.lastLedger.length>100||q.logs.some(r=>!int(r.id,1,q.nextLog-1)||!int(r.turn,0,q.turn)||typeof r.text!=="string")||new Set(q.logs.map(r=>r.id)).size!==q.logs.length)fail();
 for(const r of [...q.ledger,...q.lastLedger])if(!r||!int(r.turn,0,q.turn)||typeof r.title!=="string"||r.fund!==undefined&&!Object.hasOwn(BZ_FUNDS,r.fund)||r.fund&&r.private!==undefined||["silver","grain","private"].some(k=>r[k]!==undefined&&!num(r[k],-1e9)))fail();
 for(const f of [null,...Object.keys(BZ_FUNDS)]){const account=f?q.funds[f]:q;if(!account)fail();for(const k of ["silver","grain",...(f?[]:["private"])])if(!num(account[k])||Math.abs(round(q.ledger.filter(r=>(r.fund||null)===f).reduce((n,r)=>n+(r[k]||0),k==="private"?q.record.private:0))-account[k])>.01)fail();if(f&&["silver","grain"].some(k=>bzAvailable(q,f)[k]<0))fail();}
 const rowCheck=(title,expected)=>{const rows=q.ledger.filter(l=>l.title===title);if(rows.length!==expected.length||expected.some((x,i)=>Object.entries(x).some(([k,v])=>rows[i][k]!==v)))fail();};
 for(const d of BZ_PROMISES)for(let i=0;i<2;i++){const b=q.promises[d.id]?.shipments[i];rowCheck(`${d.id}第${i+1}批拨运`,b?[{turn:b.sent,fund:d.fund,silver:-b.amount.silver,grain:-b.amount.grain}]:[]);}
 for(const f of Object.keys(BZ_FUNDS)){const r=q.adjustments[f];rowCheck(BZ_FUNDS[f]+"调剂暂存",r?[{turn:r.requested,fund:undefined,silver:-60,grain:-40}]:[]);rowCheck(BZ_FUNDS[f]+"调剂获准入账",r?.approved!==null&&r?.approved!==undefined?[{turn:r.approved,fund:f,silver:60,grain:40}]:[]);}
 if(q.finished)q.outcome=buzhengAssessment(s);else if(q.outcome!==null)fail();
}
