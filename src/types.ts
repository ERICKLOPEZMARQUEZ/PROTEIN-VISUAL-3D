export type ViewerStyle = 'cartoon' | 'surface' | 'ball-and-stick' | 'ribbon' | 'spacefill' | 'backbone';

export type ColorScheme = 'chain' | 'secondary' | 'bfactor' | 'residue' | 'hydrophobicity' | 'uniform' | 'electrostatic';

export type SurfaceType = 'vdw' | 'sas' | 'ses';

export interface ChainInfo {
  chainId: string;
  name: string;
  sequenceLength: number;
  sequence?: string;
  polymerType: string;
  mw: number;
}

export interface LigandInfo {
  id: string;
  name: string;
  formula: string;
  mw: number;
  instanceCount: number;
  chemType?: string;
  smiles?: string;
  imageUrl?: string;
  bindingResidues?: string[];
}

export interface ValidationMetrics {
  rWork?: number;
  rFree?: number;
  clashscore?: number;
  ramachandranFavored?: number;
  ramachandranOutliers?: number;
}

export interface CitationInfo {
  title: string;
  journal: string;
  year: number;
  doi?: string;
  authors: string[];
}

export interface SecondaryStructureStats {
  helixPct: number;
  sheetPct: number;
  loopPct: number;
}

export interface AlphaFoldMetrics {
  uniprotAccession: string;
  entryVersion?: number;
  plddtMean: number;
  veryHighPct: number;   // > 90
  confidentPct: number;  // 70-90
  lowPct: number;        // 50-70
  veryLowPct: number;    // < 50
  modelUrlCif: string;
  modelUrlPdb: string;
  paeImageUrl?: string;
  sequenceLength: number;
  gene?: string;
  organismScientificName?: string;
}

export interface PDBMetadata {
  id: string;
  title: string;
  source: 'rcsb' | 'alphafold';
  experimentalMethod: string;
  resolution?: number | null;
  depositionDate: string;
  releaseDate?: string;
  organism: {
    scientificName: string;
    commonName?: string;
    taxId?: number;
  };
  chains: ChainInfo[];
  ligands: LigandInfo[];
  validation?: ValidationMetrics;
  citation?: CitationInfo;
  secondaryStructure?: SecondaryStructureStats;
  alphafoldMetrics?: AlphaFoldMetrics;
  uniprotId?: string;
  keywords?: string[];
  classification?: string;
  summary?: string;
}

export interface AgentTraceStep {
  id: string;
  timestamp: string;
  type: 'thought' | 'tool_call' | 'tool_result' | 'insight' | 'error';
  title: string;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  durationMs?: number;
}

export interface AgentInteraction {
  id: string;
  query: string;
  timestamp: string;
  response: string;
  traces: AgentTraceStep[];
  structure?: PDBMetadata;
  suggestedPrompts?: string[];
}

export interface SearchSuggestion {
  id: string;
  title: string;
  type: 'pdb' | 'uniprot' | 'keyword';
  method?: string;
  resolution?: number;
  organism?: string;
  sourceLabel?: string;
}

export interface ComparePair {
  structureA: PDBMetadata | null;
  structureB: PDBMetadata | null;
  idA: string;
  idB: string;
  activeTab: 'side-by-side' | 'metrics';
}
