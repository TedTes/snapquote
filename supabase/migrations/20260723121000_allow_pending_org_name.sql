alter table snapquote.orgs
drop constraint if exists orgs_name_check;

alter table snapquote.orgs
add constraint orgs_name_check check (length(trim(name)) <= 120);
