import { mainlineContext } from "./office-mainline.js";
import { officeEvent } from "./office-hard.js";
import { adminCost } from "./rules.js";
import { officeStoriesView, storyBadge } from "./office-stories-view.js";
import { decisionRisk } from "./accountability.js";
import {
  COUNTIES,
  PREF_EVENTS,
  prefLabel,
  place,
  transportTerms,
} from "./prefecture.js";
export function prefectureView(s, h) {
  const { esc, num, scene, avatar, portrait, btn, icon } = h,
    p = s.prefecture,
    r = p.request,
    event = mainlineContext(s, "prefecture", officeEvent(p, PREF_EVENTS.find((e) => e.id === p.event)));
  const names = [
    ["silver", "府库官银", "两"],
    ["grain", "府仓实粮", "石"],
    ["currentRelief", "当期净接济", "石"],
    ["inTransit", "在途实粮", "石"],
    ["weeksLeft", "距调粮核定", "周"],
    ["condition", "府仓状况", ""],
  ];
  const top = `<header class="masthead"><div class="brand"><span class="brand-seal">永<br>平</span><span>古代官员升职记<small>卷二 · 府署粮运</small></span></div><div class="header-right">${btn(icon("save"), "save", 'aria-label="手动存档"', "header-button")}${btn(icon("settings"), "settings", 'aria-label="设置与存档"', "header-button")}</div></header>`;
  return `<div class="pref-shell">${top}<main id="main-content" class="pref-main"><div class="page-heading"><div><div class="eyebrow">永平府 · ${p.finished ? "三年任满" : prefLabel(p)}</div><h1>府署粮运</h1><p>${esc(s.name)} · 正六品通判 · 奉命分管粮储与运输</p></div><div class="ap-badge">${icon("action")}<b>${p.ap}</b><span>可用精力</span></div></div><nav class="pref-nav" aria-label="府署页内导航"><a href="#pref-stories">剧情与案牍 · ${storyBadge(s, "prefecture")}</a><a href="#pref-counties">三县余缺</a><a href="#pref-transport">调粮运次</a><a href="#pref-record">任职履历</a>${btn("最近回执", "receipt", "", "text-button")}</nav><section class="pref-hero">${scene("scene_granary", "hero-scene", "府仓环境示意")}<div class="hero-wash"></div><div class="hero-caption"><span>府仓 · 分司钱粮</span><h2>一府粮运<br>三县冷暖</h2><p>账上有数，更须仓中有粮。</p></div>${portrait(s.appearance, "player-figure")}</section><div class="metrics">${names.map(([k, n, u]) => `<div class="metric"><div class="metric-label">${n}</div><div class="metric-value">${num(k === "currentRelief" ? r.received : k === "inTransit" ? p.shipments.filter((x) => x.status === "transit").reduce((n, x) => n + x.amount, 0) : k === "weeksLeft" ? Math.max(0, r.due - p.turn) : p[k])}<small>${u}</small></div></div>`).join("")}</div>
 ${
   p.finished
     ? `<section class="assessment"><div class="assessment-score"><span>通判考语</span><h2>${p.outcome.rating}</h2><strong>${p.outcome.score}<small>/100</small></strong></div><div><h2>${p.outcome.candidate ? "粮运有绩，列入同知候选" : "本任成败，归卷备查"}</h2><p>${p.outcome.summary}</p><p>${p.misconduct ? "本任有虚报、包庇或重复征收记录，须先查明责任。" : `总评按属县民生30%、吏治30%、调粮要务25%、有效接济15%汇总。${p.hard ? "严苛难度：民生与吏治按全任平均与期末各半计，有效接济按各期实际申请总量折算，75分方可列入候选。" : ""}`}</p><p class="muted">称职且无待查责任，可接任分管水利赈济的同知。旧府账完整留作交接。</p>${p.outcome.candidate ? btn("办理同知任命", "tz-appointment", "", "button primary") : ""}${btn("导出两任履历", "export", "", "button outline")}</div></section>`
     : `<section class="mandate-panel"><div>${icon("report")}</div><div><span class="eyebrow">本阶段调粮 · ${Math.max(0, r.due - p.turn)}周后核定</span><h3>${place(p, r.county)} · 实收${r.need}石</h3><p>当期净调入${r.received}石。${r.status === "met" ? "本项已达成；期限内再调出导致不足时，将撤回达标奖励。" : "必须在期限内运抵；在途不算到仓。"}</p></div></section>${
         event
           ? `<section class="panel"><div class="section-head"><h2>本周府署公文</h2><span>须先处置</span></div><div class="speaker">${avatar("prefect")}<div><b>知府移文</b><span>通判分司办理，重大改额另行呈批</span></div></div><h3>${event.title}</h3><p>${event.text}</p><div class="choice-list">${event.options
               .map((o) =>
                 btn(
                   `<b>${o.label}</b><small>${
                     Object.entries(o.cost)
                       .map(
                         ([k, v]) =>
                           `${{ silver: "府银", grain: "府粮", ap: "精力" }[k]}${v}${k === "ap" ? "点" : k === "grain" ? "石" : "两"}`,
                       )
                       .join(" · ") || "无需额外银粮精力"
                   }</small><p>${o.desc}</p>${decisionRisk("prefecture", event.id, o.id) ? `<p class="warning-text">${decisionRisk("prefecture", event.id, o.id)}</p>` : ""}`,
                   `pref-event`,
                   `data-choice="${o.id}"`,
                   "choice",
                   Object.entries(o.cost).some(([k, v]) => p[k] < v),
                 ),
               )
               .join("")}</div></section>`
           : '<div class="notice"><p>本周府署公文已办，可核账、调粮或修仓，再结算下一周。</p></div>'
       }`
 }
 ${officeStoriesView(s, "prefecture", h)}
 <div class="section-head spaced" id="pref-counties"><h2>三县余缺</h2><span>调粮权限已列入任命；实粮与账面分别核验</span></div><div class="pref-counties">${COUNTIES.map(
   (d) => {
     const c = p.counties[d.id];
     return `<article class="district-card"><div class="district-image">${scene(d.scene, "", d.name + "环境示意")}<h3>${d.name}</h3></div><div class="district-body"><p>${d.desc}</p><div class="district-stats"><div><span>可调实粮</span><b>${num(c.grain)}</b></div><div><span>民生</span><b>${num(Math.round(c.people))}</b></div><div><span>协作</span><b>${num(c.cooperation)}</b></div></div><p>县报在册：${num(c.grain + c.discrepancy)}石 · ${c.audited ? `已核账差${num(c.discrepancy)}石` : "待核县报"}</p><div class="pref-actions">${btn(`核账 · ${adminCost(p, 6)}两 / 1精力`, "pref-audit", `data-id="${d.id}"`, "button outline", p.finished || p.ap < 1 || p.silver < adminCost(p, 6) || p.turn - c.lastAudit < 4)}${c.audited && c.discrepancy ? btn("纠正虚记 · 1精力", "pref-rectify", `data-id="${d.id}"`, "button outline", p.finished || p.ap < 1) : ""}</div></div></article>`;
   },
 ).join("")}</div>
 <section class="panel spaced" id="pref-transport"><div class="section-head"><h2>安排跨县调粮</h2><span>起运扣粮，到达才入收仓</span></div><p>常路8两、${transportTerms(p, "normal").weeks}周；急运18两、1周。每次调度用1精力。起运或收粮县协作达到60，运费减2两。${p.blockedUntil > p.turn ? `河浅阻行还剩${p.blockedUntil - p.turn}周，已出发运次按原定到期交验。` : ""}</p><div class="transport-form"><label class="field">起运仓<select id="pref-from" aria-label="起运仓"><option value="府仓">府仓</option>${COUNTIES.map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}</select></label><label class="field">收粮仓<select id="pref-to" aria-label="收粮仓">${COUNTIES.map((d) => `<option value="${d.id}" ${r.county === d.id ? "selected" : ""}>${d.name}</option>`).join("")}<option value="府仓">府仓</option></select></label><label class="field">调运数<select id="pref-amount" aria-label="调运数"><option value="60">60石</option><option value="120">120石</option></select></label><label class="field">运输方式<select id="pref-route" aria-label="运输方式"><option value="normal">常路</option><option value="urgent">急运</option></select></label></div>${btn("拟定调粮安排", "pref-plan", "", "button primary", p.finished || p.ap < 1)}<p class="muted">每县每周需用留仓粮2石，缺粮会损害民生。收回粮食前请留足当地周转。</p><p class="muted">共${p.shipments.length}个运次，下方显示最近8次；完整记录随履历保存。</p><div class="shipment-list">${
   p.shipments
     .slice(-8)
     .reverse()
     .map(
       (x) =>
         `<article><b>第${x.id}运次 · ${place(p, x.from)} → ${place(p, x.to)}</b><span>${x.amount}石 · ${x.status === "arrived" ? `已交验 · 有效接济${x.credited}石` : `${x.due - p.turn}周后交验`}</span></article>`,
     )
     .join("") || '<p class="muted">暂无运次。</p>'
 }</div></section>
 <section class="panel"><div class="section-head"><h2>府仓与在途</h2>${btn("修仓 · 30两 / 1精力", "pref-repair", "", "button outline", p.finished || p.ap < 1 || p.silver < 30 || p.condition >= 100)}</div><p>仓况每周下降0.35，低于40时每周霉损最多5石。修仓恢复25点，上限100。</p>${p.pending.map((x) => `<p>${esc(x.kind)} · ${x.due - p.turn}周后结算，预计${x.amount}石</p>`).join("") || '<p class="muted">暂无待批援粮或待处理损耗。</p>'}<p class="muted">府署每周核拨12两、例费7两，净余5两；个人俸入与家计净余1两。临时运费和修仓另计。</p></section>
 <section class="panel" id="pref-record"><div class="section-head"><h2>两任履历</h2><span>${p.turn}/156周 · 府任</span></div><p>清河知县：${s.outcome.rating}，${s.outcome.score}分。留县交接官银${num(s.silver)}两、实粮${num(s.grain)}石；工程${s.projectsCompleted}项，复核结案${s.wellJudged}件。</p><p>当前私产${num(p.private)}两 · 吏治${num(Math.round(p.integrity))} · 上级信任${num(Math.round(p.trust))}。</p><p>府任：运输到货${p.delivered}石，有效接济${p.effectiveDelivered}石，完成调粮${p.met}项、未达${p.missed}项。</p><details><summary>查看最近府任日录</summary>${p.logs
   .slice(0, 20)
   .map(
     (l) =>
       `<p><small>第${Math.min(l.turn + 1, 156)}周</small> ${esc(l.text)}</p>`,
   )
   .join(
     "",
   )}</details><details><summary>府仓与县仓流水</summary><div class="table-scroll"><table><thead><tr><th>时令</th><th>账簿</th><th>事项</th><th>变化</th></tr></thead><tbody>${p.ledger
   .slice()
   .reverse()
   .map(
     (l) =>
       `<tr><td>${prefLabel({ turn: l.turn })}</td><td>${l.county ? place(p, l.county) : "府仓 / 私产"}</td><td>${esc(l.title)}</td><td>${[
         "silver",
         "grain",
         "private",
       ]
         .filter((k) => l[k] !== undefined)
         .map(
           (k) =>
             `${{ silver: "银", grain: "粮", private: "私产" }[k]} ${l[k] > 0 ? "+" : ""}${num(l[k])}`,
         )
         .join(" · ")}</td></tr>`,
   )
   .join(
     "",
   )}</tbody></table></div></details>${btn("导出完整履历", "export", "", "text-button")}</section>${!p.finished ? `<div class="season-footer"><div><b>本周尚余${p.ap}点精力</b><p>下一周结算府库、属县口粮与实际到货。</p></div>${btn(p.turn === 155 ? "提交通判考满" : "结束府任本周", "pref-next", "", "button primary", !!p.event)}</div>` : ""}</main></div>`;
}
