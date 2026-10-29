/**
 * Pure TypeScript GIF89a animated encoder.
 * Converts Canvas frames (ImageData) into a standard animated .gif file.
 */

// Simple 256-color palette generator (quantization using 3-3-2 bit RGB + grayscale ramp)
function buildColorPalette(): Uint8Array {
  const palette = new Uint8Array(256 * 3);
  let idx = 0;

  // 6x6x6 color cube (216 colors)
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette[idx++] = Math.round((r / 5) * 255);
        palette[idx++] = Math.round((g / 5) * 255);
        palette[idx++] = Math.round((b / 5) * 255);
      }
    }
  }

  // 16 grayscale steps
  for (let i = 0; i < 16; i++) {
    const val = Math.round((i / 15) * 255);
    palette[idx++] = val;
    palette[idx++] = val;
    palette[idx++] = val;
  }

  // 24 custom molecular colors (emerald, cyan, rose, amber, purple, etc.)
  const customColors = [
    [5, 150, 105], [4, 120, 87], [16, 185, 129], [6, 78, 59],
    [59, 130, 246], [37, 99, 235], [29, 78, 216], [99, 102, 241],
    [239, 68, 68], [220, 38, 38], [185, 28, 28], [245, 158, 11],
    [217, 119, 6], [180, 83, 9], [139, 92, 246], [124, 58, 237],
    [6, 182, 212], [8, 145, 178], [14, 116, 144], [100, 116, 139],
    [71, 85, 105], [30, 41, 59], [15, 23, 42], [255, 255, 255]
  ];

  for (const c of customColors) {
    if (idx < 256 * 3) {
      palette[idx++] = c[0];
      palette[idx++] = c[1];
      palette[idx++] = c[2];
    }
  }

  // Fill remaining slots
  while (idx < 256 * 3) {
    palette[idx++] = 0;
  }

  return palette;
}

const GLOBAL_PALETTE = buildColorPalette();

/**
 * Finds the nearest color index in the palette for an RGB pixel.
 */
function findNearestColor(r: number, g: number, b: number, palette: Uint8Array): number {
  let bestIdx = 0;
  let bestDist = Infinity;

  for (let i = 0; i < 256; i++) {
    const pr = palette[i * 3];
    const pg = palette[i * 3 + 1];
    const pb = palette[i * 3 + 2];

    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = dr * dr * 2 + dg * dg * 4 + db * db * 1; // perceptual weighting

    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
      if (dist === 0) break;
    }
  }

  return bestIdx;
}

/**
 * LZW encoder for GIF raster data.
 */
function lzwEncode(minCodeSize: number, indexedPixels: Uint8Array): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  const outBytes: number[] = [];
  let curAccum = 0;
  let curBits = 0;

  function writeBits(bits: number, count: number) {
    curAccum |= bits << curBits;
    curBits += count;
    while (curBits >= 8) {
      outBytes.push(curAccum & 0xff);
      curAccum >>= 8;
      curBits -= 8;
    }
  }

  writeBits(clearCode, codeSize);

  const prefixTable = new Int32Array(4096).fill(-1);
  const charTable = new Int32Array(4096).fill(-1);

  let currentPrefix = -1;

  for (let i = 0; i < indexedPixels.length; i++) {
    const k = indexedPixels[i];

    if (currentPrefix === -1) {
      currentPrefix = k;
      continue;
    }

    // Check if (currentPrefix, k) is in table
    let found = -1;
    for (let c = eoiCode + 1; c < nextCode; c++) {
      if (prefixTable[c] === currentPrefix && charTable[c] === k) {
        found = c;
        break;
      }
    }

    if (found !== -1) {
      currentPrefix = found;
    } else {
      writeBits(currentPrefix, codeSize);

      if (nextCode < 4096) {
        prefixTable[nextCode] = currentPrefix;
        charTable[nextCode] = k;
        nextCode++;
        if (nextCode >= (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        // Table full, emit clear
        writeBits(clearCode, codeSize);
        prefixTable.fill(-1);
        charTable.fill(-1);
        codeSize = minCodeSize + 1;
        nextCode = eoiCode + 1;
      }

      currentPrefix = k;
    }
  }

  if (currentPrefix !== -1) {
    writeBits(currentPrefix, codeSize);
  }

  writeBits(eoiCode, codeSize);

  if (curBits > 0) {
    outBytes.push(curAccum & 0xff);
  }

  // Pack into sub-blocks of at most 255 bytes
  const packetized: number[] = [minCodeSize];
  let offset = 0;
  while (offset < outBytes.length) {
    const chunkSize = Math.min(255, outBytes.length - offset);
    packetized.push(chunkSize);
    for (let j = 0; j < chunkSize; j++) {
      packetized.push(outBytes[offset + j]);
    }
    offset += chunkSize;
  }
  packetized.push(0x00); // Block terminator

  return new Uint8Array(packetized);
}

export interface GifFrameOptions {
  delayMs?: number; // Delay in milliseconds (e.g. 60-100ms)
}

/**
 * Creates an animated GIF from a series of ImageData frames.
 */
export function createAnimatedGif(
  frames: ImageData[],
  options: { delayMs?: number; loop?: boolean } = {}
): Blob {
  if (frames.length === 0) {
    return new Blob([], { type: 'image/gif' });
  }

  const width = frames[0].width;
  const height = frames[0].height;
  const delayHundredths = Math.max(2, Math.round((options.delayMs || 80) / 10)); // GIF delay is in 1/100 sec

  const out: number[] = [];

  // 1. Header: GIF89a
  const header = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
  out.push(...header);

  // 2. Logical Screen Descriptor
  out.push(width & 0xff, (width >> 8) & 0xff);
  out.push(height & 0xff, (height >> 8) & 0xff);
  out.push(0xf7); // Global color table flag: 1, 8 bits/pixel, 256 colors
  out.push(0x00); // Background color index
  out.push(0x00); // Pixel aspect ratio

  // 3. Global Color Table (256 * 3 bytes)
  for (let i = 0; i < GLOBAL_PALETTE.length; i++) {
    out.push(GLOBAL_PALETTE[i]);
  }

  // 4. Netscape Application Extension for looping
  if (options.loop !== false) {
    out.push(
      0x21, 0xff, 0x0b,
      0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, // "NETSCAPE2.0"
      0x03, 0x01, 0x00, 0x00, 0x00 // Loop infinitely
    );
  }

  // 5. Frames
  for (let f = 0; f < frames.length; f++) {
    const frame = frames[f];
    const data = frame.data;
    const pixelCount = width * height;
    const indexed = new Uint8Array(pixelCount);

    for (let p = 0; p < pixelCount; p++) {
      const r = data[p * 4];
      const g = data[p * 4 + 1];
      const b = data[p * 4 + 2];
      indexed[p] = findNearestColor(r, g, b, GLOBAL_PALETTE);
    }

    // Graphic Control Extension
    out.push(
      0x21, 0xf9, 0x04,
      0x04, // Disposal method: 01 (do not dispose / overwrite)
      delayHundredths & 0xff, (delayHundredths >> 8) & 0xff, // Delay
      0x00, // No transparency
      0x00
    );

    // Image Descriptor
    out.push(
      0x2c, // Image separator
      0x00, 0x00, // Left 0
      0x00, 0x00, // Top 0
      width & 0xff, (width >> 8) & 0xff,
      height & 0xff, (height >> 8) & 0xff,
      0x00 // No local color table
    );

    // LZW Raster Data
    const lzwData = lzwEncode(8, indexed);
    for (let b = 0; b < lzwData.length; b++) {
      out.push(lzwData[b]);
    }
  }

  // 6. GIF Trailer
  out.push(0x3b);

  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}
