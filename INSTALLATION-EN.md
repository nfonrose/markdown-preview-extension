# Markdown Preview Extension - Installation Instructions

This is essentially a **VSCode extension** and can be installed in **VSCode** or **Cursor** (both support `.vsix`).

---

## 1. Package to .vsix (Run once in the repository root)

```bash
npm install
npm run vsix
```

You will get: `markdown-preview-ext-0.1.0-prt-001.vsix` (approx. 2.5MB, including dependencies). **Use only this command**; do not manually type `vsce package` or add `--no-dependencies`, otherwise the error `Cannot find module 'markdown-it'` will occur after installation.

---

## 2. Installation Methods

### Install with VSCode

**Graphical Interface**

1. Open **VSCode**.
2. `Ctrl+Shift+P` → type **Install from VSIX** → select **Extensions: Install from VSIX**.
3. Choose the **`markdown-preview-ext-0.1.0-prt-001.vsix`** file in this directory.
4. **Reload** the window as prompted.

**Command Line** (Requires `code` to be in your PATH)

- If `code` is not available in your terminal: In VSCode, `Ctrl+Shift+P` → type **Shell Command: Install 'code' command in PATH** and execute it once.
- Then run:
  ```bash
  code --install-extension "markdown-preview-ext-0.1.0-prt-001.vsix"
  ```

### Install with Cursor (Using the same .vsix)

- **Drag and Drop**: Drag the `markdown-preview-ext-0.1.0-prt-001.vsix` file directly into the **Cursor Extensions panel** on the left to install.
- Alternatively: `Ctrl+Shift+P` → type **Install from VSIX** → select the .vsix file → Reload.

**Note**: Using the command line `Cursor --install-extension ...` will only open a new Cursor window; the extension will not be installed in the current window. **Please use one of the two methods above to install within Cursor.**

---

## 3. Verification

- Open any `.md` file → Right-click → **Preview Markdown in Browser**.
- In the browser: links are clickable (open in new tab), images are clickable (lightbox or zoom).

---

*Author: kejiqing*
