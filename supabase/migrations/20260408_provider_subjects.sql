-- IvyWay: provider subjects (canonical, provider-level)
--
-- Adds a provider-level subjects array for fast, correct subject filtering.
-- Canonical subject keys:
-- - math, english, science, history, languages, test_prep

create or replace function public.ivyway_canonical_subject(raw text)
returns text
language sql
immutable
as $$
  with n as (
    select
      lower(
        trim(
          regexp_replace(
            regexp_replace(coalesce(raw, ''), '&', 'and', 'g'),
            '[^a-zA-Z0-9]+',
            ' ',
            'g'
          )
        )
      ) as v
  )
  select
    case
      when (select v from n) = '' then null
      when (select v from n) in ('math','mathematics','maths') then 'math'
      when (select v from n) like '%english%' or (select v from n) like '%language arts%' or (select v from n) = 'ela' then 'english'
      when (select v from n) like '%science%' then 'science'
      when (select v from n) like '%history%' or (select v from n) like '%social studies%' then 'history'
      when (select v from n) like '%language%' then 'languages'
      when (select v from n) like '%test%' then 'test_prep'
      when (select v from n) in (
        'sat','act','psat','ssat','isee','ap','ib','gre','gmat','toefl','ielts','regents'
      ) then 'test_prep'
      when (select v from n) like '%sat%' or (select v from n) like '%act%' then 'test_prep'
      else null
    end;
$$;

alter table public.providers
  add column if not exists subjects text[] not null default '{}'::text[];

create index if not exists providers_subjects_gin_idx
on public.providers
using gin (subjects);

-- Backfill from users.data.subjects first, then providers.data.subjects/specialties.
with src as (
  select
    p.id,
    array(
      select distinct public.ivyway_canonical_subject(x) as subject
      from (
        select jsonb_array_elements_text(
          case
            when jsonb_typeof(coalesce(u.data->'subjects','[]'::jsonb)) = 'array' then coalesce(u.data->'subjects','[]'::jsonb)
            when jsonb_typeof(coalesce(p.data->'subjects','[]'::jsonb)) = 'array' then coalesce(p.data->'subjects','[]'::jsonb)
            when jsonb_typeof(coalesce(p.data->'specialties','[]'::jsonb)) = 'array' then coalesce(p.data->'specialties','[]'::jsonb)
            else '[]'::jsonb
          end
        ) as x
      ) t
      where public.ivyway_canonical_subject(x) is not null
    ) as subjects
  from public.providers p
  left join public.users u on u.id = p.user_id
)
update public.providers p
set
  subjects = coalesce(src.subjects, '{}'::text[]),
  data = coalesce(p.data, '{}'::jsonb) || jsonb_build_object('subjects', to_jsonb(coalesce(src.subjects, '{}'::text[])))
from src
where p.id = src.id;

