-- Supabase schema for Alhan T. E. Ch. School
-- Run this file in the Supabase SQL Editor. Keep RLS enabled.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'staff' check (role in ('super_admin','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.academic_levels(id) on delete restrict,
  name text not null,
  sort_order int not null default 0,
  is_current boolean not null default false,
  is_active boolean not null default true,
  unique(level_id, name)
);

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique(academic_year_id, name)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  unique(academic_year_id, term_id, name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique,
  full_name text not null,
  class_id uuid not null references public.classes(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true
);

-- Connect a subject to a specific class, term and grading scale.
create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  final_grade numeric(7,2) not null check (final_grade > 0),
  passing_grade numeric(7,2) not null check (passing_grade >= 0 and passing_grade <= final_grade),
  unique(class_id, subject_id)
);

create table if not exists public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  unique(user_id, class_subject_id)
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  score numeric(7,2) check (score >= 0),
  status text not null default 'draft' check (status in ('draft','ready','published')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(student_id, class_subject_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  );
$$;

create or replace function public.can_manage_class_subject(target_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.staff_permissions sp
    where sp.user_id = auth.uid() and sp.class_subject_id = target_id
  );
$$;

alter table public.profiles enable row level security;
alter table public.academic_levels enable row level security;
alter table public.academic_years enable row level security;
alter table public.terms enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.grades enable row level security;
alter table public.announcements enable row level security;
alter table public.site_settings enable row level security;

-- Public pages can read active academic structure and published notices only.
create policy "public read active levels" on public.academic_levels for select to anon, authenticated using (is_active);
create policy "public read active years" on public.academic_years for select to anon, authenticated using (is_active);
create policy "public read active terms" on public.terms for select to anon, authenticated using (is_active);
create policy "public read active classes" on public.classes for select to anon, authenticated using (is_active);
create policy "public read active subjects" on public.subjects for select to anon, authenticated using (is_active);
create policy "public read published notices" on public.announcements for select to anon, authenticated using (is_published);

-- Staff and super-admin access is enforced in the database, not just in the UI.
create policy "profile self or admin read" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_super_admin());
create policy "admin manages profiles" on public.profiles for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "admin manages levels" on public.academic_levels for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "admin manages years" on public.academic_years for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "admin manages terms" on public.terms for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "admin manages classes" on public.classes for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "admin manages subjects" on public.subjects for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "admin manages class subjects" on public.class_subjects for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "staff reads assigned students" on public.students for select to authenticated
using (
  public.is_super_admin() or exists (
    select 1 from public.class_subjects cs
    join public.staff_permissions sp on sp.class_subject_id = cs.id
    where cs.class_id = students.class_id and sp.user_id = auth.uid()
  )
);
create policy "admin manages students" on public.students for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "staff reads own permissions or admin" on public.staff_permissions for select to authenticated
using (user_id = auth.uid() or public.is_super_admin());
create policy "admin manages staff permissions" on public.staff_permissions for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "staff reads assigned grades" on public.grades for select to authenticated
using (public.can_manage_class_subject(class_subject_id));
create policy "staff inserts assigned grades" on public.grades for insert to authenticated
with check (public.can_manage_class_subject(class_subject_id) and status in ('draft','ready'));
create policy "staff updates assigned grades" on public.grades for update to authenticated
using (public.can_manage_class_subject(class_subject_id))
with check (public.can_manage_class_subject(class_subject_id) and (public.is_super_admin() or status in ('draft','ready')));
create policy "admin deletes grades" on public.grades for delete to authenticated
using (public.is_super_admin());

create policy "admin manages notices" on public.announcements for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "admin manages site settings" on public.site_settings for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

-- Students can only retrieve their own published result using their unique code.
-- The function returns a deliberately limited JSON payload and does not expose table reads.
create or replace function public.lookup_published_result(student_code_input text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  student_row public.students%rowtype;
  result_json jsonb;
begin
  if student_code_input is null or length(trim(student_code_input)) < 3 then
    return null;
  end if;

  select s.* into student_row
  from public.students s
  where s.student_code = trim(student_code_input)
  limit 1;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'student_name', student_row.full_name,
    'student_code', student_row.student_code,
    'class_name', c.name,
    'academic_year', ay.name,
    'level_name', al.name,
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject_name', sub.name,
        'score', g.score,
        'final_grade', cs.final_grade,
        'passing_grade', cs.passing_grade,
        'passed', (g.score >= cs.passing_grade)
      ) order by sub.name)
      from public.grades g
      join public.class_subjects cs on cs.id = g.class_subject_id
      join public.subjects sub on sub.id = cs.subject_id
      where g.student_id = student_row.id and g.status = 'published'
    ), '[]'::jsonb)
  ) into result_json
  from public.classes c
  join public.academic_years ay on ay.id = c.academic_year_id
  join public.academic_levels al on al.id = ay.level_id
  where c.id = student_row.class_id;

  return result_json;
end;
$$;

revoke all on function public.lookup_published_result(text) from public;
grant execute on function public.lookup_published_result(text) to anon, authenticated;

-- Only a super admin can publish results. Staff can save drafts and mark them ready.
create or replace function public.publish_class_results(target_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can publish results';
  end if;

  update public.grades g
  set status = 'published', updated_at = now(), updated_by = auth.uid()
  from public.class_subjects cs
  where g.class_subject_id = cs.id
    and cs.class_id = target_class_id
    and g.status = 'ready';
end;
$$;

revoke all on function public.publish_class_results(uuid) from public;
grant execute on function public.publish_class_results(uuid) to authenticated;
