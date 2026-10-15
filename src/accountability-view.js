import { xunfuEndingView } from "./xunfu-view.js";
import { OFFICES, LOWER, STATUS, inspectionLoad } from "./accountability.js";
import { countyCase } from "./case-content.js";
export function accountabilityView(s, h) {
  const { esc, num, scene, portrait, avatar, btn, icon } = h,
    a = s.accountability,
    p = a.current,
    criminal = p.cause === "violation",
    active = ["remedy", "retest", "demotion"].includes(p.status),
    terminal = ["dismissed", "prison", "exile", "executed"].includes(p.status),
    passed = p.status === "cleared";
  const block = (cost) => Object.entries(cost).some(([k, v]) => p[k] < v);
  const currentTitle =
    p.status === "demotion" || p.status === "demotionNotice"
      ? LOWER[p.role]
      : OFFICES[p.role];
  const sentenceText = {
    dismissed: "印信交还，从此归籍。此线官途终结，原有履历可以导出保存。",
    prison: "革职下狱，依复核结果服刑。原案、申辩与实际退赔一并留卷。",
    exile: "革职流放，押送起程。原有履历终结，未清退赔仍随案记录。",
    executed: "死刑经过审拟、复核及最终核准，斩首执行。此生履历至此终结。",
  };
  const advanceDisabled =
    terminal ||
    passed ||
    (["notice", "demotionNotice"].includes(p.status) && p.reliefDue === null);
  return `<div class="pref-shell ac-shell"><header class="masthead"><div class="brand"><span class="brand-seal">考<br>课</span><span>古代官员升职记<small>仕途起落 · 考课与处分</small></span></div><div class="header-right">${btn(icon("save"), "save", 'aria-label="手动存档"', "header-button")}${btn(icon("settings"), "settings", 'aria-label="设置与存档"', "header-button")}</div></header><main class="pref-main" id="main-content"><div class="page-heading"><div><span class="eyebrow">${OFFICES[p.role]}原任留卷 · 附卷已过${p.week}周</span><h1>${STATUS[p.status]}</h1><p>${esc(s.name)} · ${terminal ? "原任" + OFFICES[p.role] : criminal ? "停职查核" : currentTitle} · 原考满${p.initialScore}分</p></div><span class="ap-badge">${icon("report")}<b>${active ? p.ap : "卷"}</b><span>${active ? "可用精力" : "独立核办"}</span></span></div><nav class="pref-nav"><a href="#ac-process">当前程序</a><a href="#ac-facts">责任与证据</a><a href="#ac-history">考课履历</a>${btn("最近回执", "receipt", "", "text-button", !s.receipts.length)}</nav><section class="pref-hero ac-hero">${scene(criminal ? "scene_county_hall" : "scene_study_day", "hero-scene", criminal ? "查核与审拟场景示意" : "考课书案场景示意")}<div class="hero-wash"></div><div class="hero-caption"><span>${criminal ? "按事实查明，按程序处分" : "困局有因，补过有期"}</span><h2>${terminal ? "一纸处分<br>一段官途" : criminal ? "先核罪证<br>再定去留" : "考语之外<br>尚有后路"}</h2><p>${terminal ? "原卷保留，结局如实记录。" : "原任事实留底，附卷逐周结算。"}</p></div>${portrait(s.appearance, "player-figure")}</section><div class="metrics">${[
    ["附卷已过", p.week, "周"],
    ["专项官银", p.silver, "两"],
    ["专项实粮", p.grain, "石"],
    ["当前私产", p.private, "两"],
    [
      criminal ? "实际退赔" : "附卷安置",
      criminal ? p.repaid : p.settled,
      criminal ? "两" : "人",
    ],
    ["处分经历", p.discipline, "次"],
  ]
    .map(
      ([k, v, u]) =>
        `<div class="metric"><div class="metric-label">${k}</div><div class="metric-value">${num(v)}<small>${u}</small></div></div>`,
    )
    .join("")}</div>
 ${
   Object.keys(p.caseReviews || {}).length
     ? `<section class="panel"><div class="section-head"><h2>未竟案卷补查与移交</h2><span>查验人手${inspectionLoad(p)}/2</span></div><p>原任未办事项不能由总分抵销。逐案补查独立证据，再留两周核准正式移交；不倒填旧判决或结案数。</p><div class="ac-case-reviews">${Object.entries(
         p.caseReviews,
       )
         .map(([id, c]) => {
           const d = countyCase(s, id);
           return `<article class="panel"><h3>${esc(d.name)}</h3><p>${esc(d.summary)}</p><p>${c.status === "done" ? "补查与移交获准，原任未竟记录保留。" : c.status === "checking" ? `移交依据核验中，${c.due - p.week}周后答复。` : "须查齐下列线索，再呈核移交依据。"}</p>${d.clues.map((clue) => `<div class="evidence"><h4>${esc(clue.name)}</h4>${c.clues.includes(clue.id) ? `<p>${esc(clue.text)}</p>` : btn("查核原卷 · 1精力", "ac-case-clue", `data-id="${id}" data-clue="${clue.id}"`, "button outline", !active || p.ap < 1 || c.status !== "open")}</div>`).join("")}${c.status === "open" ? btn(`据查证结果呈核移交 · 8两 / 1精力`, "ac-case-handover", `data-id="${id}"`, "button outline", !active || p.ap < 1 || p.silver < 8 || c.clues.length !== d.clues.length || p.week + 2 > p.deadline || inspectionLoad(p) >= 2) : ""}</article>`;
         })
         .join("")}</div></section>`
     : ""
 }
 <section class="panel" id="ac-process"><div class="section-head"><h2>${STATUS[p.status]}</h2><span>${p.deadline !== null ? `还剩${p.deadline - p.week}周` : "依程序办理"}</span></div>
 ${p.status === "notice" ? `<p>本任未获称职。先进入13周限期整改，再进行26周留任复考；整改未完成，会增加复考要求。期限中可以安排差事、等待两周核验，不能用重复签字刷成绩。</p><p>${p.role === "county" ? "知县复考仍失败将罢官，不附加刑罚。" : "留任复考仍失败会降调试用；试用再失败则罢官。降调试用通过后，仍须回原职复考，才能恢复候选资格。"}</p>${btn("接受13周限期整改", "ac-begin", "", "button primary")}` : ""}
 ${
   active
     ? `<p>${p.status === "remedy" ? "本期每项须完成两批核验。" : p.status === "demotion" ? `现降任${LOWER[p.role]}，试用26周，每周私人俸余减为0.5两。通过后申请回原职复考；失败则罢官。` : `留任复考26周，每项须核验${p.targets[0].required}批。达标恢复候选资格，原任低分仍会保留。`}每周两点精力、最多两项在办；每批8两，民生事项另需4石，两周后记实绩。</p><div class="ac-targets">${p.targets
         .map((t) => {
           const waiting = p.pending.filter((x) => x.topic === t.id),
             done = t.done >= t.required;
           return `<article><span class="eyebrow">${done ? "已达成" : "待核验"} · ${t.done}/${t.required}</span><h3>${t.name}</h3><div class="meter"><i style="width:${(t.done / t.required) * 100}%"></i></div><p>${t.id === "life" ? `按旧册回访；每批最多落实12名待安置居民。当前仍待安置${p.remainingDisplaced}人；无待安置者则核实现有救助和民生回访。` : "原始账卷、交付凭据与现场结果逐批核对，形成可核验的改进记录。"}</p>${waiting.map((x) => `<p class="muted">一批已派员，${x.due - p.week}周后核验。</p>`).join("")}${btn("安排一批 · 8两" + (t.id === "life" ? " / 4石" : ""), "ac-work", `data-topic="${t.id}"`, "button outline", block({ silver: 8, grain: t.id === "life" ? 4 : 0, ap: 1 }) || inspectionLoad(p) >= 2 || t.done + waiting.length >= t.required || p.week + 2 > p.deadline)}</article>`;
         })
         .join(
           "",
         )}</div><p class="muted">只有实到的核验算完成。专款独立列账，原任公库不动；常规整改、复考期间每周私人俸余1两。</p>`
     : ""
 }
 ${p.status === "demotionNotice" ? `<p>留任复考仍未达标，决定由${OFFICES[p.role]}降调${LOWER[p.role]}。接受26周试用，可通过实际履职争取回原职复考；试用再失败则罢官。</p>${btn("接受降调，开始26周试用", "ac-begin", "", "button primary")}` : ""}
 ${
   p.status === "inquiry"
     ? `<p>停止升迁，原任账卷封存。账证至少查2周、证言至少查4周；最早第6周才能形成审拟。新增案件会重新计算取证期限。</p><p>${p.week >= 2 && a.incidents.some((i) => i.role === p.role && i.severity >= 2) ? "涉及较重指控，当前羁押待审；羁押不等于最终定罪。" : "当前为停职查核，尚无最终刑罚。"}</p><div class="speaker">${avatar("advisor")}<div><b>递交申辩</b><span>拒绝认罪、申请核实灾情不会单独加罪。</span></div></div><div class="choice-list">${[
         [
           "truth",
           "如实陈述，配合查核",
           "真实退赔可作为部分挪用案件减轻处分的依据，但不消除违法事实。",
         ],
         [
           "deny",
           "提出异议，要求核对证据",
           "按独立账证与证言查明，不因否认而加重。",
         ],
         [
           "disaster",
           "请核灾情与主观责任",
           "灾害因素与主动违法分开，不用天灾掩盖侵渔或毁证。",
         ],
       ]
         .map(([id, title, desc]) =>
           btn(
             `<b>${title}</b><p>${desc}</p>`,
             "ac-reply",
             `data-reply="${id}"`,
             "choice",
             !!p.reply,
           ),
         )
         .join(
           "",
         )}</div><p>${p.reply ? "申辩已入卷，等待独立查证。" : "未申辩也须依证据办理，不以沉默定罪。"}</p>${p.criminalChoice ? "" : `<details class="ac-risk"><summary>旧部提出的险招</summary><p class="warning-text">以下选择会实际形成新的违法行为，不会因申辩或原任政绩而消失。保留副本与独立证人仍会被核查。</p>${btn("指使毁证 · 将新增罪责", "ac-risk", 'data-kind="destroy"', "button danger")}${btn("指使灭口 · 可能判斩", "ac-risk", 'data-kind="murder"', "button danger")}</details>`}`
     : ""
 }
 ${p.status === "review" ? `<p>现拟处分：<strong>${STATUS[p.proposed]}</strong>。这是审拟结果，尚未生效；须完成复核。可以申诉一次，复核增加2周，申诉本身不会加重处分。</p>${btn(p.appealed ? "申诉已受理" : "提出申诉，再核证据", "ac-appeal", "", "button outline", p.appealed)}` : ""}
 ${p.status === "capitalReview" ? '<p class="warning-text">独立证据已证实故意杀人，拟判斩首。正在进行额外覆核与最终核准；本阶段结束前不执行。低分、天灾、普通失职均不会进入此程序。</p>' : ""}
 ${terminal ? `<div class="ac-ending"><h3>${STATUS[p.status]}处分已生效</h3><p>${sentenceText[p.status]}</p><p>处分依据与复核过程保留在下方附卷。${p.cause === "violation" ? `实际退赔${p.repaid}两，未清${num(p.liability - p.repaid)}两。` : "本次属于履职不合格，没有附加刑事罪名。"}</p>${btn("导出此生履历", "export", "", "button primary")}${btn("另起一局", "restart", "", "button outline")}</div>` : ""}
 ${passed ? `<div class="notice"><h3>留任复考已通过</h3><p>${p.demoted ? "已经历降调试用及回原职复考。" : ""}原任${p.initialScore}分保留，附卷合格记录恢复候选资格。考课期间私产收支及实际安置在交接时一并承接。</p>${p.role === "county" ? btn("办理通判任命", "appointment-open", "", "button primary") : p.role === "prefecture" ? btn("办理同知任命", "tz-appointment", "", "button primary") : p.role === "tongzhi" ? btn("办理知府任命", "zf-appointment", "", "button primary") : p.role === "zhifu" ? btn("办理按察司副使任命", "in-appointment", "", "button primary") : p.role === "inspector" ? btn("办理布政司参政任命", "cz-appointment", "", "button primary") : p.role === "canzheng" ? btn("办理布政使任命", "bz-appointment", "", "button primary") : p.role === "buzheng" ? btn("领受巡抚敕差", "xf-appointment", "", "button primary") : xunfuEndingView(s, {esc, btn})}${btn("导出完整履历", "export", "", "button outline")}</div>` : ""}
 ${["inquiry", "review"].includes(p.status) && p.liability > 0 ? `<section class="ac-restitution"><h3>退赔入卷</h3><p>已明确可退赔${p.liability}两，实退${p.repaid}两；当前私产${num(p.private)}两。只能从私产实际扣付，不调用封存公库。单项挪用案如实陈述且足额退赔，可由流放减为下狱；毁证或故意杀人不适用。</p>${btn(`以私产退赔${num(Math.min(p.private, p.liability - p.repaid))}两`, "ac-repay", "", "button outline", p.repaid >= p.liability || p.private <= 0)}</section>` : ""}
 </section>
 <section class="panel" id="ac-facts"><div class="section-head"><h2>责任与证据</h2><span>${{ ability: "履职能力与完成情况", disaster: "灾害因素可核", violation: "主动行为逐项查明" }[p.cause]}</span></div><p>${esc(p.disaster.text)}</p><p>低分不等于有罪；有灾情也不自动免除主动违法。本任事实与处分附卷分别留存。</p>${
   !criminal
     ? `<p>申请复核需2周。证实已如实履职且确有灾害影响，可延长当前整改或复考13周，并实拨80两、80石；不直接恢复候选资格。</p>${btn(p.reliefGranted ? "灾情复核已获准" : p.reliefDue !== null ? `灾情复核中 · ${p.reliefDue - p.week}周后答复` : "申请灾情与履职复核", "ac-disaster", "", "button outline", p.reliefClaimed || !["notice", "remedy", "retest"].includes(p.status))}`
     : `<div class="ac-evidence">${p.evidence
         .map((e) => {
           const i = a.incidents.find((i) => i.id === e.incident);
           return `<article><h3>${esc(i.title)}</h3><p>${OFFICES[i.role]}原任已过${i.week}周 · ${i.legacy ? "旧版有限记录：最多按行政去职处理，不推定为刑事重罪" : "记录来自已执行的明确选择"}</p><span>账证 ${e.documents ? "已核" : "待核"} · 独立证言 ${e.witnesses ? "已核" : "待核"}</span></article>`;
         })
         .join("")}</div>`
 }</section>
 <section class="panel" id="ac-history"><div class="section-head"><h2>考课与处分履历</h2><span>全生涯附卷累计${a.totalWeeks}周</span></div><p>已核安置${p.settled}人，旧册仍待落实${p.remainingDisplaced}人；过去的原任记录保持原样。整改差事、复考和降调试用是专门督办任期，并非重新发放原任三年全部资源。</p>${p.stageResults.map((r) => `<p>${STATUS[r.stage]} · 附卷第${r.week}周 · ${r.passed ? "通过" : "未通过"}（${r.targets.map((t) => `${t.name}${t.done}/${t.required}`).join("；")}）</p>`).join("")}<details open><summary>最近核办记录</summary>${p.logs
   .slice(0, 16)
   .map((l) => `<p><small>附卷第${l.week}周</small> ${esc(l.text)}</p>`)
   .join("")}</details><details><summary>专项和私产账目</summary>${p.ledger
   .slice(-20)
   .reverse()
   .map(
     (l) =>
       `<p>${esc(l.title)}：${["silver", "grain", "private"]
         .filter((k) => l[k] !== undefined)
         .map(
           (k) =>
             `${{ silver: "专项银", grain: "实粮", private: "私产" }[k]} ${l[k] > 0 ? "+" : ""}${num(l[k])}`,
         )
         .join(" · ")}</p>`,
   )
   .join(
     "",
   )}</details><p class="muted">本作沿用明代题材；整改期限、处分分档及重案流程为游戏化设计，不是历史律例的量刑表。刑罚以文书叙事呈现，不展示血腥场面。</p></section>${terminal || passed ? "" : `<div class="season-footer"><div><b>${p.deadline !== null ? `距本阶段核定${p.deadline - p.week}周` : "按周等待查核"}</b><p>${active ? "可用精力不结转，差事到期才算完成。" : "原任卷宗封存，附卷独立记账。"}</p></div>${btn("推进附卷一周", "ac-next", "", "button primary", advanceDisabled)}</div>`}</main></div>`;
}
