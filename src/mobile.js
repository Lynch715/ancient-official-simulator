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
  lockZoom();
  window.visualViewport?.addEventListener("resize", fit);
  window.visualViewport?.addEventListener("scroll", fit);
  window.addEventListener("resize", fit);
}

// 游戏界面不需要缩放：禁止双指缩放与双击放大。
// iOS Safari 不理会 user-scalable=no，需拦截其手势事件与多指滑动。
function lockZoom() {
  const stop = (e) => e.preventDefault();
  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    document.addEventListener(type, stop, { passive: false });
  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 1 || (e.scale !== undefined && e.scale !== 1))
        e.preventDefault();
    },
    { passive: false },
  );
  // 双击放大由样式 touch-action 关闭，不拦截点击，免得快速连点被吞。
}
