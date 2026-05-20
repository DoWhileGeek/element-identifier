# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension (no build step, no dependencies, no test suite) that lets users click any element on a page to tag it with a unique `data-ei-id` attribute, then copies a ready-to-paste `[data-ei-id="…"]` selector to the clipboard. Primary use case: handing selectors to AI coding agents (Cursor, Claude Code, etc.) over a Chrome MCP so they can act on the element the user is pointing at. Three source files: `manifest.json`, `background.js` (service worker), `content.js` (injected on every page).

## Development workflow

There is nothing to build, lint, or test. Iterating means:

1. Edit the source files directly.
2. Reload the extension: `chrome://extensions` → reload icon on the Element Identifier card.
3. Reload the target page (content scripts only re-inject on navigation; tabs open before reload still run the old script unless `background.js`'s `executeScript` fallback kicks in).

To install for the first time, see README.md (`Load unpacked` from this directory).

## Architecture

### Toggle flow
Toolbar click → `chrome.action.onClicked` in `background.js` → `ensureContentScript(tabId)` pings the tab; if the ping fails (e.g. tab pre-dates install, or content script hasn't loaded yet), `chrome.scripting.executeScript` injects `content.js` on demand → sends `ELEMENT_IDENTIFIER_TOGGLE` message → `content.js` flips `selecting` state.

The content script is **idempotent** via the `window.__elementIdentifierInstalled` guard — both the manifest-driven injection and the `executeScript` fallback can run without duplicating handlers.

### Why Shadow DOM
`content.js` mounts a single host element with `attachShadow({ mode: "open" })`. The highlight box and tooltip live inside the shadow root so page CSS cannot leak in and break the UI. The host itself has `pointer-events: none` and zero dimensions — only the tooltip re-enables pointer events for its own input. `isOurNode()` uses `getRootNode()` to identify our nodes during event capture.

### Event capture is load-bearing
All page event listeners (`mousemove`, `click`, `mousedown`, `mouseup`, `keydown`) are registered with `useCapture: true` and call `stopImmediatePropagation()` so clicks on links/buttons in selecting mode don't navigate or trigger page handlers. Input events on the tooltip also `stopPropagation()` so site keyboard shortcuts don't fire while typing. If you add new listeners, follow this pattern.

### Generated value format
`<tag>-<8 hex chars>` from `crypto.getRandomValues`. Collision is checked against the live DOM via `document.querySelector('[data-ei-id="…"]')` with up to 8 re-rolls, then a 16-char fallback. The tag prefix exists for self-documentation (so `[data-ei-id^="button-"]` finds everything you tagged on buttons) and to provide visible context in the markup.

### Why `data-ei-id` and not `id`
The extension deliberately never writes to the page's real `id` attribute — that would risk colliding with CSS rules (`#hero { display: none }`), `<label for="…">` associations, URL fragment scrolling, and the page's own `getElementById` calls. The `data-ei-id` attribute name is namespaced (`ei` = element identifier) to dodge widely-used `data-id` / `data-testid` / `data-eid` (Adobe Analytics) etc. The single source of truth is the `EI_ATTR` constant near the top of `content.js`.

### Icon rasterization
Chrome MV3 doesn't accept SVG for `chrome.action`. `background.js` reads `icons/icon.svg`, rasterizes it at 16/32/48/128 px via `createImageBitmap` + `OffscreenCanvas`, and calls `chrome.action.setIcon` on install/startup/every service-worker spin-up. The static PNGs in `icons/` are still needed for surfaces `setIcon` can't reach (`chrome://extensions`, context menus) — regenerate them from `icon.svg` if you make significant design changes.

### Scope limits (intentional, see README.md)
- `all_frames: false` — top-level frame only.
- Permissions are minimal: `activeTab`, `scripting`, `clipboardWrite`. Adding capabilities should go through host_permissions / action permissions deliberately.
- Edits live in the page DOM only; no persistence. Reload = re-tag.
- Page's own `id` attribute is read (to show in the tooltip's element descriptor) but never written.
