-- IvyWay: provider schema + defaults (Supabase)
--
-- Ensures `public.providers.data` has the canonical keys the app expects:
-- - services: string[]
-- - school: string | null
-- - schoolId: string | null
-- - availability: any[] (array of per-service availability entries)
-- - isTutor / isCounselor / offersVirtualTours: boolean (derived from services if missing)

create extension if not exists pgcrypto;

alter table public.providers
  alter column data set default '{}'::jsonb;

update public.providers
set data = coalesce(data, '{}'::jsonb);

-- Best-effort backfill of canonical keys without overwriting non-null existing values.
update public.providers
set data =
  coalesce(data, '{}'::jsonb) ||
  jsonb_build_object(
    'services',
      case
        when jsonb_typeof(coalesce(data->'services', '[]'::jsonb)) = 'array' then coalesce(data->'services', '[]'::jsonb)
        else '[]'::jsonb
      end,
    'school',
      case
        when (data ? 'school') then data->'school'
        when (data ? 'school_name') then data->'school_name'
        else null
      end,
    'schoolId',
      case
        when (data ? 'schoolId') then data->'schoolId'
        when (data ? 'school_id') then data->'school_id'
        else null
      end,
    'availability',
      case
        when jsonb_typeof(coalesce(data->'availability', '[]'::jsonb)) in ('array','object') then coalesce(data->'availability', '[]'::jsonb)
        else '[]'::jsonb
      end,
    'isTutor',
      coalesce(
        case when (data->>'isTutor') in ('true','false') then (data->>'isTutor')::boolean else null end,
        (coalesce(data->'services','[]'::jsonb) ? 'tutoring') or (coalesce(data->'services','[]'::jsonb) ? 'test_prep')
      ),
    'isCounselor',
      coalesce(
        case when (data->>'isCounselor') in ('true','false') then (data->>'isCounselor')::boolean else null end,
        (coalesce(data->'services','[]'::jsonb) ? 'college_counseling')
      ),
    'offersVirtualTours',
      coalesce(
        case when (data->>'offersVirtualTours') in ('true','false') then (data->>'offersVirtualTours')::boolean else null end,
        (coalesce(data->'services','[]'::jsonb) ? 'virtual_tour')
      )
  );

-- Optional: migrate legacy `public.availability` rows into `providers.data.availability`.
-- This keeps existing provider availability usable after switching the app to read from providers.data.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'availability'
  ) then
    with av as (
      select
        provider_id,
        jsonb_agg(
          jsonb_strip_nulls(
            jsonb_build_object(
              'providerId', provider_id,
              'serviceType', service_type,
              'timezone', coalesce(timezone, (data->>'timezone')),
              'updatedAt', coalesce((data->>'updatedAt'), updated_at::text),
              'days', data->'days',
              'blocks', data->'blocks'
            )
          )
        ) as availability_json
      from public.availability
      group by provider_id
    )
    update public.providers p
    set data = coalesce(p.data, '{}'::jsonb) || jsonb_build_object('availability', av.availability_json)
    from av
    where p.id = av.provider_id;
  end if;
end $$;

