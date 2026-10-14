// Keep dialogs inside the visible area when browser chrome or a soft keyboard moves.
export function startMobile() {
  const fit = () => {
    const v = window.visualViewport,
      root = document.documentElement;
    root.style.setProperty(
      "--visible-height",
      `${v?.height || window.innerHeight}px`,
    );
    root.style.setProperty("--visible-top", `${v?.offsetTop || 0}px`);
  };
  fit();
  window.visualViewport?.addEventListener("resize", fit);
  window.visualViewport?.addEventListener("scroll", fit);
  window.addEventListener("resize", fit);
}
