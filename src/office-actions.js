export function handleOfficeAction(action, button, context) {
  const {
    run,
    showModal,
    save,
    checkOffline,
    applyOfflineUpdate,
    installOffline,
    query: $,
    getModal,
  } = context;
  const b = button,
    id = b.dataset.id,
    modal = getModal();
  switch (action) {
    case "ac-case-clue":
      run("ac_case_clue", { case: id, clue: b.dataset.clue });
      break;
    case "ac-case-handover":
      run("ac_case_handover", { case: id });
      break;
    case "ac-begin":
      run("ac_begin");
      break;
    case "ac-work":
      run("ac_work", { topic: b.dataset.topic });
      break;
    case "ac-disaster":
      run("ac_disaster");
      break;
    case "ac-reply":
      run("ac_reply", { reply: b.dataset.reply });
      break;
    case "ac-repay":
      run("ac_repay");
      break;
    case "ac-appeal":
      run("ac_appeal");
      break;
    case "ac-risk":
      showModal({ type: "ac-risk", kind: b.dataset.kind });
      break;
    case "ac-confirm-risk":
      run("ac_crime", { kind: modal.kind, confirmed: true });
      break;
    case "ac-next":
      showModal({ type: "ac-next" });
      break;
    case "ac-confirm-next":
      run("ac_advance");
      break;
    case "zf-appointment":
      showModal({ type: "zf-appointment" });
      break;
    case "zf-appoint":
      run("zf_appoint");
      break;
    case "zf-next":
      showModal({ type: "zf-next" });
      break;
    case "zf-confirm-next":
      run("zf_advance");
      break;
    case "zf-task":
      run("zf_task", { county: id, kind: b.dataset.kind });
      break;
    case "zf-audit":
      run("zf_audit", { idTask: Number(b.dataset.task) });
      break;
    case "zf-official":
      run("zf_official", { county: id, action: b.dataset.action });
      break;
    case "zf-project":
      run("zf_project", { project: id, action: b.dataset.action });
      break;
    case "zf-clue":
      run("zf_case", { case: id, action: "clue", clue: b.dataset.clue });
      break;
    case "zf-case":
      run("zf_case", { case: id, action: b.dataset.action });
      break;
    case "zf-supply":
      run("zf_supply");
      break;
    case "zf-event":
      run("zf_event", { choice: b.dataset.choice });
      break;
    case "tz-appointment":
      showModal({ type: "tz-appointment" });
      break;
    case "tz-appoint":
      run("tz_appoint");
      break;
    case "tz-project":
      if (b.dataset.action === "accept-fast")
        showModal({ type: "tz-fast", project: id });
      else run("tz_project", { project: id, action: b.dataset.action });
      break;
    case "tz-confirm-fast":
      run("tz_project", { project: modal.project, action: "accept-fast" });
      break;
    case "tz-event":
      run("tz_event", { choice: b.dataset.choice });
      break;
    case "tz-prepare":
      run("tz_prepare", { county: id });
      break;
    case "tz-settle":
      run("tz_settle", { county: id });
      break;
    case "tz-supply":
      run("tz_supply", { kind: b.dataset.kind });
      break;
    case "tz-maintenance":
      run("tz_maintenance", { enabled: b.dataset.enabled === "true" });
      break;
    case "tz-next":
      showModal({ type: "tz-next" });
      break;
    case "tz-confirm-next":
      run("tz_advance");
      break;
    case "appointment-open":
      showModal({ type: "appointment" });
      break;
    case "appointment-confirm":
      run("appointment");
      break;
    case "pref-event":
      run("pref_event", { choice: b.dataset.choice });
      break;
    case "pref-audit":
      run("pref_audit", { county: id });
      break;
    case "pref-rectify":
      run("pref_rectify", { county: id });
      break;
    case "pref-repair":
      run("pref_repair");
      break;
    case "pref-next":
      showModal({ type: "pref-next" });
      break;
    case "pref-confirm-next":
      run("pref_advance");
      break;
    case "pref-plan":
      showModal({
        type: "pref-plan",
        from: $("#pref-from").value,
        to: $("#pref-to").value,
        amount: Number($("#pref-amount").value),
        route: $("#pref-route").value,
      });
      break;
    case "pref-send":
      run("pref_transfer", {
        from: modal.from,
        to: modal.to,
        amount: modal.amount,
        route: modal.route,
      });
      break;
    case "offline-check":
      checkOffline();
      break;
    case "offline-update":
      applyOfflineUpdate(() => save());
      break;
    case "offline-install":
      installOffline();
      break;
    default:
      return false;
  }
  return true;
}
