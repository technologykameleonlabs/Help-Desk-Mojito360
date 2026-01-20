"""
Seed script to load entities from Odoo CSV into Supabase.
Run this after creating the schema.

Usage:
  python seed_entities.py

Requirements:
  pip install supabase python-dotenv
"""

import csv
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://evhwlybmnimzdepnlqrn.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Use service role key for seeding

if not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_SERVICE_KEY in .env (service role key from Supabase dashboard)")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Path to CSV
CSV_PATH = "input/odoo/data/Entidad (x_entidad).csv"

def parse_status(status_str: str) -> str:
    """Convert Odoo status emoji to db value"""
    if "✅" in status_str or "Activa" in status_str:
        return "active"
    return "inactive"

def parse_usage(usage_str: str) -> str:
    """Normalize usage field"""
    if not usage_str:
        return None
    return usage_str.strip()

def main():
    entities = []
    seen_names = set()
    
    with open(CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("Nombre de la entidad", "").strip()
            if not name or name in seen_names:
                continue
            
            seen_names.add(name)
            
            entity = {
                "external_id": row.get("Id externa", "").strip() or None,
                "name": name,
                "status": parse_status(row.get("Estado", "")),
                "usage": parse_usage(row.get("Uso", ""))
            }
            entities.append(entity)
    
    print(f"Found {len(entities)} unique entities. Inserting...")
    
    # Insert in batches of 50
    batch_size = 50
    for i in range(0, len(entities), batch_size):
        batch = entities[i:i+batch_size]
        result = supabase.table("entities").insert(batch).execute()
        print(f"  Inserted batch {i//batch_size + 1}: {len(batch)} entities")
    
    print("Done!")

if __name__ == "__main__":
    main()
