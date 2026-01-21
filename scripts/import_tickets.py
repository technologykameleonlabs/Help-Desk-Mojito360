#!/usr/bin/env python3
"""
Import Odoo Tickets from Excel to Supabase

Usage:
    python scripts/import_tickets.py              # Full import
    python scripts/import_tickets.py --dry-run    # Parse only, no insert
    python scripts/import_tickets.py --limit 10   # Import first 10 tickets
"""

import os
import sys
import argparse
import re
from datetime import datetime
from html import unescape
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
# Use service key for admin operations (bypasses RLS), fallback to anon key
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing VITE_SUPABASE_URL and (SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY) in .env.local")
    sys.exit(1)

if os.getenv('SUPABASE_SERVICE_KEY'):
    print("Using service role key (admin access)")
else:
    print("Warning: Using anon key - may have RLS restrictions")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Excel file path
EXCEL_PATH = 'input/odoo/data/Tíquet de asistencia (helpdesk.ticket).xlsx'

# Stage mapping (Odoo emoji labels to Supabase values)
STAGE_MAP = {
    '📧 Nuevo': 'new',
    '🧍Asignado': 'assigned',
    '✍️ En Ejecución': 'in_progress',
    '💾 Pdte. Desarrollo': 'pending_dev',
    '🧑 Pdte. Cliente': 'pending_client',
    '🧪 Pruebas (Valid. Intern)': 'testing',
    '⌛ Pdte. Validación': 'pending_validation',
    '✔️ Completado': 'done',
    '⏸️ Pausado': 'paused',
    '❌ Cancelado': 'cancelled',
}

# Priority mapping
PRIORITY_MAP = {
    'Prioridad baja': 'low',
    'Prioridad media': 'medium',
    'Alta prioridad': 'high',
    'Urgente': 'critical',
}

# Cache for entities and profiles lookups
entity_cache = {}
profile_cache = {}


def clean_html(html_text):
    """Remove HTML tags and clean up text"""
    if pd.isna(html_text) or not html_text:
        return None
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', str(html_text))
    # Unescape HTML entities
    text = unescape(text)
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text if text else None


def is_group_header(row):
    """Check if row is a stage group header (e.g., '📧 Nuevo (135)')"""
    app_value = row.get('Aplicación')
    if pd.isna(app_value):
        return False
    # Pattern: emoji + stage name + (count)
    return bool(re.match(r'^[📧🧍✍️💾🧑🧪⌛✔️⏸️❌].+\(\d+\)$', str(app_value)))


def get_entity_id(entity_name):
    """Look up entity ID by name, return None if not found"""
    if pd.isna(entity_name) or not entity_name:
        return None
    
    entity_name = str(entity_name).strip()
    
    if entity_name in entity_cache:
        return entity_cache[entity_name]
    
    result = supabase.table('entities').select('id').eq('name', entity_name).execute()
    
    if result.data:
        entity_cache[entity_name] = result.data[0]['id']
        return entity_cache[entity_name]
    
    entity_cache[entity_name] = None
    return None


def get_profile_id(profile_name):
    """Look up profile ID by full_name, return None if not found"""
    if pd.isna(profile_name) or not profile_name:
        return None
    
    profile_name = str(profile_name).strip()
    
    if profile_name in profile_cache:
        return profile_cache[profile_name]
    
    result = supabase.table('profiles').select('id').eq('full_name', profile_name).execute()
    
    if result.data:
        profile_cache[profile_name] = result.data[0]['id']
        return profile_cache[profile_name]
    
    profile_cache[profile_name] = None
    return None


def parse_datetime(dt_value):
    """Parse datetime from Excel"""
    if pd.isna(dt_value):
        return None
    if isinstance(dt_value, datetime):
        return dt_value.isoformat()
    try:
        return pd.to_datetime(dt_value).isoformat()
    except:
        return None


def map_stage(stage_value):
    """Map Odoo stage to Supabase stage"""
    if pd.isna(stage_value):
        return 'new'
    stage_str = str(stage_value).strip()
    return STAGE_MAP.get(stage_str, 'new')


def map_priority(priority_value):
    """Map Odoo priority to Supabase priority"""
    if pd.isna(priority_value):
        return 'medium'
    priority_str = str(priority_value).strip()
    return PRIORITY_MAP.get(priority_str, 'medium')


def transform_row(row):
    """Transform an Excel row to a Supabase ticket record"""
    ticket = {
        'ticket_ref': int(row['ID']) if pd.notna(row.get('ID')) else None,
        'title': str(row['Asunto']).strip() if pd.notna(row.get('Asunto')) else 'Sin título',
        'description': clean_html(row.get('Descripción')),
        'stage': map_stage(row.get('Etapa')),
        'priority': map_priority(row.get('Prioridad')),
        'assigned_to': get_profile_id(row.get('Asignada a')),
        'entity_id': get_entity_id(row.get('Entidad')),
        'application': str(row['Aplicación']).strip() if pd.notna(row.get('Aplicación')) else None,
        'classification': str(row['Clase']).strip() if pd.notna(row.get('Clase')) else None,
        'channel': str(row['Canal']).strip() if pd.notna(row.get('Canal')) else None,
        'origin': str(row['Origen']).strip() if pd.notna(row.get('Origen')) else None,
        'ticket_type': str(row['Tipo']).strip() if pd.notna(row.get('Tipo')) else None,
        'commitment_date': parse_datetime(row.get('Fecha de compromiso')),
        'estimated_time': int(row['Tiempo estimado']) if pd.notna(row.get('Tiempo estimado')) else None,
        'responsibility': str(row['Responsabilidad']).strip() if pd.notna(row.get('Responsabilidad')) else None,
        'sharepoint_url': str(row['URL SharePoint']).strip() if pd.notna(row.get('URL SharePoint')) else None,
        'solution': clean_html(row.get('Solución')),
        'created_at': parse_datetime(row.get('Creado el')),
        'updated_at': parse_datetime(row.get('Última actualización el')),
    }
    
    # Remove None values to let database use defaults
    return {k: v for k, v in ticket.items() if v is not None}


def import_tickets(dry_run=False, limit=None):
    """Main import function"""
    print(f"Reading Excel file: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH)
    print(f"Total rows in Excel: {len(df)}")
    
    # Filter out group header rows
    df_tickets = df[~df.apply(is_group_header, axis=1)]
    # Also filter rows without a valid ID
    df_tickets = df_tickets[df_tickets['ID'].notna()]
    print(f"Valid ticket rows: {len(df_tickets)}")
    
    if limit:
        df_tickets = df_tickets.head(limit)
        print(f"Limited to: {limit} tickets")
    
    tickets_to_insert = []
    errors = []
    
    for idx, row in df_tickets.iterrows():
        try:
            ticket = transform_row(row)
            tickets_to_insert.append(ticket)
        except Exception as e:
            errors.append(f"Row {idx}: {e}")
    
    print(f"\nTransformed {len(tickets_to_insert)} tickets")
    if errors:
        print(f"Errors during transformation: {len(errors)}")
        for err in errors[:5]:
            print(f"  - {err}")
    
    if dry_run:
        print("\n[DRY RUN] No data inserted")
        print("\nSample tickets:")
        for t in tickets_to_insert[:3]:
            print(f"  - #{t.get('ticket_ref')}: {t.get('title')[:50]}... ({t.get('stage')})")
        return
    
    # Insert in batches
    BATCH_SIZE = 100
    inserted = 0
    
    print(f"\nInserting tickets in batches of {BATCH_SIZE}...")
    
    for i in range(0, len(tickets_to_insert), BATCH_SIZE):
        batch = tickets_to_insert[i:i + BATCH_SIZE]
        try:
            result = supabase.table('tickets').insert(batch).execute()
            inserted += len(result.data)
            print(f"  Inserted batch {i // BATCH_SIZE + 1}: {len(result.data)} tickets")
        except Exception as e:
            print(f"  Error in batch {i // BATCH_SIZE + 1}: {e}")
    
    print(f"\n✅ Successfully inserted {inserted} tickets")


def main():
    parser = argparse.ArgumentParser(description='Import Odoo tickets to Supabase')
    parser.add_argument('--dry-run', action='store_true', help='Parse only, do not insert')
    parser.add_argument('--limit', type=int, help='Limit number of tickets to import')
    args = parser.parse_args()
    
    import_tickets(dry_run=args.dry_run, limit=args.limit)


if __name__ == '__main__':
    main()
