import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Square,
  Video,
  Download,
  Repeat
} from 'lucide-react';
import { PDBMetadata, ViewerStyle, ColorScheme } from '../types';

export interface MovieCommandStep {
  id: string;
  raw: string;
  cmd: string;
  args: string[];
  durationSec: number;
  label?: string;
}

interface MovieMakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  structure: PDBMetadata | null;
  glViewer: any;
  canvasElement: HTMLCanvasElement | null;
  selectedLigandId?: string | null;
  currentStyle: ViewerStyle;
  currentColorScheme: ColorScheme;
  onApplyStyle: (style: ViewerStyle) => void;
  onApplyColorScheme: (scheme: ColorScheme) => void;
  onHighlightContacts?: (on: boolean) => void;
}

const PRESET_SCRIPTS: { name: string; description: string; script: string }[] = [
  {
    name: '10s Smooth Turntable (MP4)',
    description: 'Exact 10-second smooth 360° rotation in horizontal turntable view',
    script: `label 10s Smooth 360° Turntable
orient front
rotate y 360 10`
  },
  {
    name: 'Turntable 360°',
    description: 'Smooth 360° global rotation for full macromolecular overview',
    script: `label 360° Global Overview
orient front
rotate y 360 4
wait 0.5`
  },
  {
    name: 'Ligand Pocket Dive',
    description: 'Fly into the ligand binding pocket, show contact envelope, and rock',
    script: `label Global Conformation
orient front
rotate y 90 2
label Zooming into Ligand Binding Pocket
zoom ligand 2
contacts on
label Pocket Inspection & Sidechain Chemistry
rotate y 180 3
rock 25 2 2
wait 1
label Full Structure Return
zoom reset 1.5
contacts off`
  },
  {
    name: 'Secondary Structure Showcase',
    description: 'Color by alpha helices & beta sheets and orbit from multiple angles',
    script: `label Secondary Structure Architecture
color secondary
orient front
rotate y 180 3
label Top-Down Helical Bundle Inspection
orient top
rock 30 2 2
label Side Sagittal Profile
orient side
rotate x 90 2
orient front
color chain`
  },
  {
    name: 'Crystallographic Depth Rocking',
    description: 'Gentle rocking oscillation providing stereoscopic depth perception',
    script: `label Frontal Depth Rocking
orient front
rock 35 3 4
label Lateral Depth Rocking
orient side
rock 35 3 4
orient front`
  },
  {
    name: 'Multi-Style Molecular Tour',
    description: 'Progressively transitions from cartoon to surface to ball-and-stick',
    script: `label Cartoon Secondary Structure
style cartoon
orient front
rotate y 180 2.5
label Solvent Accessible Surface
style surface
rock 20 2 2
label Atomic Ball and Stick Details
style ball-and-stick
rotate y 180 2.5
style cartoon`
  }
];

export const MovieMakerModal: React.FC<MovieMakerModalProps> = ({
  isOpen,
  onClose,
  structure,
  glViewer,
  canvasElement,
  selectedLigandId,
  onApplyStyle,
  onApplyColorScheme,
  onHighlightContacts
}) => {
  const [scriptText, setScriptText] = useState<string>(PRESET_SCRIPTS[0].script);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [activeMovieLabel, setActiveMovieLabel] = useState<string | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<string>('');
  const [recordVideoOption, setRecordVideoOption] = useState<boolean>(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Animation and Recording Refs
  const abortAnimationRef = useRef<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isOpen) {
      const el = document.getElementById('right-sidebar-tool-host');
      setPortalTarget(el);
    }
  }, [isOpen]);

  // Parse raw text script into steps
  const parseScript = useCallback((text: string): MovieCommandStep[] => {
    const lines = text.split('\n');
    const steps: MovieCommandStep[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      const tokens = line.split(/\s+/);
      const cmd = tokens[0].toLowerCase();
      const args = tokens.slice(1);

      let durationSec = 1;
      let label: string | undefined;

      if (cmd === 'label') {
        label = args.join(' ');
        durationSec = 0.1;
      } else if (cmd === 'rotate' || cmd === 'spin') {
        durationSec = args[2] ? parseFloat(args[2]) : 3;
      } else if (cmd === 'rock') {
        durationSec = args[2] ? parseFloat(args[2]) : 3;
      } else if (cmd === 'zoom') {
        durationSec = args[1] ? parseFloat(args[1]) : 1.5;
      } else if (cmd === 'focus') {
        durationSec = args[1] ? parseFloat(args[1]) : 1.5;
      } else if (cmd === 'orient') {
        durationSec = 1;
      } else if (cmd === 'wait' || cmd === 'pause') {
        durationSec = args[0] ? parseFloat(args[0]) : 1;
      } else if (cmd === 'style' || cmd === 'color' || cmd === 'contacts') {
        durationSec = 0.4;
      }

      steps.push({
        id: `step_${i}_${cmd}`,
        raw: line,
        cmd,
        args,
        durationSec: Math.max(0.1, isNaN(durationSec) ? 1 : durationSec),
        label
      });
    }

    return steps;
  }, []);

  const parsedSteps = parseScript(scriptText);

  // Stop movie execution
  const stopMovie = useCallback(() => {
    abortAnimationRef.current = true;
    setIsPlaying(false);
    setCurrentStepIndex(-1);
    setActiveMovieLabel(null);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // Clean up when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopMovie();
    }
  }, [isOpen, stopMovie]);

  // Execute a single step
  const executeStep = useCallback(
    async (step: MovieCommandStep, speed: number): Promise<void> => {
      const viewer = glViewer;
      const duration = (step.durationSec * 1000) / speed;

      if (step.cmd === 'label') {
        setActiveMovieLabel(step.args.join(' '));
        await new Promise((r) => setTimeout(r, 100));
        return;
      }

      if (step.cmd === 'wait' || step.cmd === 'pause') {
        await new Promise((r) => setTimeout(r, duration));
        return;
      }

      if (step.cmd === 'style') {
        const targetStyle = step.args[0] as ViewerStyle;
        if (targetStyle) onApplyStyle(targetStyle);
        await new Promise((r) => setTimeout(r, duration));
        return;
      }

      if (step.cmd === 'color') {
        const targetColor = step.args[0] as ColorScheme;
        if (targetColor) onApplyColorScheme(targetColor);
        await new Promise((r) => setTimeout(r, duration));
        return;
      }

      if (step.cmd === 'contacts') {
        const state = step.args[0]?.toLowerCase() === 'on';
        onHighlightContacts?.(state);
        await new Promise((r) => setTimeout(r, duration));
        return;
      }

      if (!viewer) {
        await new Promise((r) => setTimeout(r, duration));
        return;
      }

      if (step.cmd === 'orient') {
        const axis = step.args[0]?.toLowerCase();
        try {
          viewer.zoomTo();
          if (axis === 'top') viewer.rotate(90, 'x');
          else if (axis === 'side') viewer.rotate(90, 'y');
          viewer.render();
        } catch (e) {
          console.warn('Orient step error:', e);
        }
        await new Promise((r) => setTimeout(r, duration));
        return;
      }

      if (step.cmd === 'zoom') {
        const target = step.args[0]?.toLowerCase();
        try {
          if (target === 'ligand' && selectedLigandId) {
            const ligSel = { resn: [selectedLigandId, selectedLigandId.toUpperCase()] };
            viewer.center(ligSel, duration);
            viewer.zoomTo(ligSel, duration);
          } else if (target === 'reset') {
            viewer.zoomTo({}, duration);
          } else if (target === 'in') {
            viewer.zoom(1.4, duration);
          } else if (target === 'out') {
            viewer.zoom(0.7, duration);
          } else {
            viewer.zoomTo({}, duration);
          }
        } catch (e) {
          console.warn('Zoom step error:', e);
        }
        await new Promise((r) => setTimeout(r, duration));
        return;
      }

      if (step.cmd === 'focus') {
        const query = step.args[0];
        try {
          if (query) {
            const num = parseInt(query.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num)) {
              viewer.center({ resi: num }, duration);
              viewer.zoomTo({ resi: num }, duration);
            }
          }
        } catch (e) {
          console.warn('Focus step error:', e);
        }
        await new Promise((r) => setTimeout(r, duration));
        return;
      }

      if (step.cmd === 'rotate' || step.cmd === 'spin') {
        const axis = step.args[0]?.toLowerCase() === 'x' ? 'x' : step.args[0]?.toLowerCase() === 'z' ? 'z' : 'y';
        const targetDeg = parseFloat(step.args[1]) || 360;

        return new Promise<void>((resolve) => {
          const startTime = performance.now();
          let prevTime = startTime;

          const animate = (now: number) => {
            if (abortAnimationRef.current) {
              resolve();
              return;
            }

            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            const deltaMs = now - prevTime;
            prevTime = now;

            const degThisFrame = (targetDeg * deltaMs) / duration;
            viewer.rotate(degThisFrame, axis);
            viewer.render();

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              resolve();
            }
          };

          requestAnimationFrame(animate);
        });
      }

      if (step.cmd === 'rock') {
        const targetDeg = parseFloat(step.args[0]) || 30;
        const cycles = parseFloat(step.args[1]) || 2;

        return new Promise<void>((resolve) => {
          const startTime = performance.now();
          let prevAngle = 0;

          const animate = (now: number) => {
            if (abortAnimationRef.current) {
              resolve();
              return;
            }

            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);

            const currentAngle = targetDeg * Math.sin(progress * Math.PI * 2 * cycles);
            const deltaAngle = currentAngle - prevAngle;
            prevAngle = currentAngle;

            viewer.rotate(deltaAngle, 'y');
            viewer.render();

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              resolve();
            }
          };

          requestAnimationFrame(animate);
        });
      }

      await new Promise((r) => setTimeout(r, duration));
    },
    [glViewer, onApplyStyle, onApplyColorScheme, onHighlightContacts, selectedLigandId]
  );

  // Play full movie script
  const playMovie = useCallback(async () => {
    if (parsedSteps.length === 0) return;

    abortAnimationRef.current = false;
    setIsPlaying(true);
    setRecordedVideoUrl(null);

    try {
      glViewer?.spin?.(false);
    } catch {
      // ignore
    }

    let recorder: MediaRecorder | null = null;
    if (recordVideoOption && canvasElement) {
      try {
        const stream = canvasElement.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';

        recorder = new MediaRecorder(stream, { mimeType });
        recordedChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType });
          const cleanId = structure?.id || 'protein';
          setRecordingStatus('Transcoding to universal H.264 MP4...');
          try {
            const resp = await fetch(`/api/video/convert-mp4?id=${encodeURIComponent(cleanId)}`, {
              method: 'POST',
              headers: { 'Content-Type': rawBlob.type || 'video/webm' },
              body: rawBlob
            });
            if (resp.ok) {
              const mp4Blob = await resp.blob();
              const url = URL.createObjectURL(mp4Blob);
              setRecordedVideoUrl(url);
              setRecordingStatus(`Movie ready: ${(mp4Blob.size / (1024 * 1024)).toFixed(2)} MB MP4`);
              setIsRecording(false);
              return;
            }
          } catch (e) {
            console.warn('MP4 conversion fallback:', e);
          }
          const url = URL.createObjectURL(rawBlob);
          setRecordedVideoUrl(url);
          setRecordingStatus(`Movie recorded: ${(rawBlob.size / (1024 * 1024)).toFixed(2)} MB`);
          setIsRecording(false);
        };

        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingStatus('Recording video frames at 30 FPS...');
      } catch (err) {
        console.warn('Canvas MediaRecorder failed:', err);
      }
    }

    do {
      for (let i = 0; i < parsedSteps.length; i++) {
        if (abortAnimationRef.current) break;
        setCurrentStepIndex(i);
        await executeStep(parsedSteps[i], playbackSpeed);
      }
    } while (isLooping && !abortAnimationRef.current);

    if (recorder && recorder.state === 'recording') {
      try {
        recorder.requestData();
      } catch {
        // ignore
      }
      recorder.stop();
    }

    setIsPlaying(false);
    setCurrentStepIndex(-1);
    setActiveMovieLabel(null);
  }, [parsedSteps, executeStep, playbackSpeed, isLooping, recordVideoOption, canvasElement, glViewer, structure?.id]);

  // Insert command snippet into editor
  const handleInsertCommand = (cmdStr: string) => {
    setScriptText((prev) => prev.trim() + '\n' + cmdStr);
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
                Movie Maker Studio
              </h3>
            </div>
            <p className="text-[11px] text-[var(--sg-text-secondary)] truncate">
              {structure ? `Scripted 3D camera choreography for ${structure.id}` : 'Compose scripted 3D rotations & animations'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] hover:bg-[var(--sg-surface-sunken)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all cursor-pointer"
            title="Close Movie Maker and return to Structural Biology Chat"
            aria-label="Close Movie Maker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preset Selector Strip */}
      <div className="px-3.5 py-2 border-b border-[var(--sg-border-subtle)] bg-[var(--sg-surface)] flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar text-[11px] shrink-0">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-[var(--sg-text-tertiary)] shrink-0">
          Presets:
        </span>
        {PRESET_SCRIPTS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => {
              if (!isPlaying) {
                setScriptText(preset.script);
                setRecordedVideoUrl(null);
              }
            }}
            disabled={isPlaying}
            className={`px-2 py-0.5 rounded-[4px] border transition-all whitespace-nowrap disabled:opacity-50 cursor-pointer font-medium ${
              scriptText === preset.script
                ? 'bg-[#000000] text-white border-[#000000]'
                : 'bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border-[var(--sg-border-subtle)] text-[var(--sg-text-primary)]'
            }`}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Main Scrollable Sidebar Body */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-[13px] text-[var(--sg-text-primary)] leading-relaxed min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden no-scrollbar">
        {/* Script Editor Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)]">
              Movie Script Commands
            </span>
            <span className="text-[11px] text-[var(--sg-text-tertiary)] font-mono">
              {parsedSteps.length} steps · ~{parsedSteps.reduce((acc, s) => acc + s.durationSec, 0).toFixed(1)}s
            </span>
          </div>

          {/* Quick Command Insertion Buttons */}
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { label: '+ Rotate 360°', cmd: 'rotate y 360 4' },
              { label: '+ Rock 30°', cmd: 'rock 30 2 3' },
              { label: '+ Zoom Ligand', cmd: 'zoom ligand 2' },
              { label: '+ Contacts On', cmd: 'contacts on' },
              { label: '+ Style', cmd: 'style cartoon' },
              { label: '+ Orient Front', cmd: 'orient front' },
              { label: '+ Label', cmd: 'label Subtitle Text Here' }
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => handleInsertCommand(item.cmd)}
                disabled={isPlaying}
                className="px-2 py-0.5 rounded-[4px] text-[11px] bg-[var(--sg-surface-sunken)] hover:bg-[var(--sg-surface-hover)] border border-[var(--sg-border-subtle)] text-[var(--sg-text-secondary)] hover:text-[var(--sg-text-primary)] transition-all cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            disabled={isPlaying}
            placeholder="Type simple commands here..."
            rows={5}
            className="w-full p-2.5 font-mono text-[12px] leading-relaxed bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] rounded-[6px] focus:outline-none focus:border-[#000000] focus:ring-1 focus:ring-[#000000] text-[var(--sg-text-primary)] disabled:opacity-60 resize-y"
            spellCheck={false}
          />
        </div>

        {/* Active Label & Execution Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sg-text-tertiary)]">
              Timeline & Playback
            </span>
            {activeMovieLabel && (
              <span className="text-[11px] font-medium text-[var(--sg-text-primary)] truncate max-w-[190px]">
                {activeMovieLabel}
              </span>
            )}
          </div>

          <div className="max-h-[140px] overflow-y-auto p-2 bg-[var(--sg-surface-sunken)] rounded-[6px] border border-[var(--sg-border-subtle)] space-y-1">
            {parsedSteps.map((step, idx) => {
              const isActive = currentStepIndex === idx;
              const isPast = currentStepIndex > idx;

              return (
                <div
                  key={step.id}
                  className={`px-2 py-1 rounded-[4px] text-[11px] font-mono flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-[#000000] text-white font-semibold'
                      : isPast
                      ? 'bg-[var(--sg-surface)] text-[var(--sg-text-tertiary)] line-through opacity-70'
                      : 'bg-[var(--sg-surface)] text-[var(--sg-text-secondary)] border border-[var(--sg-border-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[10px] opacity-75">{idx + 1}.</span>
                    <span className="truncate">{step.raw}</span>
                  </div>
                  <span className="text-[10px] shrink-0 font-sans ml-2 opacity-80">
                    {step.durationSec}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Playback Settings */}
        <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] space-y-2.5 text-[12px]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recordVideoOption}
              onChange={(e) => setRecordVideoOption(e.target.checked)}
              disabled={isPlaying}
              className="rounded border-[var(--sg-border)] accent-[#000000] cursor-pointer"
            />
            <span className="font-medium text-[var(--sg-text-primary)] flex items-center gap-1.5 text-[12px]">
              <Video className="w-3.5 h-3.5" />
              <span>Record Canvas as Video File (.mp4)</span>
            </span>
          </label>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--sg-border-subtle)] text-[11.5px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--sg-text-secondary)]">Speed:</span>
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  disabled={isPlaying}
                  className={`px-2 py-0.5 rounded-[4px] font-mono text-[11px] border transition-all cursor-pointer ${
                    playbackSpeed === s
                      ? 'bg-[#000000] text-white border-[#000000] font-semibold'
                      : 'bg-[var(--sg-surface)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)] hover:bg-[var(--sg-surface-hover)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsLooping(!isLooping)}
              disabled={isPlaying}
              className={`px-2 py-0.5 rounded-[4px] flex items-center gap-1 text-[11px] border transition-all cursor-pointer ${
                isLooping
                  ? 'bg-[#000000] text-white border-[#000000] font-semibold'
                  : 'bg-[var(--sg-surface)] text-[var(--sg-text-secondary)] border-[var(--sg-border-subtle)]'
              }`}
              title="Loop movie continuously"
            >
              <Repeat className="w-3 h-3" />
              <span>Loop</span>
            </button>
          </div>
        </div>

        {/* Video Download Ready Callout */}
        {recordedVideoUrl && (
          <div className="p-3 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border)] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-semibold text-[12px] text-[var(--sg-text-primary)] block truncate">
                Movie Ready for Download
              </span>
              <span className="text-[11px] text-[var(--sg-text-secondary)] block truncate">
                {recordingStatus || 'MP4 video ready'}
              </span>
            </div>
            <a
              href={recordedVideoUrl}
              download={`${structure?.id || 'protein'}_movie.mp4`}
              className="px-2.5 py-1.5 rounded-[4px] bg-[#000000] hover:bg-[#222222] text-white font-medium text-[11.5px] flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>
        )}

        {/* Command Syntax Reference */}
        <div className="p-2.5 rounded-[6px] bg-[var(--sg-surface-sunken)] border border-[var(--sg-border-subtle)] text-[11px] text-[var(--sg-text-secondary)] space-y-1">
          <span className="font-semibold text-[var(--sg-text-primary)] block">Syntax Reference</span>
          <div className="grid grid-cols-1 gap-0.5 font-mono text-[10.5px]">
            <span>rotate [y|x|z] [deg] [sec]</span>
            <span>rock [deg] [cycles] [sec]</span>
            <span>zoom [ligand|reset|in|out] [sec]</span>
            <span>style [cartoon|surface|ribbon|ball-and-stick]</span>
            <span>color [chain|secondary|plddt|hydrophobicity]</span>
          </div>
        </div>
      </div>

      {/* Footer Playback Controls */}
      <div className="p-2.5 border-t border-[var(--sg-border)] bg-[var(--sg-surface)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isPlaying ? (
            <button
              onClick={playMovie}
              disabled={parsedSteps.length === 0}
              className="flex-1 py-1.5 px-3 rounded-[6px] bg-[#000000] hover:bg-[#222222] text-white text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{recordVideoOption ? 'Play & Record' : 'Play Movie'}</span>
            </button>
          ) : (
            <button
              onClick={stopMovie}
              className="flex-1 py-1.5 px-3 rounded-[6px] bg-[#000000] hover:bg-[#222222] text-white text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isRecording ? 'Stop Recording' : 'Stop Movie'}</span>
            </button>
          )}
        </div>

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
