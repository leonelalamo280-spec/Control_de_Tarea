-- CONTROL DE TAREA | Esquema inicial para Supabase
-- Ejecutar completo en Supabase > SQL Editor > New query.
-- IMPORTANTE: el trigger asigna siempre el rol alumno. Nunca confiar en un rol
-- enviado por el formulario del navegador.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  dni varchar(8) not null unique check (dni ~ '^[0-9]{7,8}$'),
  full_name text not null,
  role text not null default 'student' check (role in ('student','teacher')),
  year text,
  division text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, dni, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'dni', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Usuario'),
    'student'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title varchar(90) not null,
  type text not null default 'Tarea',
  subject text not null,
  year text not null,
  division text not null,
  due_at timestamptz not null,
  description text not null,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles(id),
  submitted_at timestamptz not null default now(),
  grade numeric(4,2) check (grade is null or (grade >= 1 and grade <= 10)),
  feedback text,
  unique(task_id, student_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_dni varchar(8) not null,
  status text not null check (status in ('Presente','Ausente','Tarde')),
  attendance_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists tasks_due_at_idx on public.tasks(due_at);
create index if not exists deliveries_student_idx on public.deliveries(student_id);
create index if not exists attendance_date_idx on public.attendance(attendance_date);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.deliveries enable row level security;
alter table public.attendance enable row level security;

-- Helper seguro: permite consultar el rol del usuario autenticado.
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

-- Profiles: cada alumno ve su perfil; docentes pueden ver el padrón.
drop policy if exists "profile read self or teacher" on public.profiles;
create policy "profile read self or teacher" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.current_user_role() = 'teacher');

-- Tasks: cualquier usuario autenticado puede leer; solamente docentes escriben.
drop policy if exists "tasks read authenticated" on public.tasks;
create policy "tasks read authenticated" on public.tasks for select to authenticated using (true);
drop policy if exists "teachers create tasks" on public.tasks;
create policy "teachers create tasks" on public.tasks for insert to authenticated with check (public.current_user_role() = 'teacher' and created_by = (select auth.uid()));
drop policy if exists "teachers update tasks" on public.tasks;
create policy "teachers update tasks" on public.tasks for update to authenticated using (public.current_user_role() = 'teacher') with check (public.current_user_role() = 'teacher');
drop policy if exists "teachers delete tasks" on public.tasks;
create policy "teachers delete tasks" on public.tasks for delete to authenticated using (public.current_user_role() = 'teacher');

-- Deliveries: el alumno registra y ve sus propias entregas; el docente ve y califica todas.
drop policy if exists "deliveries read own or teacher" on public.deliveries;
create policy "deliveries read own or teacher" on public.deliveries for select to authenticated
using (student_id = (select auth.uid()) or public.current_user_role() = 'teacher');
drop policy if exists "students submit own delivery" on public.deliveries;
create policy "students submit own delivery" on public.deliveries for insert to authenticated
with check (student_id = (select auth.uid()) and public.current_user_role() = 'student');
drop policy if exists "teachers grade deliveries" on public.deliveries;
create policy "teachers grade deliveries" on public.deliveries for update to authenticated
using (public.current_user_role() = 'teacher') with check (public.current_user_role() = 'teacher');

-- Attendance: docentes pueden consultar y registrar asistencia.
drop policy if exists "teachers manage attendance" on public.attendance;
create policy "teachers manage attendance" on public.attendance for all to authenticated
using (public.current_user_role() = 'teacher') with check (public.current_user_role() = 'teacher');


-- Permisos de acceso a través de la API de Supabase.
-- Las políticas RLS anteriores siguen limitando qué filas puede usar cada rol.
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update on public.deliveries to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
grant execute on function public.current_user_role() to authenticated;
