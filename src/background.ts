/**
 * A Manifest V3 action popup is closed by the browser the moment it loses
 * focus — switching tabs, or even clicking the page to check a field, dismisses
 * it. That is browser behaviour and cannot be overridden from the extension.
 *
 * The side panel is the supported way to keep the UI open while you work: it is
 * docked to the window rather than anchored to the toolbar button, so it
 * survives tab switches and page interaction. Filling out an application means
 * looking back and forth between the form and your saved answers, so this is
 * the right surface for it.
 */
chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: unknown) => {
      console.error("[QuickApply] could not enable side panel:", err);
    });
});

/*
 * onInstalled only fires on install and update, so set it on every worker start
 * too — otherwise the behaviour is lost whenever the service worker is
 * recycled and never re-installed.
 */
void chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {
    /* Older Chrome without sidePanel support: the action popup still works. */
  });
