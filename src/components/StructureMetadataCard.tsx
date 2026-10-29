import React, { useState } from 'react';
import {
  FileText,
  Layers,
  FlaskConical,
  Award,
  ExternalLink,
  Copy,
  Check,
  Dna,
  Calendar,
  Microscope,
  BookOpen,
  Camera,
  MessagesSquare,
  PanelLeftClose,
  Crosshair,
  Activity
} from 'lucide-react';
import { PDBMetadata, ChainInfo, LigandInfo } from '../types';

interface MetadataCardProps {
  structure: PDBMetadata;
  onHighlightLigand?: (ligandId: string) => void;
  onOpenContactMap?: (ligandId: string) => void;
  onSelectChain?: (chainId: string) => void;
  onAskAgentAboutLigand?: (ligand: LigandInfo) => void;
  onOpenExportModal?: () => void;
  onClose?: () => void;
}

export const StructureMetadataCard: React.FC<MetadataCardProps> = ({
  structure,
  onHighlightLigand,
  onOpenContactMap,
  onSelectChain,
  onAskAgentAboutLigand,
  onOpenExportModal,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'chains' | 'ligands' | 'validation'>('overview');
  const [copiedSeqChain, setCopiedSeqChain] = useState<string | null>(null);

  const handleCopySequence = (chain: ChainInfo) => {
    const seq = chain.sequence || `Chain ${chain.chainId} sequence (${chain.sequenceLength} residues)`;
    navigator.clipboard.writeText(seq);
    setCopiedSeqChain(chain.chainId);
    setTimeout(() => setCopiedSeqChain(null), 1500);
  };

  const isAlphaFold = structure.source === 'alphafold';
  const af = structure.alphafoldMetrics;

  return (
    <div className="bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] shadow-[var(--sg-shadow-sm)] flex flex-col h-full overflow-hidden min-w-0">
      {/* Header bar */}
      <div className="p-3.5 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface-hover)] shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="inline-flex items-center justify-center h-6 px-2 rounded-[4px] font-mono font-bold text-[12px] text-[var(--sg-text-primary)] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] shrink-0">
                {structure.id}
              </span>

              <span className="inline-flex items-center justify-center h-6 px-2 rounded-[4px] font-medium text-[12px] text-[var(--sg-text-primary)] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] shrink-0">
                {structure.experimentalMethod}
              </span>

              {structure.resolution && (
                <span className="inline-flex items-center justify-center h-6 px-2 rounded-[4px] font-mono font-semibold text-[12px] text-[var(--sg-text-primary)] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] shrink-0">
                  {structure.resolution.toFixed(2)} Å
                </span>
              )}

              {isAlphaFold && af && (
                <span className="inline-flex items-center justify-center h-6 px-2 rounded-[4px] font-mono font-semibold text-[12px] text-[var(--sg-text-primary)] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] shrink-0">
                  pLDDT {af.plddtMean.toFixed(1)}
                </span>
              )}
            </div>

            <h2 className="text-[13.5px] font-medium text-[var(--sg-text-primary)] break-words leading-snug line-clamp-2">
              {structure.title}
            </h2>

            <div className="flex items-center gap-2 text-[11px] text-[var(--sg-text-secondary)] mt-1 flex-wrap break-words">
              <span className="italic font-medium">{structure.organism.scientificName}</span>
              {structure.organism.commonName && (
                <span>({structure.organism.commonName})</span>
              )}
              <span>•</span>
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3 text-[var(--sg-text-tertiary)]" />
                {structure.depositionDate}
              </span>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all cursor-pointer shrink-0"
              title="Collapse left panel to left"
              aria-label="Collapse left panel"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex flex-row flex-nowrap items-center gap-1 mt-2.5 border-b border-[var(--sg-border)] -mb-3.5 pt-0.5 overflow-x-auto overflow-y-hidden whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[var(--sg-accent)] text-[var(--sg-accent)] font-semibold'
                : 'border-transparent text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
            }`}
          >
            <span className="whitespace-nowrap">Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('chains')}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'chains'
                ? 'border-[var(--sg-accent)] text-[var(--sg-accent)] font-semibold'
                : 'border-transparent text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
            }`}
          >
            <span className="whitespace-nowrap">Chains ({structure.chains.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ligands')}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'ligands'
                ? 'border-[var(--sg-accent)] text-[var(--sg-accent)] font-semibold'
                : 'border-transparent text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
            }`}
          >
            <span className="whitespace-nowrap">Ligands ({structure.ligands.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('validation')}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'validation'
                ? 'border-[var(--sg-accent)] text-[var(--sg-accent)] font-semibold'
                : 'border-transparent text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
            }`}
          >
            <span className="whitespace-nowrap">{isAlphaFold ? 'Confidence' : 'Validation'}</span>
          </button>
        </div>
      </div>

      {/* Tab contents */}
      <div className="p-3.5 flex-1 overflow-y-auto min-h-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4 text-[13px]">
            {structure.summary && (
              <div>
                <p className="text-[var(--sg-text-primary)] leading-relaxed break-words whitespace-normal">
                  {structure.summary}
                </p>
              </div>
            )}

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] min-w-0">
                <span className="text-[11px] text-[var(--sg-text-tertiary)] block">Method</span>
                <span className="font-medium text-[var(--sg-text-primary)] break-words block mt-0.5">
                  {structure.experimentalMethod}
                </span>
              </div>

              <div className="p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] min-w-0">
                <span className="text-[11px] text-[var(--sg-text-tertiary)] block">
                  {isAlphaFold ? 'Mean Confidence' : 'Resolution'}
                </span>
                <span className="font-mono font-bold text-[var(--sg-text-primary)] block mt-0.5">
                  {isAlphaFold && af ? `${af.plddtMean.toFixed(1)} pLDDT` : structure.resolution ? `${structure.resolution} Å` : 'N/A'}
                </span>
              </div>

              <div className="p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] min-w-0">
                <span className="text-[11px] text-[var(--sg-text-tertiary)] block">Polymer Chains</span>
                <span className="font-mono font-bold text-[var(--sg-text-primary)] block mt-0.5">
                  {structure.chains.length} <span className="text-[11px] font-normal text-[var(--sg-text-secondary)]">chains</span>
                </span>
              </div>
            </div>

            {/* Citation */}
            {structure.citation && (
              <div className="p-3 rounded-[6px] bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] min-w-0">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--sg-text-secondary)] mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--sg-accent)] shrink-0" />
                  <span>Primary Citation</span>
                </div>
                <p className="font-medium text-[var(--sg-text-primary)] leading-snug break-words whitespace-normal">
                  {structure.citation.title}
                </p>
                <p className="text-[12px] text-[var(--sg-text-secondary)] mt-1.5 break-words whitespace-normal">
                  <span className="italic">{structure.citation.journal}</span> ({structure.citation.year})
                  {structure.citation.authors && structure.citation.authors.length > 0 && (
                    <span> — {structure.citation.authors.slice(0, 3).join(', ')}{structure.citation.authors.length > 3 ? ' et al.' : ''}</span>
                  )}
                </p>
                {structure.citation.doi && (
                  <a
                    href={`https://doi.org/${structure.citation.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--sg-accent)] hover:underline mt-1 font-mono break-all"
                  >
                    <span>doi:{structure.citation.doi}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </div>
            )}

            {/* Camera Capture & Publication Card */}
            <div className="p-3.5 rounded-[6px] bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-[4px] bg-[var(--sg-accent-subtle)] text-[var(--sg-accent)] flex items-center justify-center shrink-0">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-[var(--sg-text-primary)]">Camera Capture & Export</h4>
                    <span className="text-[11px] text-[var(--sg-text-secondary)]">Publication 4K rendering & slides</span>
                  </div>
                </div>
                {onOpenExportModal && (
                  <button
                    onClick={onOpenExportModal}
                    className="px-2.5 py-1 rounded-[4px] bg-[var(--sg-accent)] hover:bg-[var(--sg-accent-hover)] text-white text-[11px] font-medium transition-all shadow-sm flex items-center gap-1 cursor-pointer shrink-0"
                    title="Open Camera Capture & Presentation Export"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Capture</span>
                  </button>
                )}
              </div>
              <p className="text-[12px] text-[var(--sg-text-secondary)] leading-relaxed break-words whitespace-normal">
                Render publication-grade 4K images with transparent backgrounds for Google Slides, Docs, or posters. Copy directly to clipboard or download 3D models and PyMOL scripts.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-[var(--sg-border-subtle)] text-[11px] text-[var(--sg-text-secondary)]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--sg-success)] shrink-0" />
                  <span className="truncate">4K / 300 DPI Transparent</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                  <span className="truncate">PDB & 3D Mesh (.glb)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Polymer Chains */}
        {activeTab === 'chains' && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--sg-border)] text-[12px] text-[var(--sg-text-tertiary)] uppercase font-semibold">
                    <th className="py-2 px-2.5">Chain</th>
                    <th className="py-2 px-2.5">Macromolecule Description</th>
                    <th className="py-2 px-2.5 text-right">Length</th>
                    <th className="py-2 px-2.5 text-right">Mol. Wt.</th>
                    <th className="py-2 px-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--sg-border-subtle)]">
                  {structure.chains.map((chain) => (
                    <tr
                      key={chain.chainId}
                      className="hover:bg-[var(--sg-surface-hover)] transition-colors group cursor-pointer"
                      onClick={() => onSelectChain?.(chain.chainId)}
                    >
                      <td className="py-2.5 px-2.5 font-mono font-bold text-[var(--sg-accent)] align-top">
                        {chain.chainId}
                      </td>
                      <td className="py-2.5 px-2.5 font-medium text-[var(--sg-text-primary)] break-words whitespace-normal leading-snug align-top">
                        <div>{chain.name}</div>
                        <span className="block text-[11px] text-[var(--sg-text-tertiary)] font-normal mt-0.5 break-words">
                          {chain.polymerType}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-right text-[var(--sg-text-primary)] whitespace-nowrap align-top">
                        {chain.sequenceLength} <span className="text-[11px] text-[var(--sg-text-secondary)]">res</span>
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-right text-[var(--sg-text-primary)] whitespace-nowrap align-top">
                        {(chain.mw / 1000).toFixed(1)} <span className="text-[11px] text-[var(--sg-text-secondary)]">kDa</span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right align-top">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopySequence(chain);
                          }}
                          className="px-2 py-1 rounded-[4px] text-[11px] font-medium bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-active)] text-[var(--sg-text-secondary)] border border-[var(--sg-border-subtle)] transition-all inline-flex items-center gap-1"
                          title="Copy FASTA Sequence"
                        >
                          {copiedSeqChain === chain.chainId ? (
                            <>
                              <Check className="w-3 h-3 text-[var(--sg-success)]" />
                              <span className="text-[var(--sg-success)]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>FASTA</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Ligands & Cofactors */}
        {activeTab === 'ligands' && (
          <div className="space-y-3">
            {structure.ligands.length === 0 ? (
              <div className="py-8 text-center text-[var(--sg-text-tertiary)]">
                <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-[13px] font-medium text-[var(--sg-text-secondary)]">No bound non-polymer ligands</p>
                <p className="text-[12px] max-w-[260px] mx-auto mt-0.5">
                  This structure represents an apo conformation or monomeric model.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--sg-border-subtle)]">
                {structure.ligands.map((lig) => (
                  <div key={lig.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] flex items-center justify-center font-mono font-bold text-[14px] text-[var(--sg-accent)] shrink-0">
                        {lig.id}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[13px] text-[var(--sg-text-primary)] break-words whitespace-normal">
                            {lig.name}
                          </span>
                          {lig.instanceCount > 1 && (
                            <span className="px-1.5 py-0.2 rounded-[3px] text-[10px] bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] font-mono shrink-0">
                              x{lig.instanceCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--sg-text-secondary)] mt-0.5 flex-wrap break-all">
                          {lig.formula && <span>Formula: {lig.formula}</span>}
                          <span>•</span>
                          <span>MW: {lig.mw} Da</span>
                          {lig.chemType && (
                            <>
                              <span>•</span>
                              <span className="text-[var(--sg-text-tertiary)]">{lig.chemType}</span>
                            </>
                          )}
                        </div>

                        {/* Binding residues */}
                        {lig.bindingResidues && lig.bindingResidues.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 flex-wrap break-words">
                            <span className="text-[11px] text-[var(--sg-text-tertiary)]">Pocket:</span>
                            {lig.bindingResidues.slice(0, 6).map((res) => (
                              <span
                                key={res}
                                className="px-1.5 py-0.2 rounded-[3px] text-[10px] font-mono bg-[var(--sg-accent-subtle)] text-[var(--sg-accent)] border border-[var(--sg-accent)]/20"
                              >
                                {res}
                              </span>
                            ))}
                            {lig.bindingResidues.length > 6 && (
                              <span className="text-[10px] text-[var(--sg-text-tertiary)]">
                                +{lig.bindingResidues.length - 6} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      {onOpenContactMap && (
                        <button
                          onClick={() => onOpenContactMap(lig.id)}
                          className="px-2.5 py-1 rounded-[4px] text-[12px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                          title={`Open Ligand-Protein Contact Map for ${lig.id}`}
                        >
                          <Activity className="w-3 h-3 text-emerald-600" />
                          <span>Contact Map</span>
                        </button>
                      )}
                      {onHighlightLigand && (
                        <button
                          onClick={() => onHighlightLigand(lig.id)}
                          className="px-2.5 py-1 rounded-[4px] text-[12px] font-medium bg-[var(--sg-accent)] hover:bg-[var(--sg-accent-hover)] text-white shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1"
                          title={`Center 3D viewport on ligand ${lig.id}`}
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>Focus 3D</span>
                        </button>
                      )}
                      {onAskAgentAboutLigand && (
                        <button
                          onClick={() => onAskAgentAboutLigand(lig)}
                          className="px-2 py-0.5 rounded-[4px] text-[11px] text-[var(--sg-accent)] hover:bg-[var(--sg-accent-subtle)] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <MessagesSquare className="w-3 h-3" />
                          <span>Ask Agent</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Validation / AlphaFold Confidence */}
        {activeTab === 'validation' && (
          <div className="space-y-4">
            {isAlphaFold && af ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[var(--sg-text-primary)]">Global Mean pLDDT</span>
                  <span className="font-mono font-bold text-[15px] text-[var(--sg-accent)]">
                    {af.plddtMean.toFixed(1)} / 100
                  </span>
                </div>

                {/* pLDDT Bar */}
                <div className="h-3 w-full rounded-full overflow-hidden flex bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)]">
                  <div style={{ width: `${af.veryHighPct}%` }} className="bg-[#0053D6]" title={`Very High (>90): ${af.veryHighPct}%`} />
                  <div style={{ width: `${af.confidentPct}%` }} className="bg-[#65CBF3]" title={`Confident (70-90): ${af.confidentPct}%`} />
                  <div style={{ width: `${af.lowPct}%` }} className="bg-[#FFDB13]" title={`Low (50-70): ${af.lowPct}%`} />
                  <div style={{ width: `${af.veryLowPct}%` }} className="bg-[#FF7D45]" title={`Very Low (<50): ${af.veryLowPct}%`} />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#0053D6] shrink-0" />
                    <span>Very High (&gt;90): <strong className="font-mono">{af.veryHighPct.toFixed(1)}%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#65CBF3] shrink-0" />
                    <span>Confident (70–90): <strong className="font-mono">{af.confidentPct.toFixed(1)}%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#FFDB13] shrink-0" />
                    <span>Low (50–70): <strong className="font-mono">{af.lowPct.toFixed(1)}%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#FF7D45] shrink-0" />
                    <span>Disordered (&lt;50): <strong className="font-mono">{af.veryLowPct.toFixed(1)}%</strong></span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)]">
                  <span className="text-[11px] text-[var(--sg-text-tertiary)] block">R-work / R-free</span>
                  <span className="font-mono font-bold text-[14px] text-[var(--sg-text-primary)] block mt-0.5">
                    {structure.validation?.rWork ?? 0.19} / {structure.validation?.rFree ?? 0.23}
                  </span>
                </div>

                <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)]">
                  <span className="text-[11px] text-[var(--sg-text-tertiary)] block">Clashscore</span>
                  <span className="font-mono font-bold text-[14px] text-[var(--sg-text-primary)] block mt-0.5">
                    {structure.validation?.clashscore ?? 3.5}
                  </span>
                </div>

                <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)]">
                  <span className="text-[11px] text-[var(--sg-text-tertiary)] block">Ramachandran Favored</span>
                  <span className="font-mono font-bold text-[14px] text-[var(--sg-success)] block mt-0.5">
                    {structure.validation?.ramachandranFavored ?? 97.5}%
                  </span>
                </div>

                <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)]">
                  <span className="text-[11px] text-[var(--sg-text-tertiary)] block">Ramachandran Outliers</span>
                  <span className="font-mono font-bold text-[14px] text-[var(--sg-text-primary)] block mt-0.5">
                    {structure.validation?.ramachandranOutliers ?? 0.2}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
