/**
 * Estrely Markdown & Code Highlighting Engine
 * Handles rich markdown rendering, code block formatting, and copy-to-clipboard.
 */

class MarkdownRenderer {
    constructor() {
        this.hasMarked = typeof window.marked !== 'undefined';
        if (this.hasMarked) {
            window.marked.setOptions({
                breaks: true,
                gfm: true
            });
        }
    }

    render(text) {
        if (!text) return '';

        // If marked.js is available via CDN
        if (typeof window.marked !== 'undefined') {
            try {
                let html = window.marked.parse(text);
                return this.postProcessCodeBlocks(html);
            } catch (e) {
                console.warn('Marked parse failed, using fallback:', e);
            }
        }

        // Lightweight fallback markdown parser
        return this.fallbackParse(text);
    }

    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    postProcessCodeBlocks(html) {
        // Wrap pre > code in custom styled container with header and copy button
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        doc.querySelectorAll('pre').forEach(pre => {
            const codeEl = pre.querySelector('code');
            if (!codeEl) return;

            // Highlight syntax if highlight.js is loaded
            if (typeof window.hljs !== 'undefined') {
                window.hljs.highlightElement(codeEl);
            }

            // Extract language class (e.g. language-python -> PYTHON)
            let lang = 'CODE';
            codeEl.classList.forEach(cls => {
                if (cls.startsWith('language-')) {
                    lang = cls.replace('language-', '').toUpperCase();
                }
            });

            // Create wrapper container
            const container = document.createElement('div');
            container.className = 'code-block-wrapper';

            const header = document.createElement('div');
            header.className = 'code-block-header';
            header.innerHTML = `
                <span class="code-lang-tag">${lang}</span>
                <button class="copy-code-btn" type="button" aria-label="Copy code">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Copy</span>
                </button>
            `;

            const clonedPre = pre.cloneNode(true);
            container.appendChild(header);
            container.appendChild(clonedPre);
            pre.replaceWith(container);
        });

        return doc.body.innerHTML;
    }

    fallbackParse(text) {
        let result = text;

        // Code blocks: ```lang\ncode\n```
        result = result.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const langName = lang ? lang.toUpperCase() : 'CODE';
            const escapedCode = this.escapeHtml(code.trim());
            return `<div class="code-block-wrapper">
                <div class="code-block-header">
                    <span class="code-lang-tag">${langName}</span>
                    <button class="copy-code-btn" type="button">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span>Copy</span>
                    </button>
                </div>
                <pre><code class="language-${lang}">${escapedCode}</code></pre>
            </div>`;
        });

        // Inline code `code`
        result = result.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

        // Headers
        result = result.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
        result = result.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
        result = result.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

        // Bold & Italic
        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Blockquotes
        result = result.replace(/^\> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>');

        // Unordered lists
        result = result.replace(/^\s*[-*•]\s+(.*$)/gim, '<li class="md-li">$1</li>');
        result = result.replace(/(<li class="md-li">.*<\/li>)/gms, '<ul class="md-ul">$1</ul>');

        // Paragraphs / Linebreaks
        result = result.replace(/\n\n+/g, '<br><br>');
        result = result.replace(/\n/g, '<br>');

        return result;
    }
}

window.markdownRenderer = new MarkdownRenderer();

// Global event delegation for copy code buttons
document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-code-btn');
    if (!copyBtn) return;

    const wrapper = copyBtn.closest('.code-block-wrapper');
    if (!wrapper) return;

    const codeEl = wrapper.querySelector('pre code');
    if (!codeEl) return;

    const textToCopy = codeEl.innerText || codeEl.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span style="color: #10b981;">Copied!</span>
        `;
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
            copyBtn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy code:', err);
    });
});
