// Element Identifier - content script
// Injected on every page. Listens for toggle messages from the background
// service worker. While "selecting mode" is active:
//   - Hovered element gets a highlight overlay.
//   - Clicking an element opens a tooltip prefilled with the element's
//     existing data-ei-id value (or a freshly generated one).
//   - Enter commits the value as a `data-ei-id` attribute (deliberately not
//     touching the element's real `id`, so page CSS / accessibility / URL
//     fragments are unaffected), copies `[data-ei-id="value"]` to the clipboard,
//     and exits selecting mode.
//   - Escape cancels and keeps you in selecting mode.

(() => {
  // Idempotent install: if this script is injected more than once (e.g. once
  // by the manifest and again by background.js's executeScript fallback), keep
  // the first instance and bail out.
  if (window.__elementIdentifierInstalled) return;
  window.__elementIdentifierInstalled = true;

  const HOST_ID = "__element_identifier_host__";
  // Single source of truth: which attribute we read, write, and build selectors
  // around. Namespaced to this extension ("ei" = element identifier) to dodge
  // pages that already use `data-id` for their own purposes.
  const EI_ATTR = "data-ei-id";

  let selecting = false;
  let hoveredEl = null;
  let pinnedEl = null; // element whose tooltip is currently open

  // --- UI: Shadow-DOM-isolated host so page CSS can't bleed in ---
  const host = document.createElement("div");
  host.id = HOST_ID;
  // Make sure the host itself never intercepts events except where we want it.
  host.style.cssText = `
    position: fixed;
    inset: 0;
    width: 0;
    height: 0;
    pointer-events: none;
    z-index: 2147483647;
  `;
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host, * { box-sizing: border-box; }
      .highlight {
        position: fixed;
        pointer-events: none;
        border: 2px solid #4f8cff;
        background: rgba(79, 140, 255, 0.15);
        border-radius: 2px;
        transition: all 60ms ease-out;
        display: none;
        z-index: 1;
      }
      .tooltip {
        position: fixed;
        pointer-events: auto;
        background: #1f2330;
        color: #f4f6fb;
        border: 1px solid #3b4252;
        border-radius: 8px;
        padding: 10px 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: none;
        min-width: 240px;
        max-width: 360px;
        z-index: 2;
      }
      .tooltip .label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #9aa4bf;
        margin-bottom: 6px;
      }
      .tooltip .tag {
        color: #9aa4bf;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        margin-bottom: 6px;
        word-break: break-all;
      }
      .tooltip .row {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #11141c;
        border: 1px solid #3b4252;
        border-radius: 6px;
        padding: 4px 8px;
      }
      .tooltip .row:focus-within {
        border-color: #4f8cff;
        box-shadow: 0 0 0 2px rgba(79, 140, 255, 0.25);
      }
      .tooltip input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #f4f6fb;
        font: inherit;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 14px;
        padding: 4px 0;
        min-width: 0;
      }
      .tooltip .hint {
        margin-top: 8px;
        font-size: 11px;
        color: #6b7691;
      }
      .tooltip .status {
        margin-top: 6px;
        font-size: 11px;
        color: #ff8b8b;
        min-height: 14px;
      }
      .tooltip .status.ok { color: #6bd49a; }
      .tooltip .status.info { color: #9aa4bf; }
    </style>
    <div class="highlight" part="highlight"></div>
    <div class="tooltip" part="tooltip" role="dialog" aria-label="Edit element data-ei-id attribute">
      <div class="label">data-ei-id attribute</div>
      <div class="tag"></div>
      <div class="row">
        <input type="text" spellcheck="false" autocomplete="off" placeholder="value"/>
      </div>
      <div class="status"></div>
      <div class="hint">Press <b>Enter</b> to save · <b>Esc</b> to cancel</div>
    </div>
  `;

  const highlightEl = shadow.querySelector(".highlight");
  const tooltipEl = shadow.querySelector(".tooltip");
  const tagEl = shadow.querySelector(".tag");
  const inputEl = shadow.querySelector("input");
  const statusEl = shadow.querySelector(".status");

  // Attach host as late as possible so we never insert it before <body> exists.
  function mountHost() {
    if (host.isConnected) return;
    const root = document.body || document.documentElement;
    root.appendChild(host);
  }

  // --- Helpers ---
  function isOurNode(node) {
    // Anything inside our host (including shadow DOM ancestor) belongs to us.
    if (!node) return false;
    if (node === host) return true;
    // Walk composed path via getRootNode in case nested.
    const root = node.getRootNode && node.getRootNode();
    return root === shadow;
  }

  function describe(el) {
    if (!el || el.nodeType !== 1) return "";
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    const cls = (el.getAttribute("class") || "").trim();
    if (cls) s += "." + cls.split(/\s+/).slice(0, 3).join(".");
    return s;
  }

  // --- Auto value generation ---
  // Random hex string of the requested length, drawn from a CSPRNG.
  function randomHex(len) {
    const bytes = new Uint8Array(Math.ceil(len / 2));
    crypto.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += b.toString(16).padStart(2, "0");
    return out.slice(0, len);
  }

  // `${tag}-${8 hex chars}`. Tag prefix is for self-documentation ("what kind
  // of element was this?") and makes a `[data-ei-id^="button-"]` filter useful.
  // The hex suffix is collision-checked against any element already carrying
  // the same data-ei-id value and re-rolled on the (vanishingly rare) hit.
  function generateValue(el) {
    if (!el || el.nodeType !== 1) return "";
    const tag = el.tagName.toLowerCase();
    for (let i = 0; i < 8; i++) {
      const candidate = `${tag}-${randomHex(8)}`;
      if (!document.querySelector(`[${EI_ATTR}="${candidate}"]`)) return candidate;
    }
    // Astronomically improbable fallback: widen the hash if we keep colliding.
    return `${tag}-${randomHex(16)}`;
  }

  function positionHighlight(el) {
    if (!el) {
      highlightEl.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    highlightEl.style.display = "block";
    highlightEl.style.left = `${r.left}px`;
    highlightEl.style.top = `${r.top}px`;
    highlightEl.style.width = `${r.width}px`;
    highlightEl.style.height = `${r.height}px`;
  }

  function positionTooltip(el) {
    if (!el) return;
    // First render to measure.
    tooltipEl.style.display = "block";
    tooltipEl.style.left = "0px";
    tooltipEl.style.top = "0px";
    const r = el.getBoundingClientRect();
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let left = r.left;
    let top = r.bottom + margin;
    if (top + th > vh - margin) {
      // Not enough room below; try above.
      top = r.top - th - margin;
      if (top < margin) {
        // Clamp inside viewport, overlapping is fine.
        top = Math.max(margin, vh - th - margin);
      }
    }
    if (left + tw > vw - margin) left = vw - tw - margin;
    if (left < margin) left = margin;

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function setStatus(msg, kind = "error") {
    statusEl.textContent = msg || "";
    statusEl.classList.remove("ok", "info");
    if (msg && kind === "ok") statusEl.classList.add("ok");
    else if (msg && kind === "info") statusEl.classList.add("info");
  }

  function hideTooltip() {
    tooltipEl.style.display = "none";
    pinnedEl = null;
    setStatus("");
  }

  function openTooltipFor(el) {
    pinnedEl = el;
    tagEl.textContent = describe(el);
    const existing = el.getAttribute(EI_ATTR);
    let statusMsg = "";
    if (existing) {
      inputEl.value = existing;
      statusMsg = "Existing value — Enter to keep or edit";
    } else {
      const guess = generateValue(el);
      inputEl.value = guess;
      if (guess) statusMsg = "Suggested value — Enter to accept or edit";
    }
    setStatus(statusMsg, "info");
    positionTooltip(el);
    // Defer focus so the click that opened us doesn't immediately blur.
    requestAnimationFrame(() => {
      inputEl.focus();
      inputEl.select();
    });
  }

  // --- Event handlers (all use capture phase to win against page handlers) ---
  function onMouseMove(e) {
    if (!selecting || pinnedEl) return;
    const t = e.target;
    if (!t || isOurNode(t)) {
      hoveredEl = null;
      positionHighlight(null);
      return;
    }
    if (t !== hoveredEl) {
      hoveredEl = t;
      positionHighlight(t);
    }
  }

  function onScrollOrResize() {
    if (pinnedEl) {
      positionHighlight(pinnedEl);
      positionTooltip(pinnedEl);
    } else if (hoveredEl) {
      positionHighlight(hoveredEl);
    }
  }

  function onClickCapture(e) {
    if (!selecting) return;
    const t = e.target;
    if (isOurNode(t)) return; // Let clicks inside our UI pass through normally.
    // Swallow the click so e.g. links don't navigate.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (!t || t.nodeType !== 1) return;
    positionHighlight(t);
    openTooltipFor(t);
  }

  // Some sites attach handlers to mousedown/mouseup instead of click.
  function onMouseDownCapture(e) {
    if (!selecting) return;
    if (isOurNode(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
  function onMouseUpCapture(e) {
    if (!selecting) return;
    if (isOurNode(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function onKeyDownCapture(e) {
    if (!selecting) return;
    if (e.key === "Escape") {
      if (pinnedEl) {
        hideTooltip();
      } else {
        stopSelecting();
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Permitted character set keeps the resulting selector unambiguous and
  // copy/paste-able. We allow letters, digits, hyphens, underscores, colons,
  // and dots; reject whitespace, quotes, and backslashes that would either
  // break the CSS attribute-selector quoting or look weird in chat.
  function validateValue(raw) {
    if (raw === "") return { ok: true, value: "" }; // clearing is allowed
    if (/\s/.test(raw)) return { ok: false, error: "value cannot contain whitespace" };
    if (/["\\]/.test(raw)) return { ok: false, error: "value cannot contain \" or \\" };
    return { ok: true, value: raw };
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function selectorFor(value) {
    return `[${EI_ATTR}="${value}"]`;
  }

  async function commitValue() {
    if (!pinnedEl) return;
    const raw = inputEl.value.trim();
    const res = validateValue(raw);
    if (!res.ok) {
      setStatus(res.error);
      return;
    }
    try {
      if (res.value === "") {
        pinnedEl.removeAttribute(EI_ATTR);
      } else {
        pinnedEl.setAttribute(EI_ATTR, res.value);
      }
      tagEl.textContent = describe(pinnedEl);
      let msg;
      if (res.value === "") {
        msg = "Cleared data-ei-id";
      } else {
        // Copy the full ready-to-paste selector so it drops straight into
        // document.querySelector / Playwright / agent chat without further
        // formatting.
        const selector = selectorFor(res.value);
        const copied = await copyText(selector);
        msg = copied ? `Saved · Copied ${selector}` : `Saved ${selector} (copy blocked)`;
      }
      setStatus(msg, "ok");
      // Brief confirmation, then exit selecting mode entirely. Committing
      // means "done with this element"; if the user wants to tag another one
      // they re-enter selecting mode via the toolbar icon.
      setTimeout(() => {
        if (pinnedEl) stopSelecting();
      }, 600);
    } catch (err) {
      setStatus("Could not set " + EI_ATTR + ": " + (err && err.message ? err.message : err));
    }
  }

  inputEl.addEventListener("keydown", (e) => {
    // Don't let the page see typing.
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitValue();
    } else if (e.key === "Escape") {
      e.preventDefault();
      hideTooltip();
    }
  });
  // Same for keypress / keyup so site shortcuts don't fire while typing.
  inputEl.addEventListener("keyup", (e) => e.stopPropagation());
  inputEl.addEventListener("keypress", (e) => e.stopPropagation());

  // Click outside tooltip (but still in selecting mode) hides it.
  // We handle this by checking in onClickCapture — clicks on non-our-nodes
  // will pin a new element. Clicks inside our UI are ignored here and bubble
  // to native handlers (so the input can focus).

  function startSelecting() {
    if (selecting) return;
    selecting = true;
    mountHost();
    document.documentElement.style.cursor = "crosshair";
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("mousedown", onMouseDownCapture, true);
    document.addEventListener("mouseup", onMouseUpCapture, true);
    document.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize, true);
  }

  function stopSelecting() {
    if (!selecting) return;
    selecting = false;
    document.documentElement.style.cursor = "";
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClickCapture, true);
    document.removeEventListener("mousedown", onMouseDownCapture, true);
    document.removeEventListener("mouseup", onMouseUpCapture, true);
    document.removeEventListener("keydown", onKeyDownCapture, true);
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize, true);
    hoveredEl = null;
    positionHighlight(null);
    hideTooltip();
  }

  function toggle() {
    if (selecting) stopSelecting();
    else startSelecting();
  }

  // --- Message bridge ---
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "ELEMENT_IDENTIFIER_PING") {
      sendResponse({ ok: true });
      return; // sync response
    }
    if (msg.type === "ELEMENT_IDENTIFIER_TOGGLE") {
      toggle();
      sendResponse({ ok: true, selecting });
      return;
    }
  });
})();
