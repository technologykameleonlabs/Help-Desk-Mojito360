-- =====================================================
-- Attachments Schema (using Supabase Storage)
-- =====================================================

-- Attachments table (metadata for files in Storage)
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- bytes
  file_type TEXT NOT NULL, -- MIME type
  storage_path TEXT NOT NULL, -- path in Supabase Storage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON public.attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_comment_id ON public.attachments(comment_id);

-- RLS for attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attachments"
  ON public.attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload attachments"
  ON public.attachments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own attachments"
  ON public.attachments FOR DELETE
  USING (auth.uid() = uploaded_by);

-- =====================================================
-- Storage Bucket Setup (run this in SQL Editor)
-- =====================================================

-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false, -- private bucket
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ticket-attachments' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can view files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ticket-attachments' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ticket-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
