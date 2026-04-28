# Technical Analysis: Auto-Refresh and Semantic URLs

**Date:** April 28, 2026
**Feature:** Auto-refresh on document update & Semantic URL structure
**Status:** IMPLEMENTED

## 1. Objective
To enhance the user experience by providing:
1.  **Live Updates:** The browser preview automatically refreshes or updates when the Markdown document is modified in VS Code.
2.  **Semantic URLs:** URLs that are human-readable, re-usable, and contain project/file context (e.g., `http://localhost:3000/preview/my-project/docs/readme.md`).
3.  **Control:** An `autoRefresh=1` query parameter to toggle the refresh behavior.

---

## 2. Current Architecture vs. Desired State

### 2.1 Current URL & Session Logic
- **Structure:** `/preview/{randomHash}`
- **Generation:** A new random hash is created every time the "Preview" command is run.
- **Persistence:** Sessions expire after 30 minutes of inactivity.
- **Mapping:** The `randomHash` is a blind key to a `PreviewSession` object containing the HTML content.

### 2.2 Proposed URL & Session Logic
- **Structure:** `/preview/{workspaceName}/{relativePath}?autoRefresh=1`
- **Generation:** Deterministic based on the file's location in the workspace.
- **Persistence:** The session identifier remains constant for the same file as long as the workspace is open.
- **Mapping:** The server will map the pair of `{workspaceName}` and `{relativePath}` to the physical file path.

---

## 3. Technical Implementation Details

### 3.1 Semantic URL Routing
The `PreviewServer` needs to move away from a flat hash-based map to a hierarchical or composite key mapping.
- **Project Context:** Use `vscode.workspace.getWorkspaceFolder(uri)` to identify the root folder.
- **Path Resolution:** The server must handle URL-encoded paths (e.g., spaces as `%20`) and protect against path traversal attacks (e.g., `../../etc/passwd`).
- **Conflict Handling:** If two different workspace folders have the same name, a short hash of the absolute workspace path may be needed as a prefix to ensure uniqueness while remaining semi-semantic.

### 3.2 Live Update Mechanism (Auto-Refresh)
To achieve "Live" updates, we need a communication channel between VS Code and the browser.

#### Option A: WebSockets (Recommended)
- **Pros:** Full-duplex, low latency, standard for live-reload features.
- **Cons:** Requires an additional library (like `ws`) or a manual implementation of the WebSocket handshake.
- **Workflow:** 
    1. Browser opens a WebSocket connection back to the `PreviewServer`.
    2. VS Code listens to `vscode.workspace.onDidChangeTextDocument`.
    3. On change, the extension triggers the renderer and sends the new HTML (or a "refresh" signal) via WebSocket.

#### Option B: Server-Sent Events (SSE)
- **Pros:** Lighter than WebSockets, natively supported by `http` module without extra libraries.
- **Cons:** Unidirectional (Server to Browser only), which is sufficient for this use case.
- **Workflow:** Similar to WebSockets, but using a persistent GET request to a `/stream/{id}` endpoint.

#### Option C: Client-Side Polling
- **Pros:** No persistent connection needed on the server.
- **Cons:** High overhead, "stuttery" updates, not "live." (Not recommended).

### 3.3 Integration with `MarkdownRenderer`
The HTML template must be updated to include a client-side script that:
1.  Checks for the `autoRefresh=1` parameter.
2.  If enabled, connects to the WebSocket/SSE endpoint.
3.  Upon receiving a signal, either reloads the page (`window.location.reload()`) or updates the `#markdown-content` div dynamically to avoid losing scroll position.

---

## 4. Proposed Changes Summary

### 4.1 `extension.ts`
- Implement a document change listener: `vscode.workspace.onDidChangeTextDocument`.
- Throttling/Debouncing: Ensure we don't re-render and push updates on every single keystroke (e.g., 300ms delay).
- Capture Workspace Name: Retrieve the name of the workspace folder to build the new URL.

### 4.2 `server.ts`
- **Routing Update:** Update `handleRequest` to parse the new semantic path structure.
- **WebSocket/SSE Server:** Integrate a simple notification server.
- **Asset Mapping:** Update `/asset/` path resolution to work with the new relative path structure.

### 4.3 `markdownRenderer.ts`
- **Template Update:** Inject a small "Live Reload" script into the `getDefaultTemplate()`.
- **Dynamic Content:** Optionally add logic to handle partial DOM updates for smoother transitions.

---

## 5. Security Considerations
- **Path Traversal:** Rigorous validation that the requested `{relativePath}` stays within the `basePath` of the workspace.
- **Information Leakage:** While URLs are semantic, they should only be accessible from `localhost`.
- **Cross-Site Scripting (XSS):** Maintain the existing `DOMPurify` sanitization even during live updates.

## 6. Conclusion
The proposed changes will significantly modernize the extension. Using **Server-Sent Events (SSE)** is likely the best path forward as it fulfills the requirement without adding heavy dependencies like `ws` or `socket.io`, keeping the extension lightweight.
