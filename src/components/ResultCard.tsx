import React, { useState } from 'react';
import { 
  ExternalLink, Heart, Sparkles, Layers,
  ChevronDown, ChevronUp, CheckCircle2,
  AlertTriangle, Target
} from 'lucide-react';

export interface ResultCardProps {
  id: string;
  title: string;
  summary: string;
  url?: string | null;
  source: string;
  date: string;
  relevanceScore: number;
  relevanceReasoning?: string;
  contentType?: string;
  primaryLabel?: string;
  keyInsights?: string[];
  nextSteps?: string[];
  isFavourite: boolean;
  onToggleFavourite: (e: React.MouseEvent) => void;
  // Optional Vault/Selection props
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
}

export default function ResultCard({
  id,
  title,
  summary,
  url,
  source,
  date,
  relevanceScore,
  relevanceReasoning,
  contentType = 'intelligence',
  primaryLabel,
  keyInsights = [],
  nextSteps = [],
  isFavourite,
  onToggleFavourite,
  selectable = false,
  selected = false,
  onToggleSelect
}: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getLabelColors = (label: string) => {
    const lower = label.toLowerCase();
    if (lower === 'risk') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (lower === 'opportunity') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  };

  const getLabelIcon = (label: string) => {
    const lower = label.toLowerCase();
    if (lower === 'risk') return <AlertTriangle className="w-3 h-3" />;
    if (lower === 'opportunity') return <Target className="w-3 h-3" />;
    return <Sparkles className="w-3 h-3" />;
  };

  // Convert date to readable string if it's not already
  const dateObj = new Date(date);
  const formattedDate = isNaN(dateObj.getTime()) 
    ? date 
    : dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  // Hostname for URL
  let domain = 'Internal Intelligence';
  if (url && url !== '#') {
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch {
      // Invalid URL handled
    }
  }

  return (
    <div 
      onClick={() => setExpanded(!expanded)}
      className={`glass-card group relative p-6 border transition-all duration-300 cursor-pointer ${
        expanded ? 'bg-slate-800/80 border-blue-500/40 shadow-2xl' : 'bg-slate-900/30 border-slate-800/50 hover:border-slate-700'
      } ${selected ? 'border-blue-500 ring-1 ring-blue-500/50' : ''}`}
    >
      <div className="absolute inset-y-0 left-0 w-0 group-hover:w-1 bg-blue-600 transition-all duration-300 rounded-l-3xl" />
      
      <div className="flex gap-6 items-start">
        {selectable && onToggleSelect && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(e);
            }}
            className={`mt-1.5 w-5 h-5 shrink-0 rounded border transition-all flex items-center justify-center ${
              selected ? 'bg-blue-600 border-blue-600 shadow-lg' : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[9px] font-black px-2 py-1 bg-slate-800 text-slate-400 rounded uppercase tracking-[0.2em] border border-slate-700">
                {contentType}
              </span>
              
              {primaryLabel && primaryLabel !== 'None' && (
                <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-[0.2em] border flex items-center gap-1.5 ${getLabelColors(primaryLabel)}`}>
                  {getLabelIcon(primaryLabel)}
                  {primaryLabel}
                </span>
              )}

              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                {formattedDate} • {source}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavourite(e);
                }}
                className={`p-2 rounded-xl transition-all ${
                  isFavourite ? 'bg-red-500/10 text-red-500 shadow-lg shadow-red-500/5' : 'text-slate-600 hover:text-red-400 hover:bg-red-500/5'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavourite ? 'fill-red-500 scale-110' : ''} transition-transform`} />
              </button>
              
              <div className="flex flex-col items-center justify-center min-w-[50px]">
                <span className="text-[8px] font-black text-slate-500 uppercase leading-none tracking-widest mb-1">Relevance Score</span>
                <div className={`flex items-center gap-1.5 px-3 py-1 bg-slate-950/80 border rounded-lg ${
                  relevanceScore >= 90 ? 'border-emerald-500/30' : 
                  relevanceScore >= 75 ? 'border-blue-500/30' : 'border-slate-700'
                }`}>
                  <span className={`text-sm font-black ${
                    relevanceScore >= 90 ? 'text-emerald-400' : 
                    relevanceScore >= 75 ? 'text-blue-400' : 'text-slate-300'
                  }`}>
                    {relevanceScore}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-xl font-bold leading-tight mb-3 text-slate-100 group-hover:text-blue-400 transition-colors">
            {title}
          </h3>
          <p className={`text-sm text-slate-400 font-medium leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {summary}
          </p>

          {!expanded && (
            <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-widest">
               <span>Expand Details</span>
               <ChevronDown className="w-3.5 h-3.5" />
            </div>
          )}

          {expanded && (
            <div className="mt-8 pt-6 border-t border-slate-700/50 space-y-6 animate-in slide-in-from-top-2 duration-300">
              {/* Relevance Justification */}
              {relevanceReasoning && (
                <div className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-5">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    Relevance Score Justification
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium italic">
                    {relevanceReasoning}
                  </p>
                </div>
              )}

              {/* Key Insights & Next Steps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {keyInsights && keyInsights.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                      Key Insights
                    </h4>
                    <ul className="space-y-3">
                      {keyInsights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                          <span className="text-sm text-slate-300 leading-relaxed">{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {nextSteps && nextSteps.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">
                      Recommended Next Steps
                    </h4>
                    <ul className="space-y-3">
                      {nextSteps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="text-sm text-slate-300 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-4 mt-2">
                <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <span className="flex items-center gap-2">
                    <Layers className="w-3 h-3" />
                    {domain}
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-slate-400 transition-colors uppercase tracking-widest">
                    <span>Collapse</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </div>
                  
                  {url && url !== '#' && (
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 hover:-translate-y-0.5"
                    >
                      Visit <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
