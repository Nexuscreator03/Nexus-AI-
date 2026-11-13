import React, { useState } from 'react';
import {
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Lightbulb,
  AlertTriangle,
  Info,
  BarChart3,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onPollVote?: (question: string, option: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onPollVote }) => {
  if (!content) return null;

  const parts = parseMarkdown(content);

  return (
    <div className="space-y-2.5 text-slate-200 leading-relaxed text-[13.5px] sm:text-[14.5px] font-normal break-words [overflow-wrap:anywhere] min-w-0 w-full">
      {parts.map((part, index) => {
        if (part.type === 'code') {
          const lang = (part.language || 'code').toLowerCase();
          if (lang === 'poll' || lang === 'enquete') {
            return <PollBlock key={index} content={part.content} onVote={onPollVote} />;
          }
          return <CodeBlock key={index} code={part.content} language={part.language || 'code'} />;
        }
        return <FormattedText key={index} text={part.content} />;
      })}
    </div>
  );
};

interface PollBlockProps {
  content: string;
  onVote?: (question: string, option: string) => void;
}

const PollBlock: React.FC<PollBlockProps> = ({ content, onVote }) => {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const optionLines = lines.filter((l) => /^([-*•]|\d+[.)])\s+/.test(l));
  const questionLines = lines.filter((l) => !/^([-*•]|\d+[.)])\s+/.test(l));

  const question = questionLines[0] || 'Qual você prefere?';
  const options = optionLines.map((l) => l.replace(/^([-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sentToChat, setSentToChat] = useState(false);

  if (options.length === 0) {
    return (
      <div className="my-3 p-3.5 rounded-xl border border-cyan-500/30 bg-[#061124] text-sm text-cyan-100">
        {content}
      </div>
    );
  }

  // Deterministic friendly vote distribution when user selects an option
  const getPercent = (idx: number) => {
    if (selectedIdx === null) return 0;
    const baseWeights = options.map((_, i) => (i === selectedIdx ? 52 : 18 + ((i * 11) % 19)));
    const sum = baseWeights.reduce((a, b) => a + b, 0);
    return Math.round((baseWeights[idx] / sum) * 100);
  };

  return (
    <div className="my-3 rounded-2xl border border-cyan-500/35 bg-gradient-to-br from-[#071429] to-[#050c1a] p-3.5 sm:p-4 shadow-[0_0_18px_rgba(6,182,212,0.12)] w-full max-w-full">
      <div className="flex items-center gap-2 text-cyan-300 font-mono text-[11px] uppercase tracking-wider mb-1.5">
        <BarChart3 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>Enquete Interativa</span>
      </div>

      <p className="font-semibold text-white text-[14px] sm:text-[15px] mb-3 leading-snug break-words">
        {question}
      </p>

      <div className="space-y-2">
        {options.map((opt, idx) => {
          const isSelected = selectedIdx === idx;
          const pct = getPercent(idx);

          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSelectedIdx(idx);
                setSentToChat(false);
              }}
              className={`relative w-full text-left rounded-xl border px-3 py-2.5 text-[13px] transition-all overflow-hidden ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-950/50 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'border-white/15 bg-black/25 hover:border-cyan-500/40 hover:bg-cyan-950/20 text-slate-200'
              }`}
            >
              {selectedIdx !== null && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    isSelected ? 'bg-cyan-500/25' : 'bg-slate-700/20'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}

              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                        : 'border-slate-500 text-transparent'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                  <span className="break-words leading-snug">{opt}</span>
                </div>

                {selectedIdx !== null && (
                  <span className="text-[11px] font-mono font-bold text-cyan-300 shrink-0 tabular-nums">
                    {pct}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedIdx !== null && onVote && (
        <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-white/10">
          <span className="text-[11px] font-mono text-slate-400 truncate">
            Voto registrado!
          </span>
          <button
            type="button"
            disabled={sentToChat}
            onClick={() => {
              setSentToChat(true);
              onVote(question, options[selectedIdx]);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-mono transition-all ${
              sentToChat
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 cursor-default'
                : 'bg-cyan-600/80 hover:bg-cyan-500 text-white border border-cyan-400/50'
            }`}
          >
            {sentToChat ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>Enviado</span>
              </>
            ) : (
              <>
                <Send className="w-3 h-3" />
                <span>Responder com esta opção</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

interface CodeBlockProps {
  code: string;
  language: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-cyan-500/30 bg-[#060d1a] shadow-lg shadow-cyan-950/20 w-full max-w-full">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0a1628] border-b border-cyan-500/20 text-xs text-cyan-400 font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="uppercase tracking-wider font-semibold truncate">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 hover:text-cyan-100 transition-colors border border-cyan-500/20 text-xs shrink-0"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-xs sm:text-[13px] font-mono text-cyan-100/90 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full">
        <code>{code}</code>
      </pre>
    </div>
  );
};

interface FormattedTextProps {
  text: string;
}

const FormattedText: React.FC<FormattedTextProps> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      elements.push(<div key={`empty-${idx}`} className="h-1" />);
      idx++;
      continue;
    }

    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      elements.push(
        <div
          key={`hr-${idx}`}
          className="my-3.5 border-t border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
        />
      );
      idx++;
      continue;
    }

    // Markdown Table Detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && idx + 1 < lines.length) {
      const nextLineTrimmed = lines[idx + 1].trim();
      if (nextLineTrimmed.startsWith('|') && /^[|\s:-]+$/.test(nextLineTrimmed)) {
        const tableLines: string[] = [];
        let tIdx = idx;
        while (
          tIdx < lines.length &&
          lines[tIdx].trim().startsWith('|') &&
          lines[tIdx].trim().endsWith('|')
        ) {
          tableLines.push(lines[tIdx].trim());
          tIdx++;
        }

        if (tableLines.length >= 2) {
          const headers = tableLines[0]
            .split('|')
            .slice(1, -1)
            .map((h) => h.trim());
          const rows = tableLines.slice(2).map((row) =>
            row
              .split('|')
              .slice(1, -1)
              .map((cell) => cell.trim())
          );

          elements.push(
            <div
              key={`table-${idx}`}
              className="my-3 w-full max-w-full overflow-x-auto rounded-xl border border-cyan-500/30 bg-[#050e1d] shadow-sm"
            >
              <table className="w-full table-auto text-left text-xs sm:text-[13px] font-sans border-collapse">
                <thead>
                  <tr className="bg-[#091b35] border-b border-cyan-500/30 text-cyan-200 font-semibold font-mono">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3 py-2 break-words">
                        {parseInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-500/15">
                  {rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-cyan-950/30 transition-colors odd:bg-transparent even:bg-cyan-950/10"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-200 break-words">
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

          idx = tIdx;
          continue;
        }
      }
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${idx}`}
          className="text-[15px] sm:text-base font-bold text-cyan-200 font-['Space_Grotesk'] tracking-wide mt-3 mb-1 flex items-center gap-2 break-words"
        >
          <span className="inline-block w-1.5 h-3.5 bg-cyan-400 rounded-sm shadow-[0_0_6px_#06b6d4] shrink-0" />
          <span className="min-w-0">{parseInline(trimmed.substring(4))}</span>
        </h3>
      );
      idx++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${idx}`}
          className="text-base sm:text-lg font-bold text-cyan-100 font-['Space_Grotesk'] tracking-wide mt-3.5 mb-1.5 pb-1 border-b border-cyan-500/25 flex items-center gap-2 break-words"
        >
          <span className="inline-block w-2 h-4 bg-gradient-to-b from-cyan-400 to-sky-500 rounded-sm shadow-[0_0_8px_#06b6d4] shrink-0" />
          <span className="min-w-0">{parseInline(trimmed.substring(3))}</span>
        </h2>
      );
      idx++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${idx}`}
          className="text-lg sm:text-xl font-extrabold text-white font-['Space_Grotesk'] tracking-wide mt-4 mb-2 pb-1 border-b border-cyan-500/30 flex items-center gap-2 break-words"
        >
          <span className="inline-block w-2.5 h-5 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-sm shadow-[0_0_10px_#06b6d4] shrink-0" />
          <span className="min-w-0">{parseInline(trimmed.substring(2))}</span>
        </h1>
      );
      idx++;
      continue;
    }

    // Callouts & Blockquotes
    if (trimmed.startsWith('>')) {
      const quoteContent = trimmed.replace(/^>\s*/, '');
      const lower = quoteContent.toLowerCase();

      if (
        lower.startsWith('[!warning]') ||
        lower.startsWith('[!cuidado]') ||
        lower.includes('**atenção:**') ||
        lower.includes('⚠️')
      ) {
        const cleanText = quoteContent.replace(/^\[!(warning|cuidado)\]\s*/i, '');
        elements.push(
          <div
            key={`callout-warn-${idx}`}
            className="my-2.5 p-3 rounded-xl border border-amber-500/40 bg-amber-950/25 text-amber-200 text-[13px] sm:text-sm shadow-[0_0_15px_rgba(245,158,11,0.12)] flex items-start gap-2.5 min-w-0"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 leading-relaxed break-words">{parseInline(cleanText)}</div>
          </div>
        );
        idx++;
        continue;
      }

      if (
        lower.startsWith('[!tip]') ||
        lower.startsWith('[!dica]') ||
        lower.includes('**dica:**') ||
        lower.includes('💡')
      ) {
        const cleanText = quoteContent.replace(/^\[!(tip|dica)\]\s*/i, '');
        elements.push(
          <div
            key={`callout-tip-${idx}`}
            className="my-2.5 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/25 text-emerald-200 text-[13px] sm:text-sm shadow-[0_0_15px_rgba(52,211,153,0.12)] flex items-start gap-2.5 min-w-0"
          >
            <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 leading-relaxed break-words">{parseInline(cleanText)}</div>
          </div>
        );
        idx++;
        continue;
      }

      if (
        lower.startsWith('[!important]') ||
        lower.startsWith('[!destaque]') ||
        lower.startsWith('[!note]') ||
        lower.includes('**importante:**') ||
        lower.includes('**destaque:**')
      ) {
        const cleanText = quoteContent.replace(/^\[!(important|destaque|note)\]\s*/i, '');
        elements.push(
          <div
            key={`callout-imp-${idx}`}
            className="my-2.5 p-3 rounded-xl border border-cyan-400/50 bg-cyan-950/30 text-cyan-100 text-[13px] sm:text-sm shadow-[0_0_18px_rgba(6,182,212,0.18)] flex items-start gap-2.5 min-w-0"
          >
            <Info className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 leading-relaxed break-words">{parseInline(cleanText)}</div>
          </div>
        );
        idx++;
        continue;
      }

      elements.push(
        <blockquote
          key={`quote-${idx}`}
          className="pl-3.5 py-1.5 border-l-2 border-cyan-400 bg-cyan-950/20 text-cyan-200 italic rounded-r my-2 text-[13px] sm:text-sm leading-relaxed break-words"
        >
          {parseInline(quoteContent)}
        </blockquote>
      );
      idx++;
      continue;
    }

    // Checklists (- [ ] or - [x])
    const checkMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (checkMatch) {
      const checked = checkMatch[1].toLowerCase() === 'x';
      elements.push(
        <div key={`check-${idx}`} className="flex items-start gap-2.5 pl-1 my-1 min-w-0">
          <span
            className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              checked
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                : 'bg-black/30 border-cyan-500/40 text-transparent'
            }`}
          >
            <Check className="w-3 h-3" />
          </span>
          <div
            className={`flex-1 min-w-0 leading-relaxed break-words ${
              checked ? 'line-through text-slate-400' : ''
            }`}
          >
            {parseInline(checkMatch[2])}
          </div>
        </div>
      );
      idx++;
      continue;
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`bullet-${idx}`} className="flex items-start gap-2.5 pl-1.5 my-1 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4] mt-2 shrink-0" />
          <div className="flex-1 min-w-0 leading-relaxed break-words">
            {parseInline(trimmed.substring(2))}
          </div>
        </div>
      );
      idx++;
      continue;
    }

    // Numbered lists
    const matchNum = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (matchNum) {
      elements.push(
        <div key={`num-${idx}`} className="flex items-start gap-2.5 pl-1.5 my-1 min-w-0">
          <span className="font-mono text-[11px] font-bold text-cyan-300 bg-cyan-950/90 border border-cyan-500/40 px-1.5 py-0.5 rounded shadow-[0_0_6px_rgba(6,182,212,0.25)] shrink-0">
            {matchNum[1]}
          </span>
          <div className="flex-1 min-w-0 leading-relaxed break-words">
            {parseInline(matchNum[2])}
          </div>
        </div>
      );
      idx++;
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={`p-${idx}`} className="leading-relaxed text-slate-200 break-words [overflow-wrap:anywhere]">
        {parseInline(rawLine)}
      </p>
    );
    idx++;
  }

  return <div className="space-y-2 min-w-0 w-full">{elements}</div>;
};

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  const pattern =
    /(`[^`]+`|==[^=]+==|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|\[(DESTAQUE|IMPORTANTE|ATENÇÃO|DICA|NOTA|CRÍTICO|RESULTADO)\])/;

  while (remaining.length > 0) {
    const match = remaining.match(pattern);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    if (match.index > 0) {
      parts.push(remaining.substring(0, match.index));
    }

    const matchedStr = match[0];

    if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      const code = matchedStr.slice(1, -1);
      parts.push(
        <code
          key={keyIndex++}
          className="px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 font-mono text-xs border border-cyan-500/30 break-all"
        >
          {code}
        </code>
      );
    } else if (matchedStr.startsWith('==') && matchedStr.endsWith('==')) {
      const highlighted = matchedStr.slice(2, -2);
      parts.push(
        <mark
          key={keyIndex++}
          className="bg-gradient-to-r from-cyan-500/25 to-sky-500/20 text-cyan-100 font-semibold border-b-2 border-cyan-400 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(6,182,212,0.3)] mx-0.5 inline"
        >
          {highlighted}
        </mark>
      );
    } else if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      const boldText = matchedStr.slice(2, -2);
      parts.push(
        <strong key={keyIndex++} className="font-bold text-white tracking-wide">
          {boldText}
        </strong>
      );
    } else if (matchedStr.startsWith('~~') && matchedStr.endsWith('~~')) {
      const strikeText = matchedStr.slice(2, -2);
      parts.push(
        <span key={keyIndex++} className="line-through text-slate-500 opacity-75">
          {strikeText}
        </span>
      );
    } else if (matchedStr.startsWith('*') && matchedStr.endsWith('*')) {
      const italicText = matchedStr.slice(1, -1);
      parts.push(
        <em key={keyIndex++} className="italic text-slate-300">
          {italicText}
        </em>
      );
    } else if (matchedStr.startsWith('[') && !matchedStr.includes('](')) {
      const badgeText = matchedStr.slice(1, -1).toUpperCase();
      let badgeStyle = 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300';
      if (badgeText.includes('ATENÇÃO') || badgeText.includes('CRÍTICO')) {
        badgeStyle = 'bg-rose-950/80 border-rose-500/40 text-rose-300';
      } else if (badgeText.includes('DICA')) {
        badgeStyle = 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300';
      } else if (badgeText.includes('DESTAQUE')) {
        badgeStyle = 'bg-amber-950/80 border-amber-500/40 text-amber-300';
      }

      parts.push(
        <span
          key={keyIndex++}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider border uppercase mx-1 ${badgeStyle}`}
        >
          {badgeText}
        </span>
      );
    } else if (matchedStr.startsWith('[')) {
      const linkMatch = matchedStr.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        const linkText = linkMatch[1];
        const linkUrl = linkMatch[2];
        parts.push(
          <a
            key={keyIndex++}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline items-center gap-0.5 text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-500/50 hover:decoration-cyan-400 font-medium break-words [overflow-wrap:anywhere]"
          >
            {linkText}
            <ExternalLink className="w-3 h-3 inline ml-0.5 opacity-70" />
          </a>
        );
      } else {
        parts.push(matchedStr);
      }
    }

    remaining = remaining.substring(match.index + matchedStr.length);
  }

  return parts;
}

function parseMarkdown(
  content: string
): Array<{ type: 'text' | 'code'; content: string; language?: string }> {
  const result: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: content.substring(lastIndex, match.index),
      });
    }

    result.push({
      type: 'code',
      language: match[1] || 'code',
      content: match[2].trimEnd(),
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    result.push({
      type: 'text',
      content: content.substring(lastIndex),
    });
  }

  return result;
}
