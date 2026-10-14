const selections = new Map();
const countySelections = new Map();

export function resetChapterPage(key) {
  selections.delete(key);
}

export function configureChapter(root, key) {
  root.classList.remove("with-chapter-toolbar");
  const main = root.querySelector(".pref-main");
  const nav = main?.querySelector(".pref-nav");
  if (!nav) return;
  const entries = [...nav.querySelectorAll('a[href^="#"]')].map((a) => ({
    id: a.getAttribute("href").slice(1),
    name: a.textContent,
  }));
  const footer = main.querySelector(".season-footer");
  const receipt = nav.querySelector('[data-act="receipt"]');
  const screens = new Map();
  let current = "overview";
  for (const child of [...main.children]) {
    if (
      child === nav ||
      child === footer ||
      child.matches(".page-heading,.persistent-save-warning")
    )
      continue;
    if (entries.some((e) => e.id === child.id)) current = child.id;
    if (!screens.has(current)) {
      const page = document.createElement("section");
      page.className = "chapter-screen";
      page.dataset.screen = current;
      page.id = `screen-${key}-${current}`;
      page.setAttribute("role", "tabpanel");
      main.insertBefore(page, child);
      screens.set(current, page);
    }
    screens.get(current).append(child);
  }
  nav.replaceChildren();
  nav.classList.add("chapter-tabs");
  nav.setAttribute("role", "tablist");
  const buttons = [];
  for (const entry of [{ id: "overview", name: "总览" }, ...entries]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = entry.name;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `screen-${key}-${entry.id}`);
    button.dataset.chapter = entry.id;
    button.id = `tab-${key}-${entry.id}`;
    screens.get(entry.id)?.setAttribute("aria-labelledby", button.id);
    nav.append(button);
    buttons.push(button);
  }
  if (receipt) {
    receipt.classList.add("chapter-receipt");
    nav.append(receipt);
  }
  function select(id, scroll = false) {
    if (!screens.has(id)) id = "overview";
    selections.set(key, id);
    for (const [pageId, page] of screens) page.hidden = pageId !== id;
    for (const b of buttons) {
      b.setAttribute("aria-selected", String(b.dataset.chapter === id));
      b.tabIndex = b.dataset.chapter === id ? 0 : -1;
    }
    if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
  }
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chapter]");
    if (button) select(button.dataset.chapter, true);
  });
  nav.addEventListener("keydown", (event) => {
    const at = buttons.indexOf(event.target);
    if (at < 0) return;
    const target =
      event.key === "ArrowRight"
        ? (at + 1) % buttons.length
        : event.key === "ArrowLeft"
          ? (at + buttons.length - 1) % buttons.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : -1;
    if (target >= 0) {
      event.preventDefault();
      select(buttons[target].dataset.chapter);
      buttons[target].focus();
    }
  });
  if (footer) {
    footer.classList.add("chapter-toolbar");
    root.classList.add("with-chapter-toolbar");
  }
  for (const grid of main.querySelectorAll(".pref-counties")) {
    const cards = [...grid.querySelectorAll(":scope > .district-card")];
    if (cards.length < 2) continue;
    grid.classList.add("county-fold-grid");
    const folds = [];
    for (const card of cards) {
      const name = card.querySelector("h3")?.textContent || "县情";
      const stats = [...card.querySelectorAll(".district-stats > div")]
        .map((el) => el.textContent.trim())
        .join(" · ");
      const detail = document.createElement("details");
      detail.className = "county-fold";
      const summary = document.createElement("summary");
      const heading = document.createElement("b");
      heading.textContent = name;
      const values = document.createElement("span");
      values.textContent = stats;
      summary.append(heading, values);
      detail.append(summary);
      const body = document.createElement("div");
      body.className = "county-fold-body";
      while (card.firstChild) body.append(card.firstChild);
      detail.append(body);
      card.append(detail);
      folds.push({ name, detail });
    }
    const selected = countySelections.get(key) || folds[0].name;
    for (const fold of folds) {
      fold.detail.open = fold.name === selected;
      fold.detail.addEventListener("toggle", () => {
        if (fold.detail.open) {
          countySelections.set(key, fold.name);
          for (const other of folds)
            if (other !== fold) other.detail.open = false;
        }
      });
    }
  }
  select(selections.get(key) || "overview");
}
