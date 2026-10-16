import { challengePanel, challengeRules, workDeadline } from "./career-difficulty-view.js";
import { challenged, CHALLENGE } from "./career-difficulty.js";
import { mainlineContext } from "./office-mainline.js";
import { officeStoriesView, storyBadge } from "./office-stories-view.js";
import { officeEvent, tzFloodWindow } from "./office-hard.js";
import { adminCost } from "./rules.js";
import { familyAllowance } from "./county-content.js";
import { decisionRisk } from "./accountability.js";
import { COUNTIES } from "./prefecture.js";
import {
  TZ_PROJECTS,
  TZ_EVENTS,
  tzLabel,
  defence,
  nextFlood,
  availableResettlers,
  worksActive,
} from "./tongzhi.js";
const STAGES = {
  planned: "待勘查报批",
  approval: "等待批复",
  approved: "已获批 · 待开工",
  building: "施工中",
  ready: "待查验交付",
  reworking: "返工中",
  complete: "已交付",
};
export function tongzhiView(s, h) {
  const { esc, num, scene, avatar, portrait, btn, icon } = h,
    q = s.tongzhi,
    event = mainlineContext(s, "tongzhi", officeEvent(q, TZ_EVENTS.find((e) => e.id === q.event))),
    flood = nextFlood(q),
    displaced = Object.values(q.counties).reduce((n, c) => n + c.displaced, 0),
    workers = Object.values(q.projects).filter((p) =>
      ["building", "reworking"].includes(p.status),
    ).length;
  const disabled = (cost) =>
    q.finished || Object.entries(cost).some(([k, v]) => q[k] < v);
  const costs = (c) =>
    Object.entries(c)
      .map(
        ([k, v]) =>
          `${{ silver: "专项银", grain: "实粮", ap: "精力" }[k]}${v}${k === "ap" ? "点" : k === "grain" ? "石" : "两"}`,
      )
      .join(" · ") || "不另耗银粮精力";
  const act = (label, project, action, cost = {}, blocked = false) =>
    btn(
      label,
      "tz-project",
      `data-id="${project}" data-action="${action}"`,
      "button outline",
      blocked || disabled(cost),
    );
  const top = `<header class="masthead"><div class="brand"><span class="brand-seal">永<br>平</span><span>古代官员升职记<small>卷三 · 河工赈济</small></span></div><div class="header-right">${btn(icon("save"), "save", 'aria-label="手动存档"', "header-button")}${btn(icon("settings"), "settings", 'aria-label="设置与存档"', "header-button")}</div></header>`;
  const projects = TZ_PROJECTS.map((d) => {
    const p = q.projects[d.id];
    let controls = "";
    if (p.status === "planned")
      controls = p.surveyed
        ? act("报请核准 · 1精力", d.id, "propose", { ap: 1 }, q.turn > 154)
        : act(`勘查 · ${adminCost(q, 8)}两 / 1精力`, d.id, "survey", {
            silver: adminCost(q, 8),
            ap: 1,
          });
    if (p.status === "approved")
      controls = act(
        `开工 · ${d.cost}两 / 1精力`,
        d.id,
        "start",
        { silver: d.cost, ap: 1 },
        workers >= 2,
      );
    if (["ready", "complete"].includes(p.status) && !p.inspected)
      controls += act(`深验 · ${adminCost(q, 10)}两 / 1精力`, d.id, "inspect", {
        silver: adminCost(q, 10),
        ap: 1,
      });
    if (
      ["ready", "complete"].includes(p.status) &&
      p.inspected &&
      p.quality < 70
    )
      controls += act(
        "返工2周 · 30两 / 1精力",
        d.id,
        "rework",
        { silver: 30, ap: 1 },
        workers >= 2 || q.turn > 154,
      );
    if (p.status === "ready")
      controls +=
        p.inspected && p.quality >= 70
          ? act("合格验收 · 1精力", d.id, "accept", { ap: 1 })
          : act("仅凭表面收讫 · 有风险", d.id, "accept-fast", { ap: 1 });
    if (p.status === "complete" && p.condition < p.quality)
      controls += act("修护 · 18两 / 1精力", d.id, "maintain", {
        silver: 18,
        ap: 1,
      });
    return `<article class="district-card tz-project"><div class="district-image">${scene(d.scene, "", d.name + "环境示意")}<h3>${d.name}</h3></div><div class="district-body"><span class="eyebrow">${STAGES[p.status]}${p.stalled ? " · 本周缺款停工" : ""}</span><p>${d.desc}</p><div class="tz-progress"><i style="width:${(p.progress / d.weeks) * 100}%"></i></div><p>实做 ${num(p.progress)} / ${d.weeks} 周 · ${p.surveyed ? "勘查已完成" : "尚未勘查"}<br>${p.inspected ? `已核质量 ${p.quality} / 100` : "真实质量待查验"}${p.status === "complete" ? ` · 设施状况 ${num(Math.round(p.condition))}` : ""}${p.due ? ` · ${p.due - q.turn}周后${p.status === "approval" ? "批复" : "返工查验"}` : ""}</p><p class="muted">材料${d.cost}两＋每个实际施工周${d.weekly}两；${q.counties[d.county].name}协作${num(q.counties[d.county].cooperation)}${q.counties[d.county].cooperation < 40 ? "，低于40每周只推进半周" : "，可正常推进"}。验收后常例养护2两/周。</p><div class="tz-controls">${controls}</div></div></article>`;
  }).join("");
  return `<div class="pref-shell tz-shell">${top}<main id="main-content" class="pref-main"><div class="page-heading"><div><div class="eyebrow">永平府 · ${q.finished ? "同知三年任满" : tzLabel(q)}</div><h1>河工与赈济</h1><p>${esc(s.name)} · 正五品同知 · 分管跨县水利、救助与查验</p></div><div class="ap-badge">${icon("action")}<b>${q.ap}</b><span>可用精力</span></div></div><nav class="pref-nav" aria-label="同知页内导航"><a href="#tz-stories">剧情与案牍 · ${storyBadge(s, "tongzhi")}</a><a href="#tz-works">跨县河工</a><a href="#tz-relief">安置赈济</a><a href="#tz-record">三任履历</a>${s.receipts.length ? btn("最近回执", "receipt", "", "text-button") : ""}</nav>${challengePanel(s,"tongzhi")}<section class="pref-hero tz-hero">${scene(q.floods.at(-1)?.turn === q.turn ? "scene_river_flood" : displaced ? "scene_relief_camp" : "scene_embankment_calm", "hero-scene", "河工与当前安置环境")}<div class="hero-wash"></div><div class="hero-caption"><span>永平府 · 同知分司</span><h2>巡河问工<br>筹粮安民</h2><p>先办险段，再看安置。</p></div>${portrait(s.appearance, "player-figure")}</section><div class="metrics">${[
    ["专项官银", q.silver, "两"],
    ["赈济实粮", q.grain, "石"],
    ["待安置居民", displaced, "人"],
    ["施工队在用", workers, "队"],
    q.hard
      ? ["汛期约在", flood ? tzFloodWindow(q).join("–") : "—", flood ? "周后" : ""]
      : ["距下一汛期", flood ? flood - q.turn : 0, "周"],
    ["登记可信度", q.registry, ""],
  ]
    .map(
      ([name, value, unit]) =>
        `<div class="metric"><div class="metric-label">${name}</div><div class="metric-value">${typeof value === "string" ? value : num(value)}<small>${unit}</small></div></div>`,
    )
    .join("")}</div>
 ${q.finished ? `<section class="assessment"><div class="assessment-score"><span>同知考语</span><h2>${q.outcome.rating}</h2><strong>${q.outcome.score}<small>/100</small></strong></div><div><h2>${q.outcome.candidate ? "河工赈济有绩，列入知府候选" : "本任得失，列入交接"}</h2><p>${q.outcome.summary}</p><p>${q.misconduct ? "本任有隐瞒、漏救、挪用或虚报责任，政绩不能代替核查。" : `${challenged(q)?"本职分（占总评90%）":"总评"}：属县民生25%、吏治20%、已验收设施状况25%、实际安置15%、名册可信度5%、留存防护10%。${q.hard ? "严苛难度：民生与吏治按全任平均与期末各半计，75分方可列入候选。" : ""}`}</p><p class="muted">知府任期已开放。未竟工程与待安置居民按实带入新任；旧专项公账保留交接。</p>${q.outcome.candidate ? btn("办理知府任命", "zf-appointment", "", "button primary") : ""}${btn("导出三任履历", "export", "", "button outline")}</div></section>` : `<section class="mandate-panel"><div>${icon("report")}</div><div><span class="eyebrow">${flood ? (q.hard ? `汛期约在 ${tzFloodWindow(q).join("–")} 周后` : `距下一次汛期 ${flood - q.turn} 周`) : "三次汛期均已过 · 转入善后交接"}</span><h3>${displaced ? `仍有${displaced}人等待安置` : "先备河防，再待雨来"}</h3><p>每年夏季末结算一次汛情。只计已交付设施和临时准备；各县准备在汛期后清零。口粮不能代替复耕核验。</p></div></section>${event ? `<section class="panel"><div class="section-head"><h2>本周同知公文</h2><span>须先处置</span></div><div class="speaker">${avatar(event.speaker)}<div><b>${event.title}</b><span>河工赈济 · 依授权办理</span></div></div><p>${event.text}</p><div class="choice-list">${event.options.map((o) => btn(`<b>${o.label}</b><small>${costs(o.cost)}</small><p>${o.desc}</p>${decisionRisk("tongzhi", event.id, o.id) ? `<p class="warning-text">${decisionRisk("tongzhi", event.id, o.id)}</p>` : ""}`, "tz-event", `data-choice="${o.id}"`, "choice", disabled(o.cost))).join("")}</div></section>` : '<div class="notice"><p>本周公文已办，可转到河工或县情安排差事。</p></div>'}`}
 ${officeStoriesView(s, "tongzhi", h)}
 <section id="tz-works" class="spaced"><div class="section-head"><h2>跨县河工</h2><span>施工队 ${workers}/2 · 勘查 → 报批 → 开工 → 深验 → 交付</span></div><div class="tz-projects">${projects}</div><div class="panel tz-maintenance"><div><h3>设施养护</h3><p>${q.maintenance ? "常例养护已启用：每项已交付设施每周2两，状况折损0.2。" : "常例养护已暂停，设施每周折损1.2。"}缺款按停护处理；填料不足须另行返工。</p>${q.workUntil > q.turn ? `<p>自愿雇工安排还有${q.workUntil - q.turn}周：有施工且支付4两工资时，首项工程多推进1周，病弱者口粮照供。</p>` : ""}</div>${btn(q.maintenance ? "暂停常例养护" : "启用常例养护", "tz-maintenance", `data-enabled="${!q.maintenance}"`, "button outline", q.finished)}</div></section>
 <section id="tz-relief" class="spaced"><div class="section-head"><h2>三县防汛与安置</h2><span>复耕两周后核验 · 口粮按每6人每周1石向上取整</span></div><div class="pref-counties">${COUNTIES.map(
   (d) => {
     const c = q.counties[d.id],
       available = availableResettlers(q, d.id);
     return `<article class="district-card"><div class="district-image">${scene(d.scene, "", d.name + "环境示意")}<h3>${d.name}</h3></div><div class="district-body"><div class="district-stats"><div><span>民生</span><b>${num(Math.round(c.people))}</b></div><div><span>防护合计</span><b>${num(defence(q, d.id))}</b></div><div><span>待安置</span><b>${c.displaced}</b></div></div><p>旧有防护${c.baseDefence}＋临时准备${c.prepared}＋已验收设施。<br>待安置含病弱${c.vulnerable}人；其中${c.displaced - available}人已安排复耕、待核验。</p><div class="tz-controls">${btn("督防 · 6两 / 1精力", "tz-prepare", `data-id="${d.id}"`, "button outline", disabled({ silver: 6, ap: 1 }) || q.turn - c.lastVisit < 4 || c.prepared >= 36)}${btn(`安置${Math.min(24, available)}人 · 12两 / 8石 / 1精力`, "tz-settle", `data-id="${d.id}"`, "button outline", disabled({ silver: 12, grain: 8, ap: 1 }) || available <= 0 || q.turn > 154)}</div><p class="muted">督防间隔4周，临时准备上限36；复耕核验前仍继续领口粮。</p></div></article>`;
   },
 ).join("")}</div></section>
 <section class="panel"><div class="section-head"><h2>筹粮与到期事项</h2><span>有来源，有运输，有实到</span></div><p>采买120石须60两，${worksActive(q, "ferry") ? 1 : 2}周到货，间隔4周；申请上级协济90石，3周实到，间隔13周。两项各用1精力。</p><div class="offline-actions">${btn("采购120石", "tz-supply", 'data-kind="buy"', "button outline", disabled({ silver: 60, ap: 1 }) || q.turn - q.lastBuy < 4 || q.turn + (worksActive(q, "ferry") ? 1 : 2) > 156)}${btn("申请协济90石", "tz-supply", 'data-kind="aid"', "button outline", disabled({ ap: 1 }) || q.turn - q.lastAid < 13 || q.turn > 153)}</div>${q.pending.length ? `<div class="shipment-list">${q.pending.map((x) => `<article><b>${x.kind === "approve" ? TZ_PROJECTS.find((d) => d.id === x.project).name + "报批" : x.kind === "settle" ? q.counties[x.county].name + "复耕核验" : x.kind === "buy" ? "采购赈粮" : x.kind === "aid" ? "上级协济" : "门楼另案批复"}</b><span>${x.amount ? x.amount + (x.kind === "settle" ? "人" : "石") + " · " : ""}${x.due - q.turn}周后交验</span></article>`).join("")}</div>` : '<p class="muted">暂无在途或待批事项。</p>'}<p class="muted">专项每周核拨12两、署务6两，净入6两；工费、口粮、养护另扣。私人俸入与家计每周净余${num(1.2 + familyAllowance(s))}两，不补贴公账。</p></section>
 <section class="panel" id="tz-record"><div class="section-head"><h2>三任履历</h2><span>同知 ${q.turn}/156周 · 生涯 ${312 + q.turn}周</span></div><p>清河知县：${s.outcome.rating}，${s.outcome.score}分。原工程与钱粮留县交接。</p><p>府通判：${s.prefecture.outcome.rating}，${s.prefecture.outcome.score}分；实运${q.record.delivered}石，调粮达标${q.record.met}项。原府银${num(q.record.silver)}两、粮${num(q.record.grain)}石留旧账，未挪作新任专项。</p><p>当前吏治${num(Math.round(q.integrity))}。</p><p>当前私产${num(q.private)}两；实际安置${q.resettled}人，移出未安置${q.excluded}人，累计缺供${q.shortage}石。</p><details><summary>历次汛情与实际防护</summary>${q.floods.map((f) => `<p>同知第${f.turn}周 · 雨势${f.pressure}：${f.counties.map((c) => `${q.counties[c.id].name}防护${num(Math.round(c.defence))}，新增待安置${c.displaced}人`).join("；")}。</p>`).join("") || "<p>尚未到首个汛期。</p>"}</details><details><summary>最近同知日录</summary>${q.logs
   .slice(0, 16)
   .map((x) => `<p><small>已结算${x.turn}周</small> ${esc(x.text)}</p>`)
   .join("")}</details><details><summary>最近专项与私产账目</summary>${q.ledger
   .slice(-18)
   .reverse()
   .map(
     (x) =>
       `<p>${esc(x.title)}：${["silver", "grain", "private"]
         .filter((k) => x[k] !== undefined)
         .map(
           (k) =>
             `${{ silver: "官银", grain: "实粮", private: "私产" }[k]} ${x[k] > 0 ? "+" : ""}${num(x[k])}`,
         )
         .join(" · ")}</p>`,
   )
   .join(
     "",
   )}</details>${btn("导出完整履历", "export", "", "text-button")}</section>${q.finished ? "" : `<div class="season-footer"><div><b>本周尚余${q.ap}点精力</b><p>周末核验工费、口粮、到期事项与汛情。</p></div>${btn(q.turn === 155 ? "提交同知考满" : "结束同知本周", "tz-next", "", "button primary", !!q.event)}</div>`}</main></div>`;
}
