import { EVENTS } from "./data.js";
const item = (
  release,
  title,
  speaker,
  scene,
  district,
  text,
  labels,
  metric,
  project = null,
) => ({
  release,
  title,
  speaker,
  scene,
  district,
  text,
  labels,
  metric,
  project,
});
export const AFFAIRS = {
  C01: item(
    56,
    "旱后重新排水次",
    "farmer",
    "scene_fields_canal",
    "fields",
    (s) =>
      s.flags.waterAgreement
        ? "两岸沿用原轮水约定，旱后水位回升，几块晚种田想补一次灌溉。原时段和实际需水要重新对照。"
        : "旱后水位回升，早种与晚种田同时要求放水。里老带来田亩和播种日期，请县里排明先后。",
    ["到水口核定补灌时段", "雇人疏通两处田间支口", "交里老保留争议与水位记录"],
    "commerce",
    "canal",
  ),
  C02: item(
    60,
    "余粮与下一轮口粮",
    "clerk",
    "scene_granary",
    "hills",
    (s) =>
      `仓中实粮${Math.round(s.grain)}石。经承请把救助用粮与下一次轮供分开标记，免得已经发过的粮再列成未发。`,
    ["抽核一批收发名册", "添做批次牌，分垛存放", "交仓役照实存册办理"],
    "livelihood",
  ),
  C03: item(
    68,
    "退水后的堤脚",
    "captain",
    "scene_embankment_calm",
    "river",
    (s) =>
      s.projects.some((p) => p.id === "embankment" && p.status === "complete")
        ? "东堤已交付，退水后几处堤脚露出泥痕。是表面冲刷还是需要补护，应先把位置点清。"
        : "退水后河边露出几处冲刷痕。东堤尚未交付，捕役请先标明临时护岸与施工地段。",
    ["逐段查勘，圈出需补处", "派工补护现有险段", "留入巡堤册，交属员跟看"],
    "security",
    "embankment",
  ),
  C04: item(
    72,
    "供粮清册里的去向",
    "widow",
    "scene_fields_canal",
    "hills",
    (s) =>
      s.displaced
        ? `清册仍有${s.displaced}人待安置。村中送来可恢复生计的住户名单，需要和现有口粮册逐户对应。`
        : `已有${s.populationLedger.settled}人重新过上日子。村里想把旧供粮名册和现住户对一遍，免得有人漏领，也免得有人领两份。`,
    [
      "逐户核对名册与生计",
      "拨料修补村中公共用具",
      "留旧册，交里老核对迁出迁入",
    ],
    "livelihood",
  ),
  C05: item(
    80,
    "货担抵岸的时段",
    "boatman",
    "scene_river_ferry",
    "river",
    (s) =>
      s.projects.some((p) => p.id === "road" && p.status === "complete")
        ? "商路修好后，抵岸货担多了。船户请把客船、粮船和铺户卸货分成几段时辰。"
        : "客船与粮船同时抵岸，临时卸货处的人手不够。船户请县里先定靠岸与卸货的次序。",
    ["核船次，先试一张时刻表", "雇人整修临时卸货台", "请船户分别留抵岸记录"],
    "commerce",
    "road",
  ),
  C06: item(
    84,
    "教童蒙的人手",
    "advisor",
    "scene_county_school",
    "hills",
    (s) =>
      s.projects.some((p) => p.id === "school" && p.status === "complete")
        ? "县学已有可用学舍，教谕提出让出馆学生轮教童蒙。学生往返的农路与借用纸墨都要安排。"
        : "教谕想借乡中空屋开童蒙课。孩子们往返要走多远、谁来教，他心里还没底，想先请县里拿个主意。",
    ["与教谕核定轮教名单", "按册添补公用纸墨", "留授课建议，交教谕先议"],
    "livelihood",
  ),
  C07: item(
    96,
    "荒田受领后的工序",
    "farmer",
    "scene_fields_canal",
    "fields",
    (s) =>
      s.flags.settle
        ? "上回安置的几户已经领了田。地是有了，田埂谁修、农具借谁的、先种哪一块，村里还在争。"
        : "村里报来几块闲田，说是无主。可地契在谁手里、开荒要多少农具，还没人说得清。",
    ["核地权与现有农具", "添补公用农具，按册借用", "留受领疑点，先交里老核册"],
    "commerce",
  ),
  C08: item(
    100,
    "相邻村的水口交班",
    "deputy",
    "scene_fields_canal",
    "fields",
    (s) =>
      s.countyAffairs.records.some((r) => r.id === "C01" && r.status === "done")
        ? "上次补灌安排已核验，相邻村这次要交接看水人。旧时段、变更缘由和交班者须对上。"
        : "相邻村提出交接看水人，现有水口册却未列交班姓名。县丞请你决定先核什么、由谁留底。",
    ["核看水人和交班时段", "添制水尺与交班簿", "交两村各留一份水口册"],
    "security",
    "canal",
  ),
  C09: item(
    108,
    "两端收据如何对应",
    "merchant",
    "scene_market",
    "market",
    (s) =>
      s.countyAffairs.records.some((r) => r.id === "C05" && r.status === "done")
        ? "上一轮靠岸安排已有回执。铺户送来同批货担的两端收据，想把签认与卸货时段接在一起。"
        : "铺户送来同一批货担的两头收据：船头按件记，铺里按包记，两边数目怎么也对不上。",
    [
      "抽核一批货担的计数单位",
      "添做双联凭据，分开签认",
      "交双方保留原收据待核",
    ],
    "security",
  ),
  C10: item(
    112,
    "农路上的维护分工",
    "dianshi",
    "scene_fields_canal",
    "fields",
    (s) =>
      ["done", "legacy"].includes(s.cases.boundary?.execution?.status)
        ? "田地案已经执行。几家共用农路，现在争的是谁补路、谁留查验记录，原判归属不再重开。"
        : "几家共用一条农路，修路的钱谁出、谁来出工，吵了半个月。偏偏这几家还卷在那桩田地官司里。",
    ["核通行与维护的实际分工", "按路段拨料补修", "先交典史分别留双方记录"],
    "livelihood",
  ),
  C11: item(
    120,
    "县学下一季的用度",
    "advisor",
    "scene_county_school",
    "hills",
    (s) =>
      `当前文教${Math.round(s.education)}。教谕送来下一季纸墨与授课名单，要求把公用物料和学生自备部分分清。`,
    ["核名单与公用物料", "按册添补下一季纸墨", "交教谕留预算，暂不拨新款"],
    "commerce",
  ),
  C12: item(
    124,
    "借物与归还的清册",
    "widow",
    "scene_fields_canal",
    "hills",
    (s) =>
      s.populationLedger.settled
        ? "救助时借出的器具陆续归还，有几件已磨损。哪些修补、哪些仍由住户使用，应按实物登记。"
        : "乡里公用器具轮借了一季，有几件已磨损。借出、归还和仍在使用的器具需要分别登记。",
    ["查实借出与归还的器具", "修补仍可公用的器具", "留实物清单，交里老核看"],
    "security",
  ),
  C13: item(
    128,
    "渡口护栏的缺口",
    "boatman",
    "scene_river_ferry",
    "river",
    (s) =>
      s.projects.some((p) => p.id === "road" && p.status === "complete")
        ? "商路栈桥已经交付，渡口护栏有几处松动。现有养护钱照常支付，这次集中修补须另留查验记录。"
        : "临时登船处的护栏松了几处，前天差点有人落水。船户想先拉绳划出能走的地方，再慢慢补。",
    ["现场划清安全范围", "集中补护栏与桥面", "交船户标记缺口待查"],
    "security",
    "road",
  ),
  C14: item(
    136,
    "新旧粮垛的轮点",
    "clerk",
    "scene_granary",
    "market",
    (s) =>
      `秋粮入仓后，实存${Math.round(s.grain)}石。仓役送来新旧粮垛的位置图，想按轮点次序逐批核实。`,
    ["抽点一批粮垛与仓签", "添补仓签，按批次整理", "留轮点图，交仓役逐批核册"],
    "commerce",
  ),
  C15: item(
    140,
    "迁入户的原籍回函",
    "deputy",
    "scene_county_hall",
    "hills",
    () =>
      "迁入户的原籍回函到了，有一户姓名与旧册用字不同。县丞请你决定如何比对亲属、册号与实际居处。",
    ["核亲属与两地册号", "派人核对实际居处", "保留原函，交经承续核"],
    "livelihood",
  ),
  C16: item(
    144,
    "各乡水口交接册",
    "farmer",
    "scene_fields_canal",
    "fields",
    (s) =>
      s.countyAffairs.records.some((r) => r.id === "C08" && r.status === "done")
        ? "前次看水交班已核验，陈望田带来各乡交接册。这次要把后来改过的水位和时段一并列明。"
        : "陈望田带来各乡水口册。哪些时段大家都认，哪些还在吵，他想趁你还在任上说个明白。",
    [
      "核现行时段与待议事项",
      "添补水口标识，随册交接",
      "保留争议原文，交里老续核",
    ],
    "commerce",
    "canal",
  ),
  C17: item(
    148,
    "乡学先生的接续",
    "advisor",
    "scene_county_school",
    "hills",
    (s) =>
      s.countyAffairs.records.some((r) => r.id === "C06" && r.status === "done")
        ? "轮教安排已经核验。几名先生来问下一年的接续人手，希望把授课日期与公用纸墨列成可交接的清单。"
        : "几名先生来问下一年的接续人手。教谕请先留实际授课名册，尚未办成的轮教建议仍列待办。",
    [
      "核授课名册与接续人手",
      "添补公用教具，留验收单",
      "交教谕分别列已办与待办",
    ],
    "livelihood",
  ),
  C18: item(
    152,
    "养护事项逐项交验",
    "captain",
    "scene_county_gate",
    "river",
    () =>
      "任末养护清单送来了。哪段查过、哪段在修、哪段得留给后任操心，县丞想听你一句话再落笔。",
    ["逐处核定已办与待办", "补修可在任内交验的险处", "照实列清单，随原卷交接"],
    "security",
    "embankment",
  ),
};
for (const [id, d] of Object.entries(AFFAIRS))
  EVENTS[id] = {
    title: d.title,
    tag: "阶段事务",
    speaker: d.speaker,
    scene: d.scene,
    text: "地方送来本阶段的实际记录。",
    options: d.labels.map((label, i) => ({
      id: ["inspect", "fund", "staff"][i],
      label,
      desc: [
        "花1点精力查验，两周后核实结果。",
        "支出14两材料与差费，三周后核实交付。",
        "留待办原册，由属员循例跟进；不记作已核验成果。",
      ][i],
      cost: i === 0 ? { ap: 1 } : i === 1 ? { silver: 14 } : {},
      effect: {},
      flags: {},
    })),
  };
export const blankAffairs = () => ({ retired: {}, pending: [], records: [] });
export function nextAffair(s) {
  for (const [id, d] of Object.entries(AFFAIRS)) {
    if (s.turn > d.release + 8 && !s.countyAffairs.retired[id])
      s.countyAffairs.retired[id] = true;
    if (s.turn >= d.release && !s.countyAffairs.retired[id]) return id;
  }
  return null;
}
export function affairDefinition(s, id) {
  const d = AFFAIRS[id],
    e = structuredClone(EVENTS[id]);
  e.text = d.text(s);
  const name = { livelihood: "生计", commerce: "生产", security: "秩序" }[
    d.metric
  ];
  e.options[0].desc = `花1点精力查验，两周后核实；当地${name}最多改善2点，按实际差值留卷。`;
  e.options[1].desc = `支出14两材料与差费，不另占精力；三周后查验，当地${name}最多改善4点。`;
  e.options = e.options.filter(
    (o) => o.id === "staff" || s.turn + (o.id === "inspect" ? 2 : 3) <= 156,
  );
  if (
    d.project &&
    s.projects.some((p) => p.id === d.project && p.status === "complete")
  )
    e.options.find((o) => o.id === "fund") &&
      (e.options.find((o) => o.id === "fund").desc =
        `支出14两材料与差费，不另占精力；三周后查验，当地${name}最多改善4点，设施状况最多恢复8点。`);
  if (["C06", "C11", "C17"].includes(id))
    for (const o of e.options)
      if (o.id !== "staff")
        o.desc += ` 文教另最多提高${o.id === "fund" ? 4 : 2}点，以实际核验为准。`;
  return e;
}
export function resolveAffair(s, id, choice, ctx) {
  const due =
    choice === "staff" ? null : s.turn + (choice === "inspect" ? 2 : 3);
  const row = {
    id,
    choice,
    turn: s.turn,
    status: choice === "staff" ? "staff" : "pending",
    due,
    result: [],
  };
  s.countyAffairs.records.push(row);
  if (due !== null) s.countyAffairs.pending.push({ id, choice, due });
  ctx.log(
    s,
    AFFAIRS[id].title,
    due === null
      ? "已留原册交属员跟进，本次不记查验成果。"
      : `已安排${choice === "inspect" ? "现场查核" : "物料与工役"}，${due - s.turn}周后核验；现在不提前记交付。`,
    "decision",
  );
}
export function skipAffair(s, id) {
  s.countyAffairs.records.push({
    id,
    choice: "staff",
    turn: s.turn,
    status: "staff",
    due: null,
    result: [],
  });
}
export function settleAffairs(s, ctx) {
  for (const p of s.countyAffairs.pending.filter((p) => p.due <= s.turn)) {
    const d = AFFAIRS[p.id],
      r = s.countyAffairs.records.find((r) => r.id === p.id),
      before = s.governance.districts[d.district][d.metric];
    const actual = ctx.local(
      s,
      d.district,
      d.metric,
      p.choice === "fund" ? 4 : 2,
    );
    r.status = "done";
    r.due = null;
    r.result = [
      `${{ livelihood: "生计", commerce: "生产", security: "秩序" }[d.metric]}${Math.round(before)} → ${Math.round(before + actual)}，实际增加${Math.round(actual * 10) / 10}`,
    ];
    if (["C06", "C11", "C17"].includes(p.id)) {
      const old = s.education;
      ctx.effect(s, { education: p.choice === "fund" ? 4 : 2 });
      r.result.push(`文教${Math.round(old)} → ${Math.round(s.education)}`);
    }
    if (p.choice === "fund" && d.project) {
      const project = s.projects.find(
        (x) => x.id === d.project && x.status === "complete",
      );
      if (project) {
        const old = project.condition;
        project.condition = Math.min(100, Math.round((old + 8) * 100) / 100);
        r.result.push(`设施状况${old} → ${project.condition}`);
      }
    }
    ctx.log(
      s,
      d.title + "核验",
      r.result.join("；") + "。交付记录随卷保留。",
      "gain",
    );
  }
  s.countyAffairs.pending = s.countyAffairs.pending.filter(
    (p) => p.due > s.turn,
  );
}
export function validateAffairs(s) {
  const a = s.countyAffairs,
    fail = () => {
      throw Error("阶段事务记录异常。");
    };
  if (
    !a ||
    !a.retired ||
    Array.isArray(a.retired) ||
    !Array.isArray(a.pending) ||
    !Array.isArray(a.records) ||
    a.records.length > 18 ||
    a.pending.length > 18
  )
    fail();
  for (const [id, v] of Object.entries(a.retired))
    if (!AFFAIRS[id] || v !== true) fail();
  if (new Set(a.records.map((r) => r.id)).size !== a.records.length) fail();
  for (const r of a.records) {
    if (
      !AFFAIRS[r.id] ||
      !a.retired[r.id] ||
      !["inspect", "fund", "staff"].includes(r.choice) ||
      !["staff", "pending", "done"].includes(r.status) ||
      !Number.isInteger(r.turn) ||
      r.turn < 0 ||
      r.turn > s.turn ||
      !Array.isArray(r.result) ||
      r.result.some((x) => typeof x !== "string") ||
      (r.status === "pending"
        ? r.due !== r.turn + (r.choice === "inspect" ? 2 : 3) ||
          r.due <= s.turn ||
          r.due > 156
        : r.due !== null) ||
      (r.choice === "staff") !== (r.status === "staff")
    )
      fail();
  }
  if (new Set(a.pending.map((p) => p.id)).size !== a.pending.length) fail();
  for (const p of a.pending)
    if (
      !a.records.some(
        (r) =>
          r.id === p.id &&
          r.choice === p.choice &&
          r.due === p.due &&
          r.status === "pending",
      )
    )
      fail();
  if (
    a.records.filter((r) => r.status === "pending").length !== a.pending.length
  )
    fail();
}
