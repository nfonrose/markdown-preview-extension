import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import * as fs from 'fs';
import * as path from 'path';
import createDOMPurify, { DOMPurify } from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * Markdown渲染器
 * 支持完整的markdown语法、代码高亮、mermaid图表和表格
 */
export class MarkdownRenderer {
    private md: MarkdownIt;
    private purifier: DOMPurify;

    constructor() {
        // 初始化 DOMPurify (Node.js 环境下需要 JSDOM)
        const window = new JSDOM('').window;
        this.purifier = createDOMPurify(window as any);

        // 初始化markdown-it实例
        this.md = new MarkdownIt({
            html: true,        // 允许HTML标签
            linkify: true,     // 自动转换URL为链接
            typographer: true, // 启用一些语言中性的替换 + 引号美化
            highlight: (str: string, lang: string) => {
                // 特殊处理 mermaid 代码块
                if (lang === 'mermaid') {
                    // 将 mermaid 代码转换为特殊的 div 标记，由浏览器端的 Mermaid.js 渲染
                    const escapedCode = this.md.utils.escapeHtml(str);
                    return `<div class="mermaid">${escapedCode}</div>`;
                }
                
                // 代码高亮处理
                if (lang && hljs.getLanguage && hljs.getLanguage(lang)) {
                    try {
                        const highlighted = hljs.highlight(str, { language: lang });
                        return `<pre class="hljs"><code>${highlighted.value}</code></pre>`;
                    } catch (err) {
                        // 如果高亮失败，返回转义的代码
                        return `<pre class="hljs"><code>${this.md.utils.escapeHtml(str)}</code></pre>`;
                    }
                }
                // 如果没有指定语言或语言不支持，尝试自动检测
                try {
                    if (hljs.highlightAuto) {
                        const highlighted = hljs.highlightAuto(str);
                        return `<pre class="hljs"><code>${highlighted.value}</code></pre>`;
                    }
                } catch (err) {
                    // 如果自动检测也失败，返回转义的代码
                }
                // 最后兜底：返回转义的代码
                return `<pre class="hljs"><code>${this.md.utils.escapeHtml(str)}</code></pre>`;
            }
        });

        // 注入行号 (data-line)，用于同步滚动
        this.md.core.ruler.push('source_map', (state) => {
            state.tokens.forEach(token => {
                if (token.map && token.level === 0) {
                    token.attrSet('data-line', token.map[0].toString());
                }
            });
        });
    }

    /**
     * 渲染markdown内容为HTML
     * @param markdownContent markdown文本内容
     * @returns 完整的HTML文档字符串
     */
    public render(markdownContent: string): string {
        // 使用markdown-it渲染markdown内容
        let htmlContent = this.md.render(markdownContent);

        // 使用 DOMPurify 进行安全过滤，允许常用的 HTML 标签和属性
        htmlContent = this.purifier.sanitize(htmlContent);

        // 为所有链接添加 target="_blank" 与 rel="noopener noreferrer"，预览中点击可打开
        htmlContent = this.ensureLinksOpenInNewTab(htmlContent);
        // 将图片用可点击组件包裹，便于弹窗无极缩放等操作（仅非链接内的图片）
        htmlContent = this.wrapImagesForLightbox(htmlContent);

        // 使用内联模板（避免打包后文件路径问题）
        const template = this.getDefaultTemplate();

        // 替换模板中的内容占位符
        const finalHtml = template.replace('{{CONTENT}}', htmlContent);

        return finalHtml;
    }

    /**
     * 为所有 <a href="..."> 添加 target="_blank" rel="noopener noreferrer"，预览中点击链接有效
     */
    private ensureLinksOpenInNewTab(html: string): string {
        return html.replace(
            /<a(\s[^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi,
            (_, before, quote, href, after) => {
                const rest = before + after;
                const hasTarget = /target\s*=/i.test(rest);
                const hasRel = /rel\s*=/i.test(rest);
                let extra = '';
                if (!hasTarget) extra += ' target="_blank"';
                if (!hasRel) extra += ' rel="noopener noreferrer"';
                return `<a${before}href=${quote}${href}${quote}${after}${extra}>`;
            }
        );
    }

    /**
     * 将渲染结果中的 <img> 用可点击的包装器包裹，供前端 lightbox 使用
     */
    private wrapImagesForLightbox(html: string): string {
        return html.replace(
            /<img(\s[^>]*)>/gi,
            '<span class="mdp-image-wrap" role="button" tabindex="0" title="点击放大">$&</span>'
        );
    }

    /**
     * 获取默认HTML模板
     */
    private getDefaultTemplate(): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <title>Markdown Preview</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" id="hljs-light">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" id="hljs-dark" disabled>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        :root {
            --bg-color: #fff;
            --text-color: #333;
            --h-border-color: #eaecef;
            --blockquote-text: #6a737d;
            --blockquote-border: #dfe2e5;
            --code-bg: rgba(27, 31, 35, 0.05);
            --pre-bg: #f6f8fa;
            --table-border: #dfe2e5;
            --table-header-bg: #f6f8fa;
            --table-even-row: #f6f8fa;
            --link-color: #0366d6;
            --hr-bg: #e1e4e8;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg-color: #0d1117;
                --text-color: #c9d1d9;
                --h-border-color: #30363d;
                --blockquote-text: #8b949e;
                --blockquote-border: #30363d;
                --code-bg: rgba(110, 118, 129, 0.4);
                --pre-bg: #161b22;
                --table-border: #30363d;
                --table-header-bg: #161b22;
                --table-even-row: #0d1117;
                --link-color: #58a6ff;
                --hr-bg: #30363d;
            }
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--bg-color);
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
        h1 { font-size: 2em; border-bottom: 1px solid var(--h-border-color); padding-bottom: 0.3em; }
        h2 { font-size: 1.5em; border-bottom: 1px solid var(--h-border-color); padding-bottom: 0.3em; }
        h3 { font-size: 1.25em; }
        p { margin-bottom: 16px; }
        ul, ol { margin-bottom: 16px; padding-left: 2em; }
        blockquote { padding: 0 1em; color: var(--blockquote-text); border-left: 0.25em solid var(--blockquote-border); margin-bottom: 16px; }
        code { padding: 0.2em 0.4em; margin: 0; font-size: 85%; background-color: var(--code-bg); border-radius: 3px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
        pre { padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: var(--pre-bg); border-radius: 6px; margin-bottom: 16px; }
        pre code { display: inline; padding: 0; margin: 0; overflow: visible; line-height: inherit; word-wrap: normal; background-color: transparent; border: 0; }
        table { border-collapse: collapse; border-spacing: 0; width: 100%; margin-bottom: 16px; display: block; overflow-x: auto; }
        table th, table td { padding: 6px 13px; border: 1px solid var(--table-border); }
        table th { font-weight: 600; background-color: var(--table-header-bg); }
        table tr:nth-child(2n) { background-color: var(--table-even-row); }
        a { color: var(--link-color); text-decoration: none; }
        a:hover { text-decoration: underline; }
        img { max-width: 100%; height: auto; margin-bottom: 16px; }
        .mdp-image-wrap { display: inline-block; cursor: pointer; margin-bottom: 16px; border-radius: 6px; outline: none; }
        .mdp-image-wrap:focus { box-shadow: 0 0 0 2px var(--link-color); }
        .mdp-image-wrap img { margin-bottom: 0; vertical-align: middle; }
        hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: var(--hr-bg); border: 0; }
        .mermaid { text-align: center; margin: 20px 0; }
        /* 图片弹窗 Lightbox */
        .mdp-lightbox { display: none; position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); align-items: center; justify-content: center; }
        .mdp-lightbox.is-open { display: flex; }
        .mdp-lightbox__inner { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .mdp-lightbox__img-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; cursor: grab; }
        .mdp-lightbox__img-wrap:active { cursor: grabbing; }
        .mdp-lightbox__img { max-width: none; max-height: none; min-width: 120px; min-height: 120px; object-fit: contain; pointer-events: none; user-select: none; }
        .mdp-lightbox__toolbar { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,0,0,0.6); border-radius: 8px; z-index: 10001; }
        .mdp-lightbox__btn { width: 36px; height: 36px; border: none; background: rgba(255,255,255,0.2); color: #fff; border-radius: 6px; cursor: pointer; font-size: 18px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
        .mdp-lightbox__btn:hover { background: rgba(255,255,255,0.35); }
        .mdp-lightbox__btn-close { position: absolute; top: 16px; right: 16px; bottom: auto; left: auto; transform: none; }
        .mdp-lightbox__scale-label { color: rgba(255,255,255,0.9); font-size: 13px; min-width: 52px; text-align: center; }
        .hljs { display: block; overflow-x: auto; padding: 16px; background: var(--pre-bg); }
    </style>
</head>
<body>
    <div id="markdown-content">{{CONTENT}}</div>
    <div class="mdp-lightbox" id="mdp-lightbox" aria-hidden="true">
        <div class="mdp-lightbox__inner">
            <div class="mdp-lightbox__img-wrap" id="mdp-lightbox-img-wrap">
                <img class="mdp-lightbox__img" id="mdp-lightbox-img" alt="" referrerpolicy="no-referrer" />
            </div>
            <div class="mdp-lightbox__toolbar">
                <button type="button" class="mdp-lightbox__btn" id="mdp-lightbox-zoom-out" title="缩小">−</button>
                <span class="mdp-lightbox__scale-label" id="mdp-lightbox-scale">100%</span>
                <button type="button" class="mdp-lightbox__btn" id="mdp-lightbox-zoom-in" title="放大">+</button>
                <button type="button" class="mdp-lightbox__btn" id="mdp-lightbox-fit" title="适应窗口">⊡</button>
                <button type="button" class="mdp-lightbox__btn" id="mdp-lightbox-center" title="居中">◎</button>
            </div>
            <button type="button" class="mdp-lightbox__btn mdp-lightbox__btn-close" id="mdp-lightbox-close" title="关闭">×</button>
        </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>
        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // 设置 hljs 主题
        if (isDarkMode) {
            document.getElementById('hljs-light').disabled = true;
            document.getElementById('hljs-dark').disabled = false;
        }

        mermaid.initialize({ 
            startOnLoad: true, 
            theme: isDarkMode ? 'dark' : 'default', 
            securityLevel: 'strict' 
        });

        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('pre code').forEach((block) => { hljs.highlightElement(block); });
            mermaid.run();
            initImageLightbox();
            initAutoRefresh();
        });

        function initAutoRefresh() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('autoRefresh') !== '1') return;

            // 从路径中提取 previewId: /preview/{previewId}
            const pathParts = window.location.pathname.split('/');
            const previewIndex = pathParts.indexOf('preview');
            if (previewIndex === -1 || previewIndex === pathParts.length - 1) return;
            
            const previewId = pathParts.slice(previewIndex + 1).join('/');
            const eventSource = new EventSource('/stream/' + previewId);

            eventSource.onmessage = function(event) {
                const data = JSON.parse(event.data);
                if (data.event === 'update') {
                    window.location.reload();
                } else if (data.event === 'scroll') {
                    scrollToLine(data.line);
                }
            };

            eventSource.onerror = function() {
                console.warn('SSE connection lost, attempting to reconnect...');
            };
        }

        function scrollToLine(line) {
            const elements = document.querySelectorAll('[data-line]');
            let targetElement = null;
            let closestLine = -1;

            for (const el of elements) {
                const elLine = parseInt(el.getAttribute('data-line'), 10);
                if (elLine <= line && elLine > closestLine) {
                    closestLine = elLine;
                    targetElement = el;
                }
            }

            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        function initImageLightbox() {
            var box = document.getElementById('mdp-lightbox');
            var img = document.getElementById('mdp-lightbox-img');
            var wrap = document.getElementById('mdp-lightbox-img-wrap');
            var scaleEl = document.getElementById('mdp-lightbox-scale');
            var state = { scale: 1, x: 0, y: 0, drag: null };
            function applyTransform() {
                img.style.transform = 'translate(' + state.x + 'px,' + state.y + 'px) scale(' + state.scale + ')';
                scaleEl.textContent = Math.round(state.scale * 100) + '%';
            }
            function openLightbox(src) {
                img.src = src;
                state.scale = 1; state.x = 0; state.y = 0;
                applyTransform();
                box.classList.add('is-open');
                box.setAttribute('aria-hidden', 'false');
            }
            function closeLightbox() {
                box.classList.remove('is-open');
                box.setAttribute('aria-hidden', 'true');
            }
            document.querySelectorAll('.mdp-image-wrap').forEach(function(span) {
                var im = span.querySelector('img');
                if (!im) return;
                span.addEventListener('click', function(e) {
                    if (span.closest('a')) return;
                    e.preventDefault();
                    openLightbox(im.src);
                });
                span.addEventListener('keydown', function(e) {
                    if (span.closest('a')) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(im.src); }
                });
            });
            box.addEventListener('click', function(e) { if (e.target === box) closeLightbox(); });
            document.getElementById('mdp-lightbox-close').addEventListener('click', closeLightbox);
            wrap.addEventListener('wheel', function(e) {
                e.preventDefault();
                var delta = e.deltaY > 0 ? -0.12 : 0.12;
                state.scale = Math.max(0.1, Math.min(20, state.scale + delta));
                applyTransform();
            }, { passive: false });
            wrap.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                state.drag = { x: e.clientX - state.x, y: e.clientY - state.y };
            });
            document.addEventListener('mousemove', function(e) {
                if (!state.drag) return;
                state.x = e.clientX - state.drag.x;
                state.y = e.clientY - state.drag.y;
                applyTransform();
            });
            document.addEventListener('mouseup', function() { state.drag = null; });
            document.getElementById('mdp-lightbox-zoom-in').addEventListener('click', function() {
                state.scale = Math.min(20, state.scale + 0.25);
                applyTransform();
            });
            document.getElementById('mdp-lightbox-zoom-out').addEventListener('click', function() {
                state.scale = Math.max(0.1, state.scale - 0.25);
                applyTransform();
            });
            document.getElementById('mdp-lightbox-fit').addEventListener('click', function() {
                state.scale = 1; state.x = 0; state.y = 0;
                applyTransform();
            });
            document.getElementById('mdp-lightbox-center').addEventListener('click', function() {
                state.x = 0; state.y = 0;
                applyTransform();
            });
        }
    </script>
</body>
</html>`;
    }
}
