import { PDBMetadata } from '../types';

export interface MeshData {
  positions: number[];
  normals: number[];
  colors: number[];
  indices: number[];
}

/**
 * Parses VRML 2.0 output from 3Dmol.js into a clean triangular mesh structure.
 */
export function parseVrmlToMesh(vrmlText: string): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  if (!vrmlText || !vrmlText.includes('IndexedFaceSet')) {
    return { positions, normals, colors, indices };
  }

  const faceSetRegex = /geometry\s+IndexedFaceSet\s*\{([\s\S]*?)(?=(?:geometry\s+IndexedFaceSet|Shape\s*\{|$))/gi;
  let match: RegExpExecArray | null;
  let vertexOffset = 0;

  while ((match = faceSetRegex.exec(vrmlText)) !== null) {
    const block = match[1];

    // 1. Points
    const pMatch = block.match(/point\s*\[([\s\S]*?)\]/);
    if (!pMatch) continue;
    const pCoords = pMatch[1].trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    const startVert = vertexOffset;

    for (let i = 0; i < pCoords.length; i += 3) {
      if (i + 2 < pCoords.length) {
        positions.push(pCoords[i], pCoords[i + 1], pCoords[i + 2]);
        vertexOffset++;
      }
    }

    // 2. Normals (optional)
    const nMatch = block.match(/vector\s*\[([\s\S]*?)\]/);
    if (nMatch) {
      const nCoords = nMatch[1].trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      for (let i = 0; i < nCoords.length; i += 3) {
        if (i + 2 < nCoords.length) {
          normals.push(nCoords[i], nCoords[i + 1], nCoords[i + 2]);
        }
      }
    }

    // 3. Colors (optional)
    const cMatch = block.match(/color\s*\[([\s\S]*?)\]/);
    if (cMatch) {
      const cCoords = cMatch[1].trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      for (let i = 0; i < cCoords.length; i += 3) {
        if (i + 2 < cCoords.length) {
          colors.push(cCoords[i], cCoords[i + 1], cCoords[i + 2]);
        }
      }
    }

    // 4. Face Indices
    const idxMatch = block.match(/coordIndex\s*\[([\s\S]*?)\]/);
    if (idxMatch) {
      const idxs = idxMatch[1].trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      let face: number[] = [];
      for (const idx of idxs) {
        if (idx === -1) {
          if (face.length === 3) {
            indices.push(face[0] + startVert, face[1] + startVert, face[2] + startVert);
          } else if (face.length === 4) {
            // Quad to two triangles
            indices.push(face[0] + startVert, face[1] + startVert, face[2] + startVert);
            indices.push(face[0] + startVert, face[2] + startVert, face[3] + startVert);
          } else if (face.length > 4) {
            // Polygon fan triangulation
            for (let f = 1; f < face.length - 1; f++) {
              indices.push(face[0] + startVert, face[f] + startVert, face[f + 1] + startVert);
            }
          }
          face = [];
        } else {
          face.push(idx);
        }
      }
      if (face.length >= 3) {
        for (let f = 1; f < face.length - 1; f++) {
          indices.push(face[0] + startVert, face[f] + startVert, face[f + 1] + startVert);
        }
      }
    }
  }

  return { positions, normals, colors, indices };
}

/**
 * Fallback mesh generator directly from live 3Dmol viewer atoms or PDB/mmCIF coordinate text
 * when VRML is empty or unavailable.
 * Generates 3D octahedron representations for CA backbone and ligand atoms.
 */
export function generatePdbFallbackMesh(pdbText: string, viewer?: any): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const atoms: Array<{ x: number; y: number; z: number; isLigand: boolean }> = [];

  // 1. Try extracting atoms directly from live 3Dmol viewer model first (works for both PDB and mmCIF)
  if (viewer && typeof viewer.selectedAtoms === 'function') {
    try {
      const modelAtoms = viewer.selectedAtoms({}) || [];
      for (const a of modelAtoms) {
        if (typeof a.x === 'number' && typeof a.y === 'number' && typeof a.z === 'number') {
          if (a.atom === 'CA' || a.hetflag) {
            atoms.push({ x: a.x, y: a.y, z: a.z, isLigand: Boolean(a.hetflag) });
          }
        }
      }
      // If structure has no CA/hetflag (e.g., nucleic acids or small molecules), take all atoms
      if (atoms.length === 0 && modelAtoms.length > 0) {
        for (const a of modelAtoms) {
          if (typeof a.x === 'number' && typeof a.y === 'number' && typeof a.z === 'number') {
            atoms.push({ x: a.x, y: a.y, z: a.z, isLigand: Boolean(a.hetflag) });
          }
        }
      }
    } catch {
      // ignore viewer atom query error and fall back to text parsing
    }
  }

  // 2. Fallback: parse PDB or mmCIF text
  if (atoms.length === 0 && pdbText) {
    const lines = pdbText.split('\n');
    for (const line of lines) {
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        // Check if fixed-width PDB format or whitespace-delimited mmCIF format
        const tokens = line.trim().split(/\s+/);
        if (tokens.length >= 13 && !isNaN(parseFloat(tokens[10])) && !isNaN(parseFloat(tokens[11])) && !isNaN(parseFloat(tokens[12]))) {
          const atomName = tokens[3];
          const x = parseFloat(tokens[10]);
          const y = parseFloat(tokens[11]);
          const z = parseFloat(tokens[12]);
          if (atomName === 'CA' || line.startsWith('HETATM')) {
            atoms.push({ x, y, z, isLigand: line.startsWith('HETATM') });
          }
        } else {
          const atomName = line.substring(12, 16).trim();
          const x = parseFloat(line.substring(30, 38));
          const y = parseFloat(line.substring(38, 46));
          const z = parseFloat(line.substring(46, 54));
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            if (atomName === 'CA' || line.startsWith('HETATM')) {
              atoms.push({ x, y, z, isLigand: line.startsWith('HETATM') });
            }
          }
        }
      }
    }
  }

  // Ensure at least one fallback atom so exported 3D files are never empty or invalid
  if (atoms.length === 0) {
    atoms.push({ x: 0, y: 0, z: 0, isLigand: false });
  }

  const r = 0.75;
  const offsets = [
    [r, 0, 0],
    [-r, 0, 0],
    [0, r, 0],
    [0, -r, 0],
    [0, 0, r],
    [0, 0, -r]
  ];
  const octFaces = [
    [0, 2, 4],
    [2, 1, 4],
    [1, 3, 4],
    [3, 0, 4],
    [2, 0, 5],
    [1, 2, 5],
    [3, 1, 5],
    [0, 3, 5]
  ];

  let vertOffset = 0;
  const limit = Math.min(atoms.length, 3000);

  for (let a = 0; a < limit; a++) {
    const at = atoms[a];
    const startV = vertOffset;
    const col = at.isLigand ? [0.95, 0.4, 0.2] : [0.25, 0.55, 0.95];

    for (const off of offsets) {
      positions.push(at.x + off[0], at.y + off[1], at.z + off[2]);
      colors.push(col[0], col[1], col[2]);
      vertOffset++;
    }

    for (const f of octFaces) {
      indices.push(startV + f[0], startV + f[1], startV + f[2]);
    }
  }

  return { positions, normals, colors, indices };
}

/**
 * Converts mesh data to standard Wavefront OBJ format (.obj).
 * Accepted by Microsoft PowerPoint (Insert > 3D Models), Blender, Maya, Keynote.
 */
export function meshToObj(mesh: MeshData, metadata?: PDBMetadata | null): string {
  let obj = `# Wavefront OBJ 3D Model\n`;
  obj += `# Structure: ${metadata?.id || 'PDB_Structure'}\n`;
  obj += `# Title: ${metadata?.title?.replace(/[\r\n]+/g, ' ') || 'Macromolecule'}\n`;
  obj += `# Generated by Protein Structure Viewer for Presentations & 3D Projects\n\n`;

  const hasColors = mesh.colors.length === mesh.positions.length;
  const hasNormals = mesh.normals.length === mesh.positions.length;

  // Vertex definitions
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i].toFixed(4);
    const y = mesh.positions[i + 1].toFixed(4);
    const z = mesh.positions[i + 2].toFixed(4);
    if (hasColors) {
      const r = mesh.colors[i].toFixed(4);
      const g = mesh.colors[i + 1].toFixed(4);
      const b = mesh.colors[i + 2].toFixed(4);
      obj += `v ${x} ${y} ${z} ${r} ${g} ${b}\n`;
    } else {
      obj += `v ${x} ${y} ${z}\n`;
    }
  }

  // Normals
  if (hasNormals) {
    obj += `\n# Normals\n`;
    for (let i = 0; i < mesh.normals.length; i += 3) {
      obj += `vn ${mesh.normals[i].toFixed(4)} ${mesh.normals[i + 1].toFixed(4)} ${mesh.normals[i + 2].toFixed(4)}\n`;
    }
  }

  // Faces
  obj += `\n# Faces\ns 1\n`;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const v1 = mesh.indices[i] + 1;
    const v2 = mesh.indices[i + 1] + 1;
    const v3 = mesh.indices[i + 2] + 1;
    if (hasNormals) {
      obj += `f ${v1}//${v1} ${v2}//${v2} ${v3}//${v3}\n`;
    } else {
      obj += `f ${v1} ${v2} ${v3}\n`;
    }
  }

  return obj;
}

/**
 * Converts mesh data to standard STL format (.stl).
 * Compatible with 3D printers, CAD software, and PowerPoint.
 */
export function meshToStl(mesh: MeshData, metadata?: PDBMetadata | null): string {
  const solidName = (metadata?.id || 'Protein_Structure').replace(/[^a-zA-Z0-9_]/g, '_');
  let stl = `solid ${solidName}\n`;

  for (let i = 0; i < mesh.indices.length; i += 3) {
    const i1 = mesh.indices[i] * 3;
    const i2 = mesh.indices[i + 1] * 3;
    const i3 = mesh.indices[i + 2] * 3;

    if (
      i1 < 0 || i1 + 2 >= mesh.positions.length ||
      i2 < 0 || i2 + 2 >= mesh.positions.length ||
      i3 < 0 || i3 + 2 >= mesh.positions.length
    ) {
      continue;
    }

    // Normal approximation
    const ax = mesh.positions[i2] - mesh.positions[i1];
    const ay = mesh.positions[i2 + 1] - mesh.positions[i1 + 1];
    const az = mesh.positions[i2 + 2] - mesh.positions[i1 + 2];

    const bx = mesh.positions[i3] - mesh.positions[i1];
    const by = mesh.positions[i3 + 1] - mesh.positions[i1 + 1];
    const bz = mesh.positions[i3 + 2] - mesh.positions[i1 + 2];

    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    stl += `  facet normal ${nx.toFixed(4)} ${ny.toFixed(4)} ${nz.toFixed(4)}\n`;
    stl += `    outer loop\n`;
    stl += `      vertex ${mesh.positions[i1].toFixed(4)} ${mesh.positions[i1 + 1].toFixed(4)} ${mesh.positions[i1 + 2].toFixed(4)}\n`;
    stl += `      vertex ${mesh.positions[i2].toFixed(4)} ${mesh.positions[i2 + 1].toFixed(4)} ${mesh.positions[i2 + 2].toFixed(4)}\n`;
    stl += `      vertex ${mesh.positions[i3].toFixed(4)} ${mesh.positions[i3 + 1].toFixed(4)} ${mesh.positions[i3 + 2].toFixed(4)}\n`;
    stl += `    endloop\n`;
    stl += `  endfacet\n`;
  }

  stl += `endsolid ${solidName}\n`;
  return stl;
}

/**
 * Converts mesh data to binary glTF 2.0 (.glb).
 * Native format for PowerPoint 365 3D Models, modern web, AR and Keynote.
 */
export function meshToGlb(mesh: MeshData): Uint8Array {
  const posArray = new Float32Array(mesh.positions);
  const indArray = new Uint32Array(mesh.indices);
  const hasColors = mesh.colors && mesh.colors.length === mesh.positions.length;
  const colArray = hasColors ? new Float32Array(mesh.colors) : null;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i];
    const y = mesh.positions[i + 1];
    const z = mesh.positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  if (!isFinite(minX)) {
    minX = minY = minZ = -1;
    maxX = maxY = maxZ = 1;
  }

  function pad4(byteLen: number) {
    const rem = byteLen % 4;
    return rem === 0 ? 0 : 4 - rem;
  }

  const posPad = pad4(posArray.byteLength);
  const indPad = pad4(indArray.byteLength);
  const colPad = colArray ? pad4(colArray.byteLength) : 0;

  const binByteLength =
    posArray.byteLength +
    posPad +
    indArray.byteLength +
    indPad +
    (colArray ? colArray.byteLength + colPad : 0);
  const binBuffer = new Uint8Array(binByteLength);

  let offset = 0;
  binBuffer.set(new Uint8Array(posArray.buffer, posArray.byteOffset, posArray.byteLength), offset);
  offset += posArray.byteLength + posPad;

  const indOffset = offset;
  binBuffer.set(new Uint8Array(indArray.buffer, indArray.byteOffset, indArray.byteLength), offset);
  offset += indArray.byteLength + indPad;

  let colOffset = 0;
  if (colArray) {
    colOffset = offset;
    binBuffer.set(new Uint8Array(colArray.buffer, colArray.byteOffset, colArray.byteLength), offset);
    offset += colArray.byteLength + colPad;
  }

  const attributes: Record<string, number> = { POSITION: 0 };
  const accessors: any[] = [
    {
      bufferView: 0,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count: mesh.positions.length / 3,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ]
    },
    {
      bufferView: 1,
      byteOffset: 0,
      componentType: 5125, // UNSIGNED_INT
      count: mesh.indices.length,
      type: 'SCALAR',
      min: [0],
      max: [mesh.positions.length / 3 - 1]
    }
  ];

  const bufferViews: any[] = [
    {
      buffer: 0,
      byteOffset: 0,
      byteLength: posArray.byteLength,
      target: 34962
    },
    {
      buffer: 0,
      byteOffset: indOffset,
      byteLength: indArray.byteLength,
      target: 34963
    }
  ];

  if (colArray) {
    attributes.COLOR_0 = 2;
    accessors.push({
      bufferView: 2,
      byteOffset: 0,
      componentType: 5126,
      count: mesh.colors.length / 3,
      type: 'VEC3'
    });
    bufferViews.push({
      buffer: 0,
      byteOffset: colOffset,
      byteLength: colArray.byteLength,
      target: 34962
    });
  }

  const gltf = {
    asset: { version: '2.0', generator: 'Protein Structure Viewer' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes,
            indices: 1,
            mode: 4
          }
        ]
      }
    ],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.byteLength }]
  };

  const jsonStr = JSON.stringify(gltf);
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonStr);
  const jsonPad = pad4(jsonBytes.byteLength);
  const jsonChunkLen = jsonBytes.byteLength + jsonPad;

  const totalLength = 12 + 8 + jsonChunkLen + 8 + binBuffer.byteLength;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);

  // GLB Header (12 bytes)
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true); // version 2
  view.setUint32(8, totalLength, true);

  // Chunk 0: JSON (8 bytes + payload)
  view.setUint32(12, jsonChunkLen, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  glb.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) {
    glb[20 + jsonBytes.byteLength + i] = 0x20; // space padding
  }

  // Chunk 1: BIN (8 bytes + payload)
  const binHeaderOffset = 20 + jsonChunkLen;
  view.setUint32(binHeaderOffset, binBuffer.byteLength, true);
  view.setUint32(binHeaderOffset + 4, 0x004e4942, true); // "BIN\0"
  glb.set(binBuffer, binHeaderOffset + 8);

  return glb;
}

/**
 * Generates a self-contained, standalone interactive 3D HTML presentation slide.
 * Presenters can open this file in any web browser, project in full-screen mode,
 * or embed it in web-based presentation decks (Notion, Google Sites, Marp, Reveal.js).
 */
export function generateInteractiveHtmlSlide(
  structure: PDBMetadata | null,
  coordinateData: string,
  format: string = 'pdb',
  currentStyle: string = 'cartoon',
  currentColorScheme: string = 'chain'
): string {
  const cleanId = structure?.id || 'Structure';
  const title = structure?.title || 'Macromolecular 3D Structure';
  const organism = structure?.organism || 'Biological Specimen';
  const method = structure?.experimentalMethod || (structure?.source === 'alphafold' ? 'AlphaFold AI Prediction' : 'X-ray Diffraction');
  const resolution = structure?.resolution ? `${structure.resolution} Å` : 'AI Model';

  // Escape coordinate data for safe script injection
  const escapedData = coordinateData.replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanId} — 3D Presentation Slide</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.4.2/3Dmol-min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      height: 54px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 10;
    }
    .badge-id {
      background: #3b82f6;
      color: white;
      font-weight: 700;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 13px;
      letter-spacing: 0.5px;
    }
    .title-text {
      font-size: 13px;
      color: #94a3b8;
      max-width: 50vw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .controls-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    button, select {
      background: rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      outline: none;
    }
    button:hover, select:hover {
      background: rgba(255, 255, 255, 0.16);
      border-color: rgba(255, 255, 255, 0.3);
    }
    button.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }
    #viewport {
      flex: 1;
      width: 100%;
      height: calc(100vh - 54px);
      position: relative;
      background: #0f172a;
    }
    .bottom-info {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 11px;
      color: #94a3b8;
      pointer-events: none;
      z-index: 5;
    }
    .bottom-info strong { color: #f8fafc; }
    #atom-tooltip {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-family: monospace;
      color: #38bdf8;
      display: none;
      z-index: 5;
    }
  </style>
</head>
<body>
  <header>
    <div style="display: flex; items-center; gap: 10px;">
      <span class="badge-id">${cleanId}</span>
      <span class="title-text" title="${title}">${title}</span>
    </div>
    <div class="controls-bar">
      <select id="style-select" onchange="updateStyle(this.value)">
        <option value="cartoon" ${currentStyle === 'cartoon' ? 'selected' : ''}>Cartoon</option>
        <option value="surface" ${currentStyle === 'surface' ? 'selected' : ''}>Surface</option>
        <option value="ball-and-stick" ${currentStyle === 'ball-and-stick' ? 'selected' : ''}>Ball & Stick</option>
        <option value="spacefill" ${currentStyle === 'spacefill' ? 'selected' : ''}>Spacefill</option>
      </select>
      <select id="color-select" onchange="updateColors(this.value)">
        <option value="chain" ${currentColorScheme === 'chain' ? 'selected' : ''}>Color: Chain</option>
        <option value="secondary" ${currentColorScheme === 'secondary' ? 'selected' : ''}>Color: Secondary</option>
        <option value="bfactor" ${currentColorScheme === 'bfactor' ? 'selected' : ''}>Color: B-factor / pLDDT</option>
        <option value="residue" ${currentColorScheme === 'residue' ? 'selected' : ''}>Color: Amino Acid</option>
      </select>
      <button id="spin-btn" onclick="toggleSpin()">Spin 🔄</button>
      <button onclick="resetCamera()">Reset View 🎯</button>
      <button onclick="toggleBg()">Theme 🌓</button>
      <button onclick="toggleFullscreen()" style="background: #2563eb; color: white;">Fullscreen ⛶</button>
    </div>
  </header>

  <div id="viewport">
    <div id="atom-tooltip"></div>
    <div class="bottom-info">
      <div><strong>Organism:</strong> ${organism} • <strong>Method:</strong> ${method} (${resolution})</div>
      <div style="margin-top: 2px;">Use Left Click to Rotate • Right Click to Pan • Scroll to Zoom • Press <strong>F</strong> for Fullscreen</div>
    </div>
  </div>

  <script id="structure-data" type="text/plain">${escapedData}</script>

  <script>
    let viewer = null;
    let isSpinning = true;
    let isDark = true;
    let currentStyle = "${currentStyle}";
    let currentColors = "${currentColorScheme}";

    window.addEventListener('DOMContentLoaded', () => {
      const container = document.getElementById('viewport');
      const data = document.getElementById('structure-data').textContent;
      const format = "${format}";

      viewer = $3Dmol.createViewer(container, { backgroundColor: '#0f172a' });
      viewer.addModel(data, format);
      applyCurrentRepresentation();
      viewer.zoomTo();
      viewer.render();
      viewer.spin('y', 0.8);

      const tooltip = document.getElementById('atom-tooltip');
      viewer.setHoverable({}, true, (atom) => {
        if (!atom) {
          tooltip.style.display = 'none';
          return;
        }
        tooltip.textContent = (atom.resn || '') + (atom.resi || '') + ' (Chain ' + (atom.chain || 'A') + ') • ' + (atom.atom || '');
        tooltip.style.display = 'block';
      });

      window.addEventListener('resize', () => {
        if (viewer) { viewer.resize(); viewer.render(); }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') toggleFullscreen();
        if (e.key === ' ') { e.preventDefault(); toggleSpin(); }
      });
    });

    function applyCurrentRepresentation() {
      if (!viewer) return;
      viewer.removeAllSurfaces();

      let colorSpec = { colorscheme: 'chain' };
      if (currentColors === 'secondary') colorSpec = { colorscheme: 'ssPyMOL' };
      else if (currentColors === 'bfactor') colorSpec = { colorscheme: { prop: 'b', gradient: 'roygb', min: 40, max: 100 } };
      else if (currentColors === 'residue') colorSpec = { colorscheme: 'amino' };

      const polymer = { hetflag: false };
      if (currentStyle === 'cartoon') {
        viewer.setStyle(polymer, { cartoon: colorSpec });
      } else if (currentStyle === 'surface') {
        viewer.setStyle(polymer, { cartoon: { opacity: 0.2, ...colorSpec } });
        viewer.addSurface($3Dmol.SurfaceType?.SAS || 1, { opacity: 0.88, ...colorSpec }, polymer);
      } else if (currentStyle === 'ball-and-stick') {
        viewer.setStyle(polymer, { stick: { radius: 0.16, ...colorSpec }, sphere: { scale: 0.24, ...colorSpec } });
      } else if (currentStyle === 'spacefill') {
        viewer.setStyle(polymer, { sphere: { scale: 0.95, ...colorSpec } });
      }

      viewer.setStyle({ hetflag: true }, {
        stick: { radius: 0.32, colorscheme: 'default' },
        sphere: { scale: 0.4, colorscheme: 'default' }
      });

      viewer.render();
    }

    function updateStyle(val) { currentStyle = val; applyCurrentRepresentation(); }
    function updateColors(val) { currentColors = val; applyCurrentRepresentation(); }

    function toggleSpin() {
      isSpinning = !isSpinning;
      const btn = document.getElementById('spin-btn');
      if (isSpinning) {
        viewer.spin('y', 0.8);
        btn.classList.add('active');
      } else {
        viewer.spin(false);
        btn.classList.remove('active');
      }
    }

    function resetCamera() {
      if (viewer) { viewer.zoomTo(); viewer.render(); }
    }

    function toggleBg() {
      isDark = !isDark;
      const bg = isDark ? '#0f172a' : '#ffffff';
      document.body.style.background = bg;
      viewer.setBackgroundColor(bg);
      viewer.render();
    }

    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Generates a PyMOL presentation and publication script (.pml).
 */
export function generatePymolScript(
  structure: PDBMetadata | null,
  currentStyle: string = 'cartoon',
  _currentColorScheme: string = 'chain'
): string {
  const cleanId = structure?.id || '6LU7';
  const isAf = structure?.source === 'alphafold';

  return `# ==========================================================
# PyMOL Presentation & Publication Script
# Protein: ${cleanId}
# Title: ${structure?.title || 'Structure'}
# ==========================================================

# 1. Fetch or load coordinates
${isAf && structure?.alphafoldMetrics?.modelUrlPdb ? `load ${structure.alphafoldMetrics.modelUrlPdb}, ${cleanId}` : `fetch ${cleanId}, type=pdb`}

# 2. Reset view and appearance
hide everything
bg_color white
set ray_opaque_background, 0

# 3. Representation
${currentStyle === 'surface' ? `show surface, polymer\nset transparency, 0.15\nshow cartoon, polymer` : `show cartoon, polymer`}
${currentStyle === 'ball-and-stick' ? `show sticks, polymer\nshow spheres, polymer\nset sphere_scale, 0.25` : ''}
${currentStyle === 'spacefill' ? `show spheres, polymer` : ''}

# 4. Color scheme
util.color_chains("polymer and elem c")
show sticks, organic
util.cbaw organic

# 5. Presentation Lighting & Raytracing settings
set ray_shadows, 1
set ray_trace_mode, 1
set antialias, 2
set depth_cue, 1
set cartoon_highlight_color, grey90
set cartoon_fancy_helices, 1
set cartoon_smooth_loops, 1

# 6. Center & zoom
orient
zoom complete=1

# 7. Render publication slide image
ray 2400, 1800
png ${cleanId}_presentation_raytrace.png, dpi=300
print("Render complete: ${cleanId}_presentation_raytrace.png")
`;
}

/**
 * Generates a UCSF ChimeraX presentation script (.cxc).
 */
export function generateChimeraxScript(
  structure: PDBMetadata | null,
  currentStyle: string = 'cartoon',
  _currentColorScheme: string = 'chain'
): string {
  const cleanId = structure?.id || '6LU7';

  return `# ==========================================================
# UCSF ChimeraX Presentation Script
# Protein: ${cleanId}
# ==========================================================

open ${cleanId}
hide atoms
${currentStyle === 'surface' ? 'surface #1' : 'cartoon #1'}
color bychain
show ligands
style stick
lighting soft
graphics transparentBackground true
view
save ${cleanId}_chimerax_slide.png transparentBackground true width 2400 height 1800
`;
}

/**
 * Helper to download a text file in browser.
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Helper to download a binary or text Blob in browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copies a PNG data URI to the user's system clipboard for instant paste into Google Docs / Slides.
 */
export async function copyImageToClipboard(dataUri: string): Promise<boolean> {
  if (!dataUri) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof ClipboardItem !== 'undefined') {
      const res = await fetch(dataUri);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Clipboard write failed (fallback to download):', err);
    return false;
  }
}

/**
 * Copies text to clipboard with an iframe-safe fallback using a temporary textarea.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for sandboxed iframes
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    console.warn('Fallback text copy failed:', err);
    return false;
  }
}
