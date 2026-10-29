import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  MessagesSquare,
  Dna,
  Upload,
  Search,
  Sparkles,
  GitCompare,
  ArrowRight,
  CheckCircle2,
  Layers,
  FlaskConical
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { StructureMetadataCard } from './components/StructureMetadataCard';
import { MolstarViewer } from './components/MolstarViewer';
import { AgentPanel } from './components/AgentPanel';
import { CompareView } from './components/CompareView';
import { PDBMetadata, AgentTraceStep, LigandInfo } from './types';

// Curated benchmark structures for instant loading
const STARTER_STRUCTURES = [
  {
    id: '6LU7',
    name: 'SARS-CoV-2 Main Protease',
    detail: '1.70 Å • X-ray Diffraction • Bound inhibitor N3',
    organism: 'SARS-CoV-2',
    tag: 'Viral Protease',
    badgeClass: 'bg-transparent text-slate-600 border-slate-300',
    imageUrl: 'https://cdn.rcsb.org/images/structures/6lu7_assembly-1.jpeg'
  },
  {
    id: '1CRN',
    name: 'Crambin (Atomic Resolution)',
    detail: '0.54 Å • Atomic Resolution X-ray • Crambe abyssinica',
    organism: 'Crambe abyssinica',
    tag: 'Ultra-High Res',
    badgeClass: 'bg-transparent text-slate-600 border-slate-300',
    imageUrl: 'https://cdn.rcsb.org/images/structures/1crn_assembly-1.jpeg'
  },
  {
    id: '4HHB',
    name: 'Deoxyhemoglobin',
    detail: '1.74 Å • Allosteric Oxygen Transport Tetramer',
    organism: 'Homo sapiens',
    tag: 'Transport',
    badgeClass: 'bg-transparent text-slate-600 border-slate-300',
    imageUrl: 'https://cdn.rcsb.org/images/structures/4hhb_assembly-1.jpeg'
  },
  {
    id: 'P04637',
    name: 'Human p53 Tumor Suppressor',
    detail: 'AlphaFold DB Prediction • pLDDT 84.6 • DNA Binding',
    organism: 'Homo sapiens',
    tag: 'AlphaFold',
    badgeClass: 'bg-transparent text-slate-600 border-slate-300',
    imageUrl: 'https://cdn.rcsb.org/images/structures/1tup_assembly-1.jpeg'
  },
  {
    id: '1BNA',
    name: 'B-DNA Dodecamer',
    detail: '1.90 Å • Dickerson-Drew Right-Handed Double Helix',
    organism: 'Synthetic DNA',
    tag: 'Nucleic Acid',
    badgeClass: 'bg-transparent text-slate-600 border-slate-300',
    imageUrl: 'https://cdn.rcsb.org/images/structures/1bna_assembly-1.jpeg'
  },
  {
    id: '7KRR',
    name: 'SARS-CoV-2 Spike Trimer',
    detail: '2.60 Å • Cryo-EM Prefusion Conformation',
    organism: 'SARS-CoV-2',
    tag: 'Cryo-EM',
    badgeClass: 'bg-transparent text-slate-600 border-slate-300',
    imageUrl: 'https://cdn.rcsb.org/images/structures/7krr_assembly-1.jpeg'
  }
];

export default function App() {
  // App State - Note: No protein loaded by default per user request
  const [currentStructure, setCurrentStructure] = useState<PDBMetadata | null>(null);
  const [customCoordinates, setCustomCoordinates] = useState<string | null>(null);
  const [customCoordinatesFormat, setCustomCoordinatesFormat] = useState<'pdb' | 'cif'>('pdb');
  const [agentResponse, setAgentResponse] = useState<string>('');
  const [traces, setTraces] = useState<AgentTraceStep[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [selectedLigandId, setSelectedLigandId] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [contactMapLigandId, setContactMapLigandId] = useState<string | null>(null);
  const [openContactMapTrigger, setOpenContactMapTrigger] = useState<number>(0);
  const [hoveredAtomInfo, setHoveredAtomInfo] = useState<string | null>(null);
  const [isViewerExpanded, setIsViewerExpanded] = useState<boolean>(false);

  // Panel Collapsible State - All three panels independently collapsible to the sides
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(false);
  const [isViewerMaximized, setIsViewerMaximized] = useState<boolean>(false);

  const screenshotExportFnRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Chat conversation memory and sandbox environment ID for warm session context
  const sessionHistoryRef = useRef<Array<{ role: string; content: string }>>([]);
  const environmentIdRef = useRef<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stop active agent run
  const handleStopAgent = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Toggle maximize 3D viewer (collapsing both left & chat side panels)
  const handleToggleMaximizeViewer = () => {
    if (isViewerMaximized) {
      setIsLeftPanelOpen(true);
      setIsChatOpen(true);
      setIsViewerMaximized(false);
      setIsChatExpanded(false);
    } else {
      setIsLeftPanelOpen(false);
      setIsChatOpen(false);
      setIsViewerMaximized(true);
      setIsChatExpanded(false);
    }
  };

  // Toggle chat expansion to 50:50 split with center viewer (collapsing left structure details panel)
  const handleToggleChatExpand = () => {
    if (!isChatExpanded) {
      setIsChatExpanded(true);
      setIsLeftPanelOpen(false);
      setIsChatOpen(true);
      setIsViewerMaximized(false);
    } else {
      setIsChatExpanded(false);
      setIsLeftPanelOpen(true);
    }
  };

  const handleOpenLeftPanel = () => {
    setIsLeftPanelOpen(true);
    setIsChatExpanded(false);
  };

  const handleCloseChat = () => {
    setIsChatOpen(false);
    setIsChatExpanded(false);
  };

  // Fetch structure metadata directly or stream agent response
  const fetchStructureAndStreamAgent = useCallback(async (queryOrId: string, initialPrompt?: string) => {
    setIsStreaming(true);
    setTraces([]);
    setAgentResponse('');
    setSelectedLigandId(null);
    setSelectedChainId(null);
    setCustomCoordinates(null);

    const targetQuery = initialPrompt || queryOrId;
    let accumulatedText = '';

    // Abort any existing in-flight run
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          query: targetQuery,
          question: targetQuery,
          structureId: currentStructure?.id,
          environmentId: environmentIdRef.current,
          history: sessionHistoryRef.current
        })
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventType = 'message';
          let rawData = '';

          const eventLines = block.split('\n');
          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              eventType = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              rawData = line.replace('data: ', '').trim();
            }
          }

          if (!rawData) continue;

          try {
            const parsed = JSON.parse(rawData);

            if (eventType === 'step') {
              setTraces((prev) => [...prev, parsed]);
            } else if (eventType === 'session' && parsed.environmentId) {
              environmentIdRef.current = parsed.environmentId;
            } else if (eventType === 'token') {
              accumulatedText += parsed.text;
              setAgentResponse((prev) => prev + parsed.text);
            } else if (eventType === 'structure_ready') {
              setCurrentStructure(parsed);
            } else if (eventType === 'done') {
              setIsStreaming(false);
            }
          } catch {
            if (eventType === 'token') {
              accumulatedText += rawData;
              setAgentResponse((prev) => prev + rawData);
            }
          }
        }
      }

      // Save to session history if any response was generated
      if (accumulatedText.trim()) {
        sessionHistoryRef.current.push(
          { role: 'user', content: targetQuery },
          { role: 'agent', content: accumulatedText }
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.info('Agent run stopped by user');
      } else {
        console.error('SSE Stream error:', err);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [currentStructure?.id]);

  // Handle Search submit
  const handleSearch = (q: string) => {
    setCompareMode(false);
    fetchStructureAndStreamAgent(q);
  };

  // Handle Quick structure selection — load structure metadata & 3D model without auto-starting chat analysis
  const handleSelectStructure = async (id: string) => {
    setCompareMode(false);
    handleStopAgent();
    setTraces([]);
    setAgentResponse('');
    setSelectedLigandId(null);
    setSelectedChainId(null);
    setCustomCoordinates(null);
    sessionHistoryRef.current = [];

    try {
      const res = await fetch(`/api/structure/${encodeURIComponent(id)}`);
      if (res.ok) {
        const meta = await res.json();
        setCurrentStructure(meta);
      }
    } catch (err) {
      console.error('Failed to load structure metadata:', err);
    }
  };

  // Handle Ligand Focus in 3D
  const handleHighlightLigand = (ligandId: string) => {
    setSelectedLigandId(ligandId);
  };

  // Handle Ask Agent about specific ligand
  const handleAskAgentAboutLigand = (lig: LigandInfo) => {
    setIsChatOpen(true);
    fetchStructureAndStreamAgent(
      currentStructure?.id || '6LU7',
      `Analyze the bound ligand ${lig.id} (${lig.name}). Explain its binding affinity, contact residues (${lig.bindingResidues?.join(', ') || 'pocket'}), and chemical inhibition mechanism.`
    );
  };

  // Handle Local PDB/CIF file upload
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const filename = file.name;
      const id = filename.replace(/\.[^/.]+$/, '').toUpperCase().slice(0, 8);
      const format: 'pdb' | 'cif' = filename.toLowerCase().endsWith('.cif') ? 'cif' : 'pdb';

      let title = `${filename} (Local File)`;
      const titleMatch = text.match(/^TITLE\s+(.+)$/m);
      if (titleMatch) title = titleMatch[1].trim();

      const customMeta: PDBMetadata = {
        id,
        title,
        experimentalMethod: 'Uploaded Coordinates',
        depositionDate: new Date().toISOString().split('T')[0],
        source: 'rcsb',
        organism: { scientificName: 'Local coordinate file' },
        chains: [{ chainId: 'A', name: 'Polypeptide Chain A', sequenceLength: 100, polymerType: 'protein', mw: 11000 }],
        ligands: []
      };

      setCustomCoordinates(text);
      setCustomCoordinatesFormat(format);
      setCurrentStructure(customMeta);
      setAgentResponse(`Loaded local coordinate file **${filename}** (${(text.length / 1024).toFixed(1)} KB). You can now explore the 3D model, change representation styles, inspect measurements, or ask questions.`);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Download PDB file
  const handleDownloadPdb = () => {
    if (!currentStructure) return;
    const cleanId = currentStructure.id;
    const isAf = currentStructure.source === 'alphafold';
    const downloadUrl = isAf && currentStructure.alphafoldMetrics
      ? currentStructure.alphafoldMetrics.modelUrlPdb
      : `https://files.rcsb.org/download/${cleanId}.pdb`;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${cleanId}.pdb`;
    a.target = '_blank';
    a.click();
  };

  // Open Export modal in right sidebar
  const handleOpenExportModal = () => {
    setIsChatOpen(true);
    if ((screenshotExportFnRef.current as any)?.openExportModal) {
      (screenshotExportFnRef.current as any).openExportModal();
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--sg-page)]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdb,.cif,.ent,.mmcif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
          }
        }}
      />

      {/* 56px Top Header with integrated search bar & panel controls */}
      <Navbar
        currentStructure={currentStructure}
        onSelectStructure={handleSelectStructure}
        onSearch={handleSearch}
        compareMode={compareMode}
        onToggleCompareMode={() => {
          const next = !compareMode;
          setCompareMode(next);
          if (next) {
            setIsChatOpen(false);
            setIsChatExpanded(false);
          }
        }}
        onOpenExportModal={handleOpenExportModal}
        onDownloadPdb={handleDownloadPdb}
        isStreaming={isStreaming}
        isViewerMaximized={isViewerMaximized}
        onToggleMaximizeViewer={handleToggleMaximizeViewer}
      />

      {/* Main Workspace Area: Three full-height panels extending fully to the bottom */}
      <main className="flex-1 min-h-0 w-full flex flex-row overflow-hidden p-2.5 gap-2.5">
        {/* PANEL 1 (LEFT): Structure Metadata & Properties */}
        {isLeftPanelOpen ? (
          <div className="w-[340px] xl:w-[390px] h-full shrink-0 flex flex-col min-w-0 transition-all duration-200">
            {currentStructure ? (
              <StructureMetadataCard
                structure={currentStructure}
                onHighlightLigand={handleHighlightLigand}
                onOpenContactMap={(ligId) => {
                  setSelectedLigandId(ligId);
                  setContactMapLigandId(ligId);
                  setOpenContactMapTrigger((prev) => prev + 1);
                }}
                onSelectChain={(chainId) => setSelectedChainId(chainId)}
                onAskAgentAboutLigand={handleAskAgentAboutLigand}
                onOpenExportModal={handleOpenExportModal}
                onClose={() => setIsLeftPanelOpen(false)}
              />
            ) : (
              /* Starter Left Panel when no protein loaded yet */
              <div className="bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] shadow-[var(--sg-shadow-sm)] flex flex-col h-full overflow-hidden min-w-0">
                <div className="p-3.5 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface-hover)] flex items-center justify-between shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <span className="font-semibold text-[13.5px] text-[var(--sg-text-primary)] block">
                        Structure Details
                      </span>
                      <p className="text-[11px] text-[var(--sg-text-secondary)] truncate">
                        Upload a local file or use one of the presets from the list below
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsLeftPanelOpen(false)}
                    className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all cursor-pointer shrink-0"
                    title="Collapse Left Panel"
                    aria-label="Collapse Left Panel"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
                  <div className="space-y-1.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-3.5 py-2.5 rounded-[6px] border border-[var(--sg-border)] hover:border-slate-300 bg-white hover:bg-slate-50 text-[var(--sg-text-primary)] font-medium text-[12.5px] flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-[#000000] shrink-0" />
                      <span>Upload Local PDB / mmCIF File</span>
                    </button>
                    <div className="text-[10px] leading-snug text-[var(--sg-text-tertiary)] space-y-1 px-0.5">
                      <p>
                        By using this feature, you confirm that you have the necessary rights to any content that you upload. Do not generate content that infringes on others’ intellectual property or privacy rights. Your use of this generative AI service is subject to our{' '}
                        <a
                          href="https://policies.google.com/terms/generative-ai/use-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-[var(--sg-text-secondary)]"
                        >
                          Prohibited Use Policy
                        </a>
                        .
                      </p>
                      <p>
                        Please note that uploads, including those from Google Workspace, may be used to develop and improve Google products and services in accordance with our{' '}
                        <a
                          href="https://ai.google.dev/gemini-api/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-[var(--sg-text-secondary)]"
                        >
                          terms
                        </a>
                        .
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11.5px] font-semibold text-[var(--sg-text-tertiary)] uppercase tracking-wider mb-2">
                      Quick Benchmark Presets
                    </h4>
                    <div className="space-y-1.5">
                      {STARTER_STRUCTURES.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectStructure(item.id)}
                          className="w-full p-2.5 rounded-[6px] text-left border border-[var(--sg-border)] bg-white hover:bg-slate-50 transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[12.5px] text-[var(--sg-text-primary)]">
                                {item.id}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-[3px] border font-medium ${item.badgeClass}`}>
                                {item.tag}
                              </span>
                            </div>
                            <p className="text-[11.5px] text-[var(--sg-text-secondary)] truncate mt-0.5">
                              {item.name}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Left Collapsed Rail */
          <div
            onClick={handleOpenLeftPanel}
            className="w-[36px] h-full shrink-0 flex flex-col items-center justify-between py-3 bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] cursor-pointer hover:bg-[var(--sg-surface-hover)] shadow-xs transition-all select-none group"
            title="Expand Left Panel (Structure Details)"
          >
            <button
              className="p-1 rounded-[4px] text-[var(--sg-text-secondary)] group-hover:text-[var(--sg-accent)] transition-colors"
              aria-label="Expand Left Panel"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <div className="[writing-mode:vertical-rl] rotate-180 text-[11.5px] font-medium text-[var(--sg-text-secondary)] tracking-wide group-hover:text-[var(--sg-text-primary)] transition-colors whitespace-nowrap">
              Structure Details
            </div>
            <Layers className="w-3.5 h-3.5 text-[var(--sg-text-tertiary)] group-hover:text-[var(--sg-accent)] transition-colors" />
          </div>
        )}

        {/* PANEL 2 (CENTER): 3D Canvas / Welcome Explorer / Compare View */}
        <div
          className={`h-full min-h-0 flex flex-col min-w-0 transition-all duration-300 ${
            isChatExpanded && isChatOpen
              ? 'flex-1 md:w-1/2 md:max-w-[50%]'
              : 'flex-1'
          }`}
        >
          {compareMode ? (
            <CompareView
              initialIdA={currentStructure?.id || '6LU7'}
              initialIdB="1CRN"
              initialStructureA={currentStructure}
              onClose={() => setCompareMode(false)}
            />
          ) : currentStructure ? (
            <MolstarViewer
              structure={currentStructure}
              customCoordinates={customCoordinates}
              customCoordinatesFormat={customCoordinatesFormat}
              selectedLigandId={selectedLigandId}
              selectedChainId={selectedChainId}
              openContactMapTrigger={openContactMapTrigger}
              contactMapLigandId={contactMapLigandId}
              onHoverAtom={(info) => setHoveredAtomInfo(info)}
              onToggleExpand={(expanded) => setIsViewerExpanded(expanded)}
              onOpenRightSidebar={() => setIsChatOpen(true)}
              onDownloadPdb={handleDownloadPdb}
              onAskAgent={(prompt) => {
                setIsChatOpen(true);
                fetchStructureAndStreamAgent(currentStructure?.id || '6LU7', prompt);
              }}
              viewerRefCallback={(fn) => {
                screenshotExportFnRef.current = fn;
              }}
            />
          ) : (
            /* Starter / Welcome Screen in 3D Canvas Area */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full h-full rounded-[8px] border bg-[var(--sg-surface)] shadow-[var(--sg-shadow-sm)] flex flex-col items-center justify-start pt-[40px] px-6 pb-6 text-center relative overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar transition-all ${
                isDraggingFile
                  ? 'border-indigo-400 bg-indigo-50/20'
                  : 'border-[var(--sg-border)]'
              }`}
            >
              <div className="max-w-[720px] w-full flex flex-col items-center pb-6">
                <h1 className="text-[24px] md:text-[28px] font-bold text-[var(--sg-text-primary)] tracking-tight mb-2">
                  Protein Structure Viewer
                </h1>

                <p className="text-[13.5px] md:text-[14px] text-[var(--sg-text-secondary)] max-w-[540px] leading-relaxed mb-6">
                  Interactive real-time 3D coordinate exploration for experimentally-determined RCSB PDB structures and AlphaFold predicted models. Load an experimental or AI-predicted protein to inspect resolution, chains, binding pockets, and ligand chemistry.
                </p>

                {/* Benchmark Structure Cards: 2 cards per row, 2 columns per card (image, text) + CTA row */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6 text-left">
                  {STARTER_STRUCTURES.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectStructure(item.id)}
                      className="p-3 rounded-[8px] bg-[var(--sg-surface-sunken)] hover:bg-white border border-[var(--sg-border-subtle)] shadow-2xs hover:shadow-xs transition-all group flex flex-col justify-between cursor-pointer text-left"
                    >
                      {/* Top content: Two columns (First column image, Second column text) */}
                      <div className="flex items-start gap-3 w-full text-left">
                        {/* First column: Image */}
                        <div className="w-20 h-20 sm:w-22 sm:h-22 shrink-0 rounded-[5px] overflow-hidden bg-white border border-[var(--sg-border-subtle)] flex items-center justify-center p-1">
                          <img
                            src={item.imageUrl}
                            alt={`${item.name} biological assembly`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>

                        {/* Second column: Text */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5 mb-1 text-left">
                            <span className="font-mono font-bold text-[13px] text-[var(--sg-text-primary)]">
                              {item.id}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-[3px] border font-medium ${item.badgeClass}`}>
                              {item.tag}
                            </span>
                          </div>
                          <h4 className="text-[12px] font-semibold text-[var(--sg-text-primary)] truncate text-left">
                            {item.name}
                          </h4>
                          <p className="text-[11px] text-[var(--sg-text-secondary)] mt-0.5 line-clamp-2 text-left">
                            {item.detail}
                          </p>
                        </div>
                      </div>

                      {/* Row of CTA and Arrow */}
                      <div className="mt-2.5 pt-2 border-t border-[var(--sg-border-subtle)] flex items-center justify-between text-[11px] text-[#000000] font-medium w-full">
                        <span className="text-[#000000]">Load in 3D</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#000000] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PANEL 3 (RIGHT): Chat Assistant & Unified Tool Panels (Open & Collapsible to right) */}
        {isChatOpen ? (
          <div
            className={`relative h-full flex flex-col min-w-0 transition-all duration-300 ${
              isChatExpanded
                ? 'flex-1 md:w-1/2 md:max-w-[50%]'
                : 'w-[350px] xl:w-[410px] shrink-0'
            }`}
          >
            <AgentPanel
              currentResponse={agentResponse}
              traces={traces}
              isStreaming={isStreaming}
              structure={currentStructure}
              onSendPrompt={(p) => fetchStructureAndStreamAgent(currentStructure?.id || '6LU7', p)}
              onStopAgent={handleStopAgent}
              onClose={handleCloseChat}
              isExpanded={isChatExpanded}
              onToggleExpand={handleToggleChatExpand}
            />
            <div
              id="right-sidebar-tool-host"
              className="absolute inset-0 z-20 pointer-events-none [&>*]:pointer-events-auto empty:hidden"
            />
          </div>
        ) : (
          /* Right Collapsed Rail */
          <div
            onClick={() => setIsChatOpen(true)}
            className="w-[36px] h-full shrink-0 flex flex-col items-center justify-between py-3 bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] cursor-pointer hover:bg-[var(--sg-surface-hover)] shadow-xs transition-all select-none group"
            title="Expand Chat Assistant"
          >
            <button
              className="p-1 rounded-[4px] text-[var(--sg-text-secondary)] group-hover:text-[var(--sg-accent)] transition-colors"
              aria-label="Expand Chat Assistant"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
            <div className="[writing-mode:vertical-rl] text-[11.5px] font-medium text-[var(--sg-text-secondary)] tracking-wide group-hover:text-[var(--sg-text-primary)] transition-colors whitespace-nowrap">
              Chat Assistant
            </div>
            <MessagesSquare className="w-4 h-4 text-[var(--sg-accent)] group-hover:scale-110 transition-transform" />
          </div>
        )}
      </main>

      {/* Fixed Footer at the bottom of the app */}
      <footer className="shrink-0 w-full py-1.5 px-4 bg-[var(--sg-surface)] border-t border-[var(--sg-border)] text-center z-30">
        <p className="text-[11.5px] text-[var(--sg-text-tertiary)] leading-tight select-none">
          Generative AI can make mistakes and may display inaccurate information, so double-check responses.
        </p>
      </footer>
    </div>
  );
}
