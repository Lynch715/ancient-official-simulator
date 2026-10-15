import { OFFICE_CONTENT, gainText, storyResult, sourceClueCost } from "./office-stories.js";
export function storyBadge(s, key) {
  const b = s.officeStories.offices[key];
  return (b?.queue.length || 0) + Object.values(b?.cases || {}).filter((f) => ["open", "returned", "approved"].includes(f.status)).length;
}
export function officeStoriesView(s, key, { btn, esc, num }) {
  const defs = OFFICE_CONTENT[key], q = s[key], b = s.officeStories.offices[key];
  if (!b) return "";
  const costText = (cost) => Object.entries(cost).map(([k, n]) => `${{ silver: "公银", grain: "公粮", ap: "精力" }[k]}${n}${k === "ap" ? "点" : k === "grain" ? "石" : "两"}`).join(" · ") || "无需额外支出";
  const disabled = (cost = {}) => q.finished || Object.entries(cost).some(([k, n]) => q[k] < n);
  const events = b.queue.map((id) => {
    const d = defs.events.find((x) => x.id === id), r = b.events[id];
    return `<article class="office-letter"><div class="section-head"><h3>${esc(d.title)}</h3><span>来件后${q.turn - r.opened}周 · ${Math.max(0, r.opened + 8 - q.turn)}周内亲办</span></div><p class="story-prose">${esc(d.text)}</p><div class="choice-list">${d.options.map((o) => btn(`<b>${esc(o.label)}</b><small>${costText(o.cost)}</small><p>${o.after ? `${o.after}周后核查回报${gainText(o.gain)}` : esc(o.result)}</p>`, "office-story", `data-id="${d.id}" data-choice="${o.id}"`, "choice", disabled(o.cost) || q.turn + o.after > 156)).join("")}</div></article>`;
  }).join("");
  const working = defs.events.filter((d) => b.events[d.id]?.status === "working").map((d) => `<p>${esc(d.title)} · ${b.events[d.id].due - q.turn}周后查验，不提前记效。</p>`).join("");
  const cases = defs.cases.map((d) => {
    const f = b.cases[d.id];
    if (!f) return b.retiredCases.includes(d.id) ? "" : `<p class="muted">${esc(d.name)} · ${defs.label}第${d.week + 1}周立卷。</p>`;
    const pending = ["open", "returned"].includes(f.status);
    const names = { open: "待查证", returned: "退回补查", review: "呈报复核中", approved: "复核通过，待执行或移送", executing: "执行回报核验中", closed: "实际归档", handover: "未竟事项 · 原状交接" };
    return `<article class="zf-case source-case"><h3>${esc(d.name)}</h3><p>${names[f.status]}${f.due ? ` · ${f.due - q.turn}周后回报` : ""} · 证据${f.clues.length}/${d.clues.length}</p><p class="story-prose">${esc(d.summary)}</p><details><summary>两种待排除的解释</summary>${d.hypotheses.map((x) => `<p>${esc(x)}</p>`).join("")}</details>${d.clues.filter((c) => f.clues.some((x) => x.id === c.id)).map((c) => `<p class="evidence-note"><b>${esc(c.name)}</b><br>${esc(c.text)}</p>`).join("")}${f.status === "returned" ? '<p class="warning-text">前次推断已被退回。已核证据保留，须逐项排除另一解释再拟处理。</p>' : ""}<div class="tz-controls">${pending ? d.clues.map((c) => btn((f.clues.some((x) => x.id === c.id) ? "已核 · " : "") + esc(c.name) + ` · ${sourceClueCost(s, key, d.id, c.id).silver}两 / 1精力`, "office-case", `data-id="${d.id}" data-action="clue" data-clue="${c.id}"`, "button outline", disabled(sourceClueCost(s, key, d.id, c.id)) || f.clues.some((x) => x.id === c.id))).join("") : ""}</div>${pending ? `<div class="choice-list">${d.options.map((o) => btn(`<b>${esc(o.label)}</b><small>${o.id === "recheck" ? "保留卷宗，不消耗精力、不加分" : "1精力 · 复核2周，执行再需2周"}</small>`, "office-case", `data-id="${d.id}" data-action="review" data-choice="${o.id}"`, "choice", q.finished || (o.id !== "recheck" && (disabled({ ap: 1 }) || q.turn > 152)) || (o.id === "evidence" && f.clues.length !== d.clues.length) || f.reviews.some((r) => !r.approved && r.choice === o.id))).join("")}</div>` : f.status === "approved" ? btn("督促交还或正式移送 · 6两 / 1精力", "office-case", `data-id="${d.id}" data-action="execute"`, "button primary", disabled({ silver: 6, ap: 1 }) || q.turn > 154) : ""}${["approved", "executing", "closed"].includes(f.status) ? `<p>${esc(d.finding)}</p>` : ""}<details class="case-source"><summary>案件出处与改编说明</summary><p>取材于${esc(d.source.author || "吴趼人")}《${esc(d.source.title || "中国侦探案")}》〈${esc(d.source.chapter)}〉。原书含笔记与传闻，游戏人物、证据细节和对白为改编。</p><a href="${d.source.url}#L${d.source.lines[0]}-L${d.source.lines[1]}" target="_blank" rel="noopener noreferrer">查看 GitHub 固定版本原篇</a><p class="muted">保留原案疑点，增补可核查凭据；民间巧断和人物猜测不直接定罪。</p></details></article>`;
  }).join("");
  const history = defs.events.filter((d) => ["done", "delegated"].includes(b.events[d.id]?.status)).map((d) => {
    const r = b.events[d.id], o = d.options.find((x) => x.id === r.choice);
    return `<p><b>${esc(d.title)}</b> · ${r.status === "done" ? "查验完成" : "常例留卷"}：${esc(r.status === "done" ? storyResult(d, o) : "由属员留卷处理，未取得新增查验结果。")}</p>`;
  }).join("");
  const closed = Object.values(b.cases).filter((f) => f.status === "closed").length;
  return `<section class="panel office-stories" id="${key === "xunfu" ? "xf" : key === "buzheng" ? "bz" : key === "canzheng" ? "cz" : key === "inspector" ? "in" : key === "prefecture" ? "pref" : key === "tongzhi" ? "tz" : "zf"}-stories"><div class="section-head"><h2>${defs.title}</h2><span>剧情与案牍 · 待办${storyBadge(s, key)}件</span></div><p class="muted">来件保留8周，逾期交属员常例留卷，不计查验成果。案件独立留卷；查证、复核、执行依次办理。前事已查验的相关线索，寻访差费由4两减为2两。${q.finished ? `本任来源案实际归档${closed}件，其余列入交接。` : ""}</p>${events || '<p>案头暂无线索来信，可先办理卷宗与本职差事。</p>'}${working ? `<div class="notice">${working}</div>` : ""}<div class="section-head spaced"><h2>来源案卷</h2><span>三项证据 · 复核2周 · 执行2周</span></div>${cases}<details><summary>已办剧情与查验回报（${Object.values(b.events).filter((r) => ["done", "delegated"].includes(r.status)).length}件）</summary>${history || '<p>尚无完成记录。</p>'}</details></section>`;
}
