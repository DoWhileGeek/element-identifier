<p align="center">
  <img src="icons/icon128.png" alt="Element Identifier" width="128" height="128">
</p>

# Element Identifier

A tiny Chrome extension for tagging any element on a page with a stable `data-ei-id` attribute, then copying a ready-to-use `[data-ei-id="…"]` selector to your clipboard. Built for handing selectors to AI coding agents (Cursor, Claude Code, etc.) over a Chrome MCP so they can act on the element you're pointing at.

- Click the toolbar icon to enter **selecting mode**.
- Hover anything on the page — the element under your cursor is outlined.
- Click an element — a tooltip pops up. If the element already carries a `data-ei-id` it's shown; otherwise a unique value of the form `<tag>-<8 hex chars>` (e.g. `button-a3f9b2c1`) is auto-generated and collision-checked against any existing `data-ei-id` on the page.
- Press <kbd>Enter</kbd> to accept the suggestion, or type to override it first. The `data-ei-id` attribute is written onto the element, the full selector (e.g. `[data-ei-id="button-a3f9b2c1"]`) is copied to your clipboard, and selecting mode exits automatically.
- <kbd>Esc</kbd> cancels the tooltip without committing and keeps you in selecting mode so you can pick another element; a second <kbd>Esc</kbd> exits selecting mode.
- Click the toolbar icon again to exit selecting mode.

Leaving the input blank and pressing <kbd>Enter</kbd> removes the `data-ei-id` attribute entirely. Values cannot contain whitespace, `"`, or `\` — the tooltip will tell you if your input is invalid.

## Why `data-ei-id` and not `id`?

The extension deliberately never touches the page's real `id` attribute. Setting `id` on an arbitrary element is risky — page CSS may target specific ids (`#hero { display: none }`), form labels (`<label for="…">`) depend on them, URL fragments scroll to them, and the page's own JavaScript may call `getElementById`. Writing to a namespaced `data-ei-id` attribute sidesteps all of that while still producing a first-class CSS attribute selector that works anywhere a `#id` selector does.

The "ei" prefix is short for "element identifier" (the extension name) and is namespaced to dodge collisions with widely-used `data-id` / `data-testid` / etc. that pages and frameworks already use.

## Install (developer mode)

1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and pick this folder (`element-identifier`).
4. Pin the extension from the puzzle-piece menu so the toolbar icon is always visible.

To reload after edits: click the circular reload icon on the extension card in `chrome://extensions`.

## How it works

- `manifest.json` — Manifest V3 declaration. Requests `activeTab` + `scripting` + `clipboardWrite` and runs `content.js` on all URLs.
- `background.js` — Service worker. On toolbar click it pings the active tab; if the content script isn't there yet (e.g. tab pre-dates the install) it injects it on demand, then sends a `TOGGLE` message. Also rasterizes `icons/icon.svg` at 16/32/48/128 px on install/startup and calls `chrome.action.setIcon` so the toolbar icon stays crisp at any DPI.
- `content.js` — Injects a Shadow-DOM-isolated overlay so page CSS can never leak into the highlight box or the tooltip. While selecting mode is active it captures mouse + key events in the capture phase so it can swallow clicks on links and buttons before the page sees them.
- `icons/icon.svg` — Canonical vector source for the toolbar icon. Edit this file to change the design; the service worker handles rasterization. The PNGs alongside it are still used by `chrome://extensions` and other surfaces that `chrome.action.setIcon` doesn't reach — regenerate them from the SVG if you make significant design changes.

## Limitations

- Chrome blocks extension scripts from running on certain pages (`chrome://`, the Chrome Web Store, the New Tab page on some Chrome builds). The extension will quietly do nothing on those tabs.
- The extension only operates in the top-level frame (`all_frames: false` in the manifest). If you need to tag elements inside iframes, flip that to `true`.
- Edits live in the page DOM only — they don't survive a reload (the page's own HTML/JS is untouched). For agent workflows this is usually fine; re-tag if you reload.

## File layout

```
element-identifier/
├── manifest.json
├── background.js
├── content.js
├── icons/
│   ├── icon.svg        # canonical vector source, rasterized at runtime
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```
