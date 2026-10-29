import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  RotateCw,
  Maximize2,
  Minimize2,
  Layers,
  Palette,
  Eye,
  Sliders,
  Ruler,
  Compass,
  HelpCircle,
  X,
  Trash2,
  MousePointer,
  Move,
  Search,
  Check,
  ChevronRight,
  Presentation,
  Box,
  Zap,
  Camera,
  Film,
  Activity,
  Video,
  Download
} from 'lucide-react';
import { PDBMetadata, ViewerStyle, ColorScheme } from '../types';
import { ExportModal } from './ExportModal';
import { ContactMapModal, LigandContactResidue } from './ContactMapModal';
import { MovieMakerModal } from './MovieMakerModal';

declare global {
  interface Window {
    $3Dmol?: any;
  }
}

// Ensure 3Dmol colorscheme dictionary has all needed schemes defined to avoid warnings
function ensure3DmolColorSchemes() {
  if (typeof window === 'undefined' || !window.$3Dmol) return;

  if (window.$3Dmol.colorschemes) {
    // Map 'element' alias to standard Jmol / default CPK element colors
    if (!window.$3Dmol.colorschemes.element) {
      window.$3Dmol.colorschemes.element =
        window.$3Dmol.colorschemes.default ||
        window.$3Dmol.colorschemes.Jmol ||
        { prop: 'elem' };
    }

    // Map 'charge' / 'electrostatic'
    if (!window.$3Dmol.colorschemes.charge) {
      window.$3Dmol.colorschemes.charge = {
        prop: 'charge',
        gradient: 'rwb',
        min: -1,
        max: 1,
      };
    }

    // Map 'plddt' / 'bfactor'
    if (!window.$3Dmol.colorschemes.plddt) {
      window.$3Dmol.colorschemes.plddt = {
        prop: 'b',
        gradient: 'roygb',
        min: 40,
        max: 100,
      };
    }

    // Map 'hydrophobicity'
    if (!window.$3Dmol.colorschemes.hydrophobicity) {
      window.$3Dmol.colorschemes.hydrophobicity = {
        prop: 'hydrophobicity',
        gradient: 'sinebow',
        min: 0,
        max: 100,
      };
    }
  }
}

interface ColorSchemeItem {
  id: ColorScheme;
  label: string;
  swatchGradient: string;
  legend: { label: string; bg: string }[];
}

const COLOR_SCHEME_ITEMS: ColorSchemeItem[] = [
  {
    id: 'chain',
    label: 'Subunits / Chain',
    swatchGradient: 'bg-gradient-to-r from-sky-400 via-emerald-400 via-amber-400 to-rose-400',
    legend: [
      { label: 'Chain A', bg: 'bg-sky-400' },
      { label: 'Chain B', bg: 'bg-emerald-400' },
      { label: 'Chain C', bg: 'bg-amber-400' },
      { label: 'Chain D', bg: 'bg-rose-400' },
    ]
  },
  {
    id: 'secondary',
    label: 'Secondary (PyMOL)',
    swatchGradient: 'bg-gradient-to-r from-rose-500 via-amber-400 to-slate-400',
    legend: [
      { label: 'α-Helix', bg: 'bg-rose-500' },
      { label: 'β-Sheet', bg: 'bg-amber-500' },
      { label: 'Coil / Loop', bg: 'bg-slate-400' },
    ]
  },
  {
    id: 'bfactor',
    label: 'pLDDT / B-Factor',
    swatchGradient: 'bg-gradient-to-r from-blue-600 via-cyan-400 via-amber-400 to-orange-500',
    legend: [
      { label: '>90 Very High', bg: 'bg-blue-600' },
      { label: '70-90 Confident', bg: 'bg-cyan-400' },
      { label: '50-70 Low', bg: 'bg-amber-400' },
      { label: '<50 Disordered', bg: 'bg-orange-500' },
    ]
  },
  {
    id: 'residue',
    label: 'Amino Chemistry',
    swatchGradient: 'bg-gradient-to-r from-emerald-500 via-sky-400 via-rose-400 to-blue-500',
    legend: [
      { label: 'Hydrophobic', bg: 'bg-emerald-500' },
      { label: 'Polar', bg: 'bg-sky-400' },
      { label: 'Acidic (-)', bg: 'bg-rose-500' },
      { label: 'Basic (+)', bg: 'bg-blue-500' },
    ]
  },
  {
    id: 'electrostatic',
    label: 'Electrostatic',
    swatchGradient: 'bg-gradient-to-r from-red-500 via-slate-100 to-blue-600 border border-slate-300',
    legend: [
      { label: '-1 e Acidic', bg: 'bg-red-500' },
      { label: 'Neutral (0)', bg: 'bg-slate-300' },
      { label: '+1 e Basic', bg: 'bg-blue-600' },
    ]
  },
  {
    id: 'hydrophobicity',
    label: 'Hydrophobicity',
    swatchGradient: 'bg-gradient-to-r from-amber-600 via-amber-200 to-sky-500',
    legend: [
      { label: 'Hydrophobic', bg: 'bg-amber-600' },
      { label: 'Neutral', bg: 'bg-amber-200' },
      { label: 'Hydrophilic', bg: 'bg-sky-500' },
    ]
  },
  {
    id: 'uniform',
    label: 'Uniform Emerald',
    swatchGradient: 'bg-[var(--sg-accent)]',
    legend: [
      { label: 'Emerald Monochrome (#059669)', bg: 'bg-[var(--sg-accent)]' }
    ]
  }
];

interface MolstarViewerProps {
  structure: PDBMetadata | null;
  customCoordinates?: string | null;
  customCoordinatesFormat?: 'pdb' | 'cif';
  selectedLigandId?: string | null;
  selectedChainId?: string | null;
  ligandFocusTrigger?: number;
  openContactMapTrigger?: number;
  contactMapLigandId?: string | null;
  onHoverAtom?: (atomInfo: string | null) => void;
  viewerRefCallback?: (exportFn: () => void) => void;
  onToggleExpand?: (isExpanded: boolean) => void;
  onOpenRightSidebar?: () => void;
  onDownloadPdb?: () => void;
  onAskAgent?: (prompt: string) => void;
}

export const MolstarViewer: React.FC<MolstarViewerProps> = ({
  structure,
  customCoordinates,
  customCoordinatesFormat = 'pdb',
  selectedLigandId,
  selectedChainId,
  ligandFocusTrigger,
  openContactMapTrigger,
  contactMapLigandId,
  onHoverAtom,
  viewerRefCallback,
  onToggleExpand,
  onOpenRightSidebar,
  onDownloadPdb,
  onAskAgent
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const glViewerRef = useRef<any>(null);

  // Viewer state
  const [style, setStyle] = useState<ViewerStyle>('cartoon');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('chain');
  const [isSpinning, setIsSpinning] = useState<boolean>(true);
  const [isRocking, setIsRocking] = useState<boolean>(false);
  const [spinSpeed, setSpinSpeed] = useState<number>(0.8);
  const [bgColor, setBgColor] = useState<'light' | 'dark' | 'transparent'>('light');
  const [isExpandedModal, setIsExpandedModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [isLoadingCoordinates, setIsLoadingCoordinates] = useState<boolean>(false);
  const [measureMode, setMeasureMode] = useState<boolean>(false);
  const [selectedAtomsForDist, setSelectedAtomsForDist] = useState<any[]>([]);
  const [distanceResult, setDistanceResult] = useState<number | null>(null);
  const [hoveredResidue, setHoveredResidue] = useState<string | null>(null);
  const [showControlsDrawer, setShowControlsDrawer] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportInitialTab, setExportInitialTab] = useState<'slides' | 'video' | '3dmodels' | 'scripts'>('slides');
  const [showContactMapModal, setShowContactMapModal] = useState<boolean>(false);
  const [showMovieMakerModal, setShowMovieMakerModal] = useState<boolean>(false);
  const [activeContactMapLigand, setActiveContactMapLigand] = useState<string | null>(null);
  const [coordinateData, setCoordinateData] = useState<string>('');
  const [coordinateFormat, setCoordinateFormat] = useState<string>('pdb');
  const [isPerformanceMode, setIsPerformanceMode] = useState<boolean>(false);

  const lastHoveredAtomRef = useRef<string | null>(null);
  const rafHoverRef = useRef<number | null>(null);
  const loadedStructureIdRef = useRef<string | null>(null);

  // Keep ref for measureMode to avoid re-fetching coordinates when toggling ruler
  const measureModeRef = useRef<boolean>(false);
  useEffect(() => {
    measureModeRef.current = measureMode;
  }, [measureMode]);

  // Open Contact Map externally if requested (e.g. from ligand card)
  useEffect(() => {
    if (openContactMapTrigger && openContactMapTrigger > 0) {
      if (contactMapLigandId) {
        setActiveContactMapLigand(contactMapLigandId);
      } else if (selectedLigandId) {
        setActiveContactMapLigand(selectedLigandId);
      } else if (structure?.ligands && structure.ligands.length > 0) {
        setActiveContactMapLigand(structure.ligands[0].id);
      }
      setShowExportModal(false);
      setShowMovieMakerModal(false);
      setShowContactMapModal(true);
      onOpenRightSidebar?.();
    }
  }, [openContactMapTrigger, contactMapLigandId, selectedLigandId, structure, onOpenRightSidebar]);

  // Update representation in 3Dmol viewer
  const applyStyles = useCallback((viewer: any, currentStyle: ViewerStyle, currentColors: ColorScheme) => {
    if (!viewer) return;

    ensure3DmolColorSchemes();

    viewer.removeAllSurfaces();

    // 1. Color mapping definition
    let colorSpec: any = {};

    if (currentColors === 'chain') {
      colorSpec = { colorscheme: 'chain' };
    } else if (currentColors === 'secondary') {
      colorSpec = { colorscheme: 'ssPyMOL' };
    } else if (currentColors === 'bfactor') {
      // pLDDT or B-factor gradient (blue -> cyan -> yellow -> orange)
      colorSpec = { colorscheme: { prop: 'b', gradient: 'roygb', min: 40, max: 100 } };
    } else if (currentColors === 'residue') {
      colorSpec = { colorscheme: 'amino' };
    } else if (currentColors === 'electrostatic') {
      colorSpec = { colorscheme: { prop: 'charge', gradient: 'rwb', min: -1, max: 1 } };
    } else if (currentColors === 'hydrophobicity') {
      colorSpec = { colorscheme: { prop: 'hydrophobicity', gradient: 'sinebow', min: 0, max: 100 } };
    } else if (currentColors === 'uniform') {
      colorSpec = { color: '#059669' };
    } else {
      colorSpec = { colorscheme: 'default' };
    }

    // 2. Polymer representation
    const polymerSel = { hetflag: false };

    if (currentStyle === 'cartoon') {
      viewer.setStyle(polymerSel, {
        cartoon: {
          ...colorSpec,
          thickness: isPerformanceMode ? 0.28 : 0.4,
          arrows: !isPerformanceMode
        }
      });
    } else if (currentStyle === 'surface') {
      if (isPerformanceMode) {
        // Fast representation in performance mode
        viewer.setStyle(polymerSel, { cartoon: { ...colorSpec, thickness: 0.3 } });
      } else {
        viewer.setStyle(polymerSel, { cartoon: { opacity: 0.2, ...colorSpec } });
        viewer.addSurface(window.$3Dmol.SurfaceType?.SAS || 1, {
          opacity: 0.88,
          ...colorSpec
        }, polymerSel);
      }
    } else if (currentStyle === 'ball-and-stick') {
      viewer.setStyle(polymerSel, {
        stick: { radius: isPerformanceMode ? 0.12 : 0.16, ...colorSpec },
        sphere: { scale: isPerformanceMode ? 0.2 : 0.24, ...colorSpec }
      });
    } else if (currentStyle === 'ribbon') {
      viewer.setStyle(polymerSel, { ribbon: { ...colorSpec, thickness: 0.3 } });
    } else if (currentStyle === 'spacefill') {
      viewer.setStyle(polymerSel, { sphere: { ...colorSpec, scale: 0.95 } });
    } else if (currentStyle === 'backbone') {
      viewer.setStyle(polymerSel, { line: { ...colorSpec, linewidth: 2 } });
    }

    // 3. Highlight bound non-polymer ligands in Ball & Stick + CPK coloring
    const ligandSel = { hetflag: true };
    viewer.setStyle(ligandSel, {
      stick: { radius: 0.32, colorscheme: 'default' },
      sphere: { scale: 0.4, colorscheme: 'default' }
    });

    // 4. If a specific chain is selected, isolate or highlight it
    if (selectedChainId) {
      viewer.setStyle({ chain: selectedChainId }, {
        cartoon: { color: '#059669', thickness: 0.6 }
      });
    }

    // 5. If a specific ligand is selected, centrally focus camera and highlight with glowing sticks
    if (selectedLigandId) {
      viewer.resize();
      const ligandSelector = {
        resn: [selectedLigandId, selectedLigandId.toUpperCase(), selectedLigandId.toLowerCase()]
      };
      viewer.setStyle(ligandSelector, {
        stick: { radius: 0.45, colorscheme: 'default' },
        sphere: { scale: 0.55, colorscheme: 'default' }
      });
      viewer.center(ligandSelector, 600);
      viewer.zoomTo(ligandSelector, 600);
    }

    viewer.render();
  }, [selectedChainId, selectedLigandId, ligandFocusTrigger, isPerformanceMode]);

  // Load and render structure coordinates
  const loadStructureData = useCallback(async () => {
    if (!structure || !containerRef.current || !window.$3Dmol) return;

    // Avoid reloading if the exact same structure ID is already in memory
    if (glViewerRef.current && loadedStructureIdRef.current === structure.id) {
      applyStyles(glViewerRef.current, style, colorScheme);
      return;
    }

    setIsLoadingCoordinates(true);

    try {
      // Clear previous canvas
      containerRef.current.innerHTML = '';

      // Initialize 3Dmol viewer
      const config = {
        backgroundColor: bgColor === 'light' ? '#FFFFFF' : bgColor === 'dark' ? '#111110' : '#00000000',
        antialias: !isPerformanceMode,
        preserveDrawingBuffer: true
      };

      const viewer = window.$3Dmol.createViewer(containerRef.current, config);
      glViewerRef.current = viewer;
      loadedStructureIdRef.current = structure.id;

      // Fetch PDB or mmCIF coordinate text from proxy
      const cleanId = structure.id;
      let format = customCoordinatesFormat || 'pdb';
      let data = customCoordinates || '';
      let res: Response | null = null;

      if (!data) {
        res = await fetch(`/api/pdb-proxy/${cleanId}?format=pdb`);
        if (res.ok) {
          data = await res.text();
        }
      }

      // If PDB format is not found or empty (e.g. mmCIF-only entries), try mmCIF
      if (!data || data.trim().length === 0 || data.includes('Coordinate file not available')) {
        res = await fetch(`/api/pdb-proxy/${cleanId}?format=cif`);
        if (res.ok) {
          data = await res.text();
          format = 'cif';
        }
      }

      // Fallback to direct AlphaFold or RCSB URL
      if (!data || data.trim().length === 0 || data.includes('Coordinate file not available')) {
        const directUrl = structure.source === 'alphafold' && structure.alphafoldMetrics
          ? structure.alphafoldMetrics.modelUrlPdb || structure.alphafoldMetrics.modelUrlCif
          : `https://files.rcsb.org/download/${cleanId}.cif`;
        const directRes = await fetch(directUrl);
        if (directRes.ok) {
          data = await directRes.text();
          format = directUrl.endsWith('.cif') ? 'cif' : 'pdb';
        }
      }

      if (data && data.trim().length > 0 && !data.includes('Coordinate file not available')) {
        setCoordinateData(data);
        setCoordinateFormat(format);
        viewer.addModel(data, format);
        applyStyles(viewer, style, colorScheme);
        viewer.zoomTo();
        viewer.render();

        // Atom hover interaction throttled to prevent frame drops
        if (isPerformanceMode) {
          viewer.setHoverable({}, false);
        } else {
          viewer.setHoverable(
            {},
            true,
            (atom: any) => {
              if (rafHoverRef.current) cancelAnimationFrame(rafHoverRef.current);
              rafHoverRef.current = requestAnimationFrame(() => {
                if (!atom) {
                  if (lastHoveredAtomRef.current !== null) {
                    lastHoveredAtomRef.current = null;
                    setHoveredResidue(null);
                    onHoverAtom?.(null);
                  }
                  return;
                }
                const info = `${atom.resn}${atom.resi} (${atom.chain ? `Chain ${atom.chain}` : ''}) • Atom: ${atom.atom}`;
                if (lastHoveredAtomRef.current !== info) {
                  lastHoveredAtomRef.current = info;
                  setHoveredResidue(info);
                  onHoverAtom?.(info);
                }
              });
            },
            () => {
              if (lastHoveredAtomRef.current !== null) {
                lastHoveredAtomRef.current = null;
                setHoveredResidue(null);
                onHoverAtom?.(null);
              }
            }
          );
        }

        // Click atom for distance measurement & selection
        viewer.setClickable({}, true, (atom: any) => {
          if (!atom) return;

          if (measureModeRef.current) {
            setSelectedAtomsForDist((prev) => {
              if (prev.length === 0) {
                // First atom selected
                viewer.addSphere({
                  center: { x: atom.x, y: atom.y, z: atom.z },
                  radius: 0.65,
                  color: '#F59E0B'
                });
                viewer.addLabel(`${atom.resn}${atom.resi}:${atom.atom}`, {
                  position: { x: atom.x, y: atom.y, z: atom.z },
                  backgroundColor: '#1E293B',
                  fontColor: '#F59E0B',
                  fontSize: 11,
                  inFront: true
                });
                viewer.render();
                return [atom];
              } else if (prev.length === 1) {
                // Second atom selected
                const a1 = prev[0];
                const a2 = atom;

                viewer.addSphere({
                  center: { x: a2.x, y: a2.y, z: a2.z },
                  radius: 0.65,
                  color: '#10B981'
                });
                viewer.addLabel(`${a2.resn}${a2.resi}:${a2.atom}`, {
                  position: { x: a2.x, y: a2.y, z: a2.z },
                  backgroundColor: '#1E293B',
                  fontColor: '#10B981',
                  fontSize: 11,
                  inFront: true
                });

                const dx = a1.x - a2.x;
                const dy = a1.y - a2.y;
                const dz = a1.z - a2.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                setDistanceResult(dist);

                // Add 3D measurement dashed line
                viewer.addLine({
                  start: { x: a1.x, y: a1.y, z: a1.z },
                  end: { x: a2.x, y: a2.y, z: a2.z },
                  color: '#F59E0B',
                  dashed: true,
                  linewidth: 3.5
                });

                // Add distance midpoint label
                viewer.addLabel(`${dist.toFixed(2)} Å`, {
                  position: {
                    x: (a1.x + a2.x) / 2,
                    y: (a1.y + a2.y) / 2,
                    z: (a1.z + a2.z) / 2
                  },
                  backgroundColor: '#0F172A',
                  fontColor: '#F59E0B',
                  fontSize: 13,
                  fontWeight: 'bold',
                  borderRadius: 4,
                  inFront: true
                });
                viewer.render();
                return [a1, a2];
              } else {
                // Third click resets previous markers and starts fresh
                viewer.removeAllShapes();
                viewer.removeAllLabels();
                viewer.addSphere({
                  center: { x: atom.x, y: atom.y, z: atom.z },
                  radius: 0.65,
                  color: '#F59E0B'
                });
                viewer.addLabel(`${atom.resn}${atom.resi}:${atom.atom}`, {
                  position: { x: atom.x, y: atom.y, z: atom.z },
                  backgroundColor: '#1E293B',
                  fontColor: '#F59E0B',
                  fontSize: 11,
                  inFront: true
                });
                viewer.render();
                setDistanceResult(null);
                return [atom];
              }
            });
          }
        });
      }
    } catch (err) {
      console.error('Error loading 3D coordinates into Mol* viewer:', err);
    } finally {
      setIsLoadingCoordinates(false);
    }
  }, [structure?.id, structure?.source, isPerformanceMode]);

  // Initial load
  useEffect(() => {
    if (window.$3Dmol) {
      loadStructureData();
    } else {
      const interval = setInterval(() => {
        if (window.$3Dmol) {
          clearInterval(interval);
          loadStructureData();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [loadStructureData]);

  // Handle container resizing (e.g. when side panels collapse/expand or window resizes)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (glViewerRef.current) {
        try {
          glViewerRef.current.resize();
          glViewerRef.current.render();
        } catch {
          // ignore transient resize errors
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Re-apply style/colors without reloading file
  useEffect(() => {
    if (glViewerRef.current) {
      applyStyles(glViewerRef.current, style, colorScheme);
    }
  }, [style, colorScheme, applyStyles]);

  // Handle spin / rotation animation loop
  useEffect(() => {
    const viewer = glViewerRef.current;
    if (!viewer) return;

    if (isSpinning) {
      viewer.spin('y', spinSpeed);
    } else if (isRocking) {
      viewer.spin('rock', spinSpeed);
    } else {
      viewer.spin(false);
    }
  }, [isSpinning, isRocking, spinSpeed, showExportModal]);

  // Background color update
  useEffect(() => {
    const viewer = glViewerRef.current;
    if (viewer && typeof viewer.setBackgroundColor === 'function') {
      if (bgColor === 'transparent') {
        viewer.setBackgroundColor(0x000000, 0);
      } else if (bgColor === 'light') {
        viewer.setBackgroundColor(0xffffff, 1);
      } else {
        viewer.setBackgroundColor(0x111110, 1);
      }
      viewer.render();
    }
  }, [bgColor, showExportModal]);

  // Smooth canvas resize when expanding to large modal
  useEffect(() => {
    const timer = setTimeout(() => {
      if (glViewerRef.current) {
        glViewerRef.current.resize();
        glViewerRef.current.render();
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [isExpandedModal]);

  // Clear measurements
  const handleClearMeasurement = useCallback(() => {
    setSelectedAtomsForDist([]);
    setDistanceResult(null);
    if (glViewerRef.current) {
      glViewerRef.current.removeAllShapes();
      glViewerRef.current.removeAllLabels();
      glViewerRef.current.render();
    }
  }, []);

  // Highlight all contacts in 3D with sidechain sticks, dashed interaction lines & labels
  const handleHighlightAllContactsIn3D = useCallback((contactResidues: LigandContactResidue[], ligandId: string) => {
    const viewer = glViewerRef.current;
    if (!viewer) return;

    try {
      viewer.removeAllShapes();
      viewer.removeAllLabels();

      // Highlight ligand in Ball & Stick
      const ligSel = { resn: [ligandId, ligandId.toUpperCase()] };
      viewer.setStyle(ligSel, {
        stick: { radius: 0.35, colorscheme: 'default' },
        sphere: { scale: 0.5, colorscheme: 'default' }
      });

      // Highlight each contacting residue with sticks
      contactResidues.forEach((c) => {
        viewer.setStyle({ chain: c.chainId, resi: c.resNum }, {
          stick: { radius: 0.16, colorscheme: 'amino' }
        });

        // 3D dashed line between closest atoms
        const color = c.interactionTypes.includes('hbond')
          ? '#0284C7'
          : c.interactionTypes.includes('saltbridge')
          ? '#9333EA'
          : c.interactionTypes.includes('hydrophobic')
          ? '#D97706'
          : c.interactionTypes.includes('aromatic')
          ? '#4F46E5'
          : '#64748B';

        viewer.addLine({
          start: c.proteinAtomCoords,
          end: c.ligandAtomCoords,
          color,
          dashed: true,
          linewidth: 3
        });

        // Midpoint distance label for close contacts (<3.8 Å)
        if (c.minDistance <= 3.8) {
          viewer.addLabel(`${c.resName}${c.resNum}: ${c.minDistance.toFixed(1)}Å`, {
            position: {
              x: (c.proteinAtomCoords.x + c.ligandAtomCoords.x) / 2,
              y: (c.proteinAtomCoords.y + c.ligandAtomCoords.y) / 2,
              z: (c.proteinAtomCoords.z + c.ligandAtomCoords.z) / 2
            },
            backgroundColor: '#0F172A',
            fontColor: color,
            fontSize: 10,
            borderRadius: 3,
            inFront: true
          });
        }
      });

      viewer.center(ligSel, 600);
      viewer.zoomTo(ligSel, 600);
      viewer.render();
    } catch (e) {
      console.warn('Error highlighting 3D contacts:', e);
    }
  }, []);

  // Focus a single residue in 3D
  const handleFocusResidueIn3D = useCallback((res: LigandContactResidue) => {
    const viewer = glViewerRef.current;
    if (!viewer) return;

    try {
      viewer.removeAllShapes();
      viewer.removeAllLabels();

      viewer.setStyle({ chain: res.chainId, resi: res.resNum }, {
        stick: { radius: 0.25, colorscheme: 'amino' },
        sphere: { scale: 0.35, colorscheme: 'amino' }
      });

      viewer.addSphere({
        center: res.proteinAtomCoords,
        radius: 0.6,
        color: '#10B981'
      });

      viewer.addLine({
        start: res.proteinAtomCoords,
        end: res.ligandAtomCoords,
        color: '#10B981',
        dashed: true,
        linewidth: 4
      });

      viewer.addLabel(`${res.resName}${res.resNum} ↔ ${res.closestLigandAtom}: ${res.minDistance.toFixed(2)}Å`, {
        position: {
          x: (res.proteinAtomCoords.x + res.ligandAtomCoords.x) / 2,
          y: (res.proteinAtomCoords.y + res.ligandAtomCoords.y) / 2,
          z: (res.proteinAtomCoords.z + res.ligandAtomCoords.z) / 2
        },
        backgroundColor: '#064E3B',
        fontColor: '#A7F3D0',
        fontSize: 12,
        fontWeight: 'bold',
        borderRadius: 4,
        inFront: true
      });

      viewer.center({ chain: res.chainId, resi: res.resNum }, 500);
      viewer.zoomTo({ chain: res.chainId, resi: res.resNum }, 500);
      viewer.render();
    } catch (e) {
      console.warn('Error focusing residue in 3D:', e);
    }
  }, []);

  // Clear 3D contacts
  const handleClear3DContacts = useCallback(() => {
    const viewer = glViewerRef.current;
    if (!viewer) return;
    viewer.removeAllShapes();
    viewer.removeAllLabels();
    applyStyles(viewer, style, colorScheme);
    viewer.render();
  }, [applyStyles, style, colorScheme]);

  // Export 4K High-Res publication screenshot
  const handleExportScreenshot = useCallback(() => {
    const viewer = glViewerRef.current;
    if (!viewer) return;

    try {
      const pngUri = viewer.pngURI();
      const link = document.createElement('a');
      link.href = pngUri;
      link.download = `${structure?.id || 'structure'}_publication_3D.png`;
      link.click();
    } catch (err) {
      console.error('Screenshot export error:', err);
    }
  }, [structure]);

  // Expose export function to parent
  useEffect(() => {
    if (viewerRefCallback) {
      const exportObj: any = handleExportScreenshot;
      exportObj.openExportModal = () => {
        setShowContactMapModal(false);
        setShowMovieMakerModal(false);
        setExportInitialTab('slides');
        setShowExportModal(true);
        onOpenRightSidebar?.();
      };
      exportObj.exportScreenshot = handleExportScreenshot;
      viewerRefCallback(exportObj);
    }
  }, [viewerRefCallback, handleExportScreenshot, onOpenRightSidebar]);

  // Reset Camera View
  const handleResetCamera = () => {
    const viewer = glViewerRef.current;
    if (viewer) {
      viewer.zoomTo();
      viewer.render();
    }
  };

  // Camera Orientation Presets (Front, Top, Side)
  const handleOrientCamera = (axis: 'front' | 'top' | 'side') => {
    const viewer = glViewerRef.current;
    if (!viewer) return;

    try {
      viewer.zoomTo(); // Reset camera to centered frontal orientation
      if (axis === 'top') {
        viewer.rotate(90, 'x');
      } else if (axis === 'side') {
        viewer.rotate(90, 'y');
      }
      viewer.render();
    } catch (e) {
      console.error('Error orienting camera:', e);
    }
  };

  // Expand modal toggle (large modal taking up most of the app viewport)
  const handleToggleExpandModal = () => {
    setIsExpandedModal((prev) => {
      const next = !prev;
      onToggleExpand?.(next);
      return next;
    });
  };

  // Keyboard shortcut listener for Esc to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHelpModal) setShowHelpModal(false);
        else if (isExpandedModal) {
          setIsExpandedModal(false);
          onToggleExpand?.(false);
        }
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setShowHelpModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHelpModal, isExpandedModal, onToggleExpand]);

  return (
    <>
      {/* Dimmed backdrop when large modal is open */}
      {isExpandedModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99998] transition-opacity animate-in fade-in duration-150"
          onClick={handleToggleExpandModal}
        />
      )}

      {/* Main 3D Viewer Container (Inline or Expanded Large Modal) */}
      <div
        className={
          isExpandedModal
            ? 'fixed inset-2 sm:inset-4 md:inset-6 z-[99999] transition-all animate-in zoom-in-95 duration-150 flex flex-col'
            : 'relative w-full h-full min-h-[520px]'
        }
      >
        {/* Inner Container with border, rounded corners, and overflow hidden */}
        <div className={`w-full h-full flex flex-col overflow-hidden bg-[var(--sg-surface)] border border-[var(--sg-border)] shadow-2xl ${isExpandedModal ? 'rounded-[12px]' : 'rounded-[8px]'}`}>
          {/* Expanded View Exit Header Bar (Guaranteed visible above all app headers) */}
          {isExpandedModal && (
            <div className="h-12 px-4 bg-[var(--sg-surface)] border-b border-[var(--sg-border)] flex items-center justify-between shrink-0 z-30">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[14px] text-[var(--sg-text-primary)]">
                  {structure?.id}
                </span>
                <span className="text-[12px] text-[var(--sg-text-secondary)] hidden sm:inline">
                  • Expanded 3D Viewport
                </span>
                {structure?.title && (
                  <span className="text-[12px] text-[var(--sg-text-secondary)] truncate max-w-[400px] hidden md:inline">
                    — {structure.title}
                  </span>
                )}
              </div>
              <button
                onClick={handleToggleExpandModal}
                className="px-3 py-1.5 rounded-[6px] bg-slate-900 hover:bg-slate-800 text-slate-100 hover:text-white border border-slate-700 font-medium text-[12px] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Exit Expanded View (Esc)"
              >
                <X className="w-4 h-4" />
                <span>Exit Fullscreen (Esc)</span>
              </button>
            </div>
          )}

          {/* Top Toolbar */}
          <div className="h-11 px-3 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface)] flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-mono font-bold text-[13px] text-[var(--sg-text-primary)]">
                {structure?.id || 'Mol* 3D Canvas'}
              </span>
              {!isExpandedModal && structure?.title && (
                <span className="hidden md:inline-block text-[12px] text-[var(--sg-text-secondary)] truncate max-w-[260px]">
                  • {structure.title}
                </span>
              )}
            </div>

            {hoveredResidue && !measureMode && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-[4px] bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] font-mono text-[11px] border border-[var(--sg-border-subtle)] truncate max-w-[240px]">
                {hoveredResidue}
              </span>
            )}

            {measureMode && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-600 font-mono font-semibold text-[11px] border border-amber-500/30 flex items-center gap-1">
                  <Ruler className="w-3 h-3 text-amber-600" />
                  <span>
                    {selectedAtomsForDist.length === 0
                      ? 'Ruler: Click 1st atom'
                      : selectedAtomsForDist.length === 1
                      ? 'Click 2nd atom'
                      : `Distance: ${distanceResult?.toFixed(2)} Å`}
                  </span>
                </span>
                {selectedAtomsForDist.length > 0 && (
                  <button
                    onClick={handleClearMeasurement}
                    className="p-1 rounded-[4px] hover:bg-amber-500/20 text-amber-700 transition-all text-[10px] flex items-center gap-0.5"
                    title="Clear Measurement"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Top Actions */}
          <div className="flex items-center gap-1 shrink-0 [&_svg]:text-[#000000]">
            {/* Performance mode toggle */}
            <button
              onClick={() => setIsPerformanceMode(!isPerformanceMode)}
              className={`p-1.5 rounded-[4px] transition-all border ${
                isPerformanceMode
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] border-transparent'
              }`}
              title={
                isPerformanceMode
                  ? 'Performance Mode ON: Fast 60 FPS, reduced shaders for laptops'
                  : 'Toggle Performance Mode: Optimizes rendering at 60 FPS and reduces GPU load for laptops'
              }
            >
              <Zap className="w-4 h-4 text-[#000000]" />
            </button>

            {/* Spin toggle */}
            <button
              onClick={() => {
                setIsSpinning(!isSpinning);
                if (!isSpinning) setIsRocking(false);
              }}
              className={`p-1.5 rounded-[4px] transition-all border ${
                isSpinning
                  ? 'bg-sky-50 text-sky-700 border-sky-300'
                  : 'hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] border-transparent'
              }`}
              title={isSpinning ? 'Pause continuous turntable auto-rotation' : 'Start 360° continuous turntable auto-rotation'}
            >
              <RotateCw className="w-4 h-4 text-[#000000]" />
            </button>

            {/* Navigation & Controls Help (?) button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className={`p-1.5 rounded-[4px] transition-all border ${
                showHelpModal
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : 'hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] border-transparent'
              }`}
              title="3D Navigation & Mouse Controls Guide (?): Rotate, Pan, Zoom, Atom Picking"
            >
              <HelpCircle className="w-4 h-4 text-[#000000]" />
            </button>

            {/* Contact Map */}
            <button
              onClick={() => {
                setActiveContactMapLigand(selectedLigandId || (structure?.ligands?.[0]?.id) || null);
                setShowExportModal(false);
                setShowMovieMakerModal(false);
                setShowContactMapModal(true);
                onOpenRightSidebar?.();
              }}
              className="px-2 py-1 rounded-[4px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] transition-all flex items-center gap-1 text-[12px] font-medium cursor-pointer"
              title="Ligand-Protein Contact Map: Identify interacting amino acids, distances & binding chemistry"
            >
              <Activity className="w-3.5 h-3.5 text-[#000000]" />
              <span className="hidden sm:inline">Contact Map</span>
            </button>

            {/* Movie Maker */}
            <button
              onClick={() => {
                setShowContactMapModal(false);
                setShowExportModal(false);
                setShowMovieMakerModal(true);
                onOpenRightSidebar?.();
              }}
              className="px-2 py-1 rounded-[4px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] transition-all flex items-center gap-1 text-[12px] font-medium cursor-pointer"
              title="Movie Maker: Create animated 3D movies with simple commands (rotate, rock, zoom ligand, styles) and record WebM video"
            >
              <Film className="w-3.5 h-3.5 text-[#000000]" />
              <span className="hidden sm:inline">Movie</span>
            </button>

            {/* 10s MP4 Video */}
            <button
              onClick={() => {
                setShowContactMapModal(false);
                setShowMovieMakerModal(false);
                setExportInitialTab('video');
                setShowExportModal(true);
                onOpenRightSidebar?.();
              }}
              className="px-2 py-1 rounded-[4px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] transition-all flex items-center gap-1 text-[12px] font-medium cursor-pointer"
              title="10s MP4 Video: Export a broadcast-quality 10-second smooth rotation MP4 of the protein"
            >
              <Video className="w-3.5 h-3.5 text-[#000000]" />
              <span className="hidden sm:inline">10s MP4</span>
            </button>

            {/* Export */}
            <button
              onClick={() => {
                setShowContactMapModal(false);
                setShowMovieMakerModal(false);
                setExportInitialTab('slides');
                setShowExportModal(true);
                onOpenRightSidebar?.();
              }}
              className="px-2 py-1 rounded-[4px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] transition-all flex items-center gap-1.5 text-[12px] font-medium cursor-pointer"
              title="Export for Presentations & 3D (Google Slides, Docs, PowerPoint, .glb, .obj, PyMOL, 10s MP4 Video)"
            >
              <Presentation className="w-3.5 h-3.5 text-[#000000]" />
              <span>Export</span>
            </button>

            {/* Toggle Controls Drawer */}
            <button
              onClick={() => setShowControlsDrawer(!showControlsDrawer)}
              className={`p-1.5 rounded-[4px] transition-all border cursor-pointer ${
                showControlsDrawer
                  ? 'bg-emerald-50 text-[var(--sg-accent)] border-emerald-300 font-semibold shadow-2xs'
                  : 'hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] border-transparent'
              }`}
              title={showControlsDrawer ? "Close Molecular Style & Color Schemes Drawer" : "Open Molecular Style & Color Schemes Drawer"}
            >
              <Sliders className="w-4 h-4 text-[#000000]" />
            </button>

            {/* Download Coordinate File (PDB / mmCIF) */}
            <button
              onClick={onDownloadPdb}
              disabled={!structure}
              className="px-2 py-1 rounded-[4px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] transition-all flex items-center gap-1.5 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Download raw coordinate file (PDB / mmCIF)"
            >
              <Download className="w-3.5 h-3.5 text-[#000000]" />
              <span className="hidden md:inline">PDB</span>
            </button>
          </div>
        </div>

        {/* 3D Canvas Stage */}
        <div className="relative flex-1 w-full bg-[var(--sg-page)] overflow-hidden">
          {isLoadingCoordinates && (
            <div className="absolute inset-0 z-30 bg-white/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2.5">
              <div className="spinner-16" />
              <span className="text-[13px] font-medium text-[var(--sg-text-secondary)] font-mono">
                Rendering 3D coordinate model...
              </span>
            </div>
          )}

          {/* 3Dmol WebGL Container - Smoothly shifts up when the color schemes drawer is open so the protein remains in focus above the drawer */}
          <div
            ref={containerRef}
            className="w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-300 ease-out origin-center"
            style={{
              transform: showControlsDrawer ? 'translateY(-76px)' : 'translateY(0px)'
            }}
          />

          {/* Ruler Instruction Banner Overlay when measureMode is active */}
          {measureMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 rounded-[8px] bg-slate-900/90 text-white border border-amber-500/40 shadow-lg backdrop-blur-sm flex items-center gap-3 text-[12px] font-sans">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold font-mono text-[11px]">
                📏
              </div>
              <div>
                {selectedAtomsForDist.length === 0 ? (
                  <span>Click the <strong>1st atom</strong> on the structure to start distance measurement.</span>
                ) : selectedAtomsForDist.length === 1 ? (
                  <span>
                    Selected <strong>{selectedAtomsForDist[0].resn}{selectedAtomsForDist[0].resi} ({selectedAtomsForDist[0].atom})</strong>. Now click the <strong>2nd atom</strong>.
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Interatomic distance: <strong className="text-amber-400 font-mono text-[13px]">{distanceResult?.toFixed(2)} Å</strong>
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setMeasureMode(false);
                  handleClearMeasurement();
                }}
                className="ml-1 p-1 rounded hover:bg-white/20 text-white/70 hover:text-white transition-all"
                title="Exit Ruler"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Floating Orientation Compass & Presets Bar */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-[var(--sg-surface)]/90 backdrop-blur-sm p-1 rounded-[6px] border border-[var(--sg-border)] shadow-[var(--sg-shadow-sm)]">
            <button
              onClick={() => handleOrientCamera('front')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]"
              title="Front View: Align camera to canonical frontal plane"
            >
              Front
            </button>
            <button
              onClick={() => handleOrientCamera('top')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]"
              title="Top View: Rotate camera 90° down onto structure"
            >
              Top
            </button>
            <button
              onClick={() => handleOrientCamera('side')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]"
              title="Side View: Rotate camera 90° horizontally to sagittal profile"
            >
              Side
            </button>
          </div>
        </div>
        {/* End Inner Container */}
        </div>

        {/* Style Controls Drawer - Slides up from the bottom of the middle panel */}
        {showControlsDrawer && (
          <div className="absolute bottom-0 left-0 right-0 z-40 p-3.5 bg-[var(--sg-surface)] border-t border-[var(--sg-border)] shadow-xl transition-all duration-300 ease-out animate-in slide-in-from-bottom max-h-[340px] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[var(--sg-border-subtle)]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--sg-accent)]" />
                <span className="text-[12px] font-semibold text-[var(--sg-text-primary)]">
                  Molecular Style & Color Schemes
                </span>
              </div>
              <button
                onClick={() => setShowControlsDrawer(false)}
                className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all cursor-pointer"
                title="Close settings drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              {/* Representation Style Pills */}
              <div className="flex-1 w-full">
                <span className="text-[11px] text-[var(--sg-text-tertiary)] uppercase font-semibold block mb-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-[var(--sg-accent)]" />
                  <span>Representation</span>
                </span>
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1">
                  {(['cartoon', 'surface', 'ball-and-stick', 'ribbon', 'spacefill', 'backbone'] as ViewerStyle[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => setStyle(st)}
                        className={`px-2 py-1 rounded-[4px] text-[11px] font-medium capitalize transition-all border flex-1 sm:flex-none cursor-pointer ${
                          style === st
                            ? 'bg-[var(--sg-accent)] text-white border-[var(--sg-accent)] shadow-xs font-semibold'
                            : 'bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] border-[var(--sg-border-subtle)]'
                        }`}
                      >
                        {st.replace('-', ' ')}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Color Scheme Pills - With color swatches */}
              <div className="flex-1 w-full">
                <span className="text-[11px] text-[var(--sg-text-tertiary)] uppercase font-semibold block mb-1.5 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-[var(--sg-accent)]" />
                  <span>Color Scheme</span>
                </span>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                  {COLOR_SCHEME_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setColorScheme(item.id)}
                      className={`px-2 py-1 rounded-[4px] text-[11px] transition-all border flex items-center gap-1.5 cursor-pointer ${
                        colorScheme === item.id
                          ? 'bg-[var(--sg-accent)] text-white border-[var(--sg-accent)] shadow-xs font-semibold'
                          : 'bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] border-[var(--sg-border-subtle)]'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.swatchGradient}`} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background & Motion Toggles */}
              <div className="flex flex-col pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-[var(--sg-border-subtle)] md:pl-4 text-[12px] gap-2 w-full md:w-auto shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[var(--sg-text-tertiary)] mr-1">Background:</span>
                  <button
                    onClick={() => setBgColor('light')}
                    className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium border cursor-pointer transition-all ${
                      bgColor === 'light' ? 'bg-[var(--sg-accent)] text-white border-[var(--sg-accent)]' : 'bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)]'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => setBgColor('dark')}
                    className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium border cursor-pointer transition-all ${
                      bgColor === 'dark' ? 'bg-[var(--sg-accent)] text-white border-[var(--sg-accent)]' : 'bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)]'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setBgColor('transparent')}
                    className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium border cursor-pointer transition-all ${
                      bgColor === 'transparent' ? 'bg-[var(--sg-accent)] text-white border-[var(--sg-accent)]' : 'bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)]'
                    }`}
                  >
                    Clear
                  </button>
                </div>

                {/* Speed Slider */}
                {isSpinning && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-[var(--sg-text-tertiary)] font-mono">Speed</span>
                    <input
                      type="range"
                      min="0.2"
                      max="2.5"
                      step="0.1"
                      value={spinSpeed}
                      onChange={(e) => setSpinSpeed(parseFloat(e.target.value))}
                      className="w-24 accent-[var(--sg-accent)] h-1 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Active Color Scheme Palette Legend Strip */}
            {(() => {
              const active = COLOR_SCHEME_ITEMS.find((it) => it.id === colorScheme) || COLOR_SCHEME_ITEMS[0];
              return (
                <div className="mt-2.5 pt-2 border-t border-[var(--sg-border-subtle)] flex items-center gap-2.5 overflow-x-auto text-[11px] text-[var(--sg-text-secondary)]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--sg-text-tertiary)] shrink-0">
                    Active Palette:
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    {active.legend.map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 shrink-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${leg.bg}`} />
                        <span className="font-medium text-[11px] text-[var(--sg-text-primary)]">{leg.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Navigation & Mouse Controls Guide Modal (?) */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[12px] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--sg-border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[6px] bg-[var(--sg-accent-subtle)] text-[var(--sg-accent)] flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] text-[var(--sg-text-primary)]">
                    3D Viewer Navigation & Controls Guide
                  </h3>
                  <p className="text-[12px] text-[var(--sg-text-secondary)]">
                    Mouse gestures, interactive shortcuts, and measurement tools
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-hover)] text-[var(--sg-text-tertiary)] hover:text-[var(--sg-text-primary)] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Controls Cheat Sheet Grid */}
            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-[8px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] flex items-start gap-2.5">
                  <MousePointer className="w-4 h-4 text-[var(--sg-accent)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-[var(--sg-text-primary)] block text-[12px]">Rotate 3D View</span>
                    <span className="text-[11px] text-[var(--sg-text-secondary)]">
                      <strong>Left Click + Drag</strong> to tumble and rotate the macromolecule in 3D.
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-[8px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] flex items-start gap-2.5">
                  <Move className="w-4 h-4 text-[var(--sg-accent)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-[var(--sg-text-primary)] block text-[12px]">Pan & Translate</span>
                    <span className="text-[11px] text-[var(--sg-text-secondary)]">
                      <strong>Right Click + Drag</strong> or <strong>Ctrl + Drag</strong> to translate across screen space.
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-[8px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] flex items-start gap-2.5">
                  <Search className="w-4 h-4 text-[var(--sg-accent)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-[var(--sg-text-primary)] block text-[12px]">Zoom In / Out</span>
                    <span className="text-[11px] text-[var(--sg-text-secondary)]">
                      <strong>Scroll Wheel</strong> or two-finger trackpad pinch to zoom smoothly.
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-[8px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] flex items-start gap-2.5">
                  <Presentation className="w-4 h-4 text-[var(--sg-accent)] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-[var(--sg-text-primary)] block text-[12px]">Export & Camera Capture</span>
                    <span className="text-[11px] text-[var(--sg-text-secondary)]">
                      Click <strong>Export</strong> in the toolbar to capture 4K screenshots, 1-click copy transparent PNGs directly into Google Slides or Docs, download 3D models (.glb, .obj), and generate PyMOL scripts.
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Shortcuts Bar */}
              <div className="p-3 rounded-[8px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-1.5 text-[12px]">
                <span className="font-medium text-[var(--sg-text-primary)] block text-[11px] uppercase tracking-wider text-[var(--sg-text-tertiary)]">
                  Additional Capabilities
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--sg-text-secondary)]">
                  <div>• <strong>Hover Atom</strong>: Inspect residue, sequence, and chain.</div>
                  <div>• <strong>Rotate (🔄)</strong>: Continuous spinning animation.</div>
                  <div>• <strong>Compass</strong>: Re-center and reset camera zoom.</div>
                  <div>• <strong>Presets</strong>: Front, Top, Side perspective views.</div>
                  <div>• <strong>Expand (⤢)</strong>: Open in large viewport modal.</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--sg-border-subtle)] pt-3 text-[12px]">
              <span className="text-[11px] text-[var(--sg-text-tertiary)]">
                Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] font-mono text-[10px]">?</kbd> to toggle guide • <kbd className="px-1.5 py-0.5 rounded bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] font-mono text-[10px]">Esc</kbd> to close
              </span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-3 py-1.5 rounded-[6px] bg-[var(--sg-accent)] text-white text-[12px] font-medium hover:bg-[var(--sg-accent-hover)] transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Export for Presentations & 3D Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        structure={structure}
        viewer={glViewerRef.current}
        canvasElement={containerRef.current?.querySelector('canvas') || null}
        coordinateData={coordinateData}
        coordinateFormat={coordinateFormat}
        currentStyle={style}
        currentColorScheme={colorScheme}
        initialTab={exportInitialTab}
      />

      {/* Ligand-Protein Contact Map Modal */}
      <ContactMapModal
        isOpen={showContactMapModal}
        onClose={() => setShowContactMapModal(false)}
        structure={structure}
        selectedLigandId={activeContactMapLigand || selectedLigandId}
        coordinateData={coordinateData}
        glViewer={glViewerRef.current}
        onFocusResidueIn3D={handleFocusResidueIn3D}
        onHighlightAllContactsIn3D={handleHighlightAllContactsIn3D}
        onClear3DContacts={handleClear3DContacts}
        onAskAgent={onAskAgent}
      />

      {/* Movie Maker with Simple Commands Modal */}
      <MovieMakerModal
        isOpen={showMovieMakerModal}
        onClose={() => setShowMovieMakerModal(false)}
        structure={structure}
        glViewer={glViewerRef.current}
        canvasElement={containerRef.current?.querySelector('canvas') || null}
        selectedLigandId={selectedLigandId || (structure?.ligands?.[0]?.id) || null}
        currentStyle={style}
        currentColorScheme={colorScheme}
        onApplyStyle={(newStyle) => setStyle(newStyle)}
        onApplyColorScheme={(newColors) => setColorScheme(newColors)}
        onHighlightContacts={(on) => {
          if (!on) handleClear3DContacts();
        }}
      />
    </>
  );
};

