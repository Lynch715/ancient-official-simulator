import { MAINLINE_TEXT } from "./office-mainline.js";
// 永平府及人物、金额、工期均为游戏化设定，不视作明代制度定额。
export const ZF_TERM = 156;
export const ZF_TASKS = {
  economy: { name: "农商恢复", cost: 40, weeks: 4, metric: "economy", gain: 8 },
  order: { name: "联县护道", cost: 36, weeks: 4, metric: "order", gain: 10 },
  relief: {
    name: "复耕安置",
    cost: 24,
    grain: 8,
    weeks: 3,
    metric: "resettled",
    gain: 24,
  },
};
const o = (id, label, desc, cost = {}, effect = {}, special = "") => ({
  id,
  label,
  desc,
  cost,
  effect,
  special,
});
export const ZF_EVENTS = [
  {
    id: "F01",
    week: 0,
    title: "丰县与灾县",
    speaker: "clerk",
    text: "三县请款一同到案。上任留下的设施和安置册已接收，新任统筹款另立公账。须把有限预算投向实际缺口。",
    options: [
      o(
        "coordinate",
        "按急缓统筹",
        "12两会商，三县协作各增6；拨款差事仍须逐县下达。",
        { silver: 12 },
        { trust: 2 },
        "cooperate",
      ),
      o(
        "reserve",
        "保留财力，逐项核办",
        "不额外支出；依各县实际情况决定后续拨款。",
      ),
      o(
        "uniform",
        "不问缺口，一律摊派",
        "三县协作各减6，上级信任减2。",
        {},
        { trust: -2 },
        "divide",
      ),
    ],
  },
  {
    id: "F02",
    week: 13,
    title: "能吏有污点",
    speaker: "advisor",
    text: "临河知县韩成素称能办事，账房却发现领款与实际交付可能不符。线索不足以直接定案，须派员调查后报有权机关处置。",
    options: [
      o(
        "separate",
        "保事务，也查账证",
        "记下临河核查线索，吏治增2；调查与接任须在属官卡中实际办理。",
        {},
        { integrity: 2 },
      ),
      o(
        "watch",
        "调取公文，等现场查验",
        "不替属官背书，后续可调查或核验差事。",
      ),
      o(
        "suppress",
        "以政绩为由压下线索",
        "留下隐瞒责任；成果不能抵销责任。",
        {},
        { integrity: -15 },
        "misconduct",
      ),
    ],
  },
  {
    id: "F03",
    week: 26,
    title: "上告到了府城",
    speaker: "widow",
    text: "两县交界水口争议拖延已久，当事人携凭据来到府城。新案已立卷，需核相关批示和约定、勘验水路，再依证据办理。",
    options: [
      o(
        "hear",
        "核卷并听取双方",
        "8两安排听取双方，三县协作各增2；证据和后续执行另行办理。",
        { silver: 8 },
        { trust: 2 },
        "listen",
      ),
      o(
        "supervise",
        "登记案卷，限期督办",
        "保留调查入口；未经核实不提前结案。",
      ),
      o(
        "reject",
        "用越诉之名压回",
        "不销真实案卷，吏治减10并记失察责任。",
        {},
        { integrity: -10 },
        "misconduct",
      ),
    ],
  },
  {
    id: "F04",
    week: 39,
    title: "好看的政绩册",
    speaker: "clerk",
    text: "属县表格整齐，未必代表工程和生计都一样好。差事报称与现场实效分列，只有核验完成才能记入考绩。",
    options: [
      o(
        "sample",
        "先整理两批核验底册",
        "支出8两整理凭据，后两份报告核验各省4两；上级信任增2。巡察仍须派员，不提前算成绩。",
        { silver: 8 },
        { trust: 2 },
        "auditPrep",
      ),
      o("crosscheck", "先对账，再安排现场核查", "不产生虚构核验成绩。"),
      o(
        "accept",
        "不核事实，照单背书",
        "留下不实汇报责任，报称数字不会变成真实成果。",
        {},
        { integrity: -12 },
        "misconduct",
      ),
    ],
  },
  {
    id: "F05",
    week: 78,
    title: "联县盗案",
    speaker: "captain",
    text: "商路盗案横跨两县，赃物去向与夜巡时刻互有矛盾。新案已立卷；护道差事改善治安，案卷仍须独立查证。",
    options: [
      o(
        "coordinate",
        "联络捕役，沿线核办",
        "12两协调，三县治安各增3；不自动结案。",
        { silver: 12 },
        {},
        "patrol",
      ),
      o(
        "records",
        "归并线索，依法查证",
        "保留证据调查，不以某县报平安为结论。",
      ),
      o("borders", "各守县界，拒绝协查", "三县治安各减5。", {}, {}, "borders"),
    ],
  },
  {
    id: "F06",
    week: 104,
    title: "府城还是乡村",
    speaker: "farmer",
    text: "商民希望修桥，乡民要求先补旧水利。原有河工的真实状况仍在交接册，未完成的项目不能写成竣工。",
    options: [
      o(
        "priority",
        "先问急需和现有损耗",
        "吏治增2；由你在设施卡安排修护或续办。",
        {},
        { integrity: 2 },
      ),
      o(
        "phase",
        "分期列预算",
        "上级信任增1，不提前扣款或增加设施。",
        {},
        { trust: 1 },
      ),
      o(
        "facade",
        "抽走公款装点门面",
        "支出100两，留下挪用责任，不增加民生工程。",
        { silver: 100 },
        { integrity: -15 },
        "misconduct",
      ),
    ],
  },
  {
    id: "F07",
    week: 130,
    title: "属官考语",
    speaker: "prefect",
    text: "荐举须有实绩依据，正式升降由有权机关决定。已完成现场核验的差事、查实的问题和接任安排，都会列入本任履历。",
    options: [
      o(
        "verified",
        "以已核实的成绩作考语",
        "上级信任增2，考核仍读实际核验数量。",
        {},
        { trust: 2 },
      ),
      o("extend", "未核者留待核查", "不把未完成调查当作已查清。"),
      o(
        "favor",
        "按私人亲疏写考语",
        "留下徇私责任，真实绩效不变。",
        {},
        { integrity: -15 },
        "misconduct",
      ),
    ],
  },
  {
    id: "F08",
    week: 143,
    title: "离任还剩两件事",
    speaker: "deputy",
    text: "临近考满，未验的差事、未执行的案卷以及未竟河工，要一并列入交接。不得因换任将欠事消去。",
    options: [
      o(
        "handover",
        "能办则办，如实交接",
        "建立交接目录，吏治增2；待办仍按实际状态保留。",
        {},
        { integrity: 2 },
        "handover",
      ),
      o(
        "list",
        "逐项列出缺口",
        "交接目录照实形成，不追加改善。",
        {},
        {},
        "handover",
      ),
      o(
        "sign",
        "把未办事项都签作圆满",
        "留下虚报责任，未竟事项继续保留。",
        {},
        { integrity: -15 },
        "misconduct",
      ),
    ],
  },
];
export const ZF_CASES = [
  {
    id: "water",
    week: 26,
    name: "两县水口上诉案",
    county: "qinghe",
    clues: [
      {
        id: "deed",
        name: "核旧契与界图",
        text: "旧契约定两村共用水口，未有独占条款。",
      },
      {
        id: "site",
        name: "勘验水路并询双方",
        text: "上游私筑土障改变分水，现场痕迹与双方供述相合。",
      },
    ],
    finding: "依契恢复共用水口，责令拆除私障；核验下游实际通水后归档。",
  },
  {
    id: "road",
    week: 78,
    name: "联县盗赃案",
    county: "yongning",
    clues: [
      {
        id: "goods",
        name: "核赃物与商户记录",
        text: "赃物批次与失货清册相合，销赃地点落在两县交界。",
      },
      {
        id: "patrol",
        name: "核巡更与证人供述",
        text: "更簿存在漏巡，证言与出入时间吻合；不能只凭单方口供定案。",
      },
    ],
    finding: "证物、证言相互印证，依法移送承审并补足护道；待执行回报后归档。",
  },
];

for (const event of ZF_EVENTS) event.text = MAINLINE_TEXT[event.id] ?? event.text;
