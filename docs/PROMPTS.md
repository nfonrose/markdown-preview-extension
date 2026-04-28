
Can you inspect this code to check if it's doing something it's not supposed to? It's an extension I can't trust without a first inspection. Create a security report and call it `PRT-SECURITY-INSPECTION.md`

---

Is the XSS issue easy to fix?

---

Ok, start by fixing the XSS issue while preserving HTML display. Introduce `DOMPurify` and use `securityLevel: 'strict'` for Mermaid. You will fix the referrer issue in a separate action, later

---

How can I install this extension (which is a Dev version, not published, into my VSCode)?

---


Create `-EN.md` versions of the .md files which are in Chinese

---

 I want the HTML previews to auto-refresh when the .md document is updated. Create a tech analysis of how to do that (store it in `docs/tech/review/2026-04-28-feature-auto-refresh.md`).

Today the URL for preview is unique (when the user presses `Preview Markdown in Browser` it generates a URL which is not re-usable after a new action by the user). This probably needs to change. And we also want the URL to include an `&autoRefresh=1`.

Last, it would be much better if the URL would contain some semantic elements such as the VSCode project name (name of the workspace folder) and the filename including its relative path inside the project.

Do not generate any code yet

---

Go ahead. Implement this with `Option B: Server-Sent Events (SSE)`
