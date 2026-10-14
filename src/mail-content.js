import { EVENTS, WEEKLY_EVENTS } from "./data.js";
const next = (title, text, choices, enabled) => ({
  title,
  text,
  choices,
  enabled,
});
export const MAIL_FOLLOWUPS = {
  W01: next(
    "新册上的迁入户",
    "前一阶段的底册回到案头。两户迁入者的原籍回函到了，县丞请你决定谁负责接续登记。",
    ["亲核回函并列入新册", "把两地册号逐项勾稽", "交经承登记，留待抽验"],
    (s) => s.turn >= 13,
  ),
  W02: next(
    "修路后的排水口",
    "商路修整后，铺户发现新的排水口接在卸货台旁，雨水与货车时段需要重新安排。",
    ["与铺户分定作业时段", "勘定卸货台的排水边线", "请铺户先试行再回报"],
    (s) =>
      s.projects.some(
        (p) => p.id === "road" && p.status === "complete" && p.condition > 0,
      ),
  ),
  W03: next(
    "新粮入仓的批次",
    "秋收粮已经运来。新旧粮应分别标明入仓日期，仓役担心先进后出的记录与实际堆放对不上。",
    ["分批挂牌，留下收仓日期", "亲核一批堆号与交粮单", "交仓役挂牌，经承覆看"],
    (s) => s.turn >= 39 && s.grain > 500,
  ),
  W04: next(
    "县学出馆后的去处",
    "教谕带来几名出馆学生的去向，有人想留乡教童蒙，也有人请县里开具求学证明。",
    ["按册核实并分别出具证明", "与教谕商定乡学轮教", "交教谕办理，存一份名册"],
    (s) =>
      s.projects.some((p) => p.id === "school" && p.status === "complete") ||
      s.education >= 50,
  ),
  W05: next(
    "渡口的交货凭据",
    "商坊货担增多。船户与铺户想统一交货凭据，免得装卸两端各记一套数。",
    ["试办统一交货联单", "抽查一船的两端收据", "让双方先留双联凭据"],
    (s) =>
      s.projects.some(
        (p) => p.id === "road" && p.status === "complete" && p.condition > 0,
      ) || s.governance.districts.market.commerce >= 65,
  ),
  W06: next(
    "轮水约定后的新水位",
    "两岸已有轮水约定，近期水位回落。上游担心照旧时段会取不到水，下游要求先记录实际流量。",
    ["按实测流量重排时段", "请两岸代表共同验水", "按旧约试行，另记水位"],
    (s) => s.turn >= 13 && !!s.flags.waterAgreement,
  ),
  W07: next(
    "案卷执行后的回访",
    "前次田地案已经执行。村民这次商量的是农路的日常修整，典史请你列明轮值与查验安排。",
    ["列明双方维护责任", "走访确认通道实际用途", "请街坊先定轮值再呈报"],
    (s) => s.cases.boundary?.execution?.status === "done",
  ),
  W08: next(
    "家书中的来年安排",
    "家中带来来年的用度清单，问你是否仍请原来的先生授课。孩子的学业与家中照护各有一笔支出。",
    ["写明来年授课与照护安排", "核对清单后捎回平安信", "请亲友先议定急需部分"],
    (s) => s.turn >= 52,
  ),
};
export function mailKey(s, id) {
  const base = id + ".first";
  if (!s.contentSeen[base]) return base;
  const follow = id + ".next";
  if (
    !s.contentSeen[follow] &&
    s.routines[id] &&
    s.turn - s.routines[id].lastTurn >= 13 &&
    MAIL_FOLLOWUPS[id].enabled(s)
  )
    return follow;
  return null;
}
export function selectCountyMail(s) {
  const offset = (((s.turn + s.seed - 314159) % 8) + 8) % 8;
  for (let i = 0; i < 8; i++) {
    const id = WEEKLY_EVENTS[(offset + i) % 8],
      key = mailKey(s, id);
    if (key) return { id, key };
  }
  return null;
}
const mailDescriptions = {
  W01: [
    "核对两户原籍回函，确认册号后登记。",
    "把两地册号逐项对应，留一份可回查的勾稽表。",
    "批给经承登记，原函随册保留。",
  ],
  W02: [
    "分开排水施工与卸货时段，免得两边人手互相等候。",
    "现场划清排水与堆货边线，铺户照线使用。",
    "交铺户试行，县里保留本次安排。",
  ],
  W03: [
    "按新旧粮批次挂牌，避免先进后出的顺序混淆。",
    "核一批堆号与交粮单，找出记录和堆放的差处。",
    "批给仓役挂牌，经承按收仓册覆看。",
  ],
  W04: [
    "核实出馆学生的课业和去向，文教最多提高4点。",
    "添补试教纸墨，先按教谕提出的轮教名册办理。",
    "批给教谕办理，求学与留乡两类名单分别存档。",
  ],
  W05: [
    "统一交货联单的件数与签认，双方各留一联。",
    "先核一船的两端收据，避免把同批货担记成两次数。",
    "批给船户与铺户先留双联凭据。",
  ],
  W06: [
    "按这一轮实测水位安排时段，保留两岸共同签认。",
    "请两岸代表共同验水，县里将时段与水位一并入册。",
    "暂按旧约试行，新水位另外记录。",
  ],
  W07: [
    "列明两家维护责任，通行权与修路责任分开登记。",
    "走访确认谁在用路，再议日常维护的分工。",
    "批给街坊安排轮值，由典史循例核看。",
  ],
  W08: [
    "把授课与照护的分工写明，家人关系最多增加5。",
    "核对清单并回复近况，不另承诺未备好的用度。",
    "请亲友先议急需部分，来年的全盘安排暂缓。",
  ],
};
export function mailDefinition(s, id, key) {
  const event = structuredClone(EVENTS[id]);
  if (key?.endsWith(".next")) {
    const f = MAIL_FOLLOWUPS[id];
    event.title = f.title;
    event.text = f.text;
    event.tag = "县情后续";
    if (id === "W08") event.options[0].effect.family = 5;
    if (id === "W04") event.options[0].effect.education = 4;
    event.options.forEach((o, i) => {
      o.label = f.choices[i];
      o.desc = mailDescriptions[id][i];
    });
  }
  return event;
}
