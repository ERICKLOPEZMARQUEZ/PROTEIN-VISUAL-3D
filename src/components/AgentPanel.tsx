import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  PanelRightClose,
  ChevronDown,
  ChevronUp,
  Terminal,
  Clock,
  Send,
  X,
  Columns,
  ArrowRight,
  Square
} from 'lucide-react';
import { AgentTraceStep, PDBMetadata } from '../types';

interface AgentPanelProps {
  currentResponse: string;
  traces: AgentTraceStep[];
  isStreaming: boolean;
  structure: PDBMetadata | null;
  onSendPrompt: (prompt: string) => void;
  onStopAgent?: () => void;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

const CURATED_PROMPTS = [
  'Identify interacting amino acids & ligand contact map',
  'Explain catalytic mechanism & binding pocket',
  'Analyze drug & ligand interactions',
  'Compare with AlphaFold prediction',
  'Summarize secondary structure composition'
];

export const AgentPanel: React.FC<AgentPanelProps> = ({
  currentResponse,
  traces,
  isStreaming,
  structure,
  onSendPrompt,
  onStopAgent,
  onClose,
  isExpanded = false,
  onToggleExpand
}) => {
  const [showTrace, setShowTrace] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const prevStructureIdRef = useRef<string | null>(null);

  // Stop agent run with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming && onStopAgent) {
        e.preventDefault();
        onStopAgent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, onStopAgent]);

  // Live timer for agent reasoning runtime
  useEffect(() => {
    let interval: any = null;
    if (isStreaming) {
      const startTime = Date.now();
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds(Number(((Date.now() - startTime) / 1000).toFixed(1)));
      }, 100);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  // Clean out any residual sidecar rendering push JSON blocks or commands from text presentation
  const sanitizedResponse = React.useMemo(() => {
    if (!currentResponse) return '';
    return currentResponse
      .replace(/#{1,4}\s*(\d*\.?\s*)?(Science Canvas Sidecar|3D Command Push|Sidecar Integration|Sidecar Rendering)[\s\S]*?```(?:json)?[\s\S]*?```/gi, '')
      .replace(/```(?:json)?\s*\{\s*"action":\s*"render_structure"[\s\S]*?```/gi, '')
      .replace(/```(?:json)?\s*\{[\s\S]*?"source":\s*"(pdb|alphafold)"[\s\S]*?\}[\s\S]*?```/gi, '')
      .replace(/#{1,4}\s*(\d*\.?\s*)?Science Canvas Sidecar[\s\S]*?(?=\n#{1,4}\s|\n\n[A-Z]|$)/gi, '')
      .trim();
  }, [currentResponse]);

  // Reset chat when structure changes
  useEffect(() => {
    if (structure && structure.id !== prevStructureIdRef.current) {
      prevStructureIdRef.current = structure.id;
      setChatHistory([]);
    }
  }, [structure?.id]);

  // Auto-scroll to bottom of chat on new content
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sanitizedResponse, chatHistory.length]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const query = chatInput.trim();
    if (!query || isStreaming) return;

    // Archive current response to history before starting new turn
    if (sanitizedResponse) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `agent-${Date.now() - 1}`,
          sender: 'agent',
          text: sanitizedResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: query,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } else {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: query,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }

    setChatInput('');
    onSendPrompt(query);
  };

  const handlePromptClick = (prompt: string) => {
    if (isStreaming) return;
    if (sanitizedResponse) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `agent-${Date.now() - 1}`,
          sender: 'agent',
          text: sanitizedResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } else {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
    onSendPrompt(prompt);
  };

  return (
    <div className="bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] shadow-[var(--sg-shadow-sm)] flex flex-col h-full overflow-hidden min-w-0">
      {/* Header bar */}
      <div className="p-3 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface-hover)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-[13px] font-semibold text-[var(--sg-text-primary)]">
                Structural Biology Chat
              </h3>
            </div>
            <p className="text-[11px] text-[var(--sg-text-secondary)] truncate">
              {structure ? `Interactive scientific dialogue for ${structure.id}` : 'Ask questions about molecular structure'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className={`p-1 rounded-[4px] transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-slate-200 text-slate-800'
                  : 'hover:bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
              }`}
              title={isExpanded ? 'Restore normal chat width' : 'Expand chat to 50:50 split view (collapses left panel)'}
              aria-label={isExpanded ? 'Restore normal chat width' : 'Expand chat to 50:50 split view'}
            >
              <Columns className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all cursor-pointer"
              title="Collapse chat panel to right"
              aria-label="Collapse chat panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Thread with Text Wrapping - Direct non-nested outputs */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-4 text-[13px] text-[var(--sg-text-primary)] leading-relaxed min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
        {/* Past messages history */}
        {chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 min-w-0 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'user' ? (
              <div className="max-w-[85%] rounded-tl-[12px] rounded-tr-[12px] rounded-br-[12px] rounded-bl-[4px] px-3 py-2 text-[12.5px] bg-[#000000] text-white break-words whitespace-pre-wrap leading-relaxed shadow-xs">
                {msg.text}
              </div>
            ) : (
              <div className="flex-1 min-w-0 text-[13px] text-[var(--sg-text-primary)] leading-relaxed break-words whitespace-normal [&_p]:break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_li]:break-words [&_code]:break-all [&_table]:w-full [&_table]:border-collapse">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {/* Current Active Streaming Turn - Direct unnested output with text wrapping */}
        {sanitizedResponse ? (
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="flex-1 min-w-0 text-[13px] text-[var(--sg-text-primary)] leading-relaxed break-words whitespace-normal [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-[var(--sg-text-primary)] [&_h3]:mt-2.5 [&_h3]:mb-1 [&_h4]:text-[13px] [&_h4]:font-medium [&_h4]:text-[var(--sg-text-primary)] [&_h4]:mt-2 [&_h4]:mb-1 [&_p]:break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-0.5 [&_li]:text-[12.5px] [&_li]:break-words [&_code]:font-mono [&_code]:text-[11px] [&_code]:bg-[var(--sg-surface-sunken)] [&_code]:px-1 [&_code]:py-0.2 [&_code]:rounded-[2px] [&_code]:text-[var(--sg-accent)] [&_code]:break-all [&_strong]:font-semibold [&_strong]:text-[var(--sg-text-primary)] [&_table]:w-full [&_table]:text-left [&_table]:border-collapse [&_th]:border-b [&_th]:border-[var(--sg-border)] [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold [&_th]:text-[11px] [&_td]:border-b [&_td]:border-[var(--sg-border-subtle)] [&_td]:px-2 [&_td]:py-1 [&_td]:text-[11px] [&_td]:break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {sanitizedResponse}
                </ReactMarkdown>
              </div>
            </div>

            {isStreaming && (
              <div className="flex items-center pt-1.5 border-t border-[var(--sg-border-subtle)] text-[11px] text-slate-500">
                <span>Agent is streaming analysis... ({elapsedSeconds.toFixed(1)}s)</span>
              </div>
            )}
          </div>
        ) : isStreaming ? (
          /* Animated loading state skeleton in grey */
          <div className="py-3 px-1 space-y-3">
            <div className="space-y-2">
              {/* Bar 1: Light Neutral Grey */}
              <div className="h-3.5 w-full rounded-[4px] bg-[#E8EAED] dark:bg-slate-800/80 overflow-hidden relative">
                <div className="animate-sweep-shimmer" />
              </div>

              {/* Bar 2: Light Neutral Grey */}
              <div className="h-3.5 w-[64%] rounded-[4px] bg-[#E8EAED] dark:bg-slate-800/80 overflow-hidden relative">
                <div className="animate-sweep-shimmer" />
              </div>

              {/* Bar 3: Light Neutral Grey */}
              <div className="h-3.5 w-[86%] rounded-[4px] bg-[#E8EAED] dark:bg-slate-800/80 overflow-hidden relative">
                <div className="animate-sweep-shimmer" />
              </div>

              {/* Bar 4: Light Neutral Grey */}
              <div className="h-3.5 w-[76%] rounded-[4px] bg-[#E8EAED] dark:bg-slate-800/80 overflow-hidden relative">
                <div className="animate-sweep-shimmer" />
              </div>

              {/* Bar 5: Light Neutral Grey */}
              <div className="h-3.5 w-[92%] rounded-[4px] bg-[#E8EAED] dark:bg-slate-800/80 overflow-hidden relative">
                <div className="animate-sweep-shimmer" />
              </div>
            </div>

            {/* Text and elapsed time without spinner and stop button */}
            <div className="flex items-center pt-2 text-[13px] text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="font-normal text-slate-800 dark:text-slate-200">
                  Looking for results...
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  ({elapsedSeconds.toFixed(1)}s)
                </span>
              </div>
            </div>
          </div>
        ) : chatHistory.length === 0 ? (
          <div className="py-2 space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-[var(--sg-border-subtle)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)]">
                Example Inquiries
              </span>
              <span className="text-[10.5px] text-[var(--sg-text-tertiary)]">
                Click to analyze
              </span>
            </div>
            <div className="flex flex-col items-start gap-2">
              {CURATED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePromptClick(prompt)}
                  disabled={isStreaming}
                  className="w-fit max-w-full text-left p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border-subtle)] hover:border-[var(--sg-accent)]/50 text-[12px] text-[var(--sg-text-primary)] transition-all group flex items-center justify-between gap-2.5 cursor-pointer shadow-2xs"
                >
                  <span className="font-medium group-hover:text-[var(--sg-accent)] transition-colors leading-snug">
                    {prompt}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--sg-accent)] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Prompt Chips (Shown below only when conversation is active and zero-state chips are scrolled past) */}
      {chatHistory.length > 0 && (
        <div className="px-3 pt-2 pb-1 border-t border-[var(--sg-border-subtle)] bg-[var(--sg-surface-hover)] flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar shrink-0">
          <span className="text-[10px] uppercase font-bold text-[var(--sg-text-tertiary)] shrink-0">Ask:</span>
          {CURATED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handlePromptClick(prompt)}
              disabled={isStreaming}
              className="px-2 py-1 rounded-[4px] text-[11px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] border border-[var(--sg-border-subtle)] transition-all whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Interactive Chat Input Form */}
      <form onSubmit={handleSendMessage} className="p-2.5 border-t border-[var(--sg-border)] bg-[var(--sg-surface)] shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={isStreaming ? "Agent is reasoning... Press Stop to cancel (Esc)" : "Ask agent about active sites, mechanisms, mutations..."}
            className="w-full bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] rounded-[6px] pl-3 pr-20 py-2 text-[12px] text-[var(--sg-text-primary)] placeholder-[var(--sg-text-tertiary)] focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] transition-all"
            disabled={isStreaming}
          />
          {isStreaming && onStopAgent ? (
            <button
              type="button"
              onClick={onStopAgent}
              className="absolute right-1 px-2.5 py-1.5 rounded-[4px] bg-[#000000] hover:bg-[#222222] text-white font-medium text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Stop agent run (Esc)"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!chatInput.trim() || isStreaming}
              className="absolute right-1 p-1.5 rounded-[4px] bg-[#000000] hover:bg-[#222222] text-white disabled:opacity-30 transition-all cursor-pointer"
              title="Send inquiry (Enter)"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* Collapsible Agent Trace Steps at Bottom */}
      {traces.length > 0 && (
        <div className="border-t border-[var(--sg-border)] bg-[var(--sg-surface-sunken)] shrink-0">
          <button
            onClick={() => setShowTrace(!showTrace)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all font-medium cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-[var(--sg-accent)]" />
              <span>Execution Trace ({traces.length} steps)</span>
              {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-[var(--sg-accent)] pulse-dot" />}
            </div>
            {showTrace ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {showTrace && (
            <div className="max-h-[380px] xl:max-h-[460px] overflow-y-auto p-2.5 space-y-1.5 border-t border-[var(--sg-border-subtle)] bg-[var(--sg-surface)] font-mono text-[10px] break-all [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
              {traces.map((trace, idx) => (
                <div
                  key={trace.id ? `${trace.id}-${idx}` : `trace-${idx}`}
                  className="p-1.5 rounded-[4px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-0.5 break-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {trace.type === 'thought' && (
                        <span className="px-1 rounded-[2px] bg-purple-100 text-purple-700 text-[8px] font-bold uppercase">
                          Thought
                        </span>
                      )}
                      {trace.type === 'tool_call' && (
                        <span className="px-1 rounded-[2px] bg-blue-100 text-blue-700 text-[8px] font-bold uppercase">
                          Tool Call
                        </span>
                      )}
                      {trace.type === 'tool_result' && (
                        <span className="px-1 rounded-[2px] bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase">
                          Result
                        </span>
                      )}
                      <span className="font-semibold text-[var(--sg-text-primary)] break-all">
                        {trace.title}
                      </span>
                    </div>
                    {trace.durationMs && (
                      <span className="text-[9px] text-[var(--sg-text-tertiary)] flex items-center gap-0.5">
                        <Clock className="w-2 h-2" />
                        {trace.durationMs}ms
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--sg-text-secondary)] whitespace-pre-wrap break-words leading-tight">
                    {trace.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
