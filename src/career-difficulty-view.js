import { challenged, LATE_ROLES, CHALLENGE, weeklyAP } from './career-difficulty.js';
// 历年考语与日录原文随履历保存，展示时沿用当前案卷和来信的称呼。
export function recordText(text) {
 return text.replaceAll("新严苛", "严苛").replace(/来源案卷?/g, "案卷")
   .replaceAll("剧情查验", "来信查验").replaceAll("件剧情", "封来信");
}
export function challengeRules(q) {
 if(!challenged(q))return '';
 if(!LATE_ROLES.includes(q.challenge.role))return '严苛考评：本职分占90%，案卷归档占7%，来信查验占3%。称职须总分75、至少归档3/4件案卷、查验12/18封来信，且无待查责任。本职分仍按本任各项经营成果计算。';
 const role=q.challenge.role;
 return `严苛考评：本职成效45%、按期10%、案卷20%、来信查验15%、吏治10%。称职须75分、至少办结9/12项本职且成效折算8项、归档3/4件案卷、查验12/18封来信，且无待查责任。${['buzheng','xunfu'].includes(role)?'三类职责各须办结至少2项。':''}本职立项${CHALLENGE[role].workLimit}周内、案卷立卷16周内办结计足分；逾期仍可补办，本职成效按85%、案件按70%计，逾期本职无及时分。吏治按全任平均与期末各半计。`;
}
export function challengePanel(s,key) {
 const q=s[key];
 if(!challenged(q))return `<aside class="notice"><p>${s.difficulty==='hard'?'严苛':'常例'} · ${q.finished ? "本任考语已归卷。" : `本周可用${q.ap}点精力。`}</p></aside>`;
 const c=q.challenge, late=LATE_ROLES.includes(key), rows=Object.values(q.dockets||q.projects||q.promises||q.missions||{}), completed=late?rows.filter(r=>r.status==='closed').length:0;
 return `<section class="panel challenge-panel"><div class="section-head"><h2>严苛仕途 · 本任考核</h2><span>称职线 75分</span></div><p><b>${late?`本职已办${completed}/12项 · `:''}案卷已归档${c.cases}/4 · 来信已查验${c.stories}/18</b></p><details><summary>查看计分、期限与晋升条件</summary><p>${challengeRules(q)}</p></details><p class="muted">每周${weeklyAP(q)}点亲办精力，不结转。${late?'日常署务之外，只能亲办一项；公文、来信、查案和本职差遣共用精力，请按到期先后安排。':'办差、查信和审案共用精力，请预留查验时间。'}来信须在8周内亲办；交属员常例留卷不计查验成果。</p></section>`;
}
export function workDeadline(q,r) {
 if(!challenged(q)||!LATE_ROLES.includes(q.challenge.role)||r.status==='closed'||q.finished)return '';
 const left=r.opened+CHALLENGE[q.challenge.role].workLimit-q.turn;
 return `<p class="${left<0?'warning-text':'muted'}">${left<0?`已逾及时期限${-left}周，补办仍计85%成效`:`及时办结期限余${left}周`}；须完成最终核验。</p>`;
}
