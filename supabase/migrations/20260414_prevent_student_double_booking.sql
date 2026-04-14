-- Prevent students from booking overlapping sessions (DB-level enforcement).
-- This is stronger than API checks and prevents race conditions across services.

create or replace function public.prevent_student_overlapping_sessions()
returns trigger
language plpgsql
as $$
declare
  conflict_id uuid;
  new_end timestamptz;
begin
  -- Cancelled sessions should not block scheduling.
  if new.status = 'cancelled' then
    return new;
  end if;

  -- Best-effort default: when end_datetime is missing, assume 60 minutes.
  new_end := coalesce(new.end_datetime, new.datetime + interval '60 minutes');

  select s.id
  into conflict_id
  from public.sessions s
  where
    s.student_id = new.student_id
    and s.status <> 'cancelled'
    and s.id <> new.id
    and s.datetime < new_end
    and coalesce(s.end_datetime, s.datetime + interval '60 minutes') > new.datetime
  limit 1;

  if conflict_id is not null then
    raise exception 'student has overlapping session'
      using errcode = '23514';
  end if;

  -- Normalize end_datetime on write if missing.
  if new.end_datetime is null then
    new.end_datetime := new_end;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_student_overlapping_sessions on public.sessions;
create trigger prevent_student_overlapping_sessions
before insert or update of student_id, datetime, end_datetime, status
on public.sessions
for each row
execute function public.prevent_student_overlapping_sessions();

