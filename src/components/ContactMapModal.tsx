import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Crosshair,
  Download,
  Copy,
  Check,
  MessagesSquare,
  Activity
} from 'lucide-react';
import { PDBMetadata } from '../types';
import {
  LigandContactResidue,
  parsePdbOrCifAtoms,
  calculateLigandContacts,
  formatContactMapAgentPrompt,
  AA_PROPERTIES
} from '../utils/contactAnalysis';
import { copyTextToClipboard } from '../utils/export3D';

export type { LigandContactResidue };

export interface ContactMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  structure: PDBMetadata | null;
  selectedLigandId?: string | null;
  coordinateData: string;
  glViewer?: any;
  onFocusResidueIn3D: (residue: LigandContactResidue) => void;
  onHighlightAllContactsIn3D: (contacts: LigandContactResidue[], ligandId: string) => void;
  onClear3DContacts: () => void;
  onAskAgent?: (prompt: string) => void;
}

export const ContactMapModal: React.FC<ContactMapModalProps> = ({
  isOpen,
  onClose,
  structure,
  selectedLigandId,
  coordinateData,
  glViewer,
  onFocusResidueIn3D,
  onHighlightAllContactsIn3D,
  onClear3DContacts,
  onAskAgent
}) => {
  const ligands = structure?.ligands || [];
  const defaultLigandId = selectedLigandId || (ligands.length > 0 ? ligands[0].id : null);
  const [activeLigandId, setActiveLigandId] = useState<string | null>(defaultLigandId);
  const [cutoffDistance, setCutoffDistance] = useState<number>(4.2);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedResidue, setSelectedResidue] = useState<LigandContactResidue | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [is3DHighlighted, setIs3DHighlighted] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'matrix' | 'cards'>('matrix');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const el = document.getElementById('right-sidebar-tool-host');
      setPortalTarget(el);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedLigandId) {
      setActiveLigandId(selectedLigandId);
    } else if (ligands.length > 0 && !activeLigandId) {
      setActiveLigandId(ligands[0].id);
    }
  }, [selectedLigandId, ligands, activeLigandId]);

  // Parse atoms
  const parsedAtoms = useMemo(() => {
    return parsePdbOrCifAtoms(coordinateData, glViewer);
  }, [coordinateData, glViewer]);

  // Compute contacts
  const contacts = useMemo(() => {
    if (!activeLigandId) return [];
    return calculateLigandContacts(parsedAtoms, activeLigandId, cutoffDistance);
  }, [parsedAtoms, activeLigandId, cutoffDistance]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (selectedTypeFilter === 'all') return contacts;
    return contacts.filter((c) => c.interactionTypes.includes(selectedTypeFilter as any));
  }, [contacts, selectedTypeFilter]);

  // Counts by type
  const counts = useMemo(() => {
    let hb = 0;
    let sb = 0;
    let hyd = 0;
    let aro = 0;
    contacts.forEach((c) => {
      if (c.interactionTypes.includes('hbond')) hb++;
      if (c.interactionTypes.includes('saltbridge')) sb++;
      if (c.interactionTypes.includes('hydrophobic')) hyd++;
      if (c.interactionTypes.includes('aromatic')) aro++;
    });
    return { all: contacts.length, hbond: hb, saltbridge: sb, hydrophobic: hyd, aromatic: aro };
  }, [contacts]);

  // Copy CSV of contacts to clipboard
  const handleCopyCSV = async () => {
    const header = 'Chain,Residue,ResNum,1Letter,MinDistance_Angstrom,ContactCount,InteractionTypes,ClosestProteinAtom,ClosestLigandAtom\n';
    const rows = contacts.map((c) =>
      `${c.chainId},${c.resName},${c.resNum},${c.singleLetter},${c.minDistance.toFixed(2)},${c.contactCount},"${c.interactionTypes.join(';')}",${c.closestProteinAtom},${c.closestLigandAtom}`
    ).join('\n');
    await copyTextToClipboard(header + rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download CSV
  const handleDownloadCSV = () => {
    const header = 'Chain,Residue,ResNum,1Letter,MinDistance_Angstrom,ContactCount,InteractionTypes,ClosestProteinAtom,ClosestLigandAtom\n';
    const rows = contacts.map((c) =>
      `${c.chainId},${c.resName},${c.resNum},${c.singleLetter},${c.minDistance.toFixed(2)},${c.contactCount},"${c.interactionTypes.join(';')}",${c.closestProteinAtom},${c.closestLigandAtom}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${structure?.id || 'structure'}_${activeLigandId || 'ligand'}_contact_map.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Ask AI Agent
  const handleAskAgentAboutContacts = () => {
    if (!onAskAgent || !activeLigandId) return;
    const prompt = formatContactMapAgentPrompt(structure?.id || 'PDB', activeLigandId, contacts, cutoffDistance);
    onAskAgent(prompt);
    onClose();
  };

  // Toggle 3D contact highlight
  const handleToggle3DHighlight = () => {
    if (is3DHighlighted) {
      onClear3DContacts();
      setIs3DHighlighted(false);
    } else {
      if (activeLigandId && contacts.length > 0) {
        onHighlightAllContactsIn3D(contacts, activeLigandId);
        setIs3DHighlighted(true);
      }
    }
  };

  if (!isOpen) return null;

  const panelContent = (
    <div className="bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] shadow-[var(--sg-shadow-sm)] flex flex-col h-full w-full overflow-hidden min-w-0">
      {/* Header bar — unified with Structural Biology Chat */}
      <div className="p-3 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface-hover)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-[13px] font-semibold text-[var(--sg-text-primary)]">
                Ligand-Protein Contact Map
              </h3>
            </div>
            <p className="text-[11px] text-[var(--sg-text-secondary)] truncate">
              {structure ? `Binding pocket fingerprint for ${structure.id}` : 'Residue distance contacts & chemistry'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleToggle3DHighlight}
            className={`px-2 py-1 rounded-[4px] text-[11px] font-medium transition-all border cursor-pointer ${
              is3DHighlighted
                ? 'bg-[var(--sg-surface)] text-[var(--sg-text-primary)] border-[var(--sg-border)]'
                : 'bg-[#000000] hover:bg-[#222222] text-white border-[#000000]'
            }`}
            title={is3DHighlighted ? 'Remove 3D contact lines from viewer' : 'Draw 3D dashed contact lines & sidechains in viewer'}
          >
            {is3DHighlighted ? 'Clear 3D' : 'Show in 3D'}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all cursor-pointer"
            title="Close Contact Map and return to Structural Biology Chat"
            aria-label="Close Contact Map"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Controls Bar: Ligand selector, Cutoff & View Mode */}
      <div className="px-3.5 py-2.5 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface)] space-y-2.5 shrink-0 text-[12px]">
        {/* Ligand Selector */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)] shrink-0">
            Ligand
          </span>
          {ligands.length === 0 ? (
            <span className="font-mono text-[var(--sg-text-tertiary)] text-[11px]">
              No bound ligands
            </span>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
              {ligands.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setActiveLigandId(l.id);
                    setIs3DHighlighted(false);
                    setSelectedResidue(null);
                  }}
                  className={`px-2 py-0.5 rounded-[4px] font-mono text-[11px] font-medium border transition-all cursor-pointer whitespace-nowrap ${
                    activeLigandId === l.id
                      ? 'bg-[#000000] text-white border-[#000000]'
                      : 'bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-primary)] border-[var(--sg-border-subtle)]'
                  }`}
                >
                  {l.id}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cutoff Slider & View Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[11px] text-[var(--sg-text-secondary)] shrink-0">Cutoff:</span>
            <input
              type="range"
              min="3.0"
              max="6.0"
              step="0.1"
              value={cutoffDistance}
              onChange={(e) => setCutoffDistance(parseFloat(e.target.value))}
              className="w-20 accent-[#000000] cursor-pointer"
            />
            <span className="font-mono font-semibold text-[11.5px] text-[var(--sg-text-primary)] shrink-0">
              {cutoffDistance.toFixed(1)} Å
            </span>
          </div>

          <div className="flex items-center bg-[var(--sg-surface-sunken)] p-0.5 rounded-[4px] border border-[var(--sg-border-subtle)] shrink-0">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-2 py-0.5 rounded-[3px] text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-[var(--sg-surface)] text-[var(--sg-text-primary)] shadow-2xs font-semibold'
                  : 'text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2 py-0.5 rounded-[3px] text-[11px] font-medium transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-[var(--sg-surface)] text-[var(--sg-text-primary)] shadow-2xs font-semibold'
                  : 'text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Filter Bar by Interaction Type */}
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar pt-0.5">
          {[
            { id: 'all', label: `All (${counts.all})` },
            { id: 'hbond', label: `H-Bond (${counts.hbond})` },
            { id: 'saltbridge', label: `Salt (${counts.saltbridge})` },
            { id: 'hydrophobic', label: `Hydrophobic (${counts.hydrophobic})` },
            { id: 'aromatic', label: `Aromatic (${counts.aromatic})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTypeFilter(tab.id)}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium border transition-all whitespace-nowrap cursor-pointer ${
                selectedTypeFilter === tab.id
                  ? 'bg-[#000000] text-white border-[#000000]'
                  : 'bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] border-[var(--sg-border-subtle)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-[13px] text-[var(--sg-text-primary)] leading-relaxed min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
        {contacts.length === 0 ? (
          <div className="py-10 text-center text-[var(--sg-text-tertiary)]">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-[var(--sg-text-secondary)] text-[13px]">
              No residues contacting {activeLigandId || 'ligand'} within {cutoffDistance} Å
            </p>
            <p className="text-[11.5px] mt-1 text-[var(--sg-text-tertiary)]">
              Expand the distance cutoff slider up to 5.5–6.0 Å or select another ligand.
            </p>
          </div>
        ) : viewMode === 'matrix' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-[var(--sg-text-secondary)]">
              <span>{filteredContacts.length} contacting residues</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyCSV}
                  className="px-2 py-0.5 rounded-[4px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] border border-[var(--sg-border-subtle)] transition-all flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy CSV'}</span>
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="px-2 py-0.5 rounded-[4px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] border border-[var(--sg-border-subtle)] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* 2-Column Sidebar Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredContacts.map((c) => {
                const prop = AA_PROPERTIES[c.resName] || { type: 'Standard' };
                const isSelected = selectedResidue?.resNum === c.resNum && selectedResidue?.chainId === c.chainId;

                return (
                  <div
                    key={`${c.chainId}_${c.resNum}`}
                    onClick={() => setSelectedResidue(c)}
                    className={`p-2.5 rounded-[6px] border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#000000] bg-[var(--sg-surface-hover)] shadow-2xs'
                        : 'bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border-[var(--sg-border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-mono font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                        {c.resName}{c.resNum} <span className="text-[10.5px] text-[var(--sg-text-tertiary)] font-normal">({c.chainId})</span>
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-[var(--sg-text-primary)]">
                        {c.minDistance.toFixed(2)}Å
                      </span>
                    </div>

                    <div className="text-[11px] text-[var(--sg-text-secondary)] truncate">
                      {prop.type} · {c.interactionTypes[0] || 'contact'}
                    </div>

                    <div className="mt-1.5 pt-1 border-t border-[var(--sg-border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--sg-text-tertiary)]">
                      <span>{c.closestProteinAtom} ↔ {c.closestLigandAtom}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusResidueIn3D(c);
                        }}
                        className="text-[var(--sg-text-primary)] hover:underline flex items-center gap-0.5 font-sans font-medium"
                        title="Focus in 3D viewer"
                      >
                        <Crosshair className="w-2.5 h-2.5" />
                        <span>3D</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Residue Detail Panel */}
            {selectedResidue && (
              <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--sg-border-subtle)] gap-2">
                  <div className="min-w-0">
                    <h5 className="font-semibold text-[12.5px] text-[var(--sg-text-primary)] truncate">
                      {selectedResidue.resName} {selectedResidue.resNum} (Chain {selectedResidue.chainId})
                    </h5>
                    <span className="text-[11px] text-[var(--sg-text-secondary)]">
                      Min: <strong className="font-mono">{selectedResidue.minDistance.toFixed(2)} Å</strong> · {selectedResidue.contactCount} contacts
                    </span>
                  </div>

                  <button
                    onClick={() => onFocusResidueIn3D(selectedResidue)}
                    className="px-2.5 py-1 rounded-[4px] bg-[#000000] hover:bg-[#222222] text-white text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Focus 3D</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--sg-border)] text-[10px] text-[var(--sg-text-tertiary)] uppercase font-semibold">
                        <th className="py-1 pr-2">Protein</th>
                        <th className="py-1 px-2">Ligand</th>
                        <th className="py-1 px-2 text-right">Dist</th>
                        <th className="py-1 pl-2 text-right">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--sg-border-subtle)] font-mono">
                      {selectedResidue.atomPairs.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-1 pr-2 font-semibold text-[var(--sg-text-primary)]">{p.proteinAtom}</td>
                          <td className="py-1 px-2 text-[var(--sg-text-secondary)]">{p.ligandAtom}</td>
                          <td className="py-1 px-2 text-right font-semibold text-[var(--sg-text-primary)]">{p.distance.toFixed(2)}Å</td>
                          <td className="py-1 pl-2 text-right font-sans text-[10.5px] text-[var(--sg-text-secondary)]">
                            {p.type === 'hbond' ? 'H-Bond' : p.type}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {filteredContacts.map((c) => {
              const prop = AA_PROPERTIES[c.resName] || { type: 'Standard' };
              return (
                <div
                  key={`${c.chainId}_${c.resNum}`}
                  className="p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] hover:border-[var(--sg-border)] transition-all flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[12.5px]">
                      <span className="font-mono font-semibold text-[var(--sg-text-primary)]">
                        {c.resName} {c.resNum}
                      </span>
                      <span className="text-[var(--sg-text-tertiary)]">·</span>
                      <span className="font-mono text-[11px] text-[var(--sg-text-secondary)]">
                        Chain {c.chainId}
                      </span>
                      <span className="text-[var(--sg-text-tertiary)]">·</span>
                      <span className="text-[11px] text-[var(--sg-text-secondary)] truncate">
                        {prop.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--sg-text-secondary)] mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-[var(--sg-text-primary)]">{c.minDistance.toFixed(2)} Å</span>
                      <span>·</span>
                      <span>{c.contactCount} pairs</span>
                      <span>·</span>
                      <span className="font-mono text-[10.5px] text-[var(--sg-text-tertiary)]">{c.closestProteinAtom} ↔ {c.closestLigandAtom}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onFocusResidueIn3D(c)}
                    className="px-2 py-1 rounded-[4px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Focus</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with AI Agent Analysis Callout */}
      <div className="p-2.5 border-t border-[var(--sg-border)] bg-[var(--sg-surface)] flex items-center justify-between gap-2 shrink-0">
        {onAskAgent && activeLigandId ? (
          <button
            onClick={handleAskAgentAboutContacts}
            className="flex-1 py-1.5 px-3 rounded-[6px] bg-[#000000] hover:bg-[#222222] text-white text-[11.5px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <MessagesSquare className="w-3.5 h-3.5" />
            <span>Analyze Contacts in Chat</span>
          </button>
        ) : (
          <span className="text-[11px] text-[var(--sg-text-tertiary)]">
            {contacts.length} contacts within {cutoffDistance} Å
          </span>
        )}

        <button
          onClick={onClose}
          className="px-2.5 py-1.5 rounded-[6px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[11.5px] font-medium transition-all cursor-pointer shrink-0"
        >
          Back to Chat
        </button>
      </div>
    </div>
  );

  const host = portalTarget || (typeof document !== 'undefined' ? document.getElementById('right-sidebar-tool-host') : null);
  if (host) {
    return createPortal(panelContent, host);
  }

  return (
    <div className="fixed top-14 right-2.5 bottom-8 w-[350px] xl:w-[410px] z-[100000] flex flex-col">
      {panelContent}
    </div>
  );
};
