// Toolbar click toggles selecting mode in the active tab.
// The content script is registered via manifest.json on <all_urls>, but it
// won't be present on chrome:// pages or the Chrome Web Store. We fall back
// to chrome.scripting.executeScript in case the content script never loaded
// (e.g. the tab was open before the extension was installed).

const TOGGLE_MESSAGE = { type: "ELEMENT_IDENTIFIER_TOGGLE" };

// --- Icon rasterization ---
// Chrome MV3 doesn't accept SVG for the action icon, but we want one canonical
// vector source. So we ship icons/icon.svg, rasterize it here, and hand the
// resulting ImageData to chrome.action.setIcon. The static PNGs referenced by
// manifest.json remain in place for surfaces we can't override at runtime
// (chrome://extensions, context menus, etc.).
const ICON_SIZES = [16, 32, 48, 128];

async function setIconFromSvg() {
  try {
    const url = chrome.runtime.getURL("icons/icon.svg");
    const resp = await fetch(url);
    const svgText = await resp.text();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const imageData = {};
    for (const size of ICON_SIZES) {
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: "high",
      });
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, size, size);
      bitmap.close();
      imageData[size] = ctx.getImageData(0, 0, size, size);
    }
    await chrome.action.setIcon({ imageData });
  } catch (err) {
    console.warn("[ElementIdentifier] icon rasterization failed:", err);
  }
}

chrome.runtime.onInstalled.addListener(setIconFromSvg);
chrome.runtime.onStartup.addListener(setIconFromSvg);
// MV3 service workers spin up frequently; re-rasterizing on every spin-up is
// cheap and ensures the toolbar matches the SVG after edits + reloads.
setIconFromSvg();

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "ELEMENT_IDENTIFIER_PING" });
    return true;
  } catch (_err) {
    // No receiver — try to inject on demand.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      return true;
    } catch (injectErr) {
      console.warn("[ElementIdentifier] cannot inject into this tab:", injectErr);
      return false;
    }
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  const ok = await ensureContentScript(tab.id);
  if (!ok) return;
  try {
    await chrome.tabs.sendMessage(tab.id, TOGGLE_MESSAGE);
  } catch (err) {
    console.warn("[ElementIdentifier] toggle failed:", err);
  }
});
