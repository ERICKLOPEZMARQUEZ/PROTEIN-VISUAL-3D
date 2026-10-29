import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GitCompare, ArrowRightLeft, Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { PDBMetadata } from '../types';
import { MolstarViewer } from './MolstarViewer';
import { CLIENT_CURATED_STRUCTURES } from '../data/curatedFallback';

interface CompareViewProps {
  initialIdA?: string;
  initialIdB?: string;
  initialStructureA?: PDBMetadata | null;
  onClose: () => void;
}

const PRESET_PAIRS = [
  { idA: '6LU7', idB: '1CRN', label: '6LU7 vs 1CRN (Viral Protease vs Ultra-High Res)' },
  { idA: '4HHB', idB: 'P04637', label: '4HHB vs P04637 (X-ray Tetramer vs AlphaFold p53)' },
  { idA: '6LU7', idB: '4HHB', label: '6LU7 vs 4HHB (Drug Target vs Globin Fold)' }
];

export const CompareView: React.FC<CompareViewProps> = ({
  initialIdA = '6LU7',
  initialIdB = '1CRN',
  initialStructureA = null,
  onClose
}) => {
  const [inputA, setInputA] = useState(initialIdA);
  const [inputB, setInputB] = useState(initialIdB);
  const [activeIdA, setActiveIdA] = useState(initialIdA);
  const [activeIdB, setActiveIdB] = useState(initialIdB);

  // Initialize with initialStructureA or curated structures if available
  const [metaA, setMetaA] = useState<PDBMetadata | null>(() => {
    if (initialStructureA && (initialStructureA.id.toUpperCase() === initialIdA.toUpperCase() || initialStructureA.uniprotId?.toUpperCase() === initialIdA.toUpperCase())) {
      return initialStructureA;
    }
    return CLIENT_CURATED_STRUCTURES[initialIdA.toUpperCase()] || null;
  });

  const [metaB, setMetaB] = useState<PDBMetadata | null>(() => {
    return CLIENT_CURATED_STRUCTURES[initialIdB.toUpperCase()] || null;
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchBoth = useCallback(async (targetA: string, targetB: string) => {
    const cleanA = targetA.trim().toUpperCase() || '6LU7';
    const cleanB = targetB.trim().toUpperCase() || '1CRN';

    // Abort previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setErrorMessage(null);

    // Instant local hydration if curated
    if (CLIENT_CURATED_STRUCTURES[cleanA]) {
      setMetaA(CLIENT_CURATED_STRUCTURES[cleanA]);
    }
    if (CLIENT_CURATED_STRUCTURES[cleanB]) {
      setMetaB(CLIENT_CURATED_STRUCTURES[cleanB]);
    }

    try {
      const res = await fetch(`/api/compare?idA=${encodeURIComponent(cleanA)}&idB=${encodeURIComponent(cleanB)}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.structureA) setMetaA(data.structureA);
        if (data.structureB) setMetaB(data.structureB);
      } else {
        // Fallback: try individual structure endpoints
        const [resA, resB] = await Promise.allSettled([
          fetch(`/api/structure/${encodeURIComponent(cleanA)}`, { signal: controller.signal }).then(r => r.ok ? r.json() : null),
          fetch(`/api/structure/${encodeURIComponent(cleanB)}`, { signal: controller.signal }).then(r => r.ok ? r.json() : null)
        ]);

        if (resA.status === 'fulfilled' && resA.value) setMetaA(resA.value);
        if (resB.status === 'fulfilled' && resB.value) setMetaB(resB.value);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        // Ignored: intentional abort due to new request
        return;
      }
      console.warn('Comparative structure fetch returned notice, applying curated fallbacks:', err?.message || err);
      // Ensure we keep whatever curated fallbacks exist
      if (!metaA && CLIENT_CURATED_STRUCTURES[cleanA]) {
        setMetaA(CLIENT_CURATED_STRUCTURES[cleanA]);
      }
      if (!metaB && CLIENT_CURATED_STRUCTURES[cleanB]) {
        setMetaB(CLIENT_CURATED_STRUCTURES[cleanB]);
      }
      if (!metaA && !metaB && !CLIENT_CURATED_STRUCTURES[cleanA] && !CLIENT_CURATED_STRUCTURES[cleanB]) {
        setErrorMessage(`Could not retrieve structures for ${cleanA} and ${cleanB}. Please check the IDs or select a curated benchmark.`);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [metaA, metaB]);

  // Trigger on active ID change
  useEffect(() => {
    fetchBoth(activeIdA, activeIdB);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activeIdA, activeIdB]);

  const handleApplyComparison = () => {
    const nextA = inputA.trim().toUpperCase() || '6LU7';
    const nextB = inputB.trim().toUpperCase() || '1CRN';
    setActiveIdA(nextA);
    setActiveIdB(nextB);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyComparison();
    }
  };

  const handleSelectPreset = (idA: string, idB: string) => {
    setInputA(idA);
    setInputB(idB);
    setActiveIdA(idA);
    setActiveIdB(idB);
  };

  return (
    <div className="w-full h-full bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] p-4 shadow-[var(--sg-shadow-sm)] flex flex-col overflow-y-auto min-h-0 space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--sg-border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="font-semibold text-[15px] text-[var(--sg-text-primary)]">
              Structural Comparison Mode
            </h3>
            <p className="text-[12px] text-[var(--sg-text-secondary)]">
              Side-by-side 3D coordinate rendering and biochemical metrics comparison
            </p>
          </div>
        </div>

        {/* Input Pair & Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={inputA}
              onChange={(e) => setInputA(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 6LU7"
              className="w-24 px-2 py-1 bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] rounded-[4px] font-mono text-[12px] uppercase font-bold text-[var(--sg-text-primary)] text-center focus:outline-none focus:border-[var(--sg-accent)]"
              title="Enter first PDB ID or UniProt accession"
            />
            <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--sg-text-tertiary)] shrink-0" />
            <input
              type="text"
              value={inputB}
              onChange={(e) => setInputB(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 1CRN"
              className="w-24 px-2 py-1 bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] rounded-[4px] font-mono text-[12px] uppercase font-bold text-[var(--sg-text-primary)] text-center focus:outline-none focus:border-[var(--sg-accent)]"
              title="Enter second PDB ID or UniProt accession"
            />
            <button
              onClick={handleApplyComparison}
              disabled={loading}
              className="px-3 py-1 rounded-[4px] bg-[var(--sg-accent)] text-white text-[12px] font-medium hover:bg-[var(--sg-accent-hover)] disabled:opacity-50 transition-all flex items-center gap-1 shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Loading</span>
                </>
              ) : (
                'Compare'
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-tertiary)] hover:text-[var(--sg-text-primary)] transition-colors ml-1"
            title="Exit compare mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preset comparison pills */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <span className="text-[11px] font-medium text-[var(--sg-text-tertiary)] uppercase tracking-wider">Quick Benchmarks:</span>
        {PRESET_PAIRS.map((pair) => {
          const isSelected = activeIdA === pair.idA && activeIdB === pair.idB;
          return (
            <button
              key={`${pair.idA}-${pair.idB}`}
              onClick={() => handleSelectPreset(pair.idA, pair.idB)}
              className={`px-2.5 py-0.5 text-[11px] rounded-[4px] border font-mono transition-colors ${
                isSelected
                  ? 'bg-[var(--sg-accent-subtle)] border-[var(--sg-accent)] text-[var(--sg-accent)] font-semibold'
                  : 'bg-[var(--sg-surface-sunken)] border-[var(--sg-border)] text-[var(--sg-text-secondary)] hover:border-[var(--sg-text-tertiary)] hover:text-[var(--sg-text-primary)]'
              }`}
            >
              {pair.label}
            </button>
          );
        })}
      </div>

      {/* Inline Notice if error */}
      {errorMessage && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-[6px] flex items-center justify-between gap-3 text-[12px] text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => fetchBoth(activeIdA, activeIdB)}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-[11px] font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Side-by-side 3Dmol canvases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[460px]">
        <div className="flex flex-col h-[460px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] rounded-[6px] overflow-hidden p-2">
          <div className="text-[12px] font-mono font-bold text-[var(--sg-text-primary)] mb-1 px-1 flex items-center justify-between">
            <span className="truncate">Structure A: {metaA?.id || activeIdA}</span>
            <span className="text-[11px] text-[var(--sg-text-secondary)] font-normal shrink-0 ml-2">
              {metaA?.experimentalMethod || 'Coordinate Viewer'}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MolstarViewer structure={metaA} />
          </div>
        </div>

        <div className="flex flex-col h-[460px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] rounded-[6px] overflow-hidden p-2">
          <div className="text-[12px] font-mono font-bold text-[var(--sg-text-primary)] mb-1 px-1 flex items-center justify-between">
            <span className="truncate">Structure B: {metaB?.id || activeIdB}</span>
            <span className="text-[11px] text-[var(--sg-text-secondary)] font-normal shrink-0 ml-2">
              {metaB?.experimentalMethod || 'Coordinate Viewer'}
            </span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MolstarViewer structure={metaB} />
          </div>
        </div>
      </div>

      {/* Comparative Metrics Table */}
      {metaA && metaB && (
        <div className="border border-[var(--sg-border)] rounded-[6px] overflow-hidden">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--sg-border)] bg-[var(--sg-surface-hover)] text-[12px] text-[var(--sg-text-tertiary)] uppercase font-semibold">
                <th className="py-2 px-3">Metric</th>
                <th className="py-2 px-3 font-mono text-[var(--sg-text-primary)]">{metaA.id}</th>
                <th className="py-2 px-3 font-mono text-[var(--sg-text-primary)]">{metaB.id}</th>
                <th className="py-2 px-3 text-right">Differential</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sg-border-subtle)] text-[13px]">
              <tr className="hover:bg-[var(--sg-surface-hover)]">
                <td className="py-2 px-3 font-medium text-[var(--sg-text-secondary)]">Experimental Method</td>
                <td className="py-2 px-3">{metaA.experimentalMethod}</td>
                <td className="py-2 px-3">{metaB.experimentalMethod}</td>
                <td className="py-2 px-3 text-right text-[12px] font-mono text-[var(--sg-text-tertiary)]">—</td>
              </tr>
              <tr className="hover:bg-[var(--sg-surface-hover)]">
                <td className="py-2 px-3 font-medium text-[var(--sg-text-secondary)]">Resolution (Å)</td>
                <td className="py-2 px-3 font-mono font-bold">{metaA.resolution ? `${metaA.resolution} Å` : 'N/A'}</td>
                <td className="py-2 px-3 font-mono font-bold">{metaB.resolution ? `${metaB.resolution} Å` : 'N/A'}</td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--sg-accent)]">
                  {metaA.resolution && metaB.resolution ? `Δ ${(Math.abs(metaA.resolution - metaB.resolution)).toFixed(2)} Å` : 'N/A'}
                </td>
              </tr>
              <tr className="hover:bg-[var(--sg-surface-hover)]">
                <td className="py-2 px-3 font-medium text-[var(--sg-text-secondary)]">Polymer Chains</td>
                <td className="py-2 px-3 font-mono">{metaA.chains.length}</td>
                <td className="py-2 px-3 font-mono">{metaB.chains.length}</td>
                <td className="py-2 px-3 text-right font-mono text-[var(--sg-text-secondary)]">
                  Δ {Math.abs(metaA.chains.length - metaB.chains.length)}
                </td>
              </tr>
              <tr className="hover:bg-[var(--sg-surface-hover)]">
                <td className="py-2 px-3 font-medium text-[var(--sg-text-secondary)]">Bound Ligands</td>
                <td className="py-2 px-3 font-mono">{metaA.ligands.length}</td>
                <td className="py-2 px-3 font-mono">{metaB.ligands.length}</td>
                <td className="py-2 px-3 text-right font-mono text-[var(--sg-text-secondary)]">
                  Δ {Math.abs(metaA.ligands.length - metaB.ligands.length)}
                </td>
              </tr>
              <tr className="hover:bg-[var(--sg-surface-hover)]">
                <td className="py-2 px-3 font-medium text-[var(--sg-text-secondary)]">Clashscore</td>
                <td className="py-2 px-3 font-mono">{metaA.validation?.clashscore ?? 'N/A'}</td>
                <td className="py-2 px-3 font-mono">{metaB.validation?.clashscore ?? 'N/A'}</td>
                <td className="py-2 px-3 text-right font-mono text-[var(--sg-text-secondary)]">
                  {metaA.validation?.clashscore && metaB.validation?.clashscore ? (metaA.validation.clashscore - metaB.validation.clashscore).toFixed(1) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
