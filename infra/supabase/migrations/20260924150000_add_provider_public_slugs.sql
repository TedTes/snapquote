alter table snapquote.orgs
  add column if not exists public_slug text;

do $$
declare
  org_record record;
  base_slug text;
  candidate text;
  attempt integer;
begin
  for org_record in
    select id, name
    from snapquote.orgs
    where public_slug is null
    order by created_at, id
  loop
    base_slug := trim(both '-' from regexp_replace(lower(coalesce(org_record.name, '')), '[^a-z0-9]+', '-', 'g'));
    if length(base_slug) < 3 then
      base_slug := 'provider';
    end if;
    base_slug := trim(trailing '-' from left(base_slug, 40));
    candidate := base_slug;
    attempt := 0;

    while exists (
      select 1
      from snapquote.orgs
      where public_slug = candidate
        and id <> org_record.id
    ) loop
      attempt := attempt + 1;
      candidate := trim(trailing '-' from left(base_slug, 31)) || '-' || left(md5(org_record.id::text || attempt::text), 8);
    end loop;

    update snapquote.orgs
    set public_slug = candidate
    where id = org_record.id;
  end loop;
end
$$;

create or replace function snapquote.assign_org_public_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base_slug text;
  candidate text;
  attempt integer := 0;
begin
  if new.public_slug is not null and btrim(new.public_slug) <> '' then
    new.public_slug := lower(btrim(new.public_slug));
    return new;
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(coalesce(new.name, '')), '[^a-z0-9]+', '-', 'g'));
  if length(base_slug) < 3 then
    base_slug := 'provider';
  end if;
  base_slug := trim(trailing '-' from left(base_slug, 40));
  candidate := base_slug;

  while exists (
    select 1
    from snapquote.orgs
    where public_slug = candidate
      and id <> new.id
  ) loop
    attempt := attempt + 1;
    candidate := trim(trailing '-' from left(base_slug, 31)) || '-' || left(md5(new.id::text || attempt::text), 8);
  end loop;

  new.public_slug := candidate;
  return new;
end
$$;

drop trigger if exists assign_org_public_slug on snapquote.orgs;
create trigger assign_org_public_slug
before insert or update of public_slug on snapquote.orgs
for each row execute function snapquote.assign_org_public_slug();

alter table snapquote.orgs
  alter column public_slug set not null,
  drop constraint if exists orgs_public_slug_format_check,
  add constraint orgs_public_slug_format_check
    check (public_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

create unique index if not exists orgs_public_slug_unique_idx
  on snapquote.orgs (public_slug);

create or replace view public.snapquote_orgs
with (security_invoker = true) as
select * from snapquote.orgs;

revoke all on public.snapquote_orgs from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_orgs to service_role;
