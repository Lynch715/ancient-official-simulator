import { countyCase } from "./case-content.js";
import { routineStop, routineBoundary } from "./county-pacing.js";
import { AFFAIRS } from "./county-affairs.js";
import {
  actionUsable,
  actionDescription,
  projectBenefit,
} from "./county-rules.js";
import { adminCost } from "./rules.js";
import {
  HARD,
  isHard,
  remitGrain,
  buyCost,
  nextFloodWeek,
} from "./county-hard.js";
import { guideContent } from "./guide.js";
import { configureChapter, resetChapterPage } from "./chapter-ui.js";
import { OFFICIALS } from "./officials.js";
import {
  countyEvent,
  STAFF_PROFILES,
  staffTaskOptions,
  staffWorkBonus,
  caseChoices,
  countyMemories,
} from "./county-content.js";
import { handleOfficeAction } from "./office-actions.js";
import { persistState, restoreMessage } from "./storage.js";
import { decisionRisk } from "./accountability.js";
import { accountabilityView } from "./accountability-view.js";
import { zhifuView } from "./zhifu-view.js";
import { zfLabel } from "./zhifu.js";
import { tongzhiView } from "./tongzhi-view.js";
import { tzLabel } from "./tongzhi.js";
import {
  startOffline,
  offlineInfo,
  checkOffline,
  applyOfflineUpdate,
  installOffline,
} from "./offline.js";
import { startMobile } from "./mobile.js";
import { prefectureView } from "./prefecture-view.js";
import { transportTerms, place, prefLabel } from "./prefecture.js";
import {
  DISTRICTS,
  LOCAL_METRICS,
  POLICIES,
  INTERVENTIONS,
  interventionCost,
  districtIncomeFactor,
  policyOption,
} from "./governance.js";
import {
  createGame,
  dispatch,
  validateSave,
  label,
  affordability,
  weekLabel,
  budgetForecast,
} from "./engine.js";
import {
  FAMILIES,
  PEOPLE,
  PROJECTS,
  CASES,
  EVENTS,
  ACTIONS,
  TERM_WEEKS,
  WEEKS_PER_YEAR,
} from "./data.js";
const KEY = "qinghe-p0-v1",
  BACKUP = KEY + "-backup";
let s = null,
  tab = "court",
  modal = null,
  art = null,
  onboarding = { family: "humble", appearance: "player_a", difficulty: "hard" },
  lastFocus = null,
  storageError = "",
  artError = "";
let routineBusy = false,
  routineCancelled = false;
const $ = (x) => document.querySelector(x),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const num = (n) =>
  Number(n).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" aria-hidden="true"><use href="assets/art/icons/sprite.svg#${name}"></use></svg>`;
const asset = (id, variant) => {
  const a = art?.assets?.[id];
  return (
    a?.runtimeVariants.find((x) => x.name === variant)?.path ||
    a?.runtimeVariants[0]?.path ||
    ""
  );
};
const image = (id, cls = "", alt = "", variant = "md", fallback = "avatar") => {
  const src = asset(id, variant);
  return `<img class="${cls}" src="${src || `assets/art/placeholders/${fallback}.svg`}" alt="${esc(alt)}" data-fallback="${fallback}" loading="${cls.includes("hero") || cls.includes("player-figure") ? "eager" : "lazy"}" decoding="async">`;
};
const avatar = (id, cls = "avatar", name = "") =>
  image(
    `avatar_${id}`,
    cls,
    name ||
      PEOPLE.find((p) => p.id === id)?.name ||
      Object.values(OFFICIALS).find((p) => p.id === id)?.name ||
      "人物头像",
    "md",
  );
const portrait = (id, cls = "standing") =>
  image(
    `portrait_${id}${["player_a", "player_b", "player_c"].includes(id) ? (s?.zhifu ? "_zhifu" : s?.tongzhi ? "_tongzhi" : s?.prefecture ? "_prefecture" : "") : ""}`,
    cls,
    PEOPLE.find((p) => p.id === id)?.name || s?.name || "人物立绘",
    "main",
    "person",
  );
const scene = (id, cls = "scene-img", alt = "清河县风物") => {
  const a = asset(id, "lg"),
    sm = asset(id, "sm");
  return `<img class="${cls}" src="${a || "assets/art/placeholders/scene.svg"}" ${a && sm ? `srcset="${sm} 720w, ${a} 1200w" sizes="(max-width: 700px) 100vw, 65vw"` : ""} alt="${alt}" data-fallback="scene" decoding="async">`;
};
const btn = (text, action, extra = "", cls = "button", disabled = false) =>
  `<button class="${cls}" data-act="${action}" ${extra} ${disabled || routineBusy ? "disabled" : ""}>${text}</button>`;
const costText = (c) =>
  Object.entries(c || {})
    .map(
      ([k, v]) =>
        `${{ silver: "官银", grain: "仓粮", private: "私产", ap: "精力" }[k]} ${v}${{ silver: "两", grain: "石", private: "两", ap: "点" }[k] || ""}`,
    )
    .join(" · ") || "无需额外银粮";
const person = (id) =>
  PEOPLE.find((p) => p.id === id) || {
    id,
    name: s?.name || "新任知县",
    role: "清河县知县",
  };
function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4200);
}
function save(manual = false) {
  if (!s) return true;
  let saved = false;
  try {
    saved = persistState(localStorage, KEY, s);
  } catch {}
  storageError = saved
    ? ""
    : "尚未存档：浏览器存储不可用，请导出履历。刷新前请先备份。";
  if (!saved || manual) toast(saved ? "履历已存入此浏览器。" : storageError);
  return saved;
}
function load() {
  try {
    const str = localStorage.getItem(KEY);
    if (str) s = validateSave(JSON.parse(str));
  } catch (e) {
    storageError =
      e.name === "SecurityError"
        ? "浏览器存储不可用，进度只能保留在当前会话，请导出履历文本。"
        : "原存档无法读取，请在设置中导入有效存档或恢复备份。";
  }
}
function run(type, params = {}, quiet = false) {
  try {
    const previous = modal;
    s = dispatch(s, {
      id: `${s.revision}:${type}:${JSON.stringify(params)}`,
      type,
      ...params,
    });
    const saved = save();
    if (
      type === "advance" ||
      type === "appointment" ||
      type === "pref_advance" ||
      type === "tz_appoint" ||
      type === "tz_advance" ||
      type === "zf_appoint" ||
      type === "zf_advance" ||
      type === "ac_begin" ||
      type === "ac_advance"
    ) {
      resetChapterPage(
        s.accountability?.current
          ? "accountability"
          : s.zhifu
            ? "zhifu"
            : s.tongzhi
              ? "tongzhi"
              : "prefecture",
      );
      tab = s.finished ? "career" : "court";
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (quiet) {
      modal = null;
      render();
      return { saved };
    }
    if (type === "staff") {
      modal = null;
      render();
      toast("差事已调整，将在周末执行。");
      return;
    }
    modal = {
      type: "receipt",
      receipt: s.receipts[0],
      returnTo: ["investigate", "enforce"].includes(type) ? previous : null,
    };
    render();
    requestAnimationFrame(() => $("#modal-root .dialog")?.focus());
    return { saved };
  } catch (e) {
    toast(e.message);
    return null;
  }
}
async function continueRoutine() {
  let reason = routineStop(s);
  if (reason || storageError) {
    toast(reason || "浏览器存储不可用，先备份履历后手动结算。");
    return;
  }
  routineBusy = true;
  routineCancelled = false;
  modal = null;
  const weeks = [];
  try {
    for (let i = 0; i < 13; i++) {
      reason = routineStop(s);
      if (reason || routineCancelled) break;
      const before = s,
        result = run("advance", {}, true);
      if (!result) {
        reason = "本周操作未完成，查看当前提示。";
        break;
      }
      weeks.push({
        label: weekLabel(before.turn),
        silver: Math.round((s.silver - before.silver) * 100) / 100,
        grain: Math.round((s.grain - before.grain) * 100) / 100,
      });
      if (!result.saved) {
        reason = "本周尚未存档，先导出履历；已停止继续推进。";
        break;
      }
      reason = routineBoundary(before, s);
      if (reason) break;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } finally {
    routineBusy = false;
    render();
    showModal({
      type: "routine-result",
      weeks,
      reason: routineCancelled
        ? "已停止，已结算的周次保留。"
        : reason || "已推进13周，先核对本段账目。",
    });
  }
}
function showModal(m) {
  lastFocus = document.activeElement;
  modal = m;
  renderModal();
  requestAnimationFrame(() => $("#modal-root .dialog")?.focus());
}
function closeModal() {
  const back = modal?.returnTo;
  modal = back || null;
  renderModal();
  if (back) requestAnimationFrame(() => $("#modal-root .dialog")?.focus());
  else lastFocus?.focus?.();
}
const navs = [
  ["court", "公堂", "court"],
  ["territory", "辖地", "map"],
  ["cases", "案牍", "cases"],
  ["treasury", "钱粮", "treasury"],
  ["governance", "县政", "report"],
  ["staff", "官署", "staff"],
  ["career", "仕途", "career"],
];
function startView() {
  return `<main class="welcome"><div class="welcome-art">${scene("scene_county_gate", "welcome-scene", "清河县衙门前的市井风景")}<div class="welcome-overlay"><div class="eyebrow light">明代题材 · 地方治理模拟</div><h1>古代官员<br>升职记<span>清河初任</span></h1><p>一纸任命，千家生计。<br>从七品知县，写下你的为官之道。</p><div class="welcome-bottom">治田理财　·　听讼平争　·　赈济安民</div></div></div><section class="welcome-form"><div class="eyebrow">卷一 / 履任</div><h2>今日，赴清河。</h2><p class="muted intro">你二十六岁，进士出身，观政后外授知县。每次推进一周，三年一任。许多事情，都要从这张书案开始。</p><label class="field">你的姓名<input id="player-name" maxlength="12" value="沈知行" autocomplete="off"></label><div class="field-label">选择形象</div><div class="appearance-options">${["player_a", "player_b", "player_c"].map((id, i) => `<button class="appearance ${onboarding.appearance === id ? "selected" : ""}" data-act="appearance" data-id="${id}" aria-label="形象${i + 1}" aria-pressed="${onboarding.appearance === id}">${avatar(id)}<span>${["沉静", "明朗", "专注"][i]}</span></button>`).join("")}</div><div class="field-label">你的来处</div><div class="family-options">${Object.entries(
    FAMILIES,
  )
    .map(
      ([id, f]) =>
        `<button data-act="family" data-id="${id}" class="family ${onboarding.family === id ? "selected" : ""}" aria-pressed="${onboarding.family === id}"><b>${f.name}</b><span>${f.desc}</span></button>`,
    )
    .join(
      "",
    )}</div><div class="field-label">为官难度</div><div class="family-options difficulty-options">${[
      ["hard", "严苛", "银粮微薄，季末实解府库；旱涝时间与轻重每局不同，考评不封顶。精打细算、未雨绸缪，才可能称职。"],
      ["standard", "常例", "钱粮宽裕，灾情按固定时节到来，适合初次上手、熟悉各项办事流程。"],
    ]
      .map(
        ([id, name, desc]) =>
          `<button data-act="difficulty" data-id="${id}" class="family ${onboarding.difficulty === id ? "selected" : ""}" aria-pressed="${onboarding.difficulty === id}"><b>${name}</b><span>${desc}</span></button>`,
      )
      .join("")}</div>${btn("接印赴任 " + icon("chevron_right"), "start", "", "button primary large")}<div class="onboarding-note">难度在接印时选定，整段仕途沿用；知县、通判、同知、知府四任各156周，可随时存档。<br>考核失利可整改复考，主动违法另案查核。<br>历史制度为参照，人物与地方为虚构。</div>${btn("办事指南", "help", "", "text-button")}${btn("导入已有履历", "import", "", "text-button")}${storageError ? `<p class="warning-text">${storageError}</p>` : ""}</section></main>`;
}
function metrics() {
  const items = [
    ["silver", "可用官银", num(s.silver), "两"],
    ["grain", "实存仓粮", num(s.grain), "石"],
    ["livelihood", "民生", Math.round(s.people), ""],
    ["economy", "农商", Math.round(s.economy), ""],
    ["order", "治安", Math.round(s.order), ""],
    ["integrity", "吏治", Math.round(s.integrity), ""],
  ];
  return `<div class="metrics">${items.map(([i, t, v, u]) => `<div class="metric"><div class="metric-label">${icon(i)}${t}</div><div class="metric-value">${v}<small>${u}</small></div>${!u ? `<div class="meter"><i style="width:${v}%"></i></div>` : ""}</div>`).join("")}</div>`;
}
function shell(content) {
  return `<div class="game-shell"><header class="masthead"><a class="brand" href="#" data-act="tab" data-id="court"><span class="brand-seal">清<br>河</span><span>古代官员升职记<small>清河初任 · ${isHard(s) ? "严苛" : "一县三年"}</small></span></a><div class="header-right"><span class="season-label">${s.finished ? "三年任满" : label(s)}</span>${btn(icon("save") + "<span>存档</span>", "save", 'aria-label="手动存档"', "header-button")}${btn(icon("settings"), "settings", 'aria-label="设置与存档"', "header-button")}</div></header><div class="workspace"><aside class="sidebar"><div class="official">${avatar(s.appearance)}<b>${esc(s.name)}</b><span>清河县知县</span><em>正七品</em></div><nav aria-label="主要页面">${navs.map(([id, t, i]) => btn(icon(i) + `<span>${t}</span>`, "tab", `data-id="${id}" ${tab === id ? 'aria-current="page"' : ""}`, `nav-item ${tab === id ? "active" : ""}`)).join("")}</nav><div class="sidebar-bottom"><span>初入仕途</span><div class="season-dots">${Array.from({ length: 12 }, (_, i) => `<i class="${i < Math.floor(s.turn / 13) ? "done" : i === Math.floor(s.turn / 13) ? "current" : ""}"></i>`).join("")}</div><p>${Math.min(s.turn, TERM_WEEKS)} / ${TERM_WEEKS} 周已结算</p></div></aside><main id="main-content" class="main-content"><nav class="county-tabs" role="tablist" aria-label="县署页面">${navs.map(([id, t]) => `<button role="tab" data-act="tab" data-id="${id}" aria-selected="${tab === id}" ${routineBusy ? "disabled" : ""}>${t}</button>`).join("")}</nav>${content}</main></div>${countyToolbar()}</div>`;
}
function heading(title, sub, aside = "") {
  return `<div class="page-heading"><div><div class="eyebrow">清河县 · ${s.finished ? "任满归卷" : weekLabel(s.turn)}</div><h1>${title}</h1><p>${sub}</p></div>${aside}</div>`;
}
function eventCard(e) {
  const def = countyEvent(s, e.id);
  return `<button class="event-card" data-act="event" data-id="${e.id}"><div class="event-symbol">${avatar(def.speaker)}</div><div class="event-copy"><div class="event-meta">${def.tag}<span>${e.mandatory ? "本周要事" : "额外来信"}</span></div><h3>${def.title}</h3><p>${def.text}</p></div>${icon("chevron_right")}</button>`;
}
function court() {
  let openCases = Object.values(s.cases).filter(
    (c) =>
      c.status !== "closed" ||
      ["awaiting", "overdue", "executing"].includes(c.execution?.status),
  ).length;
  return (
    heading(
      "今日公堂",
      "一县之事，先辨轻重缓急。",
      `<div class="ap-badge">${icon("action")}<b>${s.ap}</b><span>可用精力</span></div>`,
    ) +
    `<div class="mobile-shortcuts">${btn(icon("treasury") + " 钱粮账簿", "tab", 'data-id="treasury"', "text-button")}${btn(icon("staff") + " 官署任事", "tab", 'data-id="staff"', "text-button")}${btn(icon("report") + " 县政方略", "tab", 'data-id="governance"', "text-button")}</div><div class="court-top"><section class="hero-stage">${scene("scene_county_hall", "hero-scene", "清河县公堂")}<div class="hero-wash"></div><div class="hero-caption"><span>正堂 · 清河县衙</span><h2>为官一任<br>安此一方</h2><p>案上是公文，案下是人间。</p></div>${portrait(s.appearance, "player-figure")}<span class="scene-signature">${esc(s.name)} · ${s.turn < 13 ? "初任知县" : "清河县知县"}</span></section><section class="today-panel"><div class="section-head"><h2>案头待办</h2><span>${s.events.length + dutyItems().length}件</span></div>${s.events.map(eventCard).join("")}${dutyItems().map(dutyCard).join("")}${s.events.length || dutyItems().length ? "" : `<div class="empty compact">${icon("confirm")}<h3>本周没有新来信</h3><p>例行事务由属员办理。可安排工程、调查案卷，或结算下一周。</p></div>`}<div class="small-link-row">${btn(`待办案卷 <b>${openCases}</b> ${icon("chevron_right")}`, "tab", 'data-id="cases"', "text-button")}${btn("查看任职进度", "tab", 'data-id="career"', "text-button")}${s.receipts.length ? btn("最近回执", "receipt", "", "text-button") : ""}</div></section></div>${metrics()}${hardPanel()}${mandateCard()}<div class="two-col"><section class="panel"><div class="section-head"><h2>亲自督办</h2><span>每周三点 · 高疲劳时减少</span></div><div class="action-grid">${ACTIONS.map(
      (a) => {
        let reason = s.finished
          ? "本任已结束"
          : s.actions.includes(a.id)
            ? "本周已办"
            : !actionUsable(s, a)
              ? "已无新增收益"
              : affordability(s, a.cost);
        return `<button class="action-card" data-act="action" data-id="${a.id}" ${reason ? "disabled" : ""}>${icon(a.icon)}<b>${a.name}</b><span>${reason || "精力 1点"}</span><small>${actionDescription(s, a)}</small></button>`;
      },
    ).join(
      "",
    )}</div><div class="panel-foot">疲劳 ${Math.round(s.fatigue)}/100 <small>65起每周少1点精力，85起不可透支</small> ${btn("额外督办 +1 精力", "overwork", "", "text-button", s.overworked || s.fatigue >= 85 || s.finished)}</div></section><section class="panel"><div class="section-head"><h2>本任回响</h2>${btn("全部记录", "journal", "", "text-button")}</div><div class="log-list">${s.logs
      .slice(0, 3)
      .map(
        (l) =>
          `<div class="log-item"><span class="log-dot ${esc(l.kind)}"></span><div><h3>${esc(l.title)}</h3><p>${esc(l.text)}</p></div></div>`,
      )
      .join(
        "",
      )}</div></section></div><div class="season-footer"><div><b>${s.events.some((e) => e.mandatory) ? "先办眼前事，再启下一周。" : "本周要事已办妥。"}</b><p>${s.ap > 0 ? `仍有${s.ap}点精力，可用于工程或调查。` : "精力用尽，基础应急处置仍可办理。"}</p></div>${
      s.finished
        ? btn("查看任满考核", "tab", 'data-id="career"', "button primary")
        : btn(
            `结束本周 ${icon("chevron_right")}`,
            "advance",
            "",
            "button primary",
            s.events.some((e) => e.mandatory),
          )
    }${!s.finished ? `<div class="routine-control">${btn("按常例推进至下一件待办", "routine", "", "button outline", !!routineStop(s) || !!storageError)}<small>${esc(routineStop(s) || storageError || "每周存档，遇新事项即停。")}</small></div>` : ""}</div>`
  );
}
let mapPlace = "county",
  ledgerSeasons = 1;
const ACCOUNTS = [
  ["silver", "官银", "两"],
  ["grain", "仓粮", "石"],
  ["private", "私产", "两"],
];
const signed = (v, unit) => `${v > 0 ? "+" : ""}${num(Math.round(v * 100) / 100)}${unit}`;
// 收支流水按周汇总，默认只列本季，可逐季展开更早记录。
function ledgerPanel(rows, turn, labelOf) {
  const latest = Math.min(turn, 155),
    from = Math.floor(latest / 13) * 13 - 13 * (ledgerSeasons - 1);
  const weeks = new Map();
  for (const l of rows) {
    if (l.turn < from) continue;
    if (!ACCOUNTS.some(([k]) => l[k]) && !l.note) continue;
    if (!weeks.has(l.turn)) weeks.set(l.turn, []);
    weeks.get(l.turn).push(l);
  }
  const older = rows.some((l) => l.turn < from);
  const blocks = [...weeks.entries()]
    .map(([t, list]) => {
      const sum = Object.fromEntries(
        ACCOUNTS.map(([k]) => [k, list.reduce((n, l) => n + (l[k] || 0), 0)]),
      );
      const head = ACCOUNTS.filter(([k]) => Math.abs(sum[k]) >= 0.005)
        .map(([k, n, u]) => `<b class="${sum[k] > 0 ? "positive" : "negative"}">${n} ${signed(sum[k], u)}</b>`)
        .join("");
      const items = list
        .map(
          (l) =>
            `<li><span>${esc(l.title)}${l.note ? `<small>${esc(l.note)}</small>` : ""}</span><em>${
              ACCOUNTS.filter(([k]) => l[k])
                .map(([k, n, u]) => `<i class="${l[k] > 0 ? "positive" : "negative"}">${n} ${signed(l[k], u)}</i>`)
                .join("") || "<i>过账</i>"
            }</em></li>`,
        )
        .join("");
      return `<details class="ledger-week"><summary><span>${labelOf(t)}<small>${list.length}笔</small></span><span class="ledger-sum">${head || "<b>无净变动</b>"}</span></summary><ul>${items}</ul></details>`;
    })
    .join("");
  return `<section class="panel ledger-panel"><div class="section-head"><h2>收支流水</h2><span>按周汇总 · 点开看明细</span></div>${blocks || '<p class="muted">本季尚无流水。</p>'}${older ? btn(`显示更早一季`, "ledger-more", "", "button outline ledger-more") : ""}</section>`;
}
const MAP_PLACES = [
  {
    id: "county",
    x: 51,
    y: 45,
    mx: 52,
    my: 42,
    t: "县城",
    district: "market",
    target: "scene_market",
  },
  {
    id: "fields",
    x: 32,
    y: 65,
    mx: 30,
    my: 74,
    t: "南渠",
    district: "fields",
    project: "canal",
    target: "scene_fields_canal",
  },
  {
    id: "embankment",
    x: 68,
    y: 68,
    mx: 65,
    my: 83,
    t: "东堤",
    district: "river",
    project: "embankment",
    target: "scene_embankment_calm",
  },
  {
    id: "ferry",
    x: 80,
    y: 46,
    mx: 82,
    my: 64,
    t: "渡口",
    district: "river",
    project: "road",
    target: "scene_river_ferry",
  },
  {
    id: "school",
    x: 26,
    y: 38,
    mx: 22,
    my: 30,
    t: "县学",
    project: "school",
    target: "scene_county_school",
  },
];
function mapContext() {
  const point = MAP_PLACES.find((p) => p.id === mapPlace) || MAP_PLACES[0];
  const district = point.district && s.governance.districts[point.district];
  const project =
    point.project && s.projects.find((p) => p.id === point.project);
  const status = point.project
    ? project
      ? project.status === "complete"
        ? `已交付 · 状况${num(Math.round(project.condition))}/100${point.project !== "school" ? ` · 现有主效力${num(projectBenefit(s, point.project) * 100)}%` : ""}`
        : `施工中 · 尚余${num(project.remaining)}周工作量`
      : "工程尚未立项"
    : "县城商坊 · 当地县情";
  return `<section class="map-context" aria-live="polite"><div><h3>${point.t}</h3><p>${status}</p>${district ? `<p>生计${Math.floor(district.livelihood)} · 生产${Math.floor(district.commerce)} · 秩序${Math.floor(district.security)}</p>` : `<p>文教${num(s.education)} · 修缮交付时计一次文教成果</p>`}</div><div class="map-context-actions">${point.district ? btn("查看与督办", "district", `data-id="${point.district}"`, "button outline") : ""}${point.project ? btn(project ? "查看工程" : "查看并立项", project ? "map-project" : "project", `data-id="${point.project}"`, "button outline", s.finished && !project) : ""}${btn("看风物", "scene", `data-id="${point.target}" data-title="${point.t}"`, "text-button")}</div></section>`;
}
function territory() {
  return (
    heading("县境山河", "水通田沃，路畅商来。每一项兴修，都有自己的工期。") +
    `<div class="map-heading"><h2>清河县图</h2><span>点击地点，查看当前县情</span></div><section class="map-panel" aria-label="清河县域地图">${scene("scene_county_overview", "map-img", "清河县域鸟瞰")}${MAP_PLACES.map((p) => `<button class="map-pin ${mapPlace === p.id ? "selected" : ""}" style="--pin-x:${p.x}%;--pin-y:${p.y}%;--mobile-x:${p.mx}%;--mobile-y:${p.my}%" data-act="map-place" data-id="${p.id}" aria-pressed="${mapPlace === p.id}"><span class="map-dot" aria-hidden="true"></span><span class="map-place-label">${p.t}</span></button>`).join("")}</section>${mapContext()}<div class="territory-summary"><span>常住人口 <b>${num(s.population)}</b></span><span>待安置 <b>${s.displaced}</b> 人</span><span>已竣工 <b>${s.projectsCompleted}</b> 项</span>${btn("查看地方风物", "gallery", "", "text-button")}</div>${districtCards()}<div class="section-head spaced"><h2>兴修与养护</h2><span>立项即扣款，周末推进施工</span></div><div class="project-grid">${PROJECTS.map(
      (p) => {
        const done = s.projects.find((x) => x.id === p.id);
        return `<article class="project-card" id="project-${p.id}"><div class="project-image">${scene(p.scene, "", "地方工程环境")}<span class="project-state">${done ? (done.status === "complete" ? "已验收" : `施工中 · 预计余${Math.ceil(done.remaining / ((1 + staffWorkBonus(s, done.id)) * (affordability(s, policyOption(s, "labor").cost) ? 1 : policyOption(s, "labor").work)))}周`) : "可立项"}</span></div><div class="project-body"><h3>${icon(p.icon)}${p.name}</h3><p>${p.desc}</p><div class="project-benefit">${p.benefit}</div><div class="project-cost">立项 ${p.cost}两 · 基准工期 ${p.duration}周 · 维护 ${p.upkeep}两/13周</div>${done ? `<div class="project-progress"><i style="width:${done.status === "complete" ? 100 : ((p.duration - done.remaining) / p.duration) * 100}%"></i></div><small>${done.status === "complete" ? `养护状况 ${num(Math.round(done.condition))}/100` : "属员协办可加快施工，请到官署安排。"}</small>${done.status === "complete" && done.condition < 100 ? btn("集中修复 · 20两 / 1精力", "repair", `data-id="${p.id}"`, "text-button", s.finished || s.ap < 1 || s.silver < 20) : ""}` : btn("查看并立项", "project", `data-id="${p.id}"`, "button outline", s.finished)}</div></article>`;
      },
    ).join(
      "",
    )}</div>${s.displaced > 0 ? `<div class="notice"><div><b>仍有${s.displaced}人需要过渡安置</b><p>追加十五石粮，本周最多帮助十八名居民。</p></div>${btn("追加救济 · 15石", "relief", "", "button outline", s.relievedThisTurn || s.grain < 15 || s.finished)}</div>` : ""}`
  );
}
function casesView() {
  return (
    heading("案牍有凭", "看见的不一定完整，结论须有事实支撑。") +
    `<div class="case-summary"><span>立卷 <b>${Object.keys(s.cases).length}</b></span><span>复核结案 <b>${s.wellJudged}</b></span><span>退回补查 <b>${s.badJudged}</b></span><p>县级调查与拟议，重大案卷须呈府复核。</p></div><div class="case-grid">${CASES.map(
      (base) => {
        const c = countyCase(s, base.id),
          cs = s.cases[c.id];
        return `<article class="case-card ${!cs ? "locked" : ""}"><div class="case-cover">${scene(c.scene, "", "案发环境")}${cs ? `<span class="project-state">${caseStatus(cs)}</span>` : ""}</div><div class="case-body"><span class="eyebrow">${{ boundary: "田土", granary: "仓储", inheritance: "户婚", ferry: "人命" }[base.id] || "地方"} · 案卷</span><h2>${c.name}</h2><p>${cs ? c.summary : "将随任期与地方事务自然发生。"}</p>${cs ? `<div class="case-evidence">已核实 ${cs.clues.length} / ${c.clues.length} 项线索</div>${executionInfo(cs)}${btn("展开案卷 " + icon("chevron_right"), "case", `data-id="${c.id}"`, "button outline")}` : `<div class="muted">尚未受理</div>`}</div></article>`;
      },
    ).join("")}</div>`
  );
}
function treasury() {
  return (
    heading("钱粮有数", "公帑与私产分账，承诺与实到分记。") +
    `<div class="account-grid"><div class="account-card"><span>可用官银</span><strong>${num(s.silver)}<small>两</small></strong><p>只计可用收入，已上解部分不重复计入。</p></div><div class="account-card"><span>实存可用仓粮</span><strong>${num(s.grain)}<small>石</small></strong><p>农户与市场的粮食不属于官仓。</p></div><div class="account-card private"><span>私人家资</span><strong>${num(s.private)}<small>两</small></strong><p>俸禄、赡养及幕友支出单独记账。</p></div></div>${forecastCard()}<section class="panel"><div class="section-head"><h2>往来与待办</h2><span>当前购粮参考价 ${num(s.grainPrice)}两/石</span></div>${hardTreasury()}<p class="muted">本任人口期初${s.populationLedger.opening}人，新增待安置${s.populationLedger.arrived}人，已核验恢复生计${s.populationLedger.settled}人；累计缺供${num(s.populationLedger.shortage)}石。上级信任≥75时，案卷执行差费省2两。</p><div class="pending-list">${
      s.pending
        .filter((p) => ["aid", "purchase"].includes(p.kind))
        .map(
          (p) =>
            `<div>${icon("dispatch")}<span>${p.kind === "aid" ? "协济申请" : "采购在途"} · ${p.payload.grain}石</span><b>${p.due - s.turn}周后查验</b></div>`,
        )
        .join("") || '<p class="muted">目前没有未到账的粮源。</p>'
    }${s.flags.arrears ? `<p class="warning-text">例行公费欠付：${s.flags.arrears}两，已入交接记录。</p>${btn("清偿欠付", "arrears", "", "button outline", s.finished || s.silver < s.flags.arrears)}` : ""}</div></section>${ledgerPanel(s.ledger, s.turn, weekLabel)}`
  );
}
function staffView() {
  return (
    heading("官署诸人", "听其言，察其行。把事情交出去，也把验收留在手里。") +
    `<div class="notice"><p>差事持续到撤回。核账、巡守、访察各最多两人，协工最多一人；协工按立项先后，每周只提速一项。${isHard(s) ? "严苛难度下属员效力为常例的六成。" : ""}</p></div>${hireCard()}<div class="people-grid">${PEOPLE.filter((p) => p.task).map(
      (p) =>
        `<article class="person-card"><button class="portrait-button" data-act="person" data-id="${p.id}" aria-label="查看${p.name}">${avatar(p.id, "avatar large-avatar")}</button><div class="person-copy"><span>${p.role}</span><h3>${p.name}</h3><p>${p.desc}</p>${relationshipInfo(p.id)}${
          p.task
            ? `<p class="staff-specialty">${STAFF_PROFILES[p.id].note}</p><label class="task-select">常任差事<select data-person="${p.id}" ${s.finished ? "disabled" : ""}><option value="">尚未安排</option>${staffTaskOptions(
                s,
                p.id,
              )
                .map(
                  ([k, v]) =>
                    `<option value="${k}" ${s.staffAssignments[p.id] === k ? "selected" : ""}>${v}</option>`,
                )
                .join("")}</select></label>`
            : btn("人物小传", "person", `data-id="${p.id}"`, "text-button")
        }</div></article>`,
    ).join("")}</div><details class="people-more"><summary>地方人物${PEOPLE.filter((p) => !p.task).length}位 · 互信与小传</summary><div class="people-grid">${PEOPLE.filter((p) => !p.task)
      .map(
        (p) =>
          `<article class="person-card"><button class="portrait-button" data-act="person" data-id="${p.id}" aria-label="查看${p.name}">${avatar(p.id, "avatar large-avatar")}</button><div class="person-copy"><span>${p.role}</span><h3>${p.name}</h3><p>${p.desc}</p>${relationshipInfo(p.id)}${btn("人物小传", "person", `data-id="${p.id}"`, "text-button")}</div></article>`,
      )
      .join("")}</div></details>`
  );
}
function career() {
  let out = s.outcome;
  return (
    heading(
      s.finished ? "三年，归入履历" : "为官履历",
      s.finished
        ? "地方的变化，比一纸考语更长久。"
        : "升迁看政绩，也看责任、履历与官缺。",
    ) +
    `<section class="career-profile">${portrait(s.appearance, "career-standing")}<div><span class="eyebrow">${s.finished ? "清河任满" : "初任清河"}</span><h2>${esc(s.name)}</h2><p>${26 + Math.floor(s.turn / WEEKS_PER_YEAR)}岁 · ${FAMILIES[s.familyId].name} · 进士出身</p><div class="rank-ribbon">正七品 · 清河县知县</div><div class="career-household"><span>文教 <b>${Math.round(s.education)}</b> · ${s.countyRules === "legacy" ? "旧任评分留底" : "每提高5点增加1点专项分，最多6点"}</span><span>家人关系 <b>${Math.round(s.family)}</b> · ${s.family >= 75 ? "周末多恢复1疲劳，后续府任每周家计省0.1两" : s.family < 40 ? "周末少恢复1疲劳" : "周末恢复按常例"}</span><span>来信与日常督办 ${s.actionsTotal} 次</span></div><details class="county-memories"><summary>本任处置留记</summary>${
      countyMemories(s)
        .map((t) => `<p>${esc(t)}</p>`)
        .join("") || "<p>尚无特别处置记录。</p>"
    }</details></div><span class="career-seal">履<br>历</span></section>${
      out
        ? `<section class="assessment"><div class="assessment-score"><span>任满考语</span><h2>${out.rating}</h2><strong>${out.score}<small>/100</small></strong></div><div><h2>${out.title}</h2><p>${out.summary}</p>${out.misconduct ? '<p class="warning-text">本任存在收礼、虚报或毁证记录。经济成果不能抵消待查责任。</p>' : "<p>考语按本任民生、财计、司法、吏治和专项汇总。</p>"}<div class="score-lines">${Object.entries(
            out.scores,
          )
            .map(
              ([k, v]) =>
                `<div><span>${{ people: "民生恢复", finance: "财计生产", judicial: "司法秩序", integrity: "吏治执行", mission: "专项使命" }[k]}</span><div class="meter"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b></div>`,
            )
            .join(
              "",
            )}</div></div></section><div class="ending-routes">${out.routes.map((r) => `<button class="ending-route ${out.choice === r.id ? "selected" : ""}" data-act="ending" data-id="${r.id}"><h3>${r.name} ${out.choice === r.id ? icon("confirm") : icon("chevron_right")}</h3><p>${r.desc}</p></button>`).join("")}</div><div class="notice"><p>知县任满履历已归卷。称职且无待查责任者，可按本局官缺获授分管粮运的通判；通判考满后可继续同知任期，按察副使及以上仍为后续篇章。</p>${out.rating === "称职" && !out.misconduct ? btn("办理府通判任命", "appointment-open", "", "button primary") : ""}${btn("导出本任履历", "export", "", "button outline")}</div>`
        : `<section class="panel"><div class="section-head"><h2>任职进程</h2><span>${s.turn}/${TERM_WEEKS}周</span></div><div class="career-progress"><i style="width:${(s.turn / TERM_WEEKS) * 100}%"></i></div><div class="achievement-grid"><div><b>${s.projectsCompleted}</b><span>工程验收</span></div><div><b>${s.wellJudged}</b><span>复核结案</span></div><div><b>${Math.round(s.trust)}</b><span>上级信任</span></div><div><b>${Math.round(s.integrity)}</b><span>吏治表现</span></div></div><p class="muted">三年任满后形成考语与任用建议。已达成阶段要务${s.governance.mandatesMet}项，未达${s.governance.mandatesMissed}项。${isHard(s) ? `严苛考评：民生、财计、吏治按全任平均与期末各半计算，任何一项都不会提前封顶；春旱、汛情、摊派的处置方式计入民生；上解实缴率计入财计；案卷逾限、证据不全被退回都扣司法分。称职须75分且四案办结。当前已上解${Math.round(s.hard.remitDue ? (s.hard.remitPaid / s.hard.remitDue) * 100 : 100)}%，逾限案卷${s.hard.overdue}宗。` : "达成要务每项增加2点专项使命分（最多12点），未达每项扣1点（最多6点）；已复核但未执行的案卷每宗扣4点司法分。"}</p></section>`
    }<section class="panel"><div class="section-head"><h2>仕途展望</h2><span>后续篇章</span></div><div class="career-route">${["知县", "通判", "同知", "知府", "按察副使", "布政参政", "布政使", "巡抚"].map((x, i) => `<span class="${i === 0 ? "current" : ""}">${x}</span>`).join("")}</div><p class="muted">本局已开放知县、通判、同知、知府。更高职务及完整留任任期尚未开放。</p></section>`
  );
}
function render() {
  document.title = s?.accountability?.current
    ? "古代官员升职记 · 考课与处分"
    : s?.zhifu
      ? "古代官员升职记 · 一府之治"
      : s?.tongzhi
        ? "古代官员升职记 · 河工赈济"
        : s?.prefecture
          ? "古代官员升职记 · 府署粮运"
          : "古代官员升职记 · 清河初任";
  const content = !s
    ? startView()
    : s.accountability?.current
      ? accountabilityView(s, { esc, num, scene, avatar, portrait, btn, icon })
      : s.zhifu
        ? zhifuView(s, { esc, num, scene, avatar, portrait, btn, icon })
        : s.tongzhi
          ? tongzhiView(s, { esc, num, scene, avatar, portrait, btn, icon })
          : s.prefecture
            ? prefectureView(s, {
                esc,
                num,
                scene,
                avatar,
                portrait,
                btn,
                icon,
              })
            : shell(
                (
                  {
                    court,
                    territory,
                    cases: casesView,
                    treasury,
                    staff: staffView,
                    governance: governanceView,
                    career,
                  }[tab] || court
                )(),
              );
  $("#app").innerHTML = content;
  if (routineBusy)
    $("#main-content")?.insertAdjacentHTML(
      "afterbegin",
      `<div class="notice routine-progress" role="status"><p>正在逐周结算与存档，遇新事项即停。</p><button class="button outline" data-act="routine-cancel">停止继续推进</button></div>`,
    );
  if (s && (storageError || artError)) {
    const warning = document.createElement("div");
    warning.className = "notice warning persistent-save-warning";
    warning.setAttribute("role", "alert");
    warning.innerHTML = `<p>${esc(storageError || artError)}</p>${storageError ? btn("导出备份", "export", "", "button outline") : ""}`;
    $("#main-content")?.prepend(warning);
  }
  configureChapter(
    $("#app"),
    s?.accountability?.current
      ? "accountability"
      : s?.zhifu
        ? "zhifu"
        : s?.tongzhi
          ? "tongzhi"
          : "prefecture",
  );
  if (s) {
    const header = document.querySelector(".header-right");
    if (header)
      header.insertAdjacentHTML(
        "afterbegin",
        btn(
          "指南",
          "help",
          'aria-label="办事指南"',
          "header-button guide-button",
        ),
      );
  }
  renderModal();
}
function dialog(title, content, cls = "") {
  return `<div class="modal-backdrop" data-act="backdrop"><section class="dialog ${cls}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><header class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2>${btn(icon("close"), "close", 'aria-label="关闭窗口"', "icon-button")}</header>${content}</section></div>`;
}
function renderModal() {
  if (!modal) {
    $("#modal-root").innerHTML = "";
    document.body.classList.remove("has-modal");
    return;
  }
  document.body.classList.add("has-modal");
  let html = "";
  const m = modal;
  if (m.type === "help")
    html = dialog("办事指南", guideContent(s), "wide-dialog");
  if (m.type === "ac-next")
    html = dialog(
      "结算考课附卷本周",
      `<div class="dialog-content"><p>推进一周，结算到期核验与申辩复核；到期会自动形成阶段结论。尚余精力不结转。</p>${btn("确认推进附卷一周", "ac-confirm-next", "", "button primary large")}</div>`,
    );
  if (m.type === "ac-risk")
    html = dialog(
      m.kind === "murder" ? "确认指使灭口？" : "确认指使毁证？",
      `<div class="dialog-content"><p class="warning-text">${m.kind === "murder" ? "这会实际指使杀害关键证人，新增故意杀人罪。独立证据仍在，可能经复核判处斩首，角色永久死亡。" : "这会实际新增毁证行为。原始留存副本仍在，可能导致流放等更重处分。"}</p><p>此操作不是申辩，不会使原罪证消失。</p>${btn("放弃险招，依法申辩", "close", "", "button outline")}${btn(m.kind === "murder" ? "仍指使灭口，承担后果" : "仍指使毁证，承担后果", "ac-confirm-risk", "", "button danger")}</div>`,
    );
  if (m.type === "zf-appointment")
    html = dialog(
      "获授永平府知府",
      `<div class="dialog-content"><p>正四品知府，统筹三县预算、属官履职与跨县案务，新任三年156周。</p><p>承接同知任内设施原状及待安置居民。旧任公账留底，新核拨统筹银1200两、粮600石；私产延续。</p>${btn("接任知府，统筹一府", "zf-appoint", "", "button primary large")}</div>`,
    );
  if (m.type === "zf-next")
    html = dialog(
      "结算知府本周",
      `<div class="dialog-content"><p>推进一周：结算属县差事、巡察报告、案卷、河工和口粮。尚余${s.zhifu.ap}点精力不结转。接任期间该县差事暂停，其他事项照常办理。</p>${btn("确认推进一周", "zf-confirm-next", "", "button primary large")}</div>`,
    );
  if (m.type === "tz-appointment")
    html = dialog(
      "获授永平府同知",
      `<div class="dialog-content"><p>本局同知官缺已开。正五品，奉命分管三县水利、赈济与查验，新任三年156周。</p><p>通判任期公账完整保留交接；河工赈济专项另核拨900两、480石，私产承接。属县民生、协作和清河旧堤防护会影响新任。</p>${btn("接任同知，分司河工", "tz-appoint", "", "button primary large")}</div>`,
    );
  if (m.type === "tz-next")
    html = dialog(
      "结算同知本周",
      `<div class="dialog-content"><p>推进一周：结算施工、养护、口粮和到期交验；到汛期时按实际防护结算。尚余${s.tongzhi.ap}点精力不结转。</p>${btn("确认推进一周", "tz-confirm-next", "", "button primary large")}</div>`,
    );
  if (m.type === "tz-fast")
    html = dialog(
      "仅凭表面收讫",
      `<div class="dialog-content"><p>未通过深验的工程可能存在质量缺陷，真实防护不会因签收提高。之后仍需付费查验或返工。</p>${btn("返回深验", "close", "", "button outline")}${btn("知悉风险，仍然收讫", "tz-confirm-fast", "", "button danger")}</div>`,
    );
  if (m.type === "appointment")
    html = dialog(
      "赴任永平府",
      `<div class="dialog-content"><p>本局府通判官缺已开，分管粮储和运输。新任三年156周，协调清河、临河、永宁三县。</p><p>清河钱粮留县交接，府库另核拨600两、600石；个人私产承接。你的旧任完整保存。</p>${btn("接任通判，启程赴府", "appointment-confirm", "", "button primary large")}</div>`,
    );
  if (m.type === "pref-next")
    html = dialog(
      "结算府任本周",
      `<div class="dialog-content"><p>结算一周公私账、属县口粮、府仓损耗和到期运输。尚余${s.prefecture.ap}点精力不会结转。</p>${btn("确认推进一周", "pref-confirm-next", "", "button primary large")}</div>`,
    );
  if (m.type === "pref-plan") {
    const p = s.prefecture,
      t = transportTerms(p, m.route, m.from, m.to);
    html = dialog(
      "核准本次调粮",
      `<div class="dialog-content"><p>${place(p, m.from)} → ${place(p, m.to)}：${m.amount}石。</p><p>起运即扣${m.amount}石，官银${t.silver}两、精力1点；${t.weeks}周后才记入收粮仓。</p>${btn("确认起运", "pref-send", "", "button primary large")}</div>`,
    );
  }
  if (m.type === "receipt")
    html = dialog(m.receipt.title, receiptView(m.receipt), "wide-dialog");
  if (m.type === "policy") {
    const p = POLICIES[m.category].options[m.choice];
    html = dialog(
      "调整" + POLICIES[m.category].name,
      `<div class="dialog-content"><h3>${p.name}</h3><p class="event-story">${p.desc}</p><div class="notice"><p>调整消耗1点精力，至少执行4周才可再改。本次不提前扣除未来费用；每周按实际钱粮执行，不足时暂停且无收益。</p></div>${btn("确认方针 · 1精力", "confirm-policy", `data-id="${m.choice}" data-category="${m.category}"`, "button primary large", s.ap < 1 || s.finished)}</div>`,
    );
  }
  if (m.type === "district")
    html = dialog(
      DISTRICTS.find((d) => d.id === m.id).name,
      districtDialog(m.id),
      "wide-dialog",
    );
  if (m.type === "event") {
    const d = countyEvent(s, m.id),
      p = person(d.speaker);
    html = dialog(
      d.title,
      `<div class="event-dialog-body"><div class="dialog-scene">${scene(d.scene, "", d.title + "环境")}${art?.assets?.["portrait_" + p.id] ? portrait(p.id, "dialog-standing") : ""}</div><div class="dialog-content"><div class="speaker">${avatar(p.id)}<div><b>${p.name}</b><span>${p.role} · ${d.tag}</span></div></div><p class="event-story">${d.text}</p><div class="choice-list">${d.options
        .map((o) => {
          const reason = affordability(s, o.cost);
          return `<button class="choice" data-act="choose" data-id="${m.id}" data-choice="${o.id}" ${reason ? "disabled" : ""}><div><b>${o.label}</b><span>${reason || costText(o.cost)}</span></div><p>${o.desc}</p>${decisionRisk("county", m.id, o.id) ? `<p class="warning-text">${decisionRisk("county", m.id, o.id)}</p>` : ""}</button>`;
        })
        .join(
          "",
        )}</div>${s.ap === 0 && !s.overworked && s.fatigue < 85 ? btn("透支一次精力，继续亲自督办", "overwork", "", "text-button") : ""}</div></div>`,
      "event-dialog",
    );
  }
  if (m.type === "case") {
    const d = countyCase(s, m.id),
      c = s.cases[m.id];
    html = dialog(
      d.name,
      `<div class="case-dialog-layout"><div class="case-context">${scene(d.scene, "case-scene", "案件相关地点")}<div class="speaker">${avatar(d.speaker)}<div><b>${person(d.speaker).name}</b><span>陈述与证据分别核实</span></div></div><p>${d.summary}</p><div class="notice compact"><p>查证后提出意见，呈府复核需两周；获准后还须督促执行。</p></div></div><div class="case-details"><h3>调查与证据</h3>${d.clues
        .map((c1) => {
          let found = c.clues.includes(c1.id);
          return `<div class="evidence ${found ? "found" : ""}"><h4>${icon(found ? "confirm" : "inspect")}${c1.name}</h4>${found ? `<p>${c1.text}</p>` : btn("调查 · 1点精力", "investigate", `data-id="${d.id}" data-clue="${c1.id}"`, "button outline", s.ap < 1 || !["open", "returned"].includes(c.status) || s.finished)}</div>`;
        })
        .join(
          "",
        )}<h3>处置意见</h3>${["open", "returned"].includes(c.status) && !s.finished ? caseChoices(s, d, c, btn) : `<div class="notice"><p>${esc(c.result || "本任已结束，案卷随履历归档。")}</p></div>`}${executionInfo(c, true)}</div></div>`,
      "wide-dialog",
    );
  }
  if (m.type === "project") {
    let p = PROJECTS.find((x) => x.id === m.id),
      reason = affordability(s, { silver: p.cost, ap: 1 });
    html = dialog(
      p.name,
      `<div class="dialog-content"><p class="event-story">${p.desc}</p><div class="notice"><p>立项支出${p.cost}两与1点精力，预计${p.duration}周施工；完工后维护${p.upkeep}两/13周（分周扣付）。工程收益按季节与实际完成情况结算。</p></div>${btn(reason || "确认立项", "start-project", `data-id="${p.id}"`, "button primary large", !!reason)}</div>`,
    );
  }
  if (m.type === "person") {
    const p = person(m.id);
    html = dialog(
      p.name,
      `<div class="person-detail">${art?.assets?.["portrait_" + p.id] ? portrait(p.id, "person-full") : avatar(p.id, "person-avatar")}<div><span class="eyebrow">${p.role}</span><h3>${p.name}</h3><p>${p.desc}</p>${relationshipInfo(p.id)}<p class="muted">${p.task ? STAFF_PROFILES[p.id]?.note || "" : "往来与已办事项可在履历中查阅。"}</p></div></div>`,
    );
  }
  if (m.type === "scene") {
    html = dialog(
      m.title,
      `<div class="scene-full">${scene(m.id, "", "地方风物")}<p>地方环境插画；查看案头记录可了解当前工程和灾情。</p></div>`,
      "wide-dialog",
    );
  }
  if (m.type === "gallery") {
    const imgs = Object.values(art.assets).filter((a) => a.type === "scene");
    html = dialog(
      "清河风物",
      `<p class="gallery-note">插画鉴赏，不表示当前地方正在发生相应灾情。</p><div class="gallery-grid">${imgs.map((a) => `<button data-act="scene" data-id="${a.id}" data-title="${a.label}">${scene(a.id, "", a.label)}<span>${a.label}</span></button>`).join("")}</div>`,
      "wide-dialog",
    );
  }
  if (m.type === "journal")
    html = dialog(
      "任中日录",
      `<div class="dialog-content journal">${s.logs.map((l) => `<article><span>${weekLabel(l.turn)}</span><h3>${esc(l.title)}</h3><p>${esc(l.text)}</p></article>`).join("")}</div>`,
      "wide-dialog",
    );
  if (m.type === "advance")
    html = dialog(
      "结算本周",
      `<div class="dialog-content"><p class="event-story">本次推进一周，结算分周收支、属员差事、工程进度与到期反馈。每季13周，每年52周，秋收只在秋季末入仓。${isHard(s) ? (s.turn + 1) % 13 === 0 ? `本周为季末，须实解银${HARD.remit.silver + s.hard.owedSilver}两、粮${remitGrain(s.turn) + s.hard.owedGrain}石。` : "" : ""}</p><div class="notice"><p>${s.ap ? `尚余${s.ap}点精力，本周未用完不会结转。` : "本周精力已用尽。"}${s.events.length ? "额外来信未处理，不会自动获得收益。" : ""}</p></div>${btn(s.turn === TERM_WEEKS - 1 ? "任满考核，归入履历" : "结算并进入下一周", "confirm-advance", "", "button primary large")}</div>`,
    );
  if (m.type === "routine")
    html = dialog(
      "按常例逐周推进",
      `<div class="dialog-content"><p>每周结算、每周存档，最多推进13周。有新来信、工程交付、案件进展、地方要务或秋收入仓，立即停下展示。</p><p>未用精力不结转。此操作不替你选择来信、查证案件或拨款。</p>${btn("开始按周推进", "routine-confirm", "", "button primary large")}</div>`,
    );
  if (m.type === "routine-result")
    html = dialog(
      "常例推进回执",
      `<div class="dialog-content"><p>本次已结算${m.weeks.length}周。${esc(m.reason)}</p><div class="table-scroll"><table><thead><tr><th>周次</th><th>实际官银净额</th><th>实际粮食净额</th></tr></thead><tbody>${m.weeks.map((w) => `<tr><td>${w.label}</td><td>${w.silver > 0 ? "+" : ""}${num(w.silver)}两</td><td>${w.grain > 0 ? "+" : ""}${num(w.grain)}石</td></tr>`).join("")}</tbody></table></div><p class="muted">具体周账和到期回执仍保留在钱粮与任中日录。</p>${btn("收讫，查看当前待办", "close", "", "button primary large")}</div>`,
    );
  if (m.type === "settings")
    html = dialog(
      "存档与设置",
      `<div class="dialog-content"><p>每次操作后自动存档。电脑和手机各自保存进度，不会自动同步；更换网址或设备前，请先导出履历。</p><p class="transfer-help">转移到手机：导出履历 → 将文件发到手机 → 打开游戏网址 → 设置中导入。文件下载不方便时，可使用文本备份。</p><div class="settings-actions">${btn(icon("save") + " 手动存档", "save", "", "button outline")}${btn("导出履历文件", "export", "", "button outline")}${btn("导入履历文件", "import", "", "button outline")}${btn("履历文本备份与恢复", "save-text", "", "button outline")}${btn("恢复上一次备份", "backup", "", "button outline")}${btn("查看美术图鉴", "gallery", "", "button outline")}${btn("重新开始一任", "restart", "", "button danger")}</div>${offlineCard()}<small class="muted">县府四任 · v0.14 · 履历保存在当前浏览器</small></div>`,
    );
  if (m.type === "save-text")
    html = dialog(
      "履历文本备份",
      `<div class="dialog-content"><p>可复制保存下方文本，或粘贴已有履历后恢复。文件下载不可用时也能转移进度。</p><label class="field">履历 JSON<textarea id="save-text" aria-label="履历 JSON" spellcheck="false">${esc(JSON.stringify(s))}</textarea></label>${btn("复制履历文本", "copy-save", "", "button outline")}${btn("从文本恢复履历", "restore-text", "", "button primary large")}</div>`,
    );
  if (m.type === "restart")
    html = dialog(
      "重新开始",
      `<div class="dialog-content"><p>当前任期将由新人物替换。建议先导出履历；上一次记录仍会保留为浏览器备份。</p>${btn("先导出履历", "export", "", "button outline")}${btn("确认重新开始", "confirm-restart", "", "button danger")}</div>`,
    );
  $("#modal-root").innerHTML = html;
}
async function exportSave() {
  const data = JSON.stringify(s, null, 2);
  const blob = new Blob([data], { type: "application/json" }),
    url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `官员履历_${s.name}_${s.accountability?.current ? "考课附卷" : s.zhifu ? "知府" : s.tongzhi ? "同知" : s.prefecture ? "通判" : "知县"}${Math.min((s.accountability?.current?.week ?? s.zhifu?.turn ?? s.tongzhi?.turn ?? s.prefecture?.turn ?? s.turn) + 1, TERM_WEEKS)}周.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("履历已导出，请保管好文件。");
}
function importSave() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.hidden = true;
  document.body.append(input);
  input.addEventListener("cancel", () => input.remove(), { once: true });
  input.addEventListener("change", async () => {
    try {
      const f = input.files[0];
      if (!f) return;
      if (f.size > 2e6) throw Error("存档文件过大。");
      const incoming = validateSave(JSON.parse(await f.text()));
      s = incoming;
      const saved = save();
      modal = null;
      tab = s.finished ? "career" : "court";
      render();
      toast(restoreMessage(saved));
    } catch (e) {
      toast("导入失败：" + e.message);
    } finally {
      input.remove();
    }
  });
  input.click();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const a = b.dataset.act,
    id = b.dataset.id;
  if (routineBusy) {
    if (a === "routine-cancel") routineCancelled = true;
    return;
  }
  if (a === "backdrop") {
    if (e.target === b) closeModal();
    return;
  }
  e.preventDefault();
  if (
    handleOfficeAction(a, b, {
      run,
      showModal,
      save,
      checkOffline,
      applyOfflineUpdate,
      installOffline,
      query: $,
      getModal: () => modal,
    })
  )
    return;
  switch (a) {
    case "copy-save":
      (navigator.clipboard
        ? navigator.clipboard.writeText($("#save-text").value)
        : Promise.reject()
      ).then(
        () => toast("履历文本已复制。"),
        () => toast("复制未完成，可长按文本全选复制。"),
      );
      break;
    case "family": {
      const name = $("#player-name")?.value;
      onboarding.family = id;
      render();
      if (name) $("#player-name").value = name;
      break;
    }
    case "difficulty": {
      const name = $("#player-name")?.value;
      onboarding.difficulty = id === "standard" ? "standard" : "hard";
      render();
      if (name) $("#player-name").value = name;
      break;
    }
    case "appearance": {
      const name = $("#player-name")?.value;
      onboarding.appearance = id;
      render();
      if (name) $("#player-name").value = name;
      break;
    }
    case "start":
      s = createGame({
        ...onboarding,
        name: $("#player-name").value,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
      });
      save();
      tab = "court";
      render();
      window.scrollTo(0, 0);
      break;
    case "tab":
      tab = id;
      ledgerSeasons = 1;
      modal = null;
      render();
      window.scrollTo(0, 0);
      break;
    case "close":
      closeModal();
      break;
    case "event":
      showModal({ type: "event", id });
      break;
    case "choose":
      run("event", { event: id, choice: b.dataset.choice });
      break;
    case "action":
      run("action", { action: id });
      break;
    case "project":
      showModal({ type: "project", id });
      break;
    case "start-project":
      run("project", { project: id });
      break;
    case "case":
      showModal({ type: "case", id });
      break;
    case "investigate":
      run("investigate", { case: id, clue: b.dataset.clue });
      break;
    case "judge":
      run("judge", { case: id, choice: b.dataset.choice });
      break;
    case "overwork":
      run("overwork");
      break;
    case "advance":
      if (!s.ap && !s.events.length && !(isHard(s) && (s.turn + 1) % 13 === 0))
        run("advance");
      else showModal({ type: "advance" });
      break;
    case "routine":
      showModal({ type: "routine" });
      break;
    case "routine-confirm":
      continueRoutine();
      break;
    case "confirm-advance":
      run("advance");
      break;
    case "relief":
      run("relief");
      break;
    case "hard_hire":
    case "hard_donate":
    case "hard_remit":
    case "hard_buy":
      run(a);
      break;
    case "ending":
      run("ending", { choice: id });
      break;
    case "policy":
      showModal({ type: "policy", category: b.dataset.category, choice: id });
      break;
    case "confirm-policy":
      run("policy", { category: b.dataset.category, choice: id });
      break;
    case "ledger-more":
      ledgerSeasons++;
      render();
      break;
    case "map-place":
      mapPlace = id;
      render();
      break;
    case "map-project":
      $("#project-" + id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      break;
    case "district":
      showModal({ type: "district", id });
      break;
    case "local-work":
      run("district", { district: id, kind: b.dataset.kind });
      break;
    case "enforce":
      run("enforce", { case: id });
      break;
    case "arrears":
      run("arrears");
      break;
    case "repair":
      run("repair", { project: id });
      break;
    case "receipt":
      showModal({ type: "receipt", receipt: s.receipts[0] });
      break;
    case "person":
      showModal({ type: "person", id });
      break;
    case "scene":
      showModal({ type: "scene", id, title: b.dataset.title });
      break;
    case "gallery":
      showModal({ type: "gallery" });
      break;
    case "journal":
      showModal({ type: "journal" });
      break;
    case "help":
      showModal({ type: "help" });
      break;
    case "settings":
      showModal({ type: "settings" });
      break;
    case "save":
      save(true);
      break;
    case "export":
      exportSave();
      break;
    case "save-text":
      showModal({ type: "save-text" });
      break;
    case "restore-text":
      try {
        s = validateSave(JSON.parse($("#save-text").value));
        const saved = save();
        modal = null;
        tab = s.finished ? "career" : "court";
        render();
        toast(restoreMessage(saved));
      } catch (err) {
        toast("恢复失败：" + err.message);
      }
      break;
    case "import":
      importSave();
      break;
    case "backup":
      try {
        const backup = localStorage.getItem(BACKUP);
        if (!backup) throw Error("尚无备份。");
        s = validateSave(JSON.parse(backup));
        const saved = save();
        modal = null;
        render();
        toast(restoreMessage(saved));
      } catch (err) {
        toast(err.message);
      }
      break;
    case "restart":
      showModal({ type: "restart" });
      break;
    case "confirm-restart":
      try {
        localStorage.setItem(BACKUP, JSON.stringify(s));
        localStorage.removeItem(KEY);
      } catch {}
      s = null;
      modal = null;
      render();
      break;
  }
});
document.addEventListener("change", (e) => {
  if (routineBusy) {
    render();
    return;
  }
  if (e.target.matches("[data-person]"))
    run("staff", { person: e.target.dataset.person, task: e.target.value });
});
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (img.tagName === "IMG" && img.dataset.fallback && !img.dataset.failed) {
      img.dataset.failed = "1";
      img.removeAttribute("srcset");
      img.src = `assets/art/placeholders/${img.dataset.fallback}.svg`;
    }
  },
  true,
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal) closeModal();
  if (e.key === "Tab" && modal) {
    const els = [
      ...document.querySelectorAll(
        ".dialog button:not([disabled]),.dialog input,.dialog textarea,.dialog select,.dialog a[href]",
      ),
    ];
    if (!els.length) return;
    const first = els[0],
      last = els.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        document.activeElement.classList.contains("dialog"))
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
try {
  const response = await fetch("assets/art/manifest.json");
  if (!response.ok) throw Error("资源清单不可用");
  art = await response.json();
} catch {
  art = { assets: {} };
  artError = "美术资源暂未载入，已启用占位。";
}
startMobile();
load();
if (s?.finished) tab = "career";
render();
startOffline(updateOfflineCard);

function relationshipInfo(id) {
  const value = s.governance.relations[id];
  if (value === undefined) return "";
  return `<div class="relationship"><span>互信 <b>${Math.round(value)}</b> · ${value >= 60 ? "愿意协作" : value < 40 ? "心存疑虑" : "公事往来"}</span><div class="meter"><i style="width:${value}%"></i></div><small>${["farmer", "merchant", "boatman", "widow"].includes(id) ? "互信达到60后，对应辖地督办可省5两。" : "有事仍须依账证核办。"}</small></div>`;
}
function mandateCard() {
  const m = s.governance.mandate;
  if (!m) return "";
  const d = DISTRICTS.find((x) => x.id === m.district),
    value = s.governance.districts[m.district][m.metric];
  const process =
    m.mode === "verified" && m.status === "active"
      ? m.delivered
        ? "交验已完成，按实际指标核定。"
        : m.ordered
          ? "已安排投入，等待到期交验；亲自跟办可提前一周。"
          : m.checked
            ? "现场已核实，需安排投入并交验。"
            : "先走访勘察核实现场，再投入并留两周交验。"
      : "";
  return `<section class="mandate-panel"><div class="mandate-icon">${icon("report")}</div><div><span class="eyebrow">${m.status === "met" ? "阶段要务已达成" : "本阶段地方要务"} · ${Math.max(0, m.due - s.turn)}周后核定下一阶段</span><h3>${d.name} · 改善${LOCAL_METRICS[m.metric]}</h3><p>当前 ${Math.floor(value)} / 目标 ${Math.ceil(m.target)}。${m.status === "met" ? "上级信任已增加2，继续巩固成效。" : "按实际交验核定，达标信任+2；逾期未达信任-1。"}</p>${process ? `<p>${process}</p>` : ""}</div><div class="mandate-actions">${m.mode === "verified" && m.status === "active" && !m.checked ? btn("核实要务 · 1精力", "action", 'data-id="inspect"', "button outline", s.ap < 1 || s.actions.includes("inspect")) : ""}${btn("查看地方", "tab", 'data-id="territory"', "button outline")}</div></section>`;
}
function governanceView() {
  return (
    heading("县政方略", "每周都有成本，每项方针都有受益者与代价。") +
    mandateCard() +
    `<div class="notice"><p>每类选择一项持续方针。调整花1点精力，4周内不可再改；费用在周末扣付，钱粮不足则该项本周暂停。下列数值为计划值，实际变化以结算回执为准。</p></div><div class="policy-stack">${Object.entries(
      POLICIES,
    )
      .map(([key, def]) => {
        const wait = Math.max(0, 4 - (s.turn - s.governance.changed[key]));
        return `<section class="panel"><div class="section-head"><h2>${icon(def.icon)} ${def.name}</h2><span>${wait ? `${wait}周后可调整` : "可以调整"}</span></div>${(() => {
          const card = ([id, p]) =>
            `<article class="policy-option ${s.governance.policies[key] === id ? "selected" : ""}"><span class="eyebrow">${s.governance.policies[key] === id ? "当前执行" : "可选方针"}</span><h3>${p.name}</h3><p>${p.desc}</p>${s.governance.policies[key] === id ? "" : btn("调整为此项", "policy", `data-category="${key}" data-id="${id}"`, "button outline", s.finished || wait > 0 || s.ap < 1)}</article>`;
          const all = Object.entries(def.options),
            current = all.filter(([id]) => s.governance.policies[key] === id),
            others = all.filter(([id]) => s.governance.policies[key] !== id);
          return `<div class="policy-options">${current.map(card).join("")}</div><details class="policy-more"><summary>其他方针${others.length}项${wait ? ` · ${wait}周后可调整` : ""}</summary><div class="policy-options">${others.map(card).join("")}</div></details>`;
        })()}</section>`;
      })
      .join(
        "",
      )}</div>${forecastCard()}<section class="panel"><div class="section-head"><h2>上周政策执行</h2>${s.receipts.length ? btn("最近回执", "receipt", "", "text-button") : ""}</div>${s.governance.lastWeekly.map((t) => `<p class="policy-note">${esc(t)}</p>`).join("") || '<p class="muted">尚无特别方针执行记录，或当前均按常例办理。</p>'}</section>${affairRecords()}`
  );
}
function affairRecords() {
  const a = s.countyAffairs;
  return `<section class="panel"><div class="section-head"><h2>阶段事务留卷</h2><span>核验${a.records.filter((r) => r.status === "done").length}件 · 在办${a.pending.length}件</span></div>${
    a.records.length
      ? `<details><summary>查看安排与实际交付</summary>${[...a.records]
          .reverse()
          .map(
            (r) =>
              `<article class="affair-record"><h3>${esc(AFFAIRS[r.id].title)}</h3><p>${r.status === "pending" ? `尚余${r.due - s.turn}周核验` : r.status === "done" ? r.result.map(esc).join("；") : "已交属员循例跟进，未记亲自核验成果。"}</p></article>`,
          )
          .join("")}</details>`
      : '<p class="muted">第二、第三年按县情进入新事务，已展示版本不重发。</p>'
  }</section>`;
}
function districtCards() {
  return `<div class="section-head spaced"><h2>四乡冷暖</h2><span>各乡分项另计 · 生产影响县收入</span></div><div class="district-grid">${DISTRICTS.map(
    (d) => {
      const state = s.governance.districts[d.id];
      const wait = Math.max(
        0,
        4 - (s.turn - (s.governance.visits[d.id] ?? -4)),
      );
      return `<article class="district-card"><div class="district-image">${scene(d.scene, "", d.name + "环境")}<h3>${d.name}</h3></div><div class="district-body"><p>${d.desc}</p><div class="district-stats">${Object.entries(
        LOCAL_METRICS,
      )
        .map(
          ([key, name]) =>
            `<div><span>${name}</span><b class="${state[key] < 35 ? "warning-text" : ""}">${Math.floor(state[key])}</b><div class="meter"><i style="width:${state[key]}%"></i></div></div>`,
        )
        .join(
          "",
        )}</div><div class="district-contact">${avatar(d.person)}<span>${person(d.person).name}<small>互信 ${Math.round(s.governance.relations[d.person])}${s.governance.relations[d.person] >= 60 ? " · 协作省5两" : ""}</small></span></div>${btn(wait ? `查看辖地 · ${wait}周后可督办` : "查看与督办", "district", `data-id="${d.id}"`, "button outline")}</div></article>`;
    },
  ).join("")}</div>`;
}
function districtDialog(id) {
  const d = DISTRICTS.find((x) => x.id === id),
    wait = Math.max(0, 4 - (s.turn - (s.governance.visits[id] ?? -4)));
  return `<div class="dialog-content"><div class="speaker">${avatar(d.person)}<div><b>${person(d.person).name}</b><span>地方协作 · 互信${Math.round(s.governance.relations[d.person])}</span></div></div><p class="event-story">${d.desc} 集中督办后需间隔4周，让人手落实安排。</p><div class="choice-list">${Object.entries(
    INTERVENTIONS,
  )
    .map(([kind, a]) => {
      const cost = interventionCost(s, id, kind),
        m = s.governance.mandate,
        verified =
          m?.status === "active" &&
          m.mode === "verified" &&
          m.district === id &&
          m.metric === kind,
        reason =
          verified && (!m.checked || m.ordered || s.turn + 2 > m.due)
            ? !m.checked
              ? "先核实本阶段要务"
              : m.ordered
                ? "已有交验安排"
                : "本阶段余期不足两周"
            : affordability(s, cost);
      return `<button class="choice" data-act="local-work" data-id="${id}" data-kind="${kind}" ${wait || reason || s.finished ? "disabled" : ""}><div><b>${a.name}</b><span>${wait ? `${wait}周后可再督办` : reason || costText(cost)}</span></div><p>${a.desc} 当前${LOCAL_METRICS[kind]} ${Math.floor(s.governance.districts[id][kind])}，最高100；${verified ? "两周后交验，当前不提前记成果。" : "实际增幅按上限结算。"}</p></button>`;
    })
    .join(
      "",
    )}</div><p class="muted">互信达到60后，地方愿意自备部分人手材料，每次节省5两公费；不会向官库虚增捐银。</p></div>`;
}
function forecastCard() {
  const f = budgetForecast(s);
  return `<section class="panel budget-panel"><div class="section-head"><h2>本周常项估算</h2><span>非已到账</span></div><div class="budget-grid"><div><span>预计官银收入</span><b>${num(f.income)}两</b></div><div><span>例费、养护与方针</span><b>${num(f.expense)}两</b></div><div><span>预计官银净额</span><b class="${f.net < 0 ? "negative" : "positive"}">${f.net >= 0 ? "+" : ""}${num(f.net)}两</b></div><div><span>安置与方针用粮</span><b>${num(f.grain)}石</b></div></div><p class="muted">按当前余款、人口、工程与方针估算，不含临时处置、秋收和在途到货。当前辖地生产对收入系数为${num(districtIncomeFactor(s))}；开集须连续办满4周。${f.unpaid > 0 ? ` 预计新增欠付${num(f.unpaid)}两。` : ""}${f.grainDemand > f.grain ? ` 预计缺供${num(f.grainDemand - f.grain)}石。` : ""}</p></section>`;
}
function caseStatus(c) {
  if (
    s.finished &&
    (c.status !== "closed" ||
      (c.execution && !["done", "legacy"].includes(c.execution.status)))
  )
    return "未竟事项 · 交接留卷";
  if (c.status !== "closed")
    return { open: "待查证", returned: "退回补查", review: "呈府复核" }[
      c.status
    ];
  return (
    {
      awaiting: "待执行",
      overdue: "执行迟延",
      executing: "执行中",
      done: "执行归档",
      legacy: "旧卷归档",
    }[c.execution?.status] || "复核通过"
  );
}
function executionInfo(c, controls = false) {
  if (!c) return "";
  if (
    s.finished &&
    (c.status !== "closed" ||
      (c.execution && !["done", "legacy"].includes(c.execution.status)))
  )
    return '<p class="execution-note">原任已封卷，未竟复核或执行列入交接。</p>';
  if (c.status === "review")
    return `<p class="execution-note">复核预计还需${Math.max(0, c.due - s.turn)}周。</p>`;
  const e = c.execution;
  if (!e || e.status === "legacy") return "";
  let text = {
    awaiting: `须在${Math.max(0, e.deadline - s.turn)}周内安排执行。`,
    overdue: "已记一次迟延责任，可继续补办。",
    executing: `执行中，${Math.max(0, e.due - s.turn)}周后查验。`,
    done: "执行结果已核验，案卷完整归档。",
  }[e.status];
  return `<div class="execution-note"><b>${caseStatus(c)}</b><p>${text}</p>${controls && ["awaiting", "overdue"].includes(e.status) ? btn(`督促履行 · ${adminCost(s, 6)}两 / 1精力`, "enforce", `data-id="${c.id}"`, "button primary", s.finished || s.ap < 1 || s.silver < adminCost(s, 6) || s.turn + 2 > TERM_WEEKS) : ""}</div>`;
}
function receiptView(r) {
  const always = ["官银", "仓粮", "私产", "精力", "待安置居民", "疲劳"],
    major = r.changes.filter((x) => always.includes(x.name) || Math.abs(x.delta) >= 0.5),
    minor = r.changes.filter((x) => !major.includes(x));
  r = { ...r, changes: major, minor };
  return `<div class="dialog-content"><p class="muted">${r.chapter === "考课" ? `考课附卷第${r.turn + 1}周` : r.chapter === "知府" ? zfLabel({ turn: r.turn }) : r.chapter === "同知" ? tzLabel({ turn: r.turn }) : r.chapter ? prefLabel({ turn: r.turn }) : weekLabel(r.turn)} · 本次收支与前后变化如下。</p>${r.changes.length ? `<div class="receipt-grid">${r.changes.map((x) => `<div class="receipt-change"><span>${esc(x.name)}</span><strong class="${x.delta > 0 !== (["疲劳", "待安置居民", "累计缺供粮", "移出未安置"].includes(x.name) || x.name.includes("待安置")) ? "positive" : "negative"}">${x.delta > 0 ? "+" : ""}${num(x.delta)}</strong><small>${num(x.before)} → ${num(x.after)}</small></div>`).join("")}</div>` : r.minor.length ? "" : '<div class="notice"><p>本次事项已记入卷宗，钱粮及治理数值未变。</p></div>'}${r.minor.length ? `<details class="receipt-minor"><summary>细微变化${r.minor.length}项（每周回落、养护损耗等）</summary><p>${r.minor.map((x) => `${esc(x.name)} ${x.delta > 0 ? "+" : ""}${num(Math.round(x.delta * 100) / 100 || 0)}`).join("；")}</p></details>` : ""}${r.policies?.length ? `<div class="receipt-notes">${r.policies.map((x) => `<p>${esc(x)}</p>`).join("")}</div>` : ""}${
    r.ledger.length
      ? `<details class="receipt-ledger"><summary>查看本次公私账目（${r.ledger.length}笔）</summary>${r.ledger
          .map(
            (l) =>
              `<p><b>${esc(l.title)}</b><span>${["silver", "grain", "private"]
                .filter((k) => l[k] !== undefined)
                .map(
                  (k) =>
                    `${{ silver: "官银", grain: "仓粮", private: "私产" }[k]} ${l[k] > 0 ? "+" : ""}${num(l[k])}`,
                )
                .join(" · ")}</span></p>`,
          )
          .join("")}</details>`
      : ""
  }<div class="receipt-notes">${r.notes.map((t) => `<p>${esc(t)}</p>`).join("")}</div>${btn("收讫，继续理事", "close", "", "button primary large")}</div>`;
}

function offlineCard() {
  const o = offlineInfo();
  return `<section class="offline-card"><h3>随身续玩</h3><p data-offline-status>${esc(o.text)}</p><p>iPhone：在Safari分享菜单中选择“添加到主屏幕”。安卓：从浏览器菜单选择安装或添加到主屏幕。首次须联网等资源备齐；浏览器清理数据后需要重新下载。</p><div class="offline-actions">${btn("检查更新与离线资源", "offline-check", "", "button outline", !o.supported)}${btn("保存并更新游戏", "offline-update", o.waiting ? "" : "hidden", "button primary")}${btn("安装到主屏幕", "offline-install", o.installable ? "" : "hidden", "button outline")}</div><p class="muted">更新只替换游戏资源，存档仍保留在本浏览器。离线不等于云存档，建议定期导出履历。</p></section>`;
}
function updateOfflineCard(o) {
  const text = document.querySelector("[data-offline-status]");
  if (text) text.textContent = o.text;
  const update = document.querySelector('[data-act="offline-update"]');
  if (update) update.hidden = !o.waiting;
  const install = document.querySelector('[data-act="offline-install"]');
  if (install) install.hidden = !o.installable;
}

function hardPanel() {
  if (!isHard(s) || s.finished) return "";
  const h = s.hard,
    left = 13 - (s.turn % 13),
    flood = nextFloodWeek(s),
    season = Math.floor((s.turn % 52) / 13);
  const owed = h.owedSilver || h.owedGrain;
  return `<section class="mandate-panel hard-panel"><div class="mandate-icon">${icon("treasury")}</div><div><span class="eyebrow">严苛 · 季末上解</span><h3>${left === 1 ? "本周季末起解" : `${left}周后季末起解`}：银${HARD.remit.silver + h.owedSilver}两 · 粮${remitGrain(s.turn) + h.owedGrain}石</h3><p>可用官银${num(s.silver)}两、仓粮${num(s.grain)}石；粮价每石${num(s.grainPrice)}两。${owed ? `<b class="warning-text">欠解银${num(h.owedSilver)}两、粮${num(h.owedGrain)}石。</b>` : "目前无欠解。"}</p><p>${season === 1 && flood !== null ? "夏季多雨，汛情随时可能到来，留些钱粮应急。" : season === 0 ? "春耕时节，旱情与虫灾都可能发生。" : ""}${h.hired ? ` 书启在馆，每周束脩${HARD.hireCost}两（私产）。` : ""}</p></div><div class="mandate-actions">${owed ? btn("补解欠项", "hard_remit", "", "button outline", s.silver <= 0 && s.grain <= 0) : ""}${btn("查看钱粮", "tab", 'data-id="treasury"', "button outline")}</div></section>`;
}
function hardTreasury() {
  if (!isHard(s) || s.finished) return "";
  const h = s.hard,
    cost = buyCost(s),
    buying = s.pending.some((p) => p.kind === "buy");
  return `<div class="hard-treasury"><p><b>季末上解</b>：每季银${HARD.remit.silver}两，粮按季${HARD.remit.grain.join("/")}石（秋季最重）。交不足记欠解，扣上级信任，并计入财计考评。累计实缴${Math.round(h.remitDue ? (h.remitPaid / h.remitDue) * 100 : 100)}%，欠解${h.remitMissed}次。</p><div class="settings-actions">${btn(`补解欠项${h.owedSilver || h.owedGrain ? ` · 银${num(h.owedSilver)}两 粮${num(h.owedGrain)}石` : ""}`, "hard_remit", "", "button outline", !(h.owedSilver || h.owedGrain))}${btn(buying ? "籴粮在途" : `籴粮${HARD.buyAmount}石 · ${num(cost)}两 / 1精力`, "hard_buy", "", "button outline", buying || s.silver < cost || s.ap < 1)}${btn(`捐俸${HARD.donate}两入公账`, "hard_donate", "", "button outline", h.donatedTurn === s.turn || s.private < HARD.donate)}</div></div>`;
}
function hireCard() {
  if (!isHard(s) || s.finished) return "";
  const h = s.hard;
  return `<section class="panel hire-card"><div class="section-head"><h2>私聘书启</h2><span>${h.hired ? "在馆" : "未聘"}</span></div><p>以私产每周${HARD.hireCost}两延请书启代拟文移，下周起每周多1点精力。私产不足时书启自行辞去。私人家资${num(s.private)}两，已在馆${h.hireWeeks}周。</p>${btn(h.hired ? "辞去书启" : `延请书启 · 每周${HARD.hireCost}两私产`, "hard_hire", "", "button outline", !h.hired && s.private < HARD.hireCost)}</section>`;
}

// 手机端常驻工具栏：精力、待办与结束本周，各页都能直接推进。
function countyToolbar() {
  const urgent = s.events.filter((e) => e.mandatory).length,
    letters = s.events.length + dutyItems().length;
  const action = s.finished
    ? btn("查看任满考核", "tab", 'data-id="career"', "button primary")
    : urgent
      ? btn(`先办本周要事 · ${urgent}件`, "tab", 'data-id="court"', "button primary")
      : btn(`结束本周 ${icon("chevron_right")}`, "advance", "", "button primary");
  return `<div class="county-toolbar" role="region" aria-label="本周进度"><div><b>${s.finished ? "三年任满" : `精力 ${s.ap}`}</b><span>${s.finished ? "履历已归卷" : letters ? `案头${letters}件` : "案头已清"}</span></div>${action}</div>`;
}

// 公堂案头：除来信外，列出有期限的判后执行、待查案卷和需亲自安排的地方要务。
function dutyItems() {
  if (!s || s.finished) return [];
  const items = [];
  for (const c of Object.values(s.cases)) {
    const name = countyCase(s, c.id).name;
    if (["awaiting", "overdue"].includes(c.execution?.status))
      items.push({
        kind: "case",
        id: c.id,
        tag: "判后执行",
        urgent: true,
        late: c.execution.status === "overdue",
        title: name,
        text: c.execution.status === "overdue" ? "复核已获准，执行已迟延，越拖越伤民生与信任。" : `复核已获准，须在${Math.max(0, c.execution.deadline - s.turn)}周内安排执行。`,
      });
    else if (["open", "returned"].includes(c.status)) {
      const left = isHard(s) ? HARD.caseLimit - (s.turn - c.opened) : null;
      items.push({
        kind: "case",
        id: c.id,
        tag: c.status === "returned" ? "退回补查" : "案卷待查",
        urgent: left !== null && left <= 4,
        late: !!c.overdue,
        title: name,
        text: left === null ? "查证后拟判，呈府复核。" : c.overdue ? "已逾呈审期限，仍须办结。" : `立卷${HARD.caseLimit}周内须呈审，尚余${Math.max(0, left)}周。`,
      });
    }
  }
  const m = s.governance.mandate;
  if (m?.status === "active" && (m.mode === "verified" ? !m.ordered : s.governance.districts[m.district][m.metric] < m.target)) {
    const d = DISTRICTS.find((x) => x.id === m.district);
    items.push({
      kind: m.mode === "verified" && !m.checked ? "inspect" : "district",
      id: m.district,
      tag: "地方要务",
      urgent: m.due - s.turn <= 3,
      title: `${d.name} · 改善${LOCAL_METRICS[m.metric]}`,
      text: `${Math.max(0, m.due - s.turn)}周后核定：${m.mode === "verified" && !m.checked ? "先走访勘察核实现场" : "到辖地安排投入"}。`,
    });
  }
  return items;
}
function dutyCard(d) {
  const act =
    d.kind === "case"
      ? `data-act="case" data-id="${d.id}"`
      : d.kind === "inspect" && s.ap > 0 && !s.actions.includes("inspect")
        ? `data-act="action" data-id="inspect"`
        : `data-act="district" data-id="${d.id}"`;
  return `<button class="event-card duty-card ${d.urgent ? "urgent" : ""}" ${act}><div class="event-copy"><div class="event-meta">${d.tag}<span>${d.late ? "已逾期" : d.urgent ? "期限将至" : "有期限"}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p></div>${icon("chevron_right")}</button>`;
}
