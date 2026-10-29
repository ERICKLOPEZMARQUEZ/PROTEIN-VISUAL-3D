"""
PDB API Connector for querying RCSB Protein Data Bank
Supports GraphQL queries (https://data.rcsb.org/graphql)
and RCSB Search API v2 (https://search.rcsb.org/rcsbsearch/v2/query)
"""

import json
import requests
from typing import Dict, Any, List, Optional

RCSB_DATA_API = "https://data.rcsb.org/graphql"
RCSB_REST_API = "https://data.rcsb.org/rest/v1/core/entry"
RCSB_SEARCH_API = "https://search.rcsb.org/rcsbsearch/v2/query"
RCSB_DOWNLOAD_BASE = "https://files.rcsb.org/download"

def get_structure_graphql(pdb_id: str) -> Dict[str, Any]:
    """Fetch rich structural metadata via RCSB GraphQL."""
    query = """
    query StructureQuery($id: String!) {
      entry(entry_id: $id) {
        rcsb_id
        struct {
          title
        }
        exptl {
          method
          resolution
        }
        rcsb_entry_info {
          resolution_combined
          deposited_polymer_entity_instance_count
          deposited_nonpolymer_entity_instance_count
          polymer_entity_count_protein
          molecular_weight
          polymer_entity_count_dna
          polymer_entity_count_rna
        }
        rcsb_accession_info {
          deposit_date
          initial_release_date
        }
        audit_author {
          name
        }
        rcsb_primary_citation {
          title
          journal_abbrev
          year
          pdbx_database_id_doi
        }
        polymer_entities {
          rcsb_id
          rcsb_polymer_entity {
            pdbx_description
            formula_weight
          }
          entity_poly {
            rcsb_entity_polymer_type
            pdbx_seq_one_letter_code_can
          }
          rcsb_entity_source_organism {
            ncbi_scientific_name
            ncbi_common_name
          }
        }
        nonpolymer_entities {
          rcsb_nonpolymer_entity {
            formula_weight
            pdbx_description
          }
          nonpolymer_comp {
            chem_comp {
              id
              name
              formula
              type
            }
          }
        }
      }
    }
    """
    resp = requests.post(
        RCSB_DATA_API,
        json={"query": query, "variables": {"id": pdb_id.upper()}},
        timeout=10
    )
    resp.raise_for_status()
    return resp.json().get("data", {}).get("entry", {})

def search_rcsb(query_text: str, rows: int = 10) -> List[Dict[str, Any]]:
    """Search RCSB PDB using full-text search API v2."""
    search_payload = {
        "query": {
            "type": "terminal",
            "service": "full_text",
            "parameters": {
                "value": query_text
            }
        },
        "return_type": "entry",
        "request_options": {
            "paginate": {
                "start": 0,
                "rows": rows
            },
            "scoring_strategy": "combined"
        }
    }
    resp = requests.post(RCSB_SEARCH_API, json=search_payload, timeout=10)
    if resp.status_code != 200:
        return []
    data = resp.json()
    result_set = data.get("result_set", [])
    return [{"identifier": item.get("identifier"), "score": item.get("score")} for item in result_set]

class PDBConnector:
    """Connector class for RCSB PDB services."""
    
    def __init__(self):
        self.data_api = RCSB_DATA_API
        self.search_api = RCSB_SEARCH_API
        self.download_base = RCSB_DOWNLOAD_BASE

    def search(self, query: Dict[str, Any], return_type: str = "entry", rows: int = 25, sort_by: Optional[str] = None, sort_direction: str = "desc") -> List[Dict[str, Any]]:
        """Executes a search query against RCSB Search API v2."""
        payload = {
            "query": query if "type" in query else {"type": "terminal", "service": "full_text", "parameters": {"value": str(query)}},
            "return_type": return_type,
            "request_options": {
                "paginate": {"start": 0, "rows": rows}
            }
        }
        if sort_by:
            payload["request_options"]["sort"] = [{"sort_by": sort_by, "direction": sort_direction}]
        resp = requests.post(self.search_api, json=payload, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data.get("result_set", [])

    def fetch_metadata(self, graphql_query: str) -> Dict[str, Any]:
        """Runs arbitrary GraphQL query against RCSB Data API."""
        resp = requests.post(self.data_api, json={"query": graphql_query}, timeout=10)
        resp.raise_for_status()
        return resp.json().get("data", {})

    def download_structure(self, pdb_ids: List[str], format: str = "mmcif") -> Dict[str, str]:
        """Downloads coordinate files for specified PDB entries."""
        results = {}
        for pid in pdb_ids:
            ext = "cif" if format == "mmcif" else "pdb"
            url = f"{self.download_base}/{pid.upper()}.{ext}"
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                results[pid.upper()] = resp.text
        return results

    def fetch_schema(self, api: str) -> Dict[str, Any]:
        """Fetches schema definitions for search or data APIs."""
        schema_urls = {
            "search_structure": "https://search.rcsb.org/rcsbsearch/v2/metadata/schema",
            "search_chemical": "https://search.rcsb.org/rcsbsearch/v2/metadata/schema/chemical",
            "data_entry": "https://data.rcsb.org/rest/v1/schema/entry",
            "data_polymer_entity": "https://data.rcsb.org/rest/v1/schema/polymer_entity"
        }
        url = schema_urls.get(api, schema_urls["search_structure"])
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.json()
        return {}
