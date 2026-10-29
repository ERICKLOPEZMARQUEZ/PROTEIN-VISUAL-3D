import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Presentation,
  Box,
  FileCode,
  Download,
  Copy,
  Check,
  MonitorPlay,
  Code,
  Video,
  RefreshCw,
  RotateCw,
  AlertCircle
} from 'lucide-react';
import { PDBMetadata, ViewerStyle, ColorScheme } from '../types';
import {
  parseVrmlToMesh,
  generatePdbFallbackMesh,
  meshToObj,
  meshToStl,
  meshToGlb,
  generatePymolScript,
  generateChimeraxScript,
  downloadBlob,
  downloadTextFile,
  copyImageToClipboard,
  copyTextToClipboard
} from '../utils/export3D';
import {
  recordSmoothRotationMP4,
  downloadVideoBlob,
  VideoProgressState,
  VideoExportResult
} from '../utils/videoRecorder';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  structure: PDBMetadata | null;
  viewer: any;
  canvasElement?: HTMLCanvasElement | null;
  coordinateData: string;
  coordinateFormat?: string;
  currentStyle: ViewerStyle;
  currentColorScheme: ColorScheme;
  initialTab?: 'slides' | 'video' | '3dmodels' | 'scripts';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  structure,
  viewer,
  canvasElement,
  coordinateData,
  currentStyle,
  currentColorScheme,
  initialTab = 'slides'
}) => {
  const [activeTab, setActiveTab] = useState<'slides' | 'video' | '3dmodels' | 'scripts'>(initialTab);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [bgMode, setBgMode] = useState<'transparent' | 'white' | 'dark'>('transparent');
  const [embedCodeCopied, setEmbedCodeCopied] = useState<boolean>(false);

  // Video Export options & states
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [videoFps, setVideoFps] = useState<number>(30);
  const [videoAxis, setVideoAxis] = useState<'y' | 'x' | 'z'>('y');
  const [videoRotations] = useState<number>(1);
  const [videoBg, setVideoBg] = useState<'dark' | 'white' | 'transparent'>('dark');
  const [videoProgress, setVideoProgress] = useState<VideoProgressState | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const [videoResult, setVideoResult] = useState<VideoExportResult | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Locate the right-sidebar host container
  useEffect(() => {
    if (isOpen) {
      const el = document.getElementById('right-sidebar-tool-host');
      setPortalTarget(el);
    }
  }, [isOpen]);

  // Helper to safely set 3Dmol viewer background color with proper alpha parameter
  const applyViewerBackground = (v: any, mode: 'transparent' | 'white' | 'dark' | 'light') => {
    if (!v || typeof v.setBackgroundColor !== 'function') return;
    try {
      if (mode === 'transparent') {
        v.setBackgroundColor(0x000000, 0);
      } else if (mode === 'white' || mode === 'light') {
        v.setBackgroundColor(0xffffff, 1);
      } else {
        v.setBackgroundColor(0x111110, 1);
      }
      v.render?.();
    } catch {
      // ignore transient WebGL background errors
    }
  };

  // Update active tab if initialTab prop changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Capture preview snapshot when modal opens or bgMode changes
  useEffect(() => {
    if (isOpen && viewer) {
      try {
        applyViewerBackground(viewer, bgMode);
        const uri =
          (typeof viewer.pngURI === 'function' ? viewer.pngURI() : '') ||
          canvasElement?.toDataURL?.('image/png') ||
          '';
        setPreviewUri(uri || null);
        applyViewerBackground(viewer, 'light');
      } catch (err) {
        console.warn('Failed to capture preview URI:', err);
      }
    }
  }, [isOpen, viewer, bgMode, canvasElement]);

  /**
   * Cancel ongoing video recording
   */
  const handleCancelVideo = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRecordingVideo(false);
    setVideoProgress(null);
  };

  /**
   * Clean up recording when modal closes
   */
  useEffect(() => {
    if (!isOpen) {
      handleCancelVideo();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanId = structure?.id || 'Structure';

  /**
   * Helper to capture PNG with specified background
   */
  const capturePngDataUri = (bg: 'transparent' | 'white' | 'dark'): string => {
    if (!viewer) return '';
    try {
      applyViewerBackground(viewer, bg);
      const uri =
        (typeof viewer.pngURI === 'function' ? viewer.pngURI() : '') ||
        canvasElement?.toDataURL?.('image/png') ||
        '';
      applyViewerBackground(viewer, 'light');
      return uri;
    } catch (err) {
      console.error('Error capturing PNG URI:', err);
      return (typeof viewer?.pngURI === 'function' ? viewer.pngURI() : '') || '';
    }
  };

  /**
   * 1-Click Copy Image to System Clipboard for Google Docs & Google Slides
   */
  const handleCopyImageToClipboard = async () => {
    setIsExporting(true);
    try {
      const uri = capturePngDataUri(bgMode);
      const success = await copyImageToClipboard(uri);
      if (success) {
        setCopiedStatus('image');
        setTimeout(() => setCopiedStatus(null), 3000);
      } else {
        handleDownloadPng();
        setCopiedStatus('image');
        setTimeout(() => setCopiedStatus(null), 3000);
      }
    } catch (err) {
      console.error('Clipboard copy error:', err);
      handleDownloadPng();
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Download High-Resolution PNG
   */
  const handleDownloadPng = () => {
    setIsExporting(true);
    try {
      const uri = capturePngDataUri(bgMode);
      if (!uri) return;
      const link = document.createElement('a');
      link.href = uri;
      link.download = `${cleanId}_${bgMode}_presentation.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('PNG download error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Helper to obtain mesh representation
   */
  const getStructureMesh = () => {
    let mesh = { positions: [] as number[], normals: [] as number[], colors: [] as number[], indices: [] as number[] };
    if (viewer && typeof viewer.exportVRML === 'function') {
      try {
        const vrml = viewer.exportVRML();
        if (vrml && vrml.length > 50) {
          mesh = parseVrmlToMesh(vrml);
        }
      } catch (err) {
        console.warn('VRML export failed, using coordinate fallback:', err);
      }
    }

    if (mesh.positions.length === 0) {
      mesh = generatePdbFallbackMesh(coordinateData, viewer);
    }
    return mesh;
  };

  /**
   * Export 3D Model: Binary glTF (.glb) for PowerPoint "Insert > 3D Models"
   */
  const handleExportGlb = () => {
    setIsExporting(true);
    try {
      const mesh = getStructureMesh();
      const glbBytes = meshToGlb(mesh);
      const blob = new Blob([glbBytes.buffer as ArrayBuffer], { type: 'model/gltf-binary' });
      downloadBlob(blob, `${cleanId}_powerpoint_3D.glb`);
    } catch (err) {
      console.error('GLB export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Export 3D Model: Wavefront (.obj)
   */
  const handleExportObj = () => {
    setIsExporting(true);
    try {
      const mesh = getStructureMesh();
      const objText = meshToObj(mesh, structure);
      downloadTextFile(objText, `${cleanId}_3D_model.obj`, 'text/plain');
    } catch (err) {
      console.error('OBJ export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Export 3D Model: STL (.stl)
   */
  const handleExportStl = () => {
    setIsExporting(true);
    try {
      const mesh = getStructureMesh();
      const stlText = meshToStl(mesh, structure);
      downloadTextFile(stlText, `${cleanId}_3D_mesh.stl`, 'text/plain');
    } catch (err) {
      console.error('STL export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Export PyMOL Presentation Script (.pml)
   */
  const handleExportPymol = async (copyOnly: boolean = false) => {
    const pml = generatePymolScript(structure, currentStyle, currentColorScheme);
    if (copyOnly) {
      await copyTextToClipboard(pml);
      setCopiedStatus('pml');
      setTimeout(() => setCopiedStatus(null), 2500);
    } else {
      downloadTextFile(pml, `${cleanId}_presentation.pml`, 'text/plain');
    }
  };

  /**
   * Export ChimeraX Presentation Script (.cxc)
   */
  const handleExportChimerax = async (copyOnly: boolean = false) => {
    const cxc = generateChimeraxScript(structure, currentStyle, currentColorScheme);
    if (copyOnly) {
      await copyTextToClipboard(cxc);
      setCopiedStatus('cxc');
      setTimeout(() => setCopiedStatus(null), 2500);
    } else {
      downloadTextFile(cxc, `${cleanId}_presentation.cxc`, 'text/plain');
    }
  };

  /**
   * Copy web iframe embed snippet
   */
  const handleCopyEmbedSnippet = async () => {
    const snippet = `<iframe src="https://rcsb.org/3d-view/${cleanId}" width="100%" height="500" frameborder="0" allowfullscreen style="border-radius: 8px; border: 1px solid #e2e8f0;"></iframe>`;
    await copyTextToClipboard(snippet);
    setEmbedCodeCopied(true);
    setTimeout(() => setEmbedCodeCopied(false), 2500);
  };

  /**
   * Handle starting 10-second smooth rotation MP4 recording
   */
  const handleRecordVideo = async () => {
    if (!viewer) {
      setVideoError('3D viewer is not initialized.');
      return;
    }

    const targetCanvas =
      canvasElement ||
      viewer?.getCanvas?.() ||
      document.querySelector('#molstar-viewer-container canvas') ||
      document.querySelector('canvas');

    if (!targetCanvas) {
      setVideoError('Could not find WebGL canvas element to record.');
      return;
    }

    setVideoError(null);
    setVideoResult(null);
    setIsRecordingVideo(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    applyViewerBackground(viewer, videoBg);

    try {
      const result = await recordSmoothRotationMP4(
        viewer,
        targetCanvas as HTMLCanvasElement,
        {
          durationSec: videoDuration,
          fps: videoFps,
          totalDegrees: 360 * videoRotations,
          axis: videoAxis,
          structureId: cleanId,
          backgroundColor: videoBg,
          onProgress: (p) => setVideoProgress(p)
        },
        abortController.signal
      );

      setVideoResult(result);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelled')) {
        setVideoProgress(null);
      } else {
        console.error('Error generating MP4 video:', err);
        setVideoError(err.message || 'Failed to record video.');
      }
    } finally {
      applyViewerBackground(viewer, 'light');
      setIsRecordingVideo(false);
      abortControllerRef.current = null;
    }
  };

  /**
   * Download the generated MP4
   */
  const handleDownloadVideo = () => {
    if (videoResult) {
      downloadVideoBlob(videoResult.blob, videoResult.filename);
    }
  };

  const panelContent = (
    <div className="bg-[var(--sg-surface)] border border-[var(--sg-border)] rounded-[8px] shadow-[var(--sg-shadow-sm)] flex flex-col h-full w-full overflow-hidden min-w-0">
      {/* Header bar — unified with Structural Biology Chat */}
      <div className="p-3 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface-hover)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-[13px] font-semibold text-[var(--sg-text-primary)]">
                {activeTab === 'video' ? '10s Smooth Rotation Video' : 'Export & Presentation Tools'}
              </h3>
            </div>
            <p className="text-[11px] text-[var(--sg-text-secondary)] truncate">
              {`Graphics, 10s MP4, 3D models & scripts for ${cleanId}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all cursor-pointer"
            title="Close panel and return to Structural Biology Chat"
            aria-label="Close export panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Tab Navigation */}
      <div className="grid grid-cols-4 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface-sunken)] px-2 shrink-0">
        <button
          onClick={() => setActiveTab('slides')}
          className={`flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'slides'
              ? 'border-[#000000] text-[var(--sg-text-primary)] font-semibold bg-[var(--sg-surface)]'
              : 'border-transparent text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
          }`}
        >
          <Presentation className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Slides</span>
        </button>

        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'video'
              ? 'border-[#000000] text-[var(--sg-text-primary)] font-semibold bg-[var(--sg-surface)]'
              : 'border-transparent text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
          }`}
        >
          <Video className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">10s MP4</span>
        </button>

        <button
          onClick={() => setActiveTab('3dmodels')}
          className={`flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === '3dmodels'
              ? 'border-[#000000] text-[var(--sg-text-primary)] font-semibold bg-[var(--sg-surface)]'
              : 'border-transparent text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
          }`}
        >
          <Box className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">3D Models</span>
        </button>

        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'scripts'
              ? 'border-[#000000] text-[var(--sg-text-primary)] font-semibold bg-[var(--sg-surface)]'
              : 'border-transparent text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)]'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Scripts</span>
        </button>
      </div>

      {/* Scrollable Sidebar Body */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-[13px] text-[var(--sg-text-primary)] leading-relaxed min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
        {/* TAB 1: PRESENTATIONS & SLIDES */}
        {activeTab === 'slides' && (
          <div className="space-y-3.5">
            {copiedStatus === 'image' && (
              <div className="p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[12px] flex items-center gap-2">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>3D render ready!</strong> Paste directly with <kbd className="px-1 py-0.5 rounded bg-[var(--sg-surface)] border border-[var(--sg-border)] font-mono text-[10px]">Ctrl+V</kbd> / <kbd className="px-1 py-0.5 rounded bg-[var(--sg-surface)] border border-[var(--sg-border)] font-mono text-[10px]">Cmd+V</kbd>.
                </span>
              </div>
            )}

            {/* Snapshot Preview Box */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2.5">
              <div className="w-full h-36 rounded-[4px] overflow-hidden bg-[var(--sg-surface)] flex items-center justify-center border border-[var(--sg-border-subtle)] relative">
                {previewUri ? (
                  <img
                    src={previewUri}
                    alt="3D Protein Snapshot"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-[11.5px] text-[var(--sg-text-tertiary)] flex items-center gap-1.5">
                    <MonitorPlay className="w-3.5 h-3.5" />
                    <span>Rendering 3D preview...</span>
                  </div>
                )}
                <span className="absolute bottom-1.5 right-2 text-[10px] font-mono text-[var(--sg-text-tertiary)]">
                  Current View Angle
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)] block mb-1.5">
                  Slide Background Match
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['transparent', 'white', 'dark'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setBgMode(mode)}
                      className={`px-2 py-1.5 rounded-[4px] text-[11px] font-medium border text-center transition-all cursor-pointer capitalize ${
                        bgMode === mode
                          ? 'bg-[#000000] text-white border-[#000000]'
                          : 'bg-[var(--sg-surface)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)] hover:bg-[var(--sg-surface-hover)] hover:text-[var(--sg-text-primary)]'
                      }`}
                    >
                      {mode === 'dark' ? 'Studio Dark' : mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action 1: Copy Image */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  Copy Image to Clipboard
                </span>
                <span className="text-[11px] text-[var(--sg-text-tertiary)]">
                  Google Slides · Docs
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
                Copies the high-resolution {bgMode} 3D render for instant pasting into slides or manuscripts.
              </p>
              <button
                onClick={handleCopyImageToClipboard}
                disabled={isExporting}
                className="w-full py-2 px-3 rounded-[6px] bg-[#000000] hover:bg-[#222222] text-white font-medium text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {copiedStatus === 'image' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Image</span>
                  </>
                )}
              </button>
            </div>

            {/* Action 2: Download PNG */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  Download High-Res PNG ({bgMode})
                </span>
                <span className="text-[11px] text-[var(--sg-text-tertiary)]">
                  Publication PNG
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
                Saves a crisp image file suitable for slide decks, posters, and figures.
              </p>
              <button
                onClick={handleDownloadPng}
                disabled={isExporting}
                className="w-full py-2 px-3 rounded-[6px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] font-medium text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>
            </div>

            {/* Action 3: Web Embed Snippet */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--sg-text-primary)]">
                <Code className="w-3.5 h-3.5 shrink-0" />
                <span>Interactive Web Embed Snippet</span>
              </div>
              <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
                Copy an interactive <code>&lt;iframe&gt;</code> snippet for Notion, Google Sites, Marp, or Reveal.js decks.
              </p>
              <button
                onClick={handleCopyEmbedSnippet}
                className="w-full py-1.5 px-3 rounded-[6px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[12px] font-medium text-[var(--sg-text-primary)] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {embedCodeCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied Embed Code!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Embed Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: 10s VIDEO (.MP4) SMOOTH ROTATION */}
        {activeTab === 'video' && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  10-Second Smooth 360° Rotation
                </span>
                <span className="font-mono text-[11px] text-[var(--sg-text-tertiary)]">
                  H.264 MP4
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
                Records a smooth 360° turntable loop of <strong>{cleanId}</strong> for PowerPoint, Keynote, and research talks.
              </p>
            </div>

            {videoError && (
              <div className="p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[12px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{videoError}</span>
              </div>
            )}

            {/* ACTIVE RECORDING STATE */}
            {isRecordingVideo && videoProgress && (
              <div className="p-3.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] space-y-3">
                <div className="flex items-center gap-2.5">
                  <RotateCw className="w-5 h-5 text-[var(--sg-text-primary)] animate-spin shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-[12.5px] font-semibold text-[var(--sg-text-primary)]">
                      {videoProgress.phase === 'recording'
                        ? 'Recording Smooth Rotation...'
                        : 'Encoding H.264 MP4 Video...'}
                    </h4>
                    <p className="text-[11px] text-[var(--sg-text-secondary)] truncate">
                      {videoProgress.phase === 'recording'
                        ? `${videoProgress.currentAngleDeg}° / 360° (${videoProgress.elapsedSec.toFixed(1)}s / ${videoProgress.totalSec.toFixed(1)}s)`
                        : 'Transcoding with libx264 for universal compatibility...'}
                    </p>
                  </div>
                </div>

                <div className="w-full bg-[var(--sg-surface)] rounded-[4px] h-2 border border-[var(--sg-border)] overflow-hidden">
                  <div
                    className="bg-[#000000] h-full transition-all duration-100 ease-out"
                    style={{ width: `${Math.max(5, videoProgress.percent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--sg-text-tertiary)] font-mono">
                  <span>{videoProgress.elapsedSec.toFixed(1)}s / {videoProgress.totalSec}s</span>
                  <span className="font-semibold text-[var(--sg-text-primary)]">{videoProgress.percent}%</span>
                  <span>{videoProgress.currentAngleDeg}°</span>
                </div>

                <button
                  onClick={handleCancelVideo}
                  className="w-full py-1.5 px-3 rounded-[6px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[12px] font-medium transition-all cursor-pointer"
                >
                  Cancel Recording
                </button>
              </div>
            )}

            {/* VIDEO COMPLETED STATE */}
            {!isRecordingVideo && videoResult && (
              <div className="space-y-3">
                <div className="p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] text-[12px] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span className="font-semibold text-[var(--sg-text-primary)]">MP4 Video Ready</span>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--sg-text-secondary)]">
                    {(videoResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB · {videoResult.durationSec}s
                  </span>
                </div>

                <div className="rounded-[6px] overflow-hidden border border-[var(--sg-border)] bg-black relative flex flex-col items-center justify-center">
                  <video
                    src={videoResult.url}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full max-h-[210px] object-contain"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleDownloadVideo}
                    className="w-full py-2 px-3 rounded-[6px] bg-[#000000] hover:bg-[#222222] text-white font-medium text-[12px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download {videoResult.filename}</span>
                  </button>

                  <button
                    onClick={() => setVideoResult(null)}
                    className="w-full py-1.5 px-3 rounded-[6px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Record Again / Change Options</span>
                  </button>
                </div>
              </div>
            )}

            {/* IDLE / CONFIGURATION STATE */}
            {!isRecordingVideo && !videoResult && (
              <div className="space-y-3">
                <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)] block mb-1.5">
                      Duration
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { sec: 10, label: '10s (Standard)' },
                        { sec: 5, label: '5s (Quick)' },
                        { sec: 15, label: '15s (Slow)' }
                      ].map((item) => (
                        <button
                          key={item.sec}
                          onClick={() => setVideoDuration(item.sec)}
                          className={`py-1.5 px-2 rounded-[4px] text-[11px] font-medium border text-center transition-all cursor-pointer ${
                            videoDuration === item.sec
                              ? 'bg-[#000000] text-white border-[#000000]'
                              : 'bg-[var(--sg-surface)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)] hover:bg-[var(--sg-surface-hover)] hover:text-[var(--sg-text-primary)]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)] block mb-1.5">
                      Rotation Axis
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { key: 'y', label: 'Y (Turntable)' },
                        { key: 'x', label: 'X (Pitch)' },
                        { key: 'z', label: 'Z (Roll)' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={() => setVideoAxis(item.key as any)}
                          className={`py-1.5 px-2 rounded-[4px] text-[11px] font-medium border text-center transition-all cursor-pointer ${
                            videoAxis === item.key
                              ? 'bg-[#000000] text-white border-[#000000]'
                              : 'bg-[var(--sg-surface)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)] hover:bg-[var(--sg-surface-hover)] hover:text-[var(--sg-text-primary)]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)] block mb-1.5">
                      Video Background
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { key: 'dark', label: 'Studio Dark' },
                        { key: 'white', label: 'Pure White' },
                        { key: 'transparent', label: 'Transparent' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={() => setVideoBg(item.key as any)}
                          className={`py-1.5 px-2 rounded-[4px] text-[11px] font-medium border text-center transition-all cursor-pointer ${
                            videoBg === item.key
                              ? 'bg-[#000000] text-white border-[#000000]'
                              : 'bg-[var(--sg-surface)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)] hover:bg-[var(--sg-surface-hover)] hover:text-[var(--sg-text-primary)]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)] block mb-1.5">
                      Frame Rate
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { fps: 30, label: '30 FPS (Standard)' },
                        { fps: 60, label: '60 FPS (Smooth)' }
                      ].map((item) => (
                        <button
                          key={item.fps}
                          onClick={() => setVideoFps(item.fps)}
                          className={`py-1.5 px-2 rounded-[4px] text-[11px] font-medium border text-center transition-all cursor-pointer ${
                            videoFps === item.fps
                              ? 'bg-[#000000] text-white border-[#000000]'
                              : 'bg-[var(--sg-surface)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)] hover:bg-[var(--sg-surface-hover)] hover:text-[var(--sg-text-primary)]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRecordVideo}
                  className="w-full py-2.5 px-4 rounded-[6px] bg-[#000000] hover:bg-[#222222] text-white font-medium text-[12.5px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Video className="w-4 h-4" />
                  <span>Generate {videoDuration}s MP4 Video</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: 3D MODELS (.GLB / .OBJ / .STL) */}
        {activeTab === '3dmodels' && (
          <div className="space-y-3">
            <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
              Import native 3D meshes directly into Microsoft PowerPoint 365 (<em>Insert &gt; 3D Models</em>), Apple Keynote, Blender, or CAD tools.
            </p>

            {/* Format 1: glTF Binary (.glb) */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  Binary glTF (.glb)
                </span>
                <span className="text-[11px] text-[var(--sg-text-tertiary)]">
                  PowerPoint 3D
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
                Compact binary 3D model with vertex geometry and colors for PowerPoint and Keynote.
              </p>
              <button
                onClick={handleExportGlb}
                disabled={isExporting}
                className="w-full py-2 px-3 rounded-[6px] bg-[#000000] hover:bg-[#222222] text-white text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {cleanId}.glb</span>
              </button>
            </div>

            {/* Format 2: Wavefront OBJ (.obj) */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  Wavefront 3D (.obj)
                </span>
                <span className="text-[11px] text-[var(--sg-text-tertiary)]">
                  Universal 3D
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
                Standard 3D polygonal mesh compatible with Blender, Maya, ChimeraX, and PowerPoint.
              </p>
              <button
                onClick={handleExportObj}
                disabled={isExporting}
                className="w-full py-2 px-3 rounded-[6px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {cleanId}.obj</span>
              </button>
            </div>

            {/* Format 3: Stereolithography (.stl) */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  Stereolithography (.stl)
                </span>
                <span className="text-[11px] text-[var(--sg-text-tertiary)]">
                  3D Printing · CAD
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
                Triangulated surface mesh for 3D printing tangible molecular models.
              </p>
              <button
                onClick={handleExportStl}
                disabled={isExporting}
                className="w-full py-2 px-3 rounded-[6px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {cleanId}.stl</span>
              </button>
            </div>

            {/* Format 4: Raw Coordinates (.pdb / .cif) */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  Coordinate Files (.pdb / .cif)
                </span>
                <span className="text-[11px] text-[var(--sg-text-tertiary)]">
                  Atomic Records
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://files.rcsb.org/download/${cleanId}.pdb`}
                  download={`${cleanId}.pdb`}
                  className="py-1.5 px-3 rounded-[6px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.pdb</span>
                </a>
                <a
                  href={`https://files.rcsb.org/download/${cleanId}.cif`}
                  download={`${cleanId}.cif`}
                  className="py-1.5 px-3 rounded-[6px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.cif</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PYMOL & CHIMERAX PRESENTATION SCRIPTS */}
        {activeTab === 'scripts' && (
          <div className="space-y-3.5">
            <p className="text-[11.5px] text-[var(--sg-text-secondary)] leading-relaxed">
              Automated scripts pre-configured with ray-traced lighting and representation matching your current session.
            </p>

            {/* PyMOL Section */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  PyMOL Script (.pml)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExportPymol(true)}
                    className="px-2 py-1 rounded-[4px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[11px] font-medium text-[var(--sg-text-primary)] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedStatus === 'pml' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedStatus === 'pml' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleExportPymol(false)}
                    className="px-2 py-1 rounded-[4px] bg-[#000000] hover:bg-[#222222] text-white text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>.pml</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-[4px] bg-[var(--sg-surface)] border border-[var(--sg-border-subtle)] text-[var(--sg-text-secondary)] font-mono text-[10.5px] overflow-x-auto max-h-32 select-all">
                <pre>{generatePymolScript(structure, currentStyle, currentColorScheme)}</pre>
              </div>
            </div>

            {/* ChimeraX Section */}
            <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[12.5px] text-[var(--sg-text-primary)]">
                  ChimeraX Script (.cxc)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExportChimerax(true)}
                    className="px-2 py-1 rounded-[4px] bg-[var(--sg-surface)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[11px] font-medium text-[var(--sg-text-primary)] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {copiedStatus === 'cxc' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedStatus === 'cxc' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={() => handleExportChimerax(false)}
                    className="px-2 py-1 rounded-[4px] bg-[#000000] hover:bg-[#222222] text-white text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>.cxc</span>
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-[4px] bg-[var(--sg-surface)] border border-[var(--sg-border-subtle)] text-[var(--sg-text-secondary)] font-mono text-[10.5px] overflow-x-auto max-h-32 select-all">
                <pre>{generateChimeraxScript(structure, currentStyle, currentColorScheme)}</pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-[var(--sg-border)] bg-[var(--sg-surface)] flex items-center justify-between gap-2 shrink-0 text-[11px]">
        <span className="text-[var(--sg-text-tertiary)] truncate">
          Style: <strong className="text-[var(--sg-text-secondary)]">{currentStyle}</strong> · Color: <strong className="text-[var(--sg-text-secondary)]">{currentColorScheme}</strong>
        </span>
        <button
          onClick={onClose}
          className="px-2.5 py-1 rounded-[4px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border)] text-[var(--sg-text-primary)] font-medium text-[11.5px] transition-all cursor-pointer shrink-0"
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
