import { browser } from 'wxt/browser';

export default defineBackground(() => {
  if (browser.sidePanel === undefined) {
    return;
  }

  void browser.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
});
