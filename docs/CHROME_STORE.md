# Chrome Web Store submission cheat sheet

Everything paste-ready for the Chrome Web Store Developer Dashboard
listing for Element Identifier. Keep this file in sync with `manifest.json`
and `PRIVACY.md` if any of them change.

## Build the upload artifact

```bash
npm run package
```

Produces `dist/element-identifier-v<version>.zip` containing only the
runtime files Chrome loads. Smoke-test by loading the unzipped contents
as an unpacked extension before uploading.

---

## Listing copy

### Short description (132 char max)

> Click any element, get a `[data-ei-id="…"]` selector copied to your clipboard. Built for handing selectors to AI agents.

(131 chars. Keep it tight; the store truncates aggressively.)

### Detailed description

```
Element Identifier is a tiny Chrome extension that lets you click any
element on any page and get a stable, copy-pasteable CSS selector for it.

It was built for one specific workflow: you're working with an AI coding
agent (Cursor, Claude Code, GitHub Copilot, etc.) that has access to a
Chrome MCP / DevTools integration, and you want to point it at a specific
element on a live page. Telling the agent "the third button under the
nav" is fragile. Telling it `[data-ei-id="button-a3f9b2c1"]` is not.

How it works:

1. Click the toolbar icon to enter selecting mode.
2. Hover the page — the element under your cursor is outlined.
3. Click an element — a tooltip appears with an auto-generated value
   like "button-a3f9b2c1" (or the existing data-ei-id if one is present).
4. Press Enter to commit. The extension writes a data-ei-id attribute
   on the element and copies the full selector
   `[data-ei-id="button-a3f9b2c1"]` to your clipboard.
5. Paste the selector into your AI agent chat. The agent can now use
   `document.querySelector(...)` to act on the element you pointed at.

Why data-ei-id and not id?

The extension deliberately never writes to the page's real `id`
attribute. Setting `id` on an arbitrary element risks colliding with
CSS rules (`#hero { display: none }`), form `<label for="…">`
associations, URL fragment scrolling, and the page's own
`getElementById` calls. Writing a namespaced `data-ei-id` attribute
sidesteps all of that and still produces a first-class CSS selector
that works anywhere a `#id` selector does.

What it does NOT do:

- No network requests. No analytics. No telemetry.
- No storage. Nothing persists across page reloads.
- No data ever leaves your machine.
- The page's real `id` attribute is read for display, never written.

Source code, issues, and PRs:
https://github.com/DoWhileGeek/element-identifier
```

### Category

Developer Tools

### Language

English (English (United States) is fine)

---

## Permission justifications

You will be asked to justify each permission in the dashboard. Paste-
ready answers:

### `activeTab`

> Required to read and modify the DOM of the page the user is currently
> viewing — but only after the user explicitly clicks the toolbar icon
> to enter selecting mode. No page is touched without user intent.

### `scripting`

> Required as a fallback to inject the content script into tabs that
> were open before the extension was installed. The content script is
> normally injected via the manifest's `content_scripts` entry, but
> pre-existing tabs need on-demand injection via `chrome.scripting`.

### `clipboardWrite`

> Required to copy the generated CSS selector (e.g.
> `[data-ei-id="button-a3f9b2c1"]`) to the user's clipboard at the
> moment they press Enter to commit a tag. This is the entire output
> of the extension; without clipboard write, the user would have to
> manually retype the selector.

### Host permission `<all_urls>`

> The extension is a generic DOM element picker. The user must be able
> to invoke it on any page they choose — there is no meaningful subset
> of URLs to scope it to in advance. The extension does not run
> automatically on any page; it only activates after the user
> explicitly clicks the toolbar icon. No page content is read,
> modified, or transmitted without that explicit user action.

---

## Single-purpose statement

> Tag a DOM element with a unique `data-ei-id` attribute and copy a CSS
> selector for it to the clipboard.

---

## Privacy practices disclosure (dashboard checkboxes)

For each "Data collection" category in the dashboard, the honest answer
is "We don't collect this." Specifically:

- Personally identifiable information: **No**
- Health information: **No**
- Financial and payment information: **No**
- Authentication information: **No**
- Personal communications: **No**
- Location: **No**
- Web history: **No**
- User activity: **No**
- Website content: **No** (we read the DOM the user clicks on, but
  nothing leaves the machine — see PRIVACY.md)

Compliance certifications:

- [x] I do not sell or transfer user data to third parties, outside of
      the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated
      to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness
      or for lending purposes.

### Privacy policy URL

Use the raw URL of `PRIVACY.md` on GitHub:

```
https://github.com/DoWhileGeek/element-identifier/blob/main/PRIVACY.md
```

(Or, if you prefer a rendered page, the same path without `blob/main/`
also works once the repo is public.)

---

## Distribution

**Recommendation: submit as Unlisted for the first version.**

- Unlisted = installable via direct link, no public search listing,
  lighter review path.
- Public = listed and searchable, full identity verification, slower
  initial review.

You can flip Unlisted → Public later from the dashboard without
re-submitting the extension itself.

---

## What's NOT in this repo and you still need to do

1. **Pay the $5 one-time developer registration fee** at
   <https://chrome.google.com/webstore/devconsole>.
2. **Complete identity verification** if prompted by Google. For a
   public listing this usually requires a phone number and (sometimes)
   a payment-method check.
3. **Take 1–5 screenshots at 1280×800 or 640×400.**
   Open the extension on a real page, capture the highlight + tooltip
   in action. Two or three is plenty. macOS: ⌘+⇧+4, drag the region.
4. **(Optional) Small promo tile at 440×280** — improves the chance of
   being featured. Skip for first submission unless you're feeling it.
5. **Upload `dist/element-identifier-v<version>.zip`** to the dashboard,
   paste this file's contents into the matching dashboard fields, and
   submit.

Review typically clears in 24–72 hours for an extension this small and
well-scoped.

---

## Updating after the initial publish

1. Bump `manifest.json`'s `version` (e.g. `1.0.0` → `1.0.1`).
2. Bump `package.json`'s `version` to match (keep them in sync — only
   `manifest.json` is what Chrome reads, but matching avoids confusion).
3. `npm run package` → produces a new versioned zip.
4. Upload to the dashboard's "Package" tab → submit for review.
