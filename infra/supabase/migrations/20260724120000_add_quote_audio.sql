alter table snapquote.quotes
  add column if not exists audio_storage_path text,
  add column if not exists audio_content_type text,
  add column if not exists audio_duration_seconds integer
    check (audio_duration_seconds is null or audio_duration_seconds between 0 and 3600);

insert into storage.buckets (id, name, public)
values ('snapquote-quote-audio', 'snapquote-quote-audio', false)
on conflict (id) do update set public = excluded.public;

create or replace view public.snapquote_quotes as
select * from snapquote.quotes;

grant select, insert, update, delete on public.snapquote_quotes to service_role;
