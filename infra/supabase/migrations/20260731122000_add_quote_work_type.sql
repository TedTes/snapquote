alter table snapquote.quotes
  add column if not exists work_type text not null default 'interior_repaint';

update snapquote.quotes
set work_type = case
  when lower(job_title) like '%exterior%'
    or lower(scope_summary) like '%exterior%'
    then 'exterior_trim'
  else 'interior_repaint'
end
where trim(work_type) = '';

alter table snapquote.quotes
  drop constraint if exists quotes_work_type_check;

alter table snapquote.quotes
  add constraint quotes_work_type_check
  check (work_type in ('interior_repaint', 'exterior_trim'));

drop view if exists public.snapquote_quotes;

create view public.snapquote_quotes
with (security_invoker = true) as
select * from snapquote.quotes;

grant select, insert, update, delete on public.snapquote_quotes to service_role;
