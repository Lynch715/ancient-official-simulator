// The current session remains playable if browser storage is unavailable.
export function persistState(storage, key, state) {
  try {
    const old = storage.getItem(key);
    try {
      if (old) storage.setItem(key + "-backup", old);
    } catch {}
    storage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function restoreMessage(saved) {
  return saved
    ? "履历已载入并存入此浏览器。"
    : "履历已载入当前会话，但未能存档。请立即导出备份，刷新会丢失本次恢复。";
}
