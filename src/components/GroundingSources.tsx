import React, { useState } from 'react';
import { Globe, ChevronDown, ChevronUp, ExternalLink, Search, Compass, Newspaper } from 'lucide-react';
import { GroundingSource } from '../types/chat';

interface GroundingSourcesProps {
  sources: GroundingSource[];
  queries?: string[];
}

export const GroundingSources: React.FC<GroundingSourcesProps> = ({ sources, queries }) => {
  // Open by default so the user immediately sees all site options!
  const [expanded, setExpanded] = useState(true);

  if ((!sources || sources.length === 0) && (!queries || queries.length === 0)) {
    return null;
  }

  // Deduplicate sources by URI
  const uniqueSources = (sources || []).filter(
    (src, index, self) => index === self.findIndex((s) => s.uri === src.uri)
  );

  const mainQuery = queries && queries.length > 0 ? queries[0] : '';

  return (
    <div className="mt-4 pt-3.5 border-t border-cyan-500/25 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left text-cyan-400 hover:text-cyan-300 py-1 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400 group-hover:rotate-45 transition-transform" />
          <span className="font-mono font-semibold tracking-wide text-xs">
            Sites e Fontes da Pesquisa Web ({uniqueSources.length})
          </span>
          {queries && queries.length > 0 && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
              {queries.length} {queries.length === 1 ? 'consulta' : 'consultas'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-cyan-400/80 group-hover:text-cyan-300 font-mono text-[11px]">
          <span>{expanded ? 'Recolher sites' : 'Expandir todos os sites'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 animate-fadeIn">
          {/* Query tags and instant Google Search link */}
          {queries && queries.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[#061427]/80 border border-cyan-500/25">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1 font-semibold">
                  <Search className="w-3 h-3 text-cyan-400" /> Consultas:
                </span>
                {queries.map((q, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-200 border border-cyan-500/30 text-[11px] font-mono"
                  >
                    "{q}"
                  </span>
                ))}
              </div>

              {mainQuery && (
                <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(mainQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 text-[11px] font-mono transition-all shadow-sm"
                  >
                    <Compass className="w-3 h-3 text-cyan-400" />
                    <span>Mais no Google</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </a>

                  <a
                    href={`https://news.google.com/search?q=${encodeURIComponent(mainQuery)}&hl=pt-BR&gl=BR&ceid=BR%3Apt-419`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 text-[11px] font-mono transition-all shadow-sm"
                  >
                    <Newspaper className="w-3 h-3 text-cyan-400" />
                    <span>Notícias</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Grid of verified sources & sites */}
          {uniqueSources.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {uniqueSources.map((source, idx) => {
                let domain = '';
                try {
                  domain = new URL(source.uri).hostname.replace('www.', '');
                } catch {
                  domain = source.uri;
                }

                // Favicon via Google service
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

                return (
                  <a
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-[#061224] hover:bg-[#0a203d] border border-cyan-500/20 hover:border-cyan-400/60 transition-all text-slate-200 hover:text-cyan-100 group/item shadow-sm hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-7 h-7 rounded-lg bg-cyan-950/90 border border-cyan-500/30 flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={faviconUrl}
                          alt=""
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            // Fallback to number if favicon fails
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-[10px] font-mono text-cyan-400 font-bold absolute">
                          {idx + 1}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs truncate group-hover/item:text-cyan-300 leading-snug">
                          {source.title || domain}
                        </p>
                        <p className="text-[11px] text-cyan-400/70 font-mono truncate">{domain}</p>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400/60 group-hover/item:text-cyan-300 shrink-0 group-hover/item:translate-x-0.5 group-hover/item:-translate-y-0.5 transition-transform" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
