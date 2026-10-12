// 县政、地方协作与执行阶段；数值反馈由主引擎统一记账。
export const DISTRICTS=[
 {id:'fields',name:'南渠田乡',person:'farmer',scene:'scene_fields_canal',desc:'灌溉与农时影响农户生计。',initial:{livelihood:48,commerce:46,security:54}},
 {id:'market',name:'县城商坊',person:'merchant',scene:'scene_market',desc:'商路兴衰直接影响可用收入。',initial:{livelihood:55,commerce:60,security:50}},
 {id:'river',name:'漕河渡口',person:'boatman',scene:'scene_river_ferry',desc:'渡运与堤防相连，水患后恢复较慢。',initial:{livelihood:46,commerce:44,security:42}},
 {id:'hills',name:'西岗村落',person:'widow',scene:'scene_fields_canal',desc:'离县城较远，照护与纠纷容易被忽略。',initial:{livelihood:40,commerce:42,security:48}}
];
export const LOCAL_METRICS={livelihood:'生计',commerce:'生产',security:'秩序'};
export const POLICIES={
 labor:{name:'役政',icon:'farm',options:{
  balanced:{name:'循例轮役',cost:{},desc:'按原工期施工，保留农户的日常安排。',work:1},
  gentle:{name:'雇工减役',cost:{silver:2},desc:'每周官银2两，民生+0.2；田乡生计+0.3。工程工作量按75%推进。',work:.75,effect:{people:.2},local:{fields:{livelihood:.3}}},
  intensive:{name:'集中赶工',cost:{},desc:'施工速度提高50%；每周民生-0.15、田乡生计-0.3，疲劳+0.4。',work:1.5,effect:{people:-.15,fatigue:.4},local:{fields:{livelihood:-.3}}}
 }},
 commerce:{name:'市政',icon:'trade',options:{
  routine:{name:'循例开市',cost:{},desc:'维持日常市场秩序。'},
  fair:{name:'定期开集',cost:{silver:3},desc:'每周3两组织集市，农商+0.18、商坊生产+0.35；连续办满4周后，从第5周起每周增收4两。',effect:{economy:.18},local:{market:{commerce:.35}}},
  audit:{name:'整饬市规',cost:{silver:1.5},desc:'每周1.5两查验，吏治+0.15、商坊秩序+0.3；当周市场收入减少1两。',effect:{integrity:.15},local:{market:{security:.3}}}
 }},
 relief:{name:'安民',icon:'relief',options:{
  reserve:{name:'留粮备荒',cost:{},desc:'保留储备，继续提供原有过渡口粮。'},
  kitchen:{name:'续设粥厂',cost:{grain:4},needsDisplaced:true,desc:'有待安置居民时，每周耗粮4石，额外安置4人、民生+0.2；无人待安置时自动停支。',effect:{people:.2},settle:4},
  resettle:{name:'以工安置',cost:{silver:3,grain:2},needsDisplaced:true,desc:'有待安置居民时，每周银3两、粮2石，额外安置2人、农商+0.15、田乡生计+0.25。',effect:{economy:.15},local:{fields:{livelihood:.25}},settle:2}
 }}
};
export const INTERVENTIONS={
 livelihood:{name:'走村济困',cost:{silver:12,grain:15,ap:1},gain:10,desc:'核实困户并供给过渡物资，生计+10。'},
 commerce:{name:'修补生产设施',cost:{silver:25,ap:1},gain:8,desc:'修整晒场、栈桥或摊区，生产+8。'},
 security:{name:'组织巡守调处',cost:{silver:10,ap:1},gain:10,desc:'协调巡守与街坊纠纷，秩序+10。'}
};
const clamp=n=>Math.round(Math.max(0,Math.min(100,n))*10000)/10000;
const round=n=>Math.round(n*100)/100;
function local(s,id,delta){for(const [k,v] of Object.entries(delta))s.governance.districts[id][k]=clamp(s.governance.districts[id][k]+v);}
function relation(s,id,n){if(id in s.governance.relations)s.governance.relations[id]=clamp(s.governance.relations[id]+n);}
function mandate(s){const candidates=DISTRICTS.flatMap(d=>Object.keys(LOCAL_METRICS).map(metric=>({district:d.id,metric,value:s.governance.districts[d.id][metric]}))).sort((a,b)=>a.value-b.value);const pick=candidates[0];return{district:pick.district,metric:pick.metric,start:pick.value,target:Math.min(95,pick.value+8),due:Math.min(156,(Math.floor(s.turn/13)+1)*13),status:'active'};}
export function initializeGovernance(s,legacy=false){s.governance={policies:{labor:'balanced',commerce:'routine',relief:'reserve'},changed:{labor:-4,commerce:-4,relief:-4},funded:{},streak:{labor:0,commerce:0,relief:0},districts:Object.fromEntries(DISTRICTS.map(d=>[d.id,{...d.initial}])),relations:{farmer:50,merchant:50,boatman:50,widow:50,gentry:50,prefect:50},visits:{},mandate:null,mandatesMet:0,mandatesMissed:0,lastWeekly:[]};s.receipts=[];if(!s.finished)s.governance.mandate=mandate(s);if(legacy)for(const c of Object.values(s.cases))if(c.status==='closed')c.execution={status:'legacy',deadline:null,due:null};}
export const policyOption=(s,key)=>POLICIES[key].options[s.governance.policies[key]];
export function districtIncomeFactor(s){const avg=DISTRICTS.reduce((n,d)=>n+s.governance.districts[d.id].commerce,0)/4;return Math.max(.75,Math.min(1.3,avg/48));}
export function interventionCost(s,id,kind){const d=DISTRICTS.find(x=>x.id===id),a=Object.hasOwn(INTERVENTIONS,kind)?INTERVENTIONS[kind]:null;if(!d||!a)throw Error('地方事务无效。');const cost={...a.cost};if(s.governance.relations[d.person]>=60)cost.silver=Math.max(0,cost.silver-5);return cost;}
export function constructionSpeed(s){const g=s.governance;return g.funded.labor?policyOption(s,'labor').work:1;}
export function commerceBonus(s){const g=s.governance;if(!g.funded.commerce)return 0;return g.policies.commerce==='fair'&&g.streak.commerce>4?4:g.policies.commerce==='audit'?-1:0;}
export function policyCost(s){let cost={silver:0,grain:0};for(const key of Object.keys(POLICIES)){const p=policyOption(s,key);if(p.needsDisplaced&&s.displaced<=0)continue;for(const [k,v] of Object.entries(p.cost))cost[k]+=v;}return cost;}
export function governanceCommand(s,c,ctx){const {ledger,pay,log}=ctx;const g=s.governance;
 if(c.type==='policy'){const def=Object.hasOwn(POLICIES,c.category)?POLICIES[c.category]:null,p=def&&Object.hasOwn(def.options,c.choice)?def.options[c.choice]:null;if(!p)throw Error('县政方针无效。');if(g.policies[c.category]===c.choice)throw Error('当前已执行这项方针。');if(s.turn-g.changed[c.category]<4)throw Error('方针至少执行4周后才能调整。');pay(s,{ap:1});g.policies[c.category]=c.choice;g.changed[c.category]=s.turn;g.streak[c.category]=0;g.funded[c.category]=false;log(s,'县政调整',`${def.name}改为“${p.name}”。周末按实际财力执行，至少4周后可再调整。`,'decision');return;}
 if(c.type==='district'){const d=DISTRICTS.find(x=>x.id===c.district),a=INTERVENTIONS[c.kind];const cost=interventionCost(s,c.district,c.kind);if(s.turn-(g.visits[c.district]??-4)<4)throw Error('同一片辖地须间隔4周再集中督办。');ledger(s,`${d.name} · ${a.name}`,pay(s,cost));local(s,d.id,{[c.kind]:a.gain});relation(s,d.person,3);g.visits[d.id]=s.turn;log(s,'地方督办',`${d.name}：${a.desc} 与${d.name}代表的互信增加3；数值上限仍为100。`,'decision');return;}
 if(c.type==='enforce'){const file=s.cases[c.case];if(!file||file.status!=='closed'||!['awaiting','overdue'].includes(file.execution?.status))throw Error('此案当前无需安排执行。');ledger(s,'案卷执行督办',pay(s,{silver:6,ap:1}));file.execution.status='executing';file.execution.due=s.turn+2;log(s,'启动判后执行','支出6两差旅与1点精力，两周后核验交付或纠正结果。','case');return;}
 if(c.type==='arrears'){const debt=round(s.flags.arrears||0);if(debt<=0)throw Error('当前没有欠付。');ledger(s,'清偿例行公费欠付',pay(s,{silver:debt}));s.flags.arrears=0;log(s,'欠付清偿',`偿清${debt}两，不追溯补发政绩。`);return;}
 if(c.type==='repair'){const p=s.projects.find(x=>x.id===c.project);if(!p||p.status!=='complete'||p.condition>=100)throw Error('该工程无需修复。');ledger(s,'工程集中修复',pay(s,{silver:20,ap:1}));p.condition=Math.min(100,p.condition+30);log(s,'修复既有工程','支出20两，恢复30点养护状况，上限100。');return;}
 throw Error('未知治理操作。');
}
export function applyPolicyWeek(s,ctx){const g=s.governance;g.lastWeekly=[];for(const key of Object.keys(POLICIES)){const p=policyOption(s,key);g.funded[key]=false;
 if(p.needsDisplaced&&s.displaced<=0){g.streak[key]=0;g.lastWeekly.push(`${p.name}：无人待安置，本周停支。`);continue;}
 if(Object.entries(p.cost).some(([k,v])=>s[k]<v)){g.streak[key]=0;g.lastWeekly.push(`${p.name}：钱粮不足，本周暂停，无扣款、无收益。`);ctx.log(s,'政策暂缓',g.lastWeekly.at(-1),'warning');continue;}
 ctx.ledger(s,`县政 · ${p.name}`,ctx.pay(s,p.cost));g.funded[key]=true;g.streak[key]++;ctx.effect(s,p.effect||{});for(const [id,delta] of Object.entries(p.local||{}))local(s,id,delta);if(p.settle)s.displaced=Math.max(0,s.displaced-p.settle);
 if(g.policies[key]!=={labor:'balanced',commerce:'routine',relief:'reserve'}[key])g.lastWeekly.push(`${p.name}：本周已执行${key==='commerce'&&g.policies[key]==='fair'?(g.streak[key]>4?'，开集增收4两。':`，培育进度${g.streak[key]}/4周。`):'。'}`);
 }}
export function regionalEvent(s,id,choice){
 if(id==='X02'){local(s,'fields',{livelihood:choice==='ignore'?-6:4});relation(s,'farmer',choice==='ignore'?-5:5);relation(s,'gentry',choice==='survey'?-2:0);}
 if(id==='X04')local(s,'fields',{livelihood:['grain','request'].includes(choice)?-2:choice==='petition'?-12:-6});
 if(id==='X12')local(s,'river',{livelihood:-Math.min(12,s.avoidableLoss),security:choice==='evacuate'?-3:-12,commerce:choice==='evacuate'?-2:-7});
 if(id==='X10'){local(s,'market',{commerce:choice==='leave'?-6:5});relation(s,'merchant',choice==='leave'?-5:5);}
 if(id==='X15'){relation(s,'gentry',choice==='accept'?8:choice==='public'?3:-3);relation(s,'prefect',choice==='accept'?-3:2);}
 if(id==='X11'&&choice==='verify')local(s,'hills',{livelihood:3});
}
export function regionalProject(s,id){const impacts={canal:{fields:{livelihood:6,commerce:5}},embankment:{river:{security:10}},road:{market:{commerce:7},river:{commerce:5}},school:{hills:{livelihood:6}}};for(const [d,delta] of Object.entries(impacts[id]||{}))local(s,d,delta);}
export function settleGovernance(s,ctx){const g=s.governance;
 for(const c of Object.values(s.cases)){if(c.status!=='closed')continue;
  if(!c.execution){c.execution={status:'awaiting',deadline:s.turn+4,due:null};ctx.log(s,'复核之后仍需执行','案牍新增判后督办：4周内安排执行，两周后查验结果。','case');}
  const e=c.execution;
  if(e.status==='executing'&&e.due<=s.turn){e.status='done';c.result='复核与执行均已完成，归档备查';ctx.effect(s,{people:2,trust:1});const id={boundary:'fields',granary:'market',inheritance:'hills',ferry:'river'}[c.id];local(s,id,{security:5});relation(s,DISTRICTS.find(d=>d.id===id).person,3);ctx.log(s,'判后执行查验','执行结果已核验：归属、交付或纠正事项落实，卷宗方才完整。','gain');}
  if(e.status==='awaiting'&&e.deadline<=s.turn){e.status='overdue';ctx.effect(s,{people:-2,trust:-1});ctx.log(s,'判后执行迟延','案卷虽获复核，结果尚未落实。已记一次迟延责任，仍可补办。','warning');}
 }
 const m=g.mandate;if(m){const value=g.districts[m.district][m.metric];if(m.status==='active'&&value>=m.target){m.status='met';g.mandatesMet++;ctx.effect(s,{trust:2});relation(s,'prefect',2);ctx.log(s,'阶段要务达成',`${DISTRICTS.find(d=>d.id===m.district).name}的${LOCAL_METRICS[m.metric]}达到${m.target}，本次实际值${round(value)}。`,'gain');}
 if(s.turn>=m.due){if(m.status==='active'){g.mandatesMissed++;ctx.effect(s,{trust:-1});ctx.log(s,'阶段要务未竟','目标期限已到，保留实际进展，下一阶段继续关注地方短板。','warning');}if(s.turn<156)g.mandate=mandate(s);}}
}
export function executionPenalty(s){return Object.values(s.cases).filter(c=>c.status==='closed'&&c.execution&&!['done','legacy'].includes(c.execution.status)).length*4;}
export function validateGovernance(s){const g=s.governance;if(!g||typeof g!=='object'||!g.policies||!g.districts||!g.relations||!g.changed||!g.streak||!g.funded||!g.visits||!Array.isArray(g.lastWeekly)||!Array.isArray(s.receipts)||s.receipts.length>40)throw Error('治理记录不完整。');
 for(const key of Object.keys(POLICIES))if(!Object.hasOwn(POLICIES[key].options,g.policies[key])||!Number.isFinite(g.changed[key])||!Number.isFinite(g.streak[key])||g.streak[key]<0)throw Error('政策记录异常。');
 for(const d of DISTRICTS)for(const k of Object.keys(LOCAL_METRICS)){const v=g.districts[d.id]?.[k];if(!Number.isFinite(v)||v<0||v>100)throw Error('辖地记录异常。');}
 for(const id of ['farmer','merchant','boatman','widow','gentry','prefect'])if(!Number.isFinite(g.relations[id])||g.relations[id]<0||g.relations[id]>100)throw Error('人物信任记录异常。');
 if(!Number.isInteger(g.mandatesMet)||g.mandatesMet<0||!Number.isInteger(g.mandatesMissed)||g.mandatesMissed<0)throw Error('要务记录异常。');
 if(g.mandate&&(!DISTRICTS.some(d=>d.id===g.mandate.district)||!Object.hasOwn(LOCAL_METRICS,g.mandate.metric)||!['active','met'].includes(g.mandate.status)||!Number.isInteger(g.mandate.due)||!Number.isFinite(g.mandate.target)))throw Error('阶段目标异常。');
 for(const r of s.receipts){if(!r||typeof r.title!=='string'||!Number.isInteger(r.turn)||!Array.isArray(r.changes)||!Array.isArray(r.ledger)||!Array.isArray(r.notes)||!Array.isArray(r.policies)||r.changes.length>80||r.notes.some(x=>typeof x!=='string')||r.policies.some(x=>typeof x!=='string'))throw Error('回执记录异常。');for(const x of r.changes)if(!x||typeof x.name!=='string'||!['before','after','delta'].every(k=>Number.isFinite(x[k])))throw Error('回执数值异常。');for(const l of r.ledger)if(!l||typeof l.title!=='string')throw Error('回执账目异常。');}
 for(const [id,week]of Object.entries(g.visits))if(!DISTRICTS.some(d=>d.id===id)||!Number.isInteger(week)||week<0||week>s.turn)throw Error('地方督办时间异常。');
 for(const c of Object.values(s.cases))if(c.execution&&(!['legacy','awaiting','overdue','executing','done'].includes(c.execution.status)||(['awaiting','overdue'].includes(c.execution.status)&&!Number.isInteger(c.execution.deadline))||(c.execution.status==='executing'&&!Number.isInteger(c.execution.due))))throw Error('判后记录异常。');
}
