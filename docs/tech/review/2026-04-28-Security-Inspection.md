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

### 2.2. Information Leakage & CORS Misconfiguration [MITIGATED]
**File:** `src/markdownRenderer.ts` / `src/server.ts`
**Resolution:** 
1.  **Referrer Policy:** Added `<meta name="referrer" content="no-referrer">` to the preview template. This prevents the browser from sending the `previewId` in the `Referer` header to external domains when loading images or clicking links.
2.  **Mermaid Security:** Set `securityLevel: 'strict'` for Mermaid diagrams.
**Note:** While the CORS `*` policy remains in `src/server.ts`, the leakage of the session ID via Referrer has been blocked, significantly reducing the attack surface.

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
