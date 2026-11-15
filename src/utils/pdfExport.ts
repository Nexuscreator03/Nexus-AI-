import { Conversation } from '../types/chat';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineHtml(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/==([^=]+)==/g, '<mark>$1</mark>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return out;
}

function markdownToPrintableHtml(markdown: string): string {
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
  const parts: Array<{ type: 'text' | 'code'; lang?: string; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: markdown.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', lang: match[1] || 'código', content: match[2].trimEnd() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    parts.push({ type: 'text', content: markdown.slice(lastIndex) });
  }

  return parts
    .map((part) => {
      if (part.type === 'code') {
        return `<div class="code-box"><div class="code-lang">${escapeHtml(
          part.lang || 'código'
        )}</div><pre><code>${escapeHtml(part.content)}</code></pre></div>`;
      }
      const lines = part.content.split('\n');
      return lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return '<div class="spacer"></div>';
          if (trimmed.startsWith('### ')) return `<h4>${formatInlineHtml(trimmed.slice(4))}</h4>`;
          if (trimmed.startsWith('## ')) return `<h3>${formatInlineHtml(trimmed.slice(3))}</h3>`;
          if (trimmed.startsWith('# ')) return `<h2>${formatInlineHtml(trimmed.slice(2))}</h2>`;
          if (trimmed.startsWith('>')) {
            return `<blockquote>${formatInlineHtml(trimmed.replace(/^>\s*/, ''))}</blockquote>`;
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return `<div class="list-item">&bull; ${formatInlineHtml(trimmed.slice(2))}</div>`;
          }
          return `<p>${formatInlineHtml(line)}</p>`;
        })
        .join('');
    })
    .join('');
}

export function exportConversationToPdf(conversation: Conversation): void {
  if (!conversation || conversation.messages.length === 0) return;

  const createdDate = new Date(conversation.createdAt).toLocaleString('pt-BR');
  const titleSafe = escapeHtml(conversation.title || 'Conversa NexusBye AI');

  const messagesHtml = conversation.messages
    .map((msg) => {
      const isUser = msg.role === 'user';
      const sender = isUser ? 'Você' : 'NexusBye AI';
      const timeStr = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const sourcesHtml =
        msg.groundingSources && msg.groundingSources.length > 0
          ? `<div class="sources"><strong>Fontes consultadas:</strong><ul>${msg.groundingSources
              .map(
                (s) =>
                  `<li><a href="${escapeHtml(s.uri)}">${escapeHtml(s.title || s.uri)}</a></li>`
              )
              .join('')}</ul></div>`
          : '';

      return `
        <article class="msg ${isUser ? 'msg-user' : 'msg-ai'}">
          <div class="msg-header">
            <span class="sender">${sender}</span>
            <span class="time">${escapeHtml(timeStr)}</span>
          </div>
          <div class="msg-body">${markdownToPrintableHtml(msg.content)}</div>
          ${sourcesHtml}
        </article>
      `;
    })
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${titleSafe} — NexusBye AI</title>
  <style>
    @page { margin: 16mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.55;
      font-size: 13px;
    }
    header.doc-header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 10px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    header.doc-header h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      color: #0f172a;
    }
    header.doc-header .meta {
      font-size: 11px;
      color: #475569;
    }
    .brand {
      font-size: 12px;
      font-weight: 700;
      color: #0284c7;
      white-space: nowrap;
    }
    .msg {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .msg-user {
      background: #f0f9ff;
      border-color: #bae6fd;
    }
    .msg-ai {
      background: #ffffff;
    }
    .msg-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .msg-user .sender { color: #0369a1; }
    .msg-ai .sender { color: #0f172a; }
    .time { font-weight: 500; color: #64748b; }
    p { margin: 4px 0; }
    h2, h3, h4 { margin: 10px 0 4px 0; color: #0f172a; }
    blockquote {
      margin: 6px 0;
      padding: 6px 10px;
      border-left: 3px solid #0284c7;
      background: #f8fafc;
      color: #334155;
    }
    .list-item { padding-left: 10px; margin: 3px 0; }
    .spacer { height: 4px; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 11.5px;
    }
    mark {
      background: #fef08a;
      padding: 0 3px;
      border-radius: 2px;
    }
    .code-box {
      margin: 8px 0;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      background: #f8fafc;
    }
    .code-lang {
      font-family: ui-monospace, monospace;
      font-size: 10px;
      text-transform: uppercase;
      background: #e2e8f0;
      color: #334155;
      padding: 3px 8px;
      font-weight: 700;
    }
    pre {
      margin: 0;
      padding: 8px 10px;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 11.5px;
    }
    pre code { background: transparent; padding: 0; }
    .sources {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #cbd5e1;
      font-size: 11px;
      color: #475569;
    }
    .sources ul { margin: 4px 0 0 16px; padding: 0; }
    footer.doc-footer {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <header class="doc-header">
    <div>
      <h1>${titleSafe}</h1>
      <div class="meta">Exportado em ${escapeHtml(createdDate)}</div>
    </div>
    <div class="brand">NexusBye AI</div>
  </header>
  <main>${messagesHtml}</main>
  <footer class="doc-footer">NexusBye AI — Desenvolvido pela NexusBye</footer>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => {
      iframe.remove();
    }, 500);
  };

  iframe.onload = () => {
    try {
      const win = iframe.contentWindow;
      if (win) {
        win.addEventListener('afterprint', cleanup, { once: true });
        win.focus();
        win.print();
      }
    } catch {
      cleanup();
    }
    // Safety fallback cleanup if browser doesn't emit afterprint
    setTimeout(cleanup, 60000);
  };

  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}
