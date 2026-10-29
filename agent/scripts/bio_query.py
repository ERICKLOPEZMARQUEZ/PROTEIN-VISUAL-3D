"""
Bioinformatics connector for querying RCSB PDB and AlphaFold within the remote Linux container.
"""

import json
import urllib.request
import urllib.parse
import sys

def fetch_pdb_entry(pdb_id: str):
    url = "https://data.rcsb.org/graphql"
    query = """
    query GetEntry($id: String!) {
      entry(entry_id: $id) {
        rcsb_id
        struct { title }
        exptl { method resolution }
        rcsb_entry_info { resolution_combined polymer_entity_count_protein molecular_weight }
        audit_author { name }
      }
    }
    """
    req = urllib.request.Request(
        url,
        data=json.dumps({"query": query, "variables": {"id": pdb_id.upper()}}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        return data.get("data", {}).get("entry", {})

def fetch_alphafold_entry(uniprot_id: str):
    url = f"https://alphafold.ebi.ac.uk/api/prediction/{uniprot_id.strip().upper()}"
    req = urllib.request.Request(url, headers={"User-Agent": "AntigravityAgent/1.0"})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "6LU7"
    if len(target) == 4 and target.isalnum():
        entry = fetch_pdb_entry(target)
        print(json.dumps(entry, indent=2))
    else:
        entry = fetch_alphafold_entry(target)
        print(json.dumps(entry, indent=2))
