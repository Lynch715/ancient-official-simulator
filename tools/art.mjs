import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const paths = {
  court: "M3 21h18M5 21V9h14v12M3 9l9-6 9 6M8 13h8M8 17h8",
  map: "M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16",
  cases: "M6 3h13v18H6a3 3 0 010-6h13M6 3a3 3 0 00-3 3v12M9 7h6M9 11h6",
  career: "M3 21v-5h6v-5h6V6h6M16 3h5v5",
  treasury: "M3 8l9-5 9 5M5 8v13h14V8M9 21v-9h6v9",
  staff: "M5 3h14v18H5zM9 7h6M9 12h6M9 17h6",
  silver: "M3 9l4 2 5-2 5 2 4-2-3 10H6zM7 5c2 2 8 2 10 0",
  grain: "M9 3h6l-1 4 5 6v6c0 3-14 3-14 0v-6l5-6zM9 7h6M12 11v7M9 14l3 2 3-2",
  livelihood: "M3 11l9-8 9 8M5 10v11h14V10M9 21v-7h6v7",
  economy:
    "M12 21V4M12 8c-5 0-7-2-7-5 5 0 7 2 7 5zM12 14c5 0 7-2 7-5-5 0-7 2-7 5z",
  order: "M12 3l8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6zM8 12l3 3 5-6",
  integrity: "M6 3h12v13H6zM4 21h16M9 7h6M9 11h6",
  time: "M12 3a9 9 0 110 18 9 9 0 010-18M12 6v6l4 2",
  action: "M5 19l2-7L17 2l5 5-10 10zM7 12l5 5M3 22l4-3",
  build: "M4 20L16 8M13 4l3-2 6 6-2 3-4-3M4 4l16 16M3 3l4 1-3 3z",
  farm: "M3 20h18M6 20l5-15M5 8l13 4M16 4l-3 17",
  trade: "M3 8h18l-2-5H5zM5 8v13h14V8M9 21v-7h6v7",
  inspect: "M15 4H4v16h12M8 8h4M8 12h3M17 11a4 4 0 110 8 4 4 0 010-8M20 18l3 4",
  judge: "M4 7h13v5H4zM8 12l7 9M3 21h18M17 9h4",
  relief: "M3 12h18c-1 6-4 8-9 8s-8-2-9-8zM9 3v5M15 3v5",
  dispatch: "M3 7h17l-4-4M21 17H4l4 4",
  report: "M5 3h11l4 4v14H5zM15 3v5h5M8 12h8M8 16h6",
  save: "M4 3h16v18H4zM8 3v6h8V3M8 21v-7h8v7",
  load: "M4 5h6l2 3h9v12H3V8M12 10v7M9 14l3 3 3-3",
  settings:
    "M12 8a4 4 0 110 8 4 4 0 010-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  close: "M5 5l14 14M19 5L5 19",
  back: "M20 12H4M10 5l-7 7 7 7",
  chevron_right: "M9 5l7 7-7 7",
  confirm: "M4 12l5 5L20 5",
  warning: "M12 3l10 18H2zM12 9v5M12 17v1",
  info: "M12 3a9 9 0 110 18 9 9 0 010-18M12 7v1M12 11v6",
  personnel: "M12 3a4 4 0 110 8 4 4 0 010-8M4 21v-3c0-6 16-6 16 0v3",
};
fs.mkdirSync("assets/art/icons", { recursive: true });
fs.mkdirSync("art/source/icons", { recursive: true });
fs.mkdirSync("assets/art/placeholders", { recursive: true });
let symbols = [];
for (const [id, d] of Object.entries(paths)) {
  const inner = `<path d="${d}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  fs.writeFileSync(`assets/art/icons/icon_${id}.svg`, svg);
  fs.writeFileSync(`art/source/icons/icon_${id}.svg`, svg);
  symbols.push(`<symbol id="${id}" viewBox="0 0 24 24">${inner}</symbol>`);
}
fs.writeFileSync(
  "assets/art/icons/sprite.svg",
  `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join("")}</svg>`,
);
const ph = {
  scene:
    '<path d="M0 230L160 90l190 150 180-180L800 245v155H0z" fill="#d7d8c3"/><path d="M0 280q210-100 420 0t380-30v150H0" fill="#b5c1b4"/>',
  person:
    '<circle cx="200" cy="135" r="60" fill="#c3c2ad"/><path d="M70 540l30-260q100-100 200 0l30 260z" fill="#c3c2ad"/>',
  avatar:
    '<circle cx="100" cy="70" r="36" fill="#c3c2ad"/><path d="M30 190v-30q0-70 70-70t70 70v30" fill="#c3c2ad"/>',
};
for (const [id, body] of Object.entries(ph))
  fs.writeFileSync(
    `assets/art/placeholders/${id}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${id === "scene" ? "0 0 800 400" : id === "person" ? "0 0 400 600" : "0 0 200 200"}"><rect width="100%" height="100%" fill="#eee7d8"/>${body}</svg>`,
  );
const plan = JSON.parse(fs.readFileSync("art/asset-manifest.plan.json"));
const qa = [
  ...JSON.parse(fs.readFileSync("art/qa/scenes.json")).assets,
  ...JSON.parse(fs.readFileSync("art/qa/characters.json")).assets,
];
const extension = fs.existsSync("art/asset-manifest.v0.8.json")
  ? JSON.parse(fs.readFileSync("art/asset-manifest.v0.8.json"))
  : { assets: [] };
const manifest = { schemaVersion: 1, version: "v0.8-20261012", assets: {} };
for (const a of [...plan.assets, ...extension.assets]) {
  const q = qa.find((x) => x.id === a.id);
  const vars = a.runtimeVariants.map((v) => ({
    ...v,
    bytes: fs.statSync(v.path).size,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(v.path))
      .digest("hex"),
  }));
  manifest.assets[a.id] = {
    ...a,
    status: a.status === "integrated" ? "integrated" : "reviewed",
    runtimeVariants: vars,
    visualState: q?.visualState || a.visualState,
    reference: q?.source?.path || q?.sourcePath || a.sourcePath,
  };
}
fs.writeFileSync("assets/art/manifest.json", JSON.stringify(manifest, null, 2));
console.log(
  `${Object.keys(paths).length} SVG图标与${Object.keys(manifest.assets).length}项资源清单已就绪。`,
);
