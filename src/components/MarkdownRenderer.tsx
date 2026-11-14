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
  Eye,
  Code2,
  Flame,
  Pin,
} from 'lucide-react';

import { copyTextToClipboard } from '../utils/clipboard';
import { cyberAudio } from '../utils/audio';

interface MarkdownRendererProps {
  content: string;
  onPollVote?: (question: string, option: string) => void;
  isBusy?: boolean;
  isStreaming?: boolean;
  textSize?: 'small' | 'medium' | 'large';
}

const TEXT_SIZE_CLASSES: Record<'small' | 'medium' | 'large', string> = {
  small: 'text-[12.5px] sm:text-[13.5px] leading-normal',
  medium: 'text-[13.5px] sm:text-[14.5px] leading-relaxed',
  large: 'text-[15px] sm:text-[16.5px] leading-[1.75]',
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onPollVote,
  isBusy = false,
  isStreaming = false,
  textSize = 'medium',
}) => {
  if (!content) return null;

  const parts = parseMarkdown(content, isStreaming);
  const sizeClass = TEXT_SIZE_CLASSES[textSize] || TEXT_SIZE_CLASSES.medium;

  return (
    <div
      className={`space-y-2.5 text-slate-200 ${sizeClass} font-normal break-words [overflow-wrap:anywhere] min-w-0 w-full`}
    >
      {parts.map((part, index) => {
        if (part.type === 'code') {
          const lang = (part.language || 'code').toLowerCase();
          if (lang === 'poll' || lang === 'enquete') {
            if (part.isIncomplete) {
              return (
                <div
                  key={index}
                  className="my-2 px-3.5 py-2.5 rounded-xl border border-cyan-500/30 bg-[#061224]/80 text-xs font-mono text-cyan-300 flex items-center gap-2"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
                  <span>Montando enquete interativa...</span>
                </div>
              );
            }
            return (
              <PollBlock
                key={index}
                content={part.content}
                onVote={onPollVote}
                isBusy={isBusy}
              />
            );
          }
          return <CodeBlock key={index} code={part.content} language={part.language || 'code'} />;
        }
        return <FormattedText key={index} text={part.content} />;
      })}
      {isStreaming && (
        <span
          aria-hidden="true"
          className="inline-block w-2 h-4 ml-1 align-middle rounded-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse"
        />
      )}
    </div>
  );
};

interface PollBlockProps {
  content: string;
  onVote?: (question: string, option: string) => void;
  isBusy?: boolean;
}

const PollBlock: React.FC<PollBlockProps> = ({ content, onVote, isBusy = false }) => {
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
            disabled={sentToChat || isBusy}
            onClick={() => {
              if (isBusy) return;
              setSentToChat(true);
              onVote(question, options[selectedIdx]);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-mono transition-all ${
              sentToChat
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 cursor-default'
                : isBusy
                ? 'bg-slate-800 border border-white/10 text-slate-400 cursor-not-allowed'
                : 'bg-cyan-600/80 hover:bg-cyan-500 text-white border border-cyan-400/50'
            }`}
          >
            {sentToChat ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>Enviado</span>
              </>
            ) : isBusy ? (
              <span>Aguarde...</span>
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
  const [showPreview, setShowPreview] = useState(false);

  const normalizedLang = language.trim().toLowerCase();
  const isHtml = normalizedLang === 'html' || normalizedLang === 'htm';

  const handleCopy = async () => {
    cyberAudio.playCopy();
    const ok = await copyTextToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-cyan-500/30 bg-[#060d1a] shadow-lg shadow-cyan-950/20 w-full max-w-full">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-[#0a1628] border-b border-cyan-500/20 text-xs text-cyan-400 font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="uppercase tracking-wider font-semibold truncate">{language}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isHtml && (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors border text-xs shrink-0 ${
                showPreview
                  ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                  : 'bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 hover:text-cyan-100 border-cyan-500/20'
              }`}
              title={showPreview ? 'Voltar para o código HTML' : 'Visualizar HTML em tempo real'}
            >
              {showPreview ? (
                <>
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Ver código</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Visualizar</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
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
      </div>
      {isHtml && showPreview ? (
        <div className="w-full bg-white">
          <iframe
            srcDoc={code}
            sandbox="allow-scripts"
            title="Visualização HTML ao vivo"
            className="w-full h-80 border-0 block bg-white"
          />
        </div>
      ) : (
        <pre className="p-3.5 text-xs sm:text-[13px] font-mono text-cyan-100/90 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full">
          <code>{code}</code>
        </pre>
      )}
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
              className="my-3.5 w-full max-w-full overflow-x-auto rounded-2xl border border-cyan-500/35 bg-gradient-to-b from-[#061224] to-[#040a16] shadow-[0_0_18px_rgba(6,182,212,0.1)]"
            >
              <table className="w-full table-auto text-left text-xs sm:text-[13px] font-sans border-collapse">
                <thead>
                  <tr className="bg-[#0a1e3b] border-b border-cyan-400/35 text-cyan-200 font-semibold font-mono">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2.5 break-words tracking-wide">
                        {parseInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-500/15">
                  {rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-cyan-950/35 transition-colors odd:bg-transparent even:bg-cyan-950/15"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2.5 text-slate-200 break-words align-top">
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

    // Multi-line Callouts, Quadros & Blockquotes
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      let qIdx = idx;
      while (qIdx < lines.length && lines[qIdx].trim().startsWith('>')) {
        quoteLines.push(lines[qIdx].trim().replace(/^>\s?/, ''));
        qIdx++;
      }

      const firstLine = quoteLines[0] || '';
      const combinedLower = quoteLines.join('\n').toLowerCase();

      const renderQuoteInner = (linesToRender: string[]) => (
        <div className="space-y-1.5 min-w-0 flex-1 leading-relaxed break-words">
          {linesToRender.map((ql, lIdx) => {
            const cleanQl = ql.trim();
            if (!cleanQl) return <div key={lIdx} className="h-1" />;
            if (cleanQl.startsWith('- ') || cleanQl.startsWith('* ')) {
              return (
                <div key={lIdx} className="flex items-start gap-2 pl-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 mt-2 shrink-0" />
                  <span className="flex-1 min-w-0">{parseInline(cleanQl.slice(2))}</span>
                </div>
              );
            }
            return <div key={lIdx}>{parseInline(cleanQl)}</div>;
          })}
        </div>
      );

      if (
        combinedLower.startsWith('[!warning]') ||
        combinedLower.startsWith('[!cuidado]') ||
        combinedLower.startsWith('[!aviso]') ||
        combinedLower.startsWith('[!alerta]') ||
        firstLine.toLowerCase().includes('**atenção:**') ||
        firstLine.toLowerCase().includes('**aviso:**') ||
        firstLine.toLowerCase().includes('**alerta:**') ||
        firstLine.toLowerCase().includes('**cuidado:**') ||
        firstLine.includes('⚠️') ||
        firstLine.includes('🚨')
      ) {
        const cleanedLines = [
          firstLine.replace(/^\[!(warning|cuidado|aviso|alerta)\]\s*/i, ''),
          ...quoteLines.slice(1),
        ];
        elements.push(
          <div
            key={`callout-warn-${idx}`}
            className="my-2.5 p-3.5 rounded-xl border border-amber-500/40 border-l-4 border-l-amber-400 bg-gradient-to-br from-amber-950/35 to-[#120b03]/90 text-amber-100 text-[13px] sm:text-sm shadow-[0_0_16px_rgba(245,158,11,0.14)] flex items-start gap-2.5 min-w-0"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            {renderQuoteInner(cleanedLines)}
          </div>
        );
        idx = qIdx;
        continue;
      }

      if (
        combinedLower.startsWith('[!tip]') ||
        combinedLower.startsWith('[!dica]') ||
        firstLine.toLowerCase().includes('**dica:**') ||
        firstLine.includes('💡')
      ) {
        const cleanedLines = [
          firstLine.replace(/^\[!(tip|dica)\]\s*/i, ''),
          ...quoteLines.slice(1),
        ];
        elements.push(
          <div
            key={`callout-tip-${idx}`}
            className="my-2.5 p-3.5 rounded-xl border border-emerald-500/40 border-l-4 border-l-emerald-400 bg-gradient-to-br from-emerald-950/35 to-[#03120c]/90 text-emerald-100 text-[13px] sm:text-sm shadow-[0_0_16px_rgba(52,211,153,0.14)] flex items-start gap-2.5 min-w-0"
          >
            <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            {renderQuoteInner(cleanedLines)}
          </div>
        );
        idx = qIdx;
        continue;
      }

      if (
        combinedLower.startsWith('[!important]') ||
        combinedLower.startsWith('[!destaque]') ||
        combinedLower.startsWith('[!note]') ||
        combinedLower.startsWith('[!info]') ||
        combinedLower.startsWith('[!essencial]') ||
        combinedLower.startsWith('[!resumo]') ||
        combinedLower.startsWith('[!quadro]') ||
        firstLine.toLowerCase().includes('**importante:**') ||
        firstLine.toLowerCase().includes('**informação importante:**') ||
        firstLine.toLowerCase().includes('**informações importantes:**') ||
        firstLine.toLowerCase().includes('**nota:**') ||
        firstLine.toLowerCase().includes('**nota importante:**') ||
        firstLine.toLowerCase().includes('**lembrete:**') ||
        firstLine.toLowerCase().includes('**destaque:**') ||
        firstLine.toLowerCase().includes('**essencial:**') ||
        firstLine.toLowerCase().includes('**resumo:**') ||
        firstLine.toLowerCase().includes('**resumo rápido:**') ||
        firstLine.toLowerCase().includes('**quadro:**') ||
        firstLine.toLowerCase().includes('**ponto-chave:**') ||
        firstLine.includes('ℹ️') ||
        firstLine.includes('📌') ||
        firstLine.includes('🔥') ||
        firstLine.includes('📊')
      ) {
        const isHot =
          combinedLower.startsWith('[!essencial]') ||
          firstLine.toLowerCase().includes('**essencial:**') ||
          firstLine.includes('🔥');
        const isQuadro =
          combinedLower.startsWith('[!quadro]') ||
          combinedLower.startsWith('[!resumo]') ||
          firstLine.toLowerCase().includes('**resumo') ||
          firstLine.toLowerCase().includes('**quadro') ||
          firstLine.includes('📌') ||
          firstLine.includes('📊');
        const cleanedLines = [
          firstLine.replace(/^\[!(important|destaque|note|info|essencial|resumo|quadro)\]\s*/i, ''),
          ...quoteLines.slice(1),
        ];
        elements.push(
          <div
            key={`callout-imp-${idx}`}
            className={`my-2.5 p-3.5 rounded-xl border border-l-4 text-[13px] sm:text-sm flex items-start gap-2.5 min-w-0 ${
              isHot
                ? 'border-fuchsia-400/50 border-l-fuchsia-400 bg-gradient-to-br from-fuchsia-950/35 to-[#120416]/90 text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,0.16)]'
                : isQuadro
                ? 'border-sky-400/45 border-l-sky-400 bg-gradient-to-br from-sky-950/35 to-[#061224]/90 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.14)]'
                : 'border-cyan-400/50 border-l-cyan-400 bg-gradient-to-br from-cyan-950/40 to-[#041022]/90 text-cyan-100 shadow-[0_0_18px_rgba(6,182,212,0.18)]'
            }`}
          >
            {isHot ? (
              <Flame className="w-4 h-4 text-fuchsia-300 shrink-0 mt-0.5" />
            ) : isQuadro ? (
              <Pin className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
            )}
            {renderQuoteInner(cleanedLines)}
          </div>
        );
        idx = qIdx;
        continue;
      }

      elements.push(
        <blockquote
          key={`quote-${idx}`}
          className="pl-3.5 pr-3 py-2 border-l-2 border-cyan-400 bg-cyan-950/20 text-cyan-100/95 rounded-r-xl my-2.5 text-[13px] sm:text-sm leading-relaxed break-words"
        >
          {renderQuoteInner(quoteLines)}
        </blockquote>
      );
      idx = qIdx;
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

const CopyableCode: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
    if (sel && sel.trim().length > 0) return;
    e.stopPropagation();
    const ok = await copyTextToClipboard(code);
    if (ok) {
      cyberAudio.playCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <code
      onClick={handleClick}
      title="Clique para copiar apenas este termo"
      className={`px-1.5 py-0.5 rounded font-mono text-xs border break-all cursor-pointer transition-colors inline-flex items-center gap-1 align-baseline ${
        copied
          ? 'bg-emerald-950/90 text-emerald-200 border-emerald-400/60'
          : 'bg-cyan-950/90 hover:bg-cyan-900/90 text-cyan-300 border-cyan-500/30 hover:border-cyan-400/60'
      }`}
    >
      <span>{code}</span>
      {copied && <Check className="w-2.5 h-2.5 text-emerald-400 inline shrink-0" />}
    </code>
  );
};

const HIGHLIGHT_COLOR_CLASSES: Record<string, string> = {
  amarelo:
    'bg-yellow-300/18 text-yellow-100 border-b-[2px] border-yellow-300/90 shadow-[0_1px_8px_rgba(253,224,71,0.18)]',
  amber:
    'bg-yellow-300/18 text-yellow-100 border-b-[2px] border-yellow-300/90 shadow-[0_1px_8px_rgba(253,224,71,0.18)]',
  yellow:
    'bg-yellow-300/18 text-yellow-100 border-b-[2px] border-yellow-300/90 shadow-[0_1px_8px_rgba(253,224,71,0.18)]',
  verde:
    'bg-emerald-400/16 text-emerald-100 border-b-[2px] border-emerald-400/85 shadow-[0_1px_8px_rgba(16,185,129,0.18)]',
  emerald:
    'bg-emerald-400/16 text-emerald-100 border-b-[2px] border-emerald-400/85 shadow-[0_1px_8px_rgba(16,185,129,0.18)]',
  roxo:
    'bg-purple-400/20 text-purple-100 border-b-[2px] border-purple-400/85 shadow-[0_1px_8px_rgba(168,85,247,0.2)]',
  purple:
    'bg-purple-400/20 text-purple-100 border-b-[2px] border-purple-400/85 shadow-[0_1px_8px_rgba(168,85,247,0.2)]',
  rosa:
    'bg-rose-400/16 text-rose-100 border-b-[2px] border-rose-400/85 shadow-[0_1px_8px_rgba(244,63,94,0.18)]',
  rose:
    'bg-rose-400/16 text-rose-100 border-b-[2px] border-rose-400/85 shadow-[0_1px_8px_rgba(244,63,94,0.18)]',
  azul:
    'bg-cyan-400/18 text-cyan-100 border-b-[2px] border-cyan-400/85 shadow-[0_1px_8px_rgba(34,211,238,0.2)]',
  cyan:
    'bg-cyan-400/18 text-cyan-100 border-b-[2px] border-cyan-400/85 shadow-[0_1px_8px_rgba(34,211,238,0.2)]',
  laranja:
    'bg-orange-400/18 text-orange-100 border-b-[2px] border-orange-400/85 shadow-[0_1px_8px_rgba(251,146,60,0.2)]',
  orange:
    'bg-orange-400/18 text-orange-100 border-b-[2px] border-orange-400/85 shadow-[0_1px_8px_rgba(251,146,60,0.2)]',
};

const CopyableMark: React.FC<{ raw: string }> = ({ raw }) => {
  const [copied, setCopied] = useState(false);
  const colorMatch = raw.match(/^(amarelo|amber|yellow|verde|emerald|roxo|purple|rosa|rose|azul|cyan|laranja|orange):\s*([\s\S]+)$/i);
  const colorKey = colorMatch ? colorMatch[1].toLowerCase() : 'cyan';
  const cleanText = colorMatch ? colorMatch[2] : raw;
  const colorClass = HIGHLIGHT_COLOR_CLASSES[colorKey] || HIGHLIGHT_COLOR_CLASSES.cyan;

  const handleClick = async (e: React.MouseEvent) => {
    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
    if (sel && sel.trim().length > 0) return;
    e.stopPropagation();
    const ok = await copyTextToClipboard(cleanText);
    if (ok) {
      cyberAudio.playCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <mark
      onClick={handleClick}
      title="Clique para copiar apenas este destaque"
      className={`${colorClass} font-semibold px-1.5 py-0.5 rounded mx-0.5 inline cursor-pointer hover:brightness-110 transition-all`}
    >
      {cleanText}
      {copied && (
        <Check className="w-3 h-3 text-emerald-300 inline ml-1 align-middle" />
      )}
    </mark>
  );
};

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  const pattern =
    /(`[^`]+`|==[^=]+==|\*\*[^*]+\*\*|__[^_]+__|<u>[\s\S]+?<\/u>|~~[^~]+~~|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|\[(DESTAQUE|IMPORTANTE|ATENÇÃO|DICA|NOTA|CRÍTICO|RESULTADO|ESSENCIAL|EXEMPLO|RESUMO)\])/;

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
      parts.push(<CopyableCode key={keyIndex++} code={code} />);
    } else if (matchedStr.startsWith('==') && matchedStr.endsWith('==')) {
      const highlighted = matchedStr.slice(2, -2);
      parts.push(<CopyableMark key={keyIndex++} raw={highlighted} />);
    } else if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      const boldText = matchedStr.slice(2, -2);
      parts.push(
        <strong
          key={keyIndex++}
          className="font-bold text-white tracking-[0.01em] drop-shadow-[0_0_8px_rgba(255,255,255,0.16)]"
        >
          {boldText}
        </strong>
      );
    } else if (
      (matchedStr.startsWith('__') && matchedStr.endsWith('__')) ||
      (matchedStr.startsWith('<u>') && matchedStr.endsWith('</u>'))
    ) {
      const underlinedText = matchedStr.startsWith('<u>')
        ? matchedStr.slice(3, -4)
        : matchedStr.slice(2, -2);
      parts.push(
        <span
          key={keyIndex++}
          className="underline decoration-2 decoration-cyan-400/80 underline-offset-4 text-white font-medium"
        >
          {underlinedText}
        </span>
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
      } else if (badgeText.includes('DICA') || badgeText.includes('RESULTADO')) {
        badgeStyle = 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300';
      } else if (badgeText.includes('DESTAQUE')) {
        badgeStyle = 'bg-amber-950/80 border-amber-500/40 text-amber-300';
      } else if (badgeText.includes('ESSENCIAL') || badgeText.includes('EXEMPLO')) {
        badgeStyle = 'bg-purple-950/80 border-purple-500/40 text-purple-300';
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
  content: string,
  isStreaming = false
): Array<{ type: 'text' | 'code'; content: string; language?: string; isIncomplete?: boolean }> {
  const result: Array<{
    type: 'text' | 'code';
    content: string;
    language?: string;
    isIncomplete?: boolean;
  }> = [];
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
    const tail = content.substring(lastIndex);
    if (isStreaming) {
      const openFenceMatch = tail.match(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*)$/);
      if (openFenceMatch && openFenceMatch.index !== undefined) {
        const beforeFence = tail.substring(0, openFenceMatch.index);
        if (beforeFence) {
          result.push({ type: 'text', content: beforeFence });
        }
        result.push({
          type: 'code',
          language: openFenceMatch[1] || 'code',
          content: openFenceMatch[2],
          isIncomplete: true,
        });
        return result;
      }
    }

    result.push({
      type: 'text',
      content: tail,
    });
  }

  return result;
}
