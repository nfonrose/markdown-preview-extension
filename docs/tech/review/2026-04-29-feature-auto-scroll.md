# Technical Analysis: Synchronized Auto-Scroll

**Date:** April 29, 2026
**Feature:** Synchronize browser scroll position with VS Code editor scroll
**Status:** ✅ IMPLEMENTED

## 1. Objective
To provide a "Sync Scroll" experience where scrolling the Markdown file in VS Code automatically scrolls the browser preview to the corresponding section.

---

## 2. Technical Challenges

### 2.1 Mapping Editor Position to HTML
VS Code's scroll position is measured in lines, while the browser's position is measured in pixels. Since Markdown rendering changes the height of elements (images, headers, code blocks), a simple percentage-based scroll is inaccurate.

**Solution:** **Source Line Mapping.**
1.  Inject source line numbers into the generated HTML (e.g., `<p data-line="15">...</p>`).
2.  The browser finds the element corresponding to the editor's top visible line and scrolls to it.

### 2.2 Communication Channel
We already have a **Server-Sent Events (SSE)** connection established for auto-refresh. We can reuse this channel to send "scroll" events.

---

## 3. Implementation Strategy

### 3.1 Step 1: Inject Line Numbers (Renderer)
Modify `src/markdownRenderer.ts` to add a `markdown-it` rule that injects the `data-line` attribute into every block-level element.

```typescript
// Proposed logic for markdown-it
md.core.ruler.push('source_map', (state) => {
    state.tokens.forEach(token => {
        if (token.map && token.level === 0) {
            token.attrSet('data-line', token.map[0].toString());
        }
    });
});
```

### 3.2 Step 2: Track Editor Scroll (Extension)
In `src/extension.ts`, listen for scroll events using `vscode.window.onDidChangeTextEditorVisibleRanges`.

-   **Logic:** 
    1.  Get the first visible range: `event.visibleRanges[0].start.line`.
    2.  Throttle the event (e.g., 50ms) to prevent performance degradation.
    3.  Send the line number to the `PreviewServer`.

### 3.3 Step 3: Broadcast Scroll Position (Server)
Update `src/server.ts` to support a new SSE event type: `scroll`.

```json
{
    "event": "scroll",
    "line": 42
}
```

### 3.4 Step 4: Handle Scroll in Browser (Client Script)
Update the `initAutoRefresh` script in `src/markdownRenderer.ts`:

1.  Listen for `scroll` events.
2.  Find the element with `data-line` closest to the received line.
3.  Use `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`.

---

## 4. Proposed Changes Summary

### 4.1 `markdownRenderer.ts`
-   Add `markdown-it` source mapping logic.
-   Add client-side scroll listener and smooth-scroll logic.

### 4.2 `extension.ts`
-   Implement `vscode.window.onDidChangeTextEditorVisibleRanges`.
-   Add a dedicated debounce/throttle for scroll events.

### 4.3 `server.ts`
-   Add `broadcastScroll(session, line)` method.

---

## 5. Potential Issues & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **SSE Overhead** | Strictly throttle scroll events to ~20Hz (50ms). |
| **Image Loading** | Scroll position might jump if images load after the scroll signal. Mitigation: Set fixed dimensions or use `loading="lazy"` with placeholders. |
| **Nested Elements** | `data-line` should only be on top-level blocks to keep the DOM clean and search fast. |

## 6. Conclusion
Implementing synchronized scroll is a natural extension of our existing SSE infrastructure. By adding source line mapping to the HTML elements, we can achieve high-precision scrolling that remains accurate regardless of images or complex styling.
