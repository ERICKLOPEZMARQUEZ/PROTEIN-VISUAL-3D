/**
 * Video recording and MP4 conversion utility for 3D Protein Structures
 * Records smooth 360-degree rotation of macromolecules and outputs high-quality H.264 MP4 files.
 */

export interface SmoothRotationOptions {
  durationSec?: number; // Default 10 seconds
  fps?: number; // Default 30 FPS
  totalDegrees?: number; // Default 360 degrees (1 full turn)
  axis?: 'y' | 'x' | 'z'; // Default 'y' (horizontal turntable)
  structureId?: string;
  backgroundColor?: 'dark' | 'white' | 'transparent';
  onProgress?: (progress: VideoProgressState) => void;
}

export interface VideoProgressState {
  phase: 'idle' | 'recording' | 'converting' | 'completed' | 'error';
  elapsedSec: number;
  totalSec: number;
  percent: number;
  currentAngleDeg: number;
  message?: string;
}

export interface VideoExportResult {
  blob: Blob;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
}

/**
 * Detect the best available MediaRecorder MIME type supported by this browser.
 */
export function getOptimalRecordingMimeType(): string {
  const preferredTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1',
    'video/mp4'
  ];

  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  for (const mime of preferredTypes) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // ignore unsupported check errors
    }
  }
  return '';
}

/**
 * Records a smooth 360-degree rotation of the protein from the 3Dmol viewer
 * and converts it into a universally compatible 10-second H.264 MP4 file.
 */
export async function recordSmoothRotationMP4(
  viewer: any,
  canvasElement: HTMLCanvasElement,
  options: SmoothRotationOptions = {},
  abortSignal?: AbortSignal
): Promise<VideoExportResult> {
  const durationSec = Math.max(1, options.durationSec ?? 10);
  const fps = options.fps ?? 30;
  const totalDegrees = options.totalDegrees ?? 360;
  const axis = options.axis ?? 'y';
  const structureId = options.structureId || 'protein';
  const cleanId = structureId.replace(/[^a-zA-Z0-9_-]/g, '') || 'structure';
  const bgMode = options.backgroundColor ?? 'dark';
  const onProgress = options.onProgress;

  if (!canvasElement) {
    throw new Error('Canvas element is required for video recording.');
  }

  if (!viewer) {
    throw new Error('3D viewer instance is required.');
  }

  // Check MediaRecorder support
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser environment.');
  }

  // Pause 3Dmol's internal spin animation so it doesn't fight with our frame-accurate turntable loop
  try {
    viewer.spin?.(false);
    viewer.render?.();
  } catch {
    // ignore
  }

  // Create an offscreen 2D staging canvas with guaranteed even dimensions (required by H.264 / yuv420p)
  const rawWidth = canvasElement.width || canvasElement.clientWidth || 800;
  const rawHeight = canvasElement.height || canvasElement.clientHeight || 600;
  const evenWidth = Math.max(2, Math.floor(rawWidth / 2) * 2);
  const evenHeight = Math.max(2, Math.floor(rawHeight / 2) * 2);

  const stagingCanvas = document.createElement('canvas');
  stagingCanvas.width = evenWidth;
  stagingCanvas.height = evenHeight;
  const stagingCtx = stagingCanvas.getContext('2d');

  const drawFrameToStaging = () => {
    if (!stagingCtx) return;
    stagingCtx.clearRect(0, 0, evenWidth, evenHeight);
    if (bgMode !== 'transparent') {
      stagingCtx.fillStyle = bgMode === 'white' ? '#FFFFFF' : '#111110';
      stagingCtx.fillRect(0, 0, evenWidth, evenHeight);
    }
    try {
      stagingCtx.drawImage(canvasElement, 0, 0, evenWidth, evenHeight);
    } catch {
      // ignore transient WebGL drawImage errors
    }
  };

  // Draw initial frame before starting stream capture
  drawFrameToStaging();

  // Ensure canvas stream (prefer 2D staging canvas, fallback to source WebGL canvas)
  let stream: MediaStream | null = null;
  const captureTarget = stagingCtx ? stagingCanvas : canvasElement;
  try {
    stream = captureTarget.captureStream
      ? captureTarget.captureStream(fps)
      : (captureTarget as any).mozCaptureStream?.(fps);
  } catch {
    try {
      stream = canvasElement.captureStream
        ? canvasElement.captureStream(fps)
        : (canvasElement as any).mozCaptureStream?.(fps);
    } catch (err: any) {
      throw new Error('Failed to capture stream from canvas: ' + (err?.message || String(err)));
    }
  }

  if (!stream) {
    throw new Error('Canvas does not support captureStream in this browser.');
  }

  const mimeType = getOptimalRecordingMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 })
      : new MediaRecorder(stream, { videoBitsPerSecond: 5000000 });
  } catch {
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  // Start recorder
  recorder.start(100); // 100ms timeslices for steady chunk streaming

  onProgress?.({
    phase: 'recording',
    elapsedSec: 0,
    totalSec: durationSec,
    percent: 0,
    currentAngleDeg: 0,
    message: `Recording 10s smooth ${axis.toUpperCase()}-axis rotation...`
  });

  // Smooth rotation animation loop using high-precision performance.now()
  const durationMs = durationSec * 1000;
  let animationFrameId: number;

  await new Promise<void>((resolve, reject) => {
    const startTime = performance.now();
    let accumulatedDegrees = 0;

    const onAbort = () => {
      cancelAnimationFrame(animationFrameId);
      try {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      } catch {
        // ignore
      }
      reject(new DOMException('Video recording cancelled by user', 'AbortError'));
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }

    const step = (now: number) => {
      if (abortSignal?.aborted) {
        onAbort();
        return;
      }

      const elapsedMs = Math.min(durationMs, now - startTime);
      const progress = elapsedMs / durationMs;
      const targetAngle = progress * totalDegrees;
      const deltaAngle = targetAngle - accumulatedDegrees;

      if (Math.abs(deltaAngle) > 0.001) {
        try {
          viewer.rotate(deltaAngle, axis);
          viewer.render();
        } catch {
          // ignore
        }
        accumulatedDegrees = targetAngle;
      }

      drawFrameToStaging();

      const elapsedSec = Math.min(durationSec, elapsedMs / 1000);
      const percent = Math.min(100, Math.round(progress * 100));

      onProgress?.({
        phase: 'recording',
        elapsedSec,
        totalSec: durationSec,
        percent,
        currentAngleDeg: Math.round(targetAngle),
        message: `Recording: ${elapsedSec.toFixed(1)}s / ${durationSec.toFixed(1)}s (${percent}%) • ${Math.round(targetAngle)}°`
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        // Animation complete
        if (abortSignal) {
          abortSignal.removeEventListener('abort', onAbort);
        }
        resolve();
      }
    };

    // Kick off animation loop
    animationFrameId = requestAnimationFrame(step);
  });

  // Stop MediaRecorder and collect blob
  const recordedRawBlob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const fullBlob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
      resolve(fullBlob);
    };
    try {
      if (recorder.state === 'recording') {
        try {
          recorder.requestData();
        } catch {
          // ignore
        }
        recorder.stop();
      } else {
        resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
      }
    } catch {
      resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
    }
  });

  // Stop media stream tracks cleanly
  try {
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // ignore
  }

  onProgress?.({
    phase: 'converting',
    elapsedSec: durationSec,
    totalSec: durationSec,
    percent: 100,
    currentAngleDeg: totalDegrees,
    message: 'Encoding universally compatible H.264 MP4 video...'
  });

  // Convert via backend ffmpeg service
  try {
    const response = await fetch(`/api/video/convert-mp4?id=${encodeURIComponent(cleanId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': recordedRawBlob.type || 'video/webm'
      },
      body: recordedRawBlob
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Server returned ${response.status}`);
    }

    const mp4Blob = await response.blob();
    const finalBlob = new Blob([mp4Blob], { type: 'video/mp4' });
    const url = URL.createObjectURL(finalBlob);
    const filename = `${cleanId}_10s_smooth_rotation.mp4`;

    onProgress?.({
      phase: 'completed',
      elapsedSec: durationSec,
      totalSec: durationSec,
      percent: 100,
      currentAngleDeg: totalDegrees,
      message: '10-Second Smooth Rotation MP4 successfully generated!'
    });

    return {
      blob: finalBlob,
      url,
      filename,
      mimeType: 'video/mp4',
      sizeBytes: finalBlob.size,
      durationSec
    };
  } catch (err: any) {
    console.warn('Backend MP4 conversion unavailable, using captured recording directly:', err);

    // Fallback: If client browser already produced MP4 or if WebM fallback is needed
    const isClientMp4 = recordedRawBlob.type.includes('mp4');
    const ext = isClientMp4 ? 'mp4' : 'webm';
    const fallbackUrl = URL.createObjectURL(recordedRawBlob);
    const fallbackFilename = `${cleanId}_10s_smooth_rotation.${ext}`;

    onProgress?.({
      phase: 'completed',
      elapsedSec: durationSec,
      totalSec: durationSec,
      percent: 100,
      currentAngleDeg: totalDegrees,
      message: `Recording ready (${(recordedRawBlob.size / (1024 * 1024)).toFixed(1)} MB)`
    });

    return {
      blob: recordedRawBlob,
      url: fallbackUrl,
      filename: fallbackFilename,
      mimeType: recordedRawBlob.type,
      sizeBytes: recordedRawBlob.size,
      durationSec
    };
  }
}

/**
 * Download a video blob to user filesystem with given filename
 */
export function downloadVideoBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
