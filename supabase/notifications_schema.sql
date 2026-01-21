-- =====================================================
-- Notifications & Mentions Schema
-- =====================================================

-- Notifications table for tracking mentions, assignments, status changes
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

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;

-- Comment mentions table (many-to-many between comments and mentioned users)
CREATE TABLE IF NOT EXISTS public.comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment_id ON public.comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user_id ON public.comment_mentions(user_id);

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS for comment_mentions
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mentions"
  ON public.comment_mentions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create mentions"
  ON public.comment_mentions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification on ticket assignment
CREATE OR REPLACE FUNCTION handle_ticket_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if assigned_to changed and is not null
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, ticket_id, type, triggered_by, message)
    VALUES (
      NEW.assigned_to,
      NEW.id,
      'assignment',
      auth.uid(),
      'Te han asignado el ticket #' || NEW.ticket_ref || ': ' || NEW.title
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_ticket_assignment
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION handle_ticket_assignment();

-- Function to create notification on status change
CREATE OR REPLACE FUNCTION handle_ticket_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if stage changed
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    -- Notify the creator if they're not the one making the change
    IF NEW.created_by IS NOT NULL AND NEW.created_by != auth.uid() THEN
      INSERT INTO public.notifications (user_id, ticket_id, type, triggered_by, message)
      VALUES (
        NEW.created_by,
        NEW.id,
        'status_change',
        auth.uid(),
        'El ticket #' || NEW.ticket_ref || ' cambió a: ' || NEW.stage
      );
    END IF;
    
    -- Notify the assignee if they're not the one making the change
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() AND NEW.assigned_to != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, ticket_id, type, triggered_by, message)
      VALUES (
        NEW.assigned_to,
        NEW.id,
        'status_change',
        auth.uid(),
        'El ticket #' || NEW.ticket_ref || ' cambió a: ' || NEW.stage
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_ticket_status_change
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION handle_ticket_status_change();
