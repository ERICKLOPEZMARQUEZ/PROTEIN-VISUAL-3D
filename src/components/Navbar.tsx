import React from 'react';
import {
  GitCompare,
  ExternalLink,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { PDBMetadata } from '../types';
import { SearchBar } from './SearchBar';

interface NavbarProps {
  currentStructure: PDBMetadata | null;
  onSelectStructure: (id: string) => void;
  onSearch: (query: string) => void;
  compareMode: boolean;
  onToggleCompareMode: () => void;
  onOpenExportModal?: () => void;
  onDownloadPdb: () => void;
  isStreaming: boolean;
  isViewerMaximized?: boolean;
  onToggleMaximizeViewer?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStructure,
  onSelectStructure,
  onSearch,
  compareMode,
  onToggleCompareMode,
  isStreaming,
  isViewerMaximized = false,
  onToggleMaximizeViewer
}) => {
  return (
    <header className="h-[56px] border-b border-[var(--sg-border)] bg-[var(--sg-surface)] sticky top-0 z-40 px-3 md:px-4 flex items-center justify-between gap-3 shadow-[var(--sg-shadow-sm)] shrink-0">
      {/* Brand Logo & Title */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => onSelectStructure('6LU7')}
          title="Explore SARS-CoV-2 Mpro (6LU7)"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[14px] md:text-[15px] tracking-tight text-[var(--sg-text-primary)]">
              PDB Viewer
            </span>
          </div>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-[320px] md:max-w-[420px] lg:max-w-[500px] min-w-0">
        <SearchBar onSearch={onSearch} isLoading={isStreaming} compact={true} showPresets={false} />
      </div>

      {/* Right Action Controls with Complementary Color Accents */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Maximize / Restore Center 3D Canvas */}
        {onToggleMaximizeViewer && (
          <button
            onClick={onToggleMaximizeViewer}
            className={`px-2.5 md:px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              isViewerMaximized
                ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-xs'
                : 'bg-white hover:bg-slate-50 text-slate-800 hover:text-black border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
            title={isViewerMaximized ? 'Restore Side Panels' : 'Maximize 3D Canvas (Collapse Side Panels)'}
          >
            {isViewerMaximized ? (
              <Minimize2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#000000]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#000000]" />
            )}
            <span className="hidden xl:inline">{isViewerMaximized ? 'Restore' : 'Expand'}</span>
          </button>
        )}

        {/* Compare Mode Toggle */}
        <button
          onClick={onToggleCompareMode}
          className={`px-2.5 md:px-3 py-1.5 rounded-[6px] text-[12.5px] font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
            compareMode
              ? 'bg-slate-100 text-slate-900 border-slate-300 shadow-xs'
              : 'bg-white hover:bg-slate-50 text-slate-800 hover:text-black border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
          title="Compare two protein structures side-by-side"
        >
          <GitCompare className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#000000]" />
          <span className="hidden sm:inline">Compare</span>
        </button>

        {/* External Link */}
        {currentStructure && (
          <a
            href={
              currentStructure.source === 'alphafold' && currentStructure.uniprotId
                ? `https://alphafold.ebi.ac.uk/entry/${currentStructure.uniprotId}`
                : `https://www.rcsb.org/structure/${currentStructure.id}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-[6px] bg-white hover:bg-slate-50 text-slate-800 hover:text-black border border-slate-200 hover:border-slate-300 shadow-2xs transition-all hidden lg:inline-flex items-center justify-center cursor-pointer"
            title={`View in ${currentStructure.source === 'alphafold' ? 'AlphaFold DB' : 'RCSB PDB'}`}
          >
            <ExternalLink className="w-4 h-4 text-[#000000]" />
          </a>
        )}
      </div>
    </header>
  );
};

