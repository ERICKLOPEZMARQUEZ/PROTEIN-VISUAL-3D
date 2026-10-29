import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import util from 'util';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { fetchPdbMetadata, searchRcsb, CURATED_STRUCTURES } from './server/pdbService';
import { fetchAlphaFoldMetadata, CURATED_ALPHAFOLD } from './server/alphafoldService';
import { handleAgentStream } from './server/agent';

dotenv.config();

const execFileAsync = util.promisify(execFile);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.raw({ type: ['video/*', 'application/octet-stream', 'application/binary'], limit: '100mb' }));

  // Enable CORS for iframe and cross-origin preview requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // API Routes FIRST

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Curated benchmark structures
  app.get('/api/curated', (req, res) => {
    const curated = [
      ...Object.values(CURATED_STRUCTURES),
      ...Object.values(CURATED_ALPHAFOLD)
    ];
    res.json(curated);
  });

  // Get structure metadata (PDB or AlphaFold)
  app.get('/api/structure/:id', async (req, res) => {
    const { id } = req.params;
    try {
      if (id.startsWith('AF-') || id.length === 6 && /^[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]/i.test(id)) {
        const cleanId = id.replace(/^AF-/, '').replace(/-F1$/, '');
        const meta = await fetchAlphaFoldMetadata(cleanId);
        if (meta) return res.json(meta);
      }

      const meta = await fetchPdbMetadata(id);
      if (meta) return res.json(meta);

      // Fallback check AlphaFold
      const afMeta = await fetchAlphaFoldMetadata(id);
      if (afMeta) return res.json(afMeta);

      return res.status(404).json({ error: `Structure ${id} not found.` });
    } catch (e: any) {
      console.error(`Error fetching structure ${id}:`, e);
      res.status(500).json({ error: e.message || 'Failed to fetch structure.' });
    }
  });

  // Get AlphaFold metadata directly
  app.get('/api/alphafold/:uniprotId', async (req, res) => {
    const { uniprotId } = req.params;
    try {
      const meta = await fetchAlphaFoldMetadata(uniprotId);
      if (!meta) return res.status(404).json({ error: `UniProt entry ${uniprotId} not found in AlphaFold DB.` });
      res.json(meta);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'AlphaFold fetch failed.' });
    }
  });

  // Search RCSB PDB
  app.get('/api/search', async (req, res) => {
    const q = (req.query.q as string) || '';
    const limit = parseInt((req.query.limit as string) || '8', 10);
    try {
      const results = await searchRcsb(q, limit);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Search failed.' });
    }
  });

  // Proxy 3D Structure File (PDB / mmCIF) with CORS & caching
  app.get('/api/pdb-proxy/:id', async (req, res) => {
    const { id } = req.params;
    const format = (req.query.format as string) || 'pdb';
    const cleanId = id.replace(/\.(pdb|cif|mmcif)$/i, '').toUpperCase();

    // Check if it's an AlphaFold ID or accession
    if (cleanId.startsWith('AF-') || CURATED_ALPHAFOLD[cleanId] || /^[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/i.test(cleanId)) {
      const afAcc = cleanId.replace(/^AF-/, '').replace(/-F1$/, '');
      const versions = ['v4', 'v6', 'v3'];
      for (const v of versions) {
        const url = `https://alphafold.ebi.ac.uk/files/AF-${afAcc}-F1-model_${v}.${format === 'cif' ? 'cif' : 'pdb'}`;
        try {
          const remoteRes = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProteinStructureViewer/1.0)' }
          });
          if (remoteRes.ok) {
            const text = await remoteRes.text();
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(text);
          }
        } catch (err) {
          // Try next version
        }
      }
    }

    // Default RCSB PDB or mmCIF coordinate proxy
    try {
      const ext = format === 'cif' ? 'cif' : 'pdb';
      const url = `https://files.rcsb.org/download/${cleanId}.${ext}`;
      const remoteRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProteinStructureViewer/1.0)' }
      });
      if (remoteRes.ok) {
        const text = await remoteRes.text();
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(text);
      } else {
        // Try alternate format if primary failed
        const altExt = format === 'cif' ? 'pdb' : 'cif';
        const altUrl = `https://files.rcsb.org/download/${cleanId}.${altExt}`;
        const altRes = await fetch(altUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProteinStructureViewer/1.0)' }
        });
        if (altRes.ok) {
          const altText = await altRes.text();
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(altText);
        }
      }
    } catch (e: any) {
      console.warn(`PDB coordinate proxy failed for ${cleanId}:`, e);
    }

    res.status(404).send('Coordinate file not available.');
  });

  // Compare mode data endpoint
  app.get('/api/compare', async (req, res) => {
    const rawA = Array.isArray(req.query.idA) ? req.query.idA[0] : req.query.idA;
    const rawB = Array.isArray(req.query.idB) ? req.query.idB[0] : req.query.idB;
    const idA = (typeof rawA === 'string' && rawA.trim() ? rawA.trim() : '6LU7').toUpperCase();
    const idB = (typeof rawB === 'string' && rawB.trim() ? rawB.trim() : '1CRN').toUpperCase();

    const fetchMetaSafe = async (id: string) => {
      try {
        const pdb = await fetchPdbMetadata(id);
        if (pdb) return pdb;
      } catch (_) {}
      try {
        const af = await fetchAlphaFoldMetadata(id);
        if (af) return af;
      } catch (_) {}
      if (CURATED_STRUCTURES[id]) return CURATED_STRUCTURES[id];
      if (CURATED_ALPHAFOLD[id]) return CURATED_ALPHAFOLD[id];
      return null;
    };

    try {
      const [metaA, metaB] = await Promise.all([
        fetchMetaSafe(idA),
        fetchMetaSafe(idB)
      ]);

      res.json({
        structureA: metaA || CURATED_STRUCTURES[idA] || null,
        structureB: metaB || CURATED_STRUCTURES[idB] || null,
        idA,
        idB
      });
    } catch (e: any) {
      console.warn('Compare endpoint fallback response:', e?.message);
      res.json({
        structureA: CURATED_STRUCTURES[idA] || null,
        structureB: CURATED_STRUCTURES[idB] || null,
        idA,
        idB
      });
    }
  });

  // Direct Managed Agent SSE Analyze Endpoint
  app.post('/api/analyze', async (req, res) => {
    const { question, query, environmentId, structureId, history } = req.body;
    await handleAgentStream(question || query || 'Explain structure', structureId, history || [], res, environmentId);
  });

  // SSE Managed Structural Biology Agent Endpoint
  app.post('/api/agent/stream', async (req, res) => {
    const { query, question, structureId, history, environmentId } = req.body;
    await handleAgentStream(query || question || 'Explain structure', structureId, history || [], res, environmentId);
  });

  // Convert recorded video to universal H.264 MP4 (Smooth 10s rotation export)
  app.post('/api/video/convert-mp4', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
    const structureId = (req.query.id as string) || 'protein';
    const cleanId = structureId.replace(/[^a-zA-Z0-9_-]/g, '') || 'structure';

    const isBuffer = Buffer.isBuffer(req.body);
    if (!req.body || (isBuffer && req.body.length === 0) || (!isBuffer && typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
      return res.status(400).json({ error: 'No video payload received for MP4 conversion.' });
    }

    const tempId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tempInput = path.join(os.tmpdir(), `input_${tempId}.webm`);
    const tempOutput = path.join(os.tmpdir(), `output_${tempId}.mp4`);

    try {
      const videoBuffer = isBuffer
        ? req.body
        : req.body instanceof Uint8Array
        ? Buffer.from(req.body)
        : typeof req.body === 'string'
        ? Buffer.from(req.body, 'binary')
        : null;

      if (!videoBuffer || videoBuffer.length === 0) {
        return res.status(400).json({ error: 'Invalid video buffer received for MP4 conversion.' });
      }

      await fs.promises.writeFile(tempInput, videoBuffer);

      // Transcode video to high-quality universal H.264 MP4 with even dimensions, yuv420p, and faststart
      await execFileAsync('ffmpeg', [
        '-y',
        '-i', tempInput,
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        tempOutput
      ]);

      const mp4Data = await fs.promises.readFile(tempOutput);

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanId}_10s_smooth_rotation.mp4"`);
      res.setHeader('Content-Length', mp4Data.length);
      res.send(mp4Data);
    } catch (err: any) {
      console.error('Error converting video to MP4 via ffmpeg:', err);
      res.status(500).json({ error: 'Video conversion failed: ' + (err.message || String(err)) });
    } finally {
      try {
        if (fs.existsSync(tempInput)) await fs.promises.unlink(tempInput);
      } catch (_) {}
      try {
        if (fs.existsSync(tempOutput)) await fs.promises.unlink(tempOutput);
      } catch (_) {}
    }
  });

  // Vite Middleware for Development / Static serving for Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PDB Viewer server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
