"""
Execute SQL migrations against Supabase using the Supabase Python client.
Uses RPC function or direct table access.

Usage:
  python execute_sql.py
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://evhwlybmnimzdepnlqrn.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_KEY")

if not SUPABASE_SERVICE_KEY:
    print("ERROR: Set VITE_SUPABASE_SERVICE_KEY in .env (service role key from Supabase dashboard)")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# The SQL to execute (notifications, comment_mentions, attachments tables)
SQL_MIGRATION = """
-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'assignment', 'status_change', 'new_comment')),
  triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

-- Comment mentions table
CREATE TABLE IF NOT EXISTS public.comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment_id ON public.comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user_id ON public.comment_mentions(user_id);

-- Attachments table
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON public.attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_comment_id ON public.attachments(comment_id);

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS for comment_mentions  
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

-- RLS for attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
"""

def main():
    print("Checking if tables exist by trying to query them...")
    
    # Test connection and check if tables already exist
    try:
        # Try to select from notifications - if it fails, table doesn't exist
        result = supabase.table("notifications").select("id").limit(1).execute()
        print("✅ notifications table already exists")
    except Exception as e:
        if "relation" in str(e) and "does not exist" in str(e):
            print("❌ notifications table does not exist - needs to be created via SQL Editor")
        else:
            print(f"⚠️ notifications table - unknown status: {e}")
    
    try:
        result = supabase.table("comment_mentions").select("id").limit(1).execute()
        print("✅ comment_mentions table already exists")
    except Exception as e:
        if "relation" in str(e) and "does not exist" in str(e):
            print("❌ comment_mentions table does not exist - needs to be created via SQL Editor")
        else:
            print(f"⚠️ comment_mentions table - unknown status: {e}")
    
    try:
        result = supabase.table("attachments").select("id").limit(1).execute()
        print("✅ attachments table already exists")
    except Exception as e:
        if "relation" in str(e) and "does not exist" in str(e):
            print("❌ attachments table does not exist - needs to be created via SQL Editor")
        else:
            print(f"⚠️ attachments table - unknown status: {e}")
    
    print("\n" + "="*60)
    print("NOTE: The Supabase Python client cannot execute raw DDL SQL.")
    print("To create the tables, you need to run the following SQL in")
    print("the Supabase Dashboard SQL Editor:")
    print("="*60)
    print("\nFile: supabase/migrations/20260121_notifications_attachments.sql")
    print("="*60)

if __name__ == "__main__":
    main()
