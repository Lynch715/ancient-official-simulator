// v0.21 的整段仕途规则；旧存档 balanceVersion=0，永远不自动转入新规则。
export const LATE_ROLES = ['inspector','canzheng','buzheng','xunfu'];
export const CHALLENGE = {
 inspector: {silver:150, weeklySilver:1.9, workLimit:24},
 canzheng: {silver:190, grain:120, weeklySilver:3.5, weeklyGrain:2.3, workLimit:24},
 buzheng: {silver:80, grain:40, weeklySilver:1.2, workLimit:28},
 xunfu: {silver:230, grain:180, weeklySilver:2.7, weeklyGrain:1.5, workLimit:26},
};
export const newCareer=s=>s.balanceVersion===1&&s.difficulty==='hard';
export const challenged=q=>q?.challenge?.version===1;
export const weeklyAP=q=>challenged(q)&&LATE_ROLES.includes(q.challenge.role)?1:3;
export function initChallenge(s,q,role) {
 if(newCareer(s))q.challenge={version:1,role,stories:0,cases:0,timelyCases:0};
 if(challenged(q))q.ap=weeklyAP(q);
}
export function contentStats(book) {
 const cases=Object.values(book?.cases||{}).filter(r=>r.status==='closed');
 return {stories:Object.values(book?.events||{}).filter(r=>r.status==='done').length,cases:cases.length,timelyCases:cases.filter(r=>r.closed<=r.opened+16).length};
}
export function syncChallenge(s,key) {
 const q=s[key];
 if(!q.challenge&&newCareer(s))initChallenge(s,q,key);
 if(challenged(q))Object.assign(q.challenge,contentStats(s.officeStories.offices[key]));
}
export function contentAssessment(q,result) {
 if(!challenged(q))return result;
 const c=q.challenge, score=Math.round(result.score*.9+c.cases/4*7+c.stories/18*3);
 const candidate=!q.misconduct&&score>=75&&c.cases>=3&&c.stories>=12;
 return {...result,score,candidate,rating:q.misconduct?'候查':candidate?'称职':score>=50?'平常':'不称职',summary:result.summary+` 新严苛：本职90%、来源案7%、剧情查验3%；称职还须来源案归档至少3/4、剧情查验至少12/18。当前${c.cases}/4案、${c.stories}/18件。`};
}
export function lateAssessment(q,closed,quality,integrity,scopeOK=true) {
 const c=q.challenge,limit=CHALLENGE[c.role].workLimit;
 const timely=closed.filter(r=>r.closed<=r.opened+limit).length;
 const qualityPoints=closed.reduce((n,r)=>n+quality(r)*(r.closed<=r.opened+limit?1:.85),0);
 const score=Math.round(qualityPoints/12*45+timely/12*10+(c.timelyCases+(c.cases-c.timelyCases)*.7)/4*20+c.stories/18*15+integrity*.1);
 const candidate=!q.misconduct&&score>=75&&closed.length>=9&&closed.reduce((n,r)=>n+quality(r),0)>=8&&c.cases>=3&&c.stories>=12&&scopeOK;
 return {score,candidate,rating:q.misconduct?'候查':candidate?'称职':score>=50?'平常':'不称职',summary:`新严苛考评：本职成效45%、按期10%、来源案20%、剧情查验15%、吏治10%。已验${closed.length}/12项，其中${limit}周内${timely}项；来源案归档${c.cases}/4，其中16周内${c.timelyCases}案；剧情查验${c.stories}/18。称职须75分、至少9项本职且成效折算8项、3案及12件剧情${["buzheng","xunfu"].includes(c.role)?"；分类职责仍须各2项":""}。逾期本职按85%成效计、案件按70%计，补办仍可挽回成绩。`};
}
export function validateChallenge(s) {
 if(![0,1].includes(s.balanceVersion)||(s.balanceVersion===1&&s.difficulty!=="hard"))throw Error('仕途难度规则版本异常。');
 for(const role of ['prefecture','tongzhi','zhifu',...LATE_ROLES]) {
  const q=s[role];if(!q)continue;
  if(!newCareer(s)){if(q.challenge!==undefined)throw Error('旧规则履历不应混入新考评。');continue;}
  const expected={version:1,role,...contentStats(s.officeStories.offices[role])};
  if(!q.hard||(!q.challenge||Object.keys(q.challenge).length!==Object.keys(expected).length||Object.entries(expected).some(([k,v])=>q.challenge[k]!==v))||q.ap>weeklyAP(q))throw Error('新严苛履历与案卷不符。');
 }
}
