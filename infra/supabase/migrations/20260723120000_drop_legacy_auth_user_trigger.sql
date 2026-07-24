-- This trigger belonged to an older app in the shared Supabase project.
-- It writes every auth.users insert into public.users, which breaks SnapQuote
-- social auth because SnapQuote stores app profiles in snapquote.org_members.
drop trigger if exists on_auth_user_created on auth.users;
