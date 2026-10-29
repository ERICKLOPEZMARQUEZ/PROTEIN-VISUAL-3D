import { PDBMetadata } from '../types';

export const CLIENT_CURATED_STRUCTURES: Record<string, PDBMetadata> = {
  '6LU7': {
    id: '6LU7',
    title: 'The crystal structure of COVID-19 main protease in complex with an inhibitor N3',
    source: 'rcsb',
    experimentalMethod: 'X-ray Diffraction',
    resolution: 2.16,
    depositionDate: '2020-01-26',
    releaseDate: '2020-02-05',
    organism: {
      scientificName: 'Severe acute respiratory syndrome coronavirus 2',
      commonName: 'SARS-CoV-2',
      taxId: 2697049
    },
    chains: [
      {
        chainId: 'A',
        name: '3C-like proteinase (Main Protease Mpro)',
        sequenceLength: 306,
        polymerType: 'Polypeptide(L)',
        mw: 33796.8
      }
    ],
    ligands: [
      {
        id: 'N3',
        name: 'N-[(5-METHYLISOXAZOL-3-YL)CARBONYL]ALANYL-L-VALYL-N~1~-((1R,2Z)-4-(BENZYLOXY)-4-OXO-1-{[(3R)-2-OXOPYRROLIDIN-3-YL]METHYL}BUT-2-ENYL)-L-LEUCINAMIDE',
        formula: 'C38 H47 N5 O8',
        mw: 701.81,
        instanceCount: 1,
        chemType: 'Peptide-like covalent inhibitor',
        smiles: 'CC(C)CC(NC(=O)C(C)NC(=O)c1cc(C)no1)C(=O)NC(CC2CCNC2=O)C=CC(=O)OCc3ccccc3',
        imageUrl: 'https://cdn.rcsb.org/images/ccd/labeled/N/N3.svg',
        bindingResidues: ['His41', 'Met49', 'Phe140', 'Leu141', 'Asn142', 'Gly143', 'Ser144', 'Cys145', 'His163', 'Met165', 'Glu166', 'Gln189']
      },
      {
        id: 'DMS',
        name: 'DIMETHYL SULFOXIDE',
        formula: 'C2 H6 O S',
        mw: 78.13,
        instanceCount: 3,
        chemType: 'Solvent molecule'
      }
    ],
    validation: {
      rWork: 0.202,
      rFree: 0.235,
      clashscore: 4.8,
      ramachandranFavored: 97.4,
      ramachandranOutliers: 0.3
    },
    citation: {
      title: 'Structure of Mpro from COVID-19 virus and discovery of its inhibitors',
      journal: 'Nature',
      year: 2020,
      doi: '10.1038/s41586-020-2223-y',
      authors: ['Jin, Z.', 'Du, X.', 'Xu, Y.', 'Deng, Y.', 'Liu, M.', 'Shao, R.', 'Ma, B.', 'Gao, Z.', 'Yang, H.', 'Rao, Z.']
    },
    secondaryStructure: {
      helixPct: 24,
      sheetPct: 32,
      loopPct: 44
    },
    keywords: ['VIRAL PROTEIN', 'SARS-COV-2', 'MAIN PROTEASE', 'MPRO', '3CLPRO', 'COVALENT INHIBITOR', 'N3'],
    classification: 'VIRAL PROTEIN',
    summary: 'The main protease (Mpro / 3CLpro) of SARS-CoV-2 is an essential homodimeric cysteine protease that cleaves viral polyproteins. In this crystal structure at 2.16 Å, it is covalently bound to the peptidomimetic inhibitor N3 at catalytic Cys145, locking the enzyme in an inactive state.'
  },
  '1CRN': {
    id: '1CRN',
    title: 'Water structure of a hydrophobic protein at atomic resolution: pentagonal rings of water molecules in crystals of crambin at 120 K and 0.54 Å',
    source: 'rcsb',
    experimentalMethod: 'X-ray Diffraction',
    resolution: 0.54,
    depositionDate: '1981-04-30',
    releaseDate: '1981-10-20',
    organism: {
      scientificName: 'Crambe hispanica subsp. abyssinica',
      commonName: 'Abyssinian kale',
      taxId: 3721
    },
    chains: [
      {
        chainId: 'A',
        name: 'Crambin seed storage protein',
        sequenceLength: 46,
        polymerType: 'Polypeptide(L)',
        mw: 4719.5
      }
    ],
    ligands: [
      {
        id: 'ETH',
        name: 'ETHANOL',
        formula: 'C2 H6 O',
        mw: 46.07,
        instanceCount: 2,
        chemType: 'Crystallization additive'
      }
    ],
    validation: {
      rWork: 0.089,
      rFree: 0.105,
      clashscore: 1.2,
      ramachandranFavored: 99.1,
      ramachandranOutliers: 0.0
    },
    citation: {
      title: 'Water structure of a hydrophobic protein at atomic resolution: pentagonal rings of water molecules in crystals of crambin at 120 K',
      journal: 'Proc. Natl. Acad. Sci. U.S.A.',
      year: 1984,
      doi: '10.1073/pnas.81.19.6014',
      authors: ['Teeter, M.M.']
    },
    secondaryStructure: {
      helixPct: 41,
      sheetPct: 15,
      loopPct: 44
    },
    keywords: ['PLANT PROTEIN', 'ULTRA-HIGH RESOLUTION', 'CRAMBIN', 'HYDROPHOBIC CORE', 'ATOMIC RESOLUTION', '0.54 ANGSTROM'],
    classification: 'PLANT SEED PROTEIN',
    summary: 'Crambin from Crambe abyssinica is one of the highest-resolution protein crystal structures in the PDB (0.54 Å). The atomic resolution allows direct observation of individual hydrogen atoms and an exquisite network of pentagonal hydration clusters across the hydrophobic surface.'
  },
  '4HHB': {
    id: '4HHB',
    title: 'The crystal structure of human deoxyhaemoglobin at 1.74 Å resolution',
    source: 'rcsb',
    experimentalMethod: 'X-ray Diffraction',
    resolution: 1.74,
    depositionDate: '1984-03-07',
    releaseDate: '1984-07-17',
    organism: {
      scientificName: 'Homo sapiens',
      commonName: 'Human',
      taxId: 9606
    },
    chains: [
      { chainId: 'A', name: 'Hemoglobin subunit alpha', sequenceLength: 141, polymerType: 'Polypeptide(L)', mw: 15126.4 },
      { chainId: 'B', name: 'Hemoglobin subunit beta', sequenceLength: 146, polymerType: 'Polypeptide(L)', mw: 15867.2 },
      { chainId: 'C', name: 'Hemoglobin subunit alpha (Chain C)', sequenceLength: 141, polymerType: 'Polypeptide(L)', mw: 15126.4 },
      { chainId: 'D', name: 'Hemoglobin subunit beta (Chain D)', sequenceLength: 146, polymerType: 'Polypeptide(L)', mw: 15867.2 }
    ],
    ligands: [
      {
        id: 'HEM',
        name: 'PROTOPORPHYRIN IX CONTAINING FE',
        formula: 'C34 H32 Fe N4 O4',
        mw: 616.49,
        instanceCount: 4,
        chemType: 'Porphyrin prosthetic group',
        bindingResidues: ['His58 (alpha)', 'His87 (alpha)', 'His63 (beta)', 'His92 (beta)', 'Val62', 'Phe43']
      }
    ],
    validation: {
      rWork: 0.158,
      rFree: 0.185,
      clashscore: 2.1,
      ramachandranFavored: 98.6
    },
    citation: {
      title: 'The crystal structure of human deoxyhaemoglobin at 1.74 Å resolution',
      journal: 'J. Mol. Biol.',
      year: 1984,
      doi: '10.1016/0022-2836(84)90248-2',
      authors: ['Fermi, G.', 'Perutz, M.F.', 'Shaanan, B.', 'Fourme, R.']
    },
    secondaryStructure: {
      helixPct: 76,
      sheetPct: 0,
      loopPct: 24
    },
    keywords: ['OXYGEN STORAGE', 'HEMOGLOBIN', 'ALLOSTERY', 'T-STATE', 'DEOXYHEMOGLOBIN'],
    classification: 'OXYGEN TRANSPORT',
    summary: 'The classic T-state (tense) deoxy conformation of human hemoglobin tetramer (alpha2-beta2) solved at 1.74 Å by Max Perutz and colleagues. It exhibits low oxygen affinity with salt bridges constraining the quaternary interface.'
  },
  'P04637': {
    id: 'AF-P04637-F1',
    uniprotId: 'P04637',
    title: 'Cellular tumor antigen p53 (Human TP53)',
    source: 'alphafold',
    experimentalMethod: 'AlphaFold v4 Structure Prediction',
    depositionDate: '2022-11-01',
    organism: {
      scientificName: 'Homo sapiens',
      commonName: 'Human',
      taxId: 9606
    },
    chains: [
      {
        chainId: 'A',
        name: 'Cellular tumor antigen p53',
        sequenceLength: 393,
        polymerType: 'Polypeptide(L)',
        mw: 43653
      }
    ],
    ligands: [],
    alphafoldMetrics: {
      uniprotAccession: 'P04637',
      plddtMean: 58.4,
      veryHighPct: 42.1,
      confidentPct: 14.2,
      lowPct: 15.6,
      veryLowPct: 28.1,
      modelUrlCif: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.cif',
      modelUrlPdb: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.pdb',
      paeImageUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-predicted_aligned_error_v4.png',
      sequenceLength: 393,
      gene: 'TP53',
      organismScientificName: 'Homo sapiens'
    },
    secondaryStructure: {
      helixPct: 18,
      sheetPct: 28,
      loopPct: 54
    },
    keywords: ['TUMOR SUPPRESSOR', 'TP53', 'DNA BINDING DOMAIN', 'INTRINSICALLY DISORDERED', 'ALPHAFOLD DB'],
    classification: 'TRANSCRIPTION FACTOR',
    summary: 'Full-length human p53 predicted by AlphaFold. Accurately predicts the folded beta-sandwich DNA-binding domain (pLDDT > 90) and tetramerization helix, while capturing the intrinsically disordered N-terminal transactivation domain (TAD) and C-terminal regulatory domain in low-confidence ribbon conformations (pLDDT < 50).'
  }
};
