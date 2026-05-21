# Privacy Policy — Element Identifier

_Last updated: 2026-05-20_

## What Element Identifier does with your data

**Nothing.** Element Identifier is a Chrome extension that runs entirely on
your local machine, inside Chrome, on pages you explicitly invoke it on. It
does not collect, store, transmit, sell, share, or otherwise process any
personal data.

Specifically:

- **No network requests.** The extension makes no outbound HTTP calls, no
  analytics calls, no telemetry, no error reporting.
- **No storage.** The extension does not use `chrome.storage`, `localStorage`,
  `sessionStorage`, IndexedDB, cookies, or any other persistent storage.
- **No data leaves your machine.** Anything you do with the extension — the
  elements you tag, the values you type, the selectors that land on your
  clipboard — stays on the device running Chrome.

## What it _does_ touch

- **The DOM of the page you invoke it on**, but only while you have it in
  selecting mode after explicitly clicking the toolbar icon. It reads the
  element you click on, adds a `data-ei-id` attribute to it, and reads the
  element's tag name + class + existing `id` to display in the tooltip.
- **Your clipboard**, but only at the exact moment you press Enter to commit
  a tag. It writes the generated CSS selector and nothing else.

## Permissions, and why

- `activeTab` — to interact with the page you're currently viewing after you
  click the toolbar icon.
- `scripting` — to inject the content script into tabs that pre-date the
  extension's installation.
- `clipboardWrite` — to copy the generated selector to your clipboard when
  you commit a tag.
- `<all_urls>` host permission — the extension is a generic element picker
  and the user expects it to work on any page they choose to invoke it on.
  It does not run automatically; it only activates after an explicit toolbar
  click.

## Contact

Questions or concerns: open an issue at
<https://github.com/DoWhileGeek/element-identifier/issues>.
