# CONTROL DE TAREA
### Plataforma de gestión académica

Proyecto escolar desarrollado con HTML, CSS y JavaScript. Esta versión incorpora integración con Supabase para autenticación y persistencia de tareas, entregas, calificaciones, alumnos y asistencia.

**Integrantes:** Leonel Alamo y Santiago Ropero  
**Año:** 2026

## Funcionalidades
- Registro e inicio de sesión con DNI y contraseña mediante Supabase Auth.
- Las cuentas nuevas se crean siempre como **Alumno**.
- Un administrador habilita las cuentas docentes desde Supabase; el navegador nunca puede asignarse el rol Profesor.
- Tareas: lectura para usuarios autenticados y alta, edición y eliminación exclusivas del profesor.
- Entregas: cada alumno registra y consulta sus entregas; el profesor consulta y califica.
- Calificaciones visibles para el alumno propietario de la entrega.
- Padrón de alumnos y asistencia para docentes.
- Políticas Row Level Security (RLS) en las tablas principales.
- Modo demostración local disponible cuando no se completan las credenciales.

## 1. Crear el proyecto Supabase
1. Entrá en [Supabase](https://supabase.com/) y creá un proyecto.
2. En **Project Settings → API** copiá la **Project URL** y la clave **anon/publicable** (`anon` o `publishable`).
3. Nunca uses ni publiques la clave `service_role` o `secret` en el frontend.

## 2. Crear las tablas y políticas
1. Abrí **SQL Editor → New query**.
2. Copiá y ejecutá todo el contenido de `supabase/schema.sql`.
3. En **Authentication → Providers → Email**, habilitá Email.
4. Como este proyecto identifica las cuentas con DNI y no usa una casilla de correo real, para las pruebas escolares desactivá **Confirm email** en la configuración de autenticación. Si se mantiene activada, el registro puede requerir una confirmación que no llegará al alumno.

## 3. Configurar el frontend
Abrí `public/js/config.js` y completá:

```js
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_ANON_KEY = "TU_CLAVE_ANON_O_PUBLICABLE";
export const USE_LOCAL_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
```

La URL y la clave pública pueden estar en el frontend porque las tablas están protegidas con RLS. **No pegues la clave service_role.** Al completar ambos valores, la aplicación deja automáticamente el modo demostración y utiliza Supabase.

## 4. Habilitar al profesor
1. Registrá primero la cuenta del docente desde la aplicación usando su DNI, nombre y contraseña.
2. Abrí `supabase/habilitar-profesor.sql`.
3. Reemplazá `12345678` por el DNI del docente y ejecutá el SQL desde Supabase SQL Editor.
4. Cerrá sesión y volvé a ingresar en la aplicación. El menú docente aparecerá según el rol guardado en la base de datos.

No habilites profesores desde el formulario público. Solo una persona con acceso administrativo al proyecto Supabase debe ejecutar este paso.

## 5. Ejecutar el proyecto
Requiere Node.js instalado.

```bash
npm install
npm run dev
```

Abrí la URL local que muestra Vite. Para generar la versión de producción:

```bash
npm run build
npm run preview
```

## Tablas incluidas
- `profiles`: DNI, nombre, rol y curso vinculados al usuario de Supabase Auth.
- `tasks`: actividades publicadas por docentes.
- `deliveries`: entregas y notas, vinculadas al alumno y a la tarea.
- `attendance`: asistencia registrada por docentes.

## Notas importantes
- Supabase Auth usa internamente un identificador de correo derivado del DNI (`DNI@controldetarea.com`); el alumno solo ve y escribe su DNI en la interfaz.
- Las contraseñas las administra Supabase Auth; nunca se guardan en texto plano en las tablas del proyecto.
- Las políticas RLS son la barrera real de permisos. Ocultar botones en la interfaz no reemplaza la autorización en la base de datos.
- El modo local es solo para demostración y no debe usarse con cuentas reales.
- La carga de archivos adjuntos todavía no está implementada; las entregas actuales registran la entrega de la actividad, no suben documentos.

---
**Control de Tarea — Organizar, aprender y avanzar.**


## Selector de perfil
La pantalla de acceso muestra el selector **Alumno / Profesor**. Al iniciar sesión, el sistema comprueba que el perfil elegido coincida con el rol guardado en Supabase. Elegir “Profesor” no otorga permisos docentes. El alta pública crea cuentas de alumno; un administrador debe habilitar las cuentas de profesor desde Supabase.

## 6. Publicación en Vercel
1. Subí esta carpeta a un repositorio de GitHub.
2. En Vercel elegí **Add New → Project** e importá ese repositorio.
3. Framework: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. No necesitás variables de entorno adicionales en esta versión: la URL y la clave publicable se configuran en `public/js/config.js`.
5. Cada vez que actualices el código en GitHub, Vercel volverá a desplegar el sitio.

**Importante:** la clave `sb_publishable_...` es una clave pública para el navegador, no una `service_role`. La seguridad depende de las políticas RLS del archivo SQL. Nunca agregues una clave `service_role` al proyecto ni al repositorio.

## 7. Comprobación rápida
- Registrá un alumno con DNI de 7 u 8 dígitos y contraseña de al menos 6 caracteres.
- Iniciá sesión como alumno y comprobá que pueda ver tareas, entregar y consultar sus notas, pero no editar ni borrar.
- Registrá la cuenta del docente como alumno y habilitala con `supabase/habilitar-profesor.sql`.
- Cerrá sesión y entrá seleccionando Profesor. Comprobá crear, editar, borrar tareas y calificar entregas.
- Probá también desde una ventana privada o desde otro dispositivo para comprobar que los datos se sincronizan desde Supabase.
