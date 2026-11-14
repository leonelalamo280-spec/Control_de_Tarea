-- Ejecutar desde Supabase SQL Editor cuando el profesor ya se haya registrado.
-- Reemplazá el DNI por el DNI real del docente.
update public.profiles
set role = 'teacher'
where dni = '12345678';

-- Comprobá el resultado:
select dni, full_name, role from public.profiles where dni = '12345678';
