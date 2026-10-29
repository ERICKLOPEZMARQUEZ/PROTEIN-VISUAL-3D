export interface ContactAtomPair {
  proteinAtom: string;
  ligandAtom: string;
  distance: number;
  type: 'hbond' | 'saltbridge' | 'hydrophobic' | 'aromatic' | 'vdw';
}

export interface LigandContactResidue {
  chainId: string;
  resNum: number;
  resName: string;
  singleLetter: string;
  minDistance: number;
  interactionTypes: ('hbond' | 'saltbridge' | 'hydrophobic' | 'aromatic' | 'vdw')[];
  contactCount: number;
  closestLigandAtom: string;
  closestProteinAtom: string;
  ligandAtomCoords: { x: number; y: number; z: number };
  proteinAtomCoords: { x: number; y: number; z: number };
  atomPairs: ContactAtomPair[];
}

export interface ParsedAtom {
  atom: string;
  resn: string;
  resi: number;
  chain: string;
  x: number;
  y: number;
  z: number;
  elem: string;
  hetflag: boolean;
}

export const AA_3TO1: Record<string, string> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
  GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
  SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  SEC: 'U', PYL: 'O'
};

export const AA_PROPERTIES: Record<string, { type: string; color: string; bg: string }> = {
  ARG: { type: 'Basic (+)', color: '#2563EB', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  LYS: { type: 'Basic (+)', color: '#2563EB', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  HIS: { type: 'Aromatic / Basic', color: '#4F46E5', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ASP: { type: 'Acidic (-)', color: '#DC2626', bg: 'bg-red-50 text-red-700 border-red-200' },
  GLU: { type: 'Acidic (-)', color: '#DC2626', bg: 'bg-red-50 text-red-700 border-red-200' },
  SER: { type: 'Polar Neutral', color: '#0891B2', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  THR: { type: 'Polar Neutral', color: '#0891B2', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  ASN: { type: 'Polar Neutral', color: '#0891B2', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  GLN: { type: 'Polar Neutral', color: '#0891B2', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  CYS: { type: 'Reactive Thiol', color: '#059669', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  GLY: { type: 'Conformational', color: '#475569', bg: 'bg-slate-50 text-slate-700 border-slate-200' },
  PRO: { type: 'Rigid Cyclic', color: '#475569', bg: 'bg-slate-50 text-slate-700 border-slate-200' },
  ALA: { type: 'Hydrophobic', color: '#D97706', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  VAL: { type: 'Hydrophobic', color: '#D97706', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  ILE: { type: 'Hydrophobic', color: '#D97706', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  LEU: { type: 'Hydrophobic', color: '#D97706', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  MET: { type: 'Hydrophobic', color: '#D97706', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  PHE: { type: 'Aromatic', color: '#7C3AED', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  TYR: { type: 'Aromatic Polar', color: '#7C3AED', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  TRP: { type: 'Aromatic', color: '#7C3AED', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const SOLVENT_RESIDUES = new Set(['HOH', 'WAT', 'DOD', 'TIP', 'SOL']);

/**
 * Extracts and normalizes atom coordinates from 3Dmol viewer or PDB/CIF coordinate string.
 */
export function parsePdbOrCifAtoms(coordinateData: string, glViewer?: any): ParsedAtom[] {
  if (glViewer && typeof glViewer.selectedAtoms === 'function') {
    try {
      const atoms = glViewer.selectedAtoms({});
      if (atoms && atoms.length > 0) {
        return atoms.map((a: any) => ({
          atom: a.atom || 'CA',
          resn: (a.resn || '').toUpperCase(),
          resi: typeof a.resi === 'number' ? a.resi : parseInt(a.resi, 10) || 0,
          chain: a.chain || 'A',
          x: a.x || 0,
          y: a.y || 0,
          z: a.z || 0,
          elem: (a.elem || a.atom?.[0] || 'C').toUpperCase(),
          hetflag: Boolean(a.hetflag)
        }));
      }
    } catch (e) {
      console.warn('3Dmol atom extraction fallback to text:', e);
    }
  }

  if (!coordinateData) return [];
  const results: ParsedAtom[] = [];
  const lines = coordinateData.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
      const isHet = line.startsWith('HETATM');
      const atom = line.substring(12, 16).trim();
      const resn = line.substring(17, 20).trim().toUpperCase();
      const chain = line.substring(21, 22).trim() || 'A';
      const resi = parseInt(line.substring(22, 26).trim(), 10) || 0;
      const x = parseFloat(line.substring(30, 38).trim());
      const y = parseFloat(line.substring(38, 46).trim());
      const z = parseFloat(line.substring(46, 54).trim());
      let elem = line.length >= 78 ? line.substring(76, 78).trim().toUpperCase() : '';
      if (!elem) {
        elem = atom.replace(/[^A-Za-z]/g, '').substring(0, 1).toUpperCase();
      }

      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        results.push({ atom, resn, resi, chain, x, y, z, elem, hetflag: isHet });
      }
    }
  }

  return results;
}

/**
 * Calculates contacting amino acid residues and classifies interaction types.
 */
export function calculateLigandContacts(
  parsedAtoms: ParsedAtom[],
  activeLigandId: string,
  cutoffDistance: number = 4.5
): LigandContactResidue[] {
  if (!activeLigandId || parsedAtoms.length === 0) return [];

  const normLigId = activeLigandId.toUpperCase();

  const ligandAtoms = parsedAtoms.filter(
    (a) => a.resn === normLigId && !SOLVENT_RESIDUES.has(a.resn)
  );

  if (ligandAtoms.length === 0) return [];

  const proteinAtoms = parsedAtoms.filter(
    (a) => !a.hetflag && !SOLVENT_RESIDUES.has(a.resn) && a.resn !== normLigId
  );

  const residueMap = new Map<string, ParsedAtom[]>();
  for (const pAtom of proteinAtoms) {
    const key = `${pAtom.chain}_${pAtom.resi}_${pAtom.resn}`;
    if (!residueMap.has(key)) {
      residueMap.set(key, []);
    }
    residueMap.get(key)!.push(pAtom);
  }

  const results: LigandContactResidue[] = [];

  residueMap.forEach((resAtoms) => {
    const first = resAtoms[0];
    const resName = first.resn;
    const resNum = first.resi;
    const chainId = first.chain;
    const singleLetter = AA_3TO1[resName] || 'X';

    let minDistance = Infinity;
    let closestLAtom = '';
    let closestPAtom = '';
    let bestLCoords = { x: 0, y: 0, z: 0 };
    let bestPCoords = { x: 0, y: 0, z: 0 };
    const pairs: ContactAtomPair[] = [];
    const interactionTypesSet = new Set<'hbond' | 'saltbridge' | 'hydrophobic' | 'aromatic' | 'vdw'>();

    for (const pAtom of resAtoms) {
      for (const lAtom of ligandAtoms) {
        const dx = pAtom.x - lAtom.x;
        const dy = pAtom.y - lAtom.y;
        const dz = pAtom.z - lAtom.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < minDistance) {
          minDistance = dist;
          closestLAtom = lAtom.atom;
          closestPAtom = pAtom.atom;
          bestLCoords = { x: lAtom.x, y: lAtom.y, z: lAtom.z };
          bestPCoords = { x: pAtom.x, y: pAtom.y, z: pAtom.z };
        }

        if (dist <= cutoffDistance) {
          const isPElec = pAtom.elem === 'O' || pAtom.elem === 'N';
          const isLElec = lAtom.elem === 'O' || lAtom.elem === 'N';

          let type: 'hbond' | 'saltbridge' | 'hydrophobic' | 'aromatic' | 'vdw' = 'vdw';

          if (isPElec && isLElec && dist <= 3.5) {
            type = 'hbond';
            interactionTypesSet.add('hbond');
          } else if (
            ((['ARG', 'LYS', 'HIS'].includes(resName) && lAtom.elem === 'O') ||
              (['ASP', 'GLU'].includes(resName) && lAtom.elem === 'N')) &&
            dist <= 4.0
          ) {
            type = 'saltbridge';
            interactionTypesSet.add('saltbridge');
          } else if (['PHE', 'TYR', 'TRP', 'HIS'].includes(resName) && dist <= 4.8) {
            type = 'aromatic';
            interactionTypesSet.add('aromatic');
          } else if (
            pAtom.elem === 'C' &&
            lAtom.elem === 'C' &&
            ['ALA', 'VAL', 'LEU', 'ILE', 'MET', 'PRO', 'PHE', 'TRP'].includes(resName) &&
            dist <= 4.5
          ) {
            type = 'hydrophobic';
            interactionTypesSet.add('hydrophobic');
          } else {
            type = 'vdw';
            interactionTypesSet.add('vdw');
          }

          pairs.push({
            proteinAtom: pAtom.atom,
            ligandAtom: lAtom.atom,
            distance: dist,
            type
          });
        }
      }
    }

    if (minDistance <= cutoffDistance && pairs.length > 0) {
      results.push({
        chainId,
        resNum,
        resName,
        singleLetter,
        minDistance,
        interactionTypes: Array.from(interactionTypesSet),
        contactCount: pairs.length,
        closestLigandAtom: closestLAtom,
        closestProteinAtom: closestPAtom,
        ligandAtomCoords: bestLCoords,
        proteinAtomCoords: bestPCoords,
        atomPairs: pairs.sort((a, b) => a.distance - b.distance)
      });
    }
  });

  return results.sort((a, b) => a.minDistance - b.minDistance);
}

/**
 * Prepares prompt for the AI Agent detailing contact residues
 */
export function formatContactMapAgentPrompt(
  structureId: string,
  ligandId: string,
  contacts: LigandContactResidue[],
  cutoff: number
): string {
  const topList = contacts
    .slice(0, 12)
    .map(
      (c) =>
        `${c.resName}${c.resNum} (Chain ${c.chainId}, ${c.minDistance.toFixed(2)}Å, [${c.interactionTypes.join(', ')}])`
    )
    .join(', ');

  return `Identify and analyze the key interacting amino acids between ligand ${ligandId} and protein ${structureId}.
Based on contact map distance analysis (<${cutoff}Å), the primary contacting residues are: ${topList}.
Please explain:
1. The primary anchor and catalytic residues in this binding pocket.
2. The key hydrogen bond donors/acceptors and hydrophobic pocket interactions.
3. How this residue interaction profile explains binding affinity, inhibition, or target selectivity.`;
}
