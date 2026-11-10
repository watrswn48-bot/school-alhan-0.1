-- Security and integrity hardening for the existing Alhan school schema.
-- Run once in Supabase SQL Editor after schema.sql.

-- Assigned staff must be able to load only the class-subject rows they manage.
drop policy if exists "staff reads assigned class subjects" on public.class_subjects;
create policy "staff reads assigned class subjects"
on public.class_subjects for select to authenticated
using (public.can_manage_class_subject(id));

-- Ensure a grade always belongs to a student in the same class as its subject.
-- Also enforce score limits and prevent staff from publishing results.
create or replace function public.guard_grade_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class uuid;
  max_score numeric(7,2);
begin
  select class_id, final_grade
    into target_class, max_score
  from public.class_subjects
  where id = new.class_subject_id;

  if target_class is null then
    raise exception 'Invalid class subject';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = new.student_id and s.class_id = target_class
  ) then
    raise exception 'Student does not belong to this class';
  end if;

  if new.score is not null and (new.score < 0 or new.score > max_score) then
    raise exception 'Score must be between zero and the subject final grade';
  end if;

  if not public.is_super_admin() then
    if not public.can_manage_class_subject(new.class_subject_id) then
      raise exception 'Not authorized for this subject';
    end if;
    if new.status not in ('draft','ready') then
      raise exception 'Only the super admin can publish results';
    end if;
    if tg_op = 'UPDATE' and old.status = 'published' then
      raise exception 'Published grades cannot be changed by staff';
    end if;
    new.updated_by := auth.uid();
  else
    new.updated_by := auth.uid();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists grades_guard_write on public.grades;
create trigger grades_guard_write
before insert or update on public.grades
for each row execute function public.guard_grade_write();

-- Keep the publication RPC restricted to the authenticated super admin.
revoke all on function public.publish_class_results(uuid) from public, anon;
grant execute on function public.publish_class_results(uuid) to authenticated;

-- Avoid exposing internal helper functions to anonymous callers.
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.can_manage_class_subject(uuid) from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.can_manage_class_subject(uuid) to authenticated;
