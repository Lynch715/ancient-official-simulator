import { mailDefinition } from "./mail-content.js";
import { canFinish } from "./rules.js";
import { EVENTS } from "./data.js";
import { AFFAIRS, affairDefinition } from "./county-affairs.js";
import { hardEventDefinition, HARD, isHard, roll } from "./county-hard.js";

const followups = {
  W01: [
    "上次抽查的两里已补齐底册。这次周报另有迁入户，需要核对新旧登记。",
    "经承送回了补册，仍有迁入户没有找到原籍凭据。",
  ],
  W02: [
    "前次清过的沟渠仍可通水，雨后新淤积堵在街尾。铺户来商量这次的作业时段。",
    "轮值铺户已清了街口，街尾积水却还没退。罗行舟带来新的勘看记录。",
  ],
  W03: [
    "前次换过的垫木仍然牢固。仓役这次发现屋角漏水，想趁粮袋受潮前补好。",
    "仓役用旧料支住了粮架，请经承一同查验，免得修过便无人过问。",
  ],
  W04: [
    "上一批策论已经发还。教谕送来新作，其中几份谈到本县轮水和役户的难处。",
    "教谕收到了回函，这次带来新一季的借书和纸墨用度。",
  ],
  W05: [
    "分时靠岸已经试过几回。船户说客船顺了，赶集日的货担仍需有人疏导。",
    "巡役维持住了轮候，今天多了几条外县粮船，旧安排有些吃紧。",
  ],
  W06: [
    "前次轮水安排已写入巡水册。水位降了，几户田地请你再核一遍时段。",
    "里老调处后暂且放了水，陈望田带来新水位记录，请县里留意。",
  ],
  W07: [
    "前次划定的通行线仍在，街坊另为卸货时辰起了争执。典史已分别记下两家诉求。",
    "典史劝解过两家，旧堆物已挪走；新送来的木料又占了半条巷子。",
  ],
  W08: [
    "家中收到了上一封信，这次寄来孩子习字的纸页，也问你近来睡得如何。",
    "家中收到平安口信，托驿递送来近况。案头的旧信还没有细读。",
  ],
};

export function countyEvent(s, id) {
  if (AFFAIRS[id]) return hardEventDefinition(s, id, affairDefinition(s, id));
  const row = s.events.find((row) => row.id === id);
  if (row?.contentKey && row.contentKey !== "legacy")
    return hardEventDefinition(s, id, mailDefinition(s, id, row.contentKey));
  const event = structuredClone(EVENTS[id]);
  if (id === "G05" && s.fatigue === 0) {
    event.title = "属员送来的差事清单";
    event.speaker = "deputy";
    event.tag = "任事复查";
    event.text =
      "属员送来已办差事与在办期限。手头尚无积劳，县丞请你留一份清单，方便下次分派。";
    event.options = event.options.map((o) => ({
      ...o,
      label:
        o.id === "rest"
          ? "按实际进展核一遍清单"
          : o.id === "continue"
            ? "只留待办，暂不调整分派"
            : "交县丞留册，循例跟进",
      desc: "本次只留任事记录，不收休养精力，也不追加恢复或考绩。",
      cost: {},
      effect: {},
      flags: { staffReview: true },
    }));
  } else if (id === "G05") {
    event.text = `当前疲劳${s.fatigue}/100。余婆婆劝你重新分派手头差事，留下亲自查验的重点。`;
    event.title = s.fatigue >= 25 ? "连日劳瘁" : "歇一歇手头的事";
  }
  const previous = s.routines?.[id];
  if (previous && followups[id]) {
    const handsOn = !["delegate", "list", "reply", "mediate"].includes(
      previous.lastChoice,
    );
    event.text = followups[id][handsOn ? 0 : 1];
    event.tag = "后续来信";
    if (id === "W03" && handsOn) {
      event.text =
        "前次整修过的粮架仍稳。仓役这次发现屋角漏水，想趁粮袋受潮前补好。";
      event.title = "仓役的巡仓回报";
      event.options[0].label = "修补漏点并查验";
      event.options[0].desc = "支付2两工料，补好屋角漏点。";
      event.options[1].label = "用旧瓦补漏，亲自验看";
      event.options[1].desc = "花1点精力查验旧料和修补结果。";
      event.options[2].label = "交仓役循例修补";
      event.options[2].desc = "责成仓役补好漏点。";
    }
    if (id === "W04" && previous.lastChoice === "supply")
      event.text =
        "前次添补的纸墨已用过一批。教谕带来新作，其中几份谈到本县轮水和役户的难处。";
    if (previous.by === "staff" && id === "W04")
      event.text = "教谕照常主持课业，新一批策论和纸墨用度又送到案头。";
    if (previous.by === "staff" && id === "W08")
      event.text =
        "驿递捎来新信，案下还有前次未细读的家书。家中问你近来睡得如何。";
    // Context stays tied to actual durable choices rather than replaying benefits.
    if (id === "W06" && s.flags.waterAgreement)
      event.text += " 两岸代表仍按当年勘定的水口办理。";
    if (id === "W03" && s.flags.warehouseAudit)
      event.text += " 新记录与旧仓案分卷留存。";
    if (id === "W08" && s.family < 40)
      event.text =
        "家中来信寥寥几句，药费单仍压在旧信下。驿递问你，这次要不要留一封回信。";
  }
  if (id === "X04") {
    event.scene = "scene_village_drought";
    const buy = event.options.find((o) => o.id === "buy");
    buy.cost.silver = Math.round((360 * s.grainPrice + 20) * 100) / 100;
    buy.desc = `360石按每石${s.grainPrice}两采购，配送20两，合计${buy.cost.silver}两；1周后到货发放。`;
  }
  return hardEventDefinition(s, id, event);
}

export const familyRecovery = (s) =>
  s.family >= 75 ? 1 : s.family < 40 ? -1 : 0;
export const familyAllowance = (s) => (s.family >= 75 ? 0.1 : 0);

export function countyMemories(s) {
  const f = s.flags;
  return [
    f.handover &&
      {
        verified: "接印时分项验收，待核项留卷。",
        noted: "接印时先办日常，仓粮另记待核。",
        signed: "接印时按交接册签收。",
      }[f.handover],
    f.waterAgreement
      ? "两岸按实勘约定放水。"
      : f.waterPromise
        ? "两岸代表曾议定放水，县里保留协商记录。"
        : "",
    f.warehouseAudit ? "仓账差额已呈报，仓案另卷办理。" : "",
    f.floodResponse &&
      {
        evacuate: "汛情当夜先撤村户，再组织抢护。",
        protect: "汛情当夜优先保住仓路。",
        appeal: "汛情当夜组织乡里互助并请援。",
      }[f.floodResponse],
    f.shelter ? "曾供过渡口粮，流民地权另查。" : "",
    f.kinRisk ? "故人借名经商一事，未作公开声明。" : "",
    f.reliefHouseholds !== undefined
      ? `首轮救济计划覆盖${f.reliefHouseholds}户；实际收发粮见钱粮账。`
      : "",
  ].filter(Boolean);
}

export const STAFF_TASKS = {
  ledger: "核对钱粮",
  patrol: "巡街查堤",
  care: "走访民情",
  works: "协办工程",
};
export const STAFF_PROFILES = {
  deputy: {
    tasks: { works: 1, care: 1 },
    note: "县丞熟悉工役，可使一项工程每周多推进1周。",
  },
  dianshi: {
    tasks: { ledger: 1.25, patrol: 1 },
    note: "典史擅长案牍，核账效力为常例的1.25倍。",
  },
  clerk: {
    tasks: { ledger: 1.5, care: 0.75 },
    note: "经承熟悉旧册，核账效力为常例的1.5倍。",
  },
  captain: {
    tasks: { patrol: 1.5, works: 0.5 },
    note: "捕役头目熟悉乡路，巡守效力为常例的1.5倍；协工每周多推进半周。",
  },
  advisor: {
    tasks: { care: 1.5, ledger: 1.25 },
    note: "幕友善于会商，访察效力为常例的1.5倍。",
  },
};
export function staffWorkBonus(s, projectId) {
  const first = s.projects.find((p) => p.status === "building");
  if (!first || first.id !== projectId) return 0;
  return Math.max(
    0,
    ...Object.entries(s.staffAssignments)
      .filter(([, task]) => task === "works")
      .map(([id]) => STAFF_PROFILES[id]?.tasks.works ?? 1),
  );
}
export function staffTaskOptions(s, id) {
  const tasks = { ...STAFF_PROFILES[id].tasks };
  const old = s.staffAssignments[id];
  if (old && !(old in tasks)) tasks[old] = 1;
  return Object.keys(tasks).map((task) => [
    task,
    STAFF_TASKS[task] +
      (task === old && !(task in STAFF_PROFILES[id].tasks)
        ? "（旧差事保留）"
        : ""),
  ]);
}

export function caseChoices(s, definition, file, btn) {
  if (!["open", "returned"].includes(file.status) || s.finished) return "";
  if (isHard(s)) return hardCaseChoices(s, definition, file, btn);
  if (file.clues.length < definition.clues.length)
    return `<p class="muted">先核实上列线索，再对照凭据提出意见。</p>${btn("整理线索，继续调查", "judge", `data-id="${definition.id}" data-choice="defer"`, "text-button")}`;
  const alternatives = [
    ["good", definition.good],
    ["bad", definition.bad],
  ];
  if (definition.id === "granary" || definition.id === "ferry")
    alternatives.reverse();
  return `<div class="choice-list">${alternatives.map(([id, label]) => btn(label, "judge", `data-id="${definition.id}" data-choice="${id}"`, "button outline", !canFinish(s.turn, 4))).join("")}${!canFinish(s.turn, 4) ? '<p class="warning-text">余期不足四周，无法完成复核与执行，案卷须列入交接。</p>' : ""}${btn("继续核对，暂不拟判", "judge", `data-id="${definition.id}" data-choice="defer"`, "text-button")}</div>`;
}

function hardCaseChoices(s, definition, file, btn) {
  const left = HARD.caseLimit - (s.turn - file.opened),
    deadline = file.overdue
      ? '<p class="warning-text">已逾呈审期限，记过一次；仍须办结。</p>'
      : `<p class="muted">立卷${HARD.caseLimit}周内须呈审，尚余${Math.max(0, left)}周。</p>`;
  const settle = HARD.settleCases.includes(definition.id)
    ? btn("劝两造和息，具结销案", "judge", `data-id="${definition.id}" data-choice="settle"`, "button outline")
    : "";
  if (!file.clues.length)
    return `${deadline}<p class="muted">至少核实一项线索后才能拟判。</p>${settle ? `<div class="choice-list">${settle}</div>` : ""}`;
  const partial = file.clues.length < definition.clues.length;
  const alternatives = [
    ["good", definition.good],
    ["bad", definition.bad],
  ].sort((a, b) => roll(s.seed, `${definition.id}:${a[0]}`) - roll(s.seed, `${definition.id}:${b[0]}`));
  const ok = canFinish(s.turn, 4);
  return `${deadline}${partial ? '<p class="warning-text">线索尚未查齐。现在拟判可省精力，但证据链不全，复核可能退回。</p>' : ""}<div class="choice-list">${alternatives.map(([id, label]) => btn(label, "judge", `data-id="${definition.id}" data-choice="${id}"`, "button outline", !ok)).join("")}${settle}${!ok ? '<p class="warning-text">余期不足四周，无法完成复核与执行，案卷须列入交接。</p>' : ""}${partial ? btn("继续核对，暂不拟判", "judge", `data-id="${definition.id}" data-choice="defer"`, "text-button") : ""}</div>`;
}
