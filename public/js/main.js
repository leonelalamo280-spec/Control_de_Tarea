import {getData,saveData,createTask,getTask,updateTask,deleteTask,createDelivery,gradeDelivery,registerAccount,loginAccount,logoutAccount,restoreSession,isSupabaseMode,saveAttendance} from "./api.js";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let data, role, userName, dni, currentView="dashboard", authMode="login";
const roleNames={student:"Alumno",teacher:"Profesor"};
const isTeacher=()=>role==="teacher";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=s=>s?new Date(s).toLocaleString("es-AR",{dateStyle:"short",timeStyle:"short"}):"Sin fecha";
const expired=t=>t.due&&new Date(t.due)<new Date();
function toast(m){const el=$("#toast");if(!el)return;el.textContent=m;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
async function currentAccount(){return await restoreSession()}
function setAccount(account){
  role=account?.role;userName=account?.name||"Usuario";dni=account?.dni||"";
  if(!$("#user-name"))return;
  $("#user-name").textContent=userName;$("#user-role").textContent=roleNames[role]||"Invitado";
  $("#welcome-name").textContent=userName.split(" ")[0];$("#avatar").textContent=userName.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase();
  $$(".teacher-only").forEach(el=>el.classList.toggle("hidden",!isTeacher()));
  $$(".student-only").forEach(el=>el.classList.toggle("hidden",role!=="student"));
  $(".online-label").textContent=isSupabaseMode()?"Conectado a Supabase":"Modo de demostración";
  $("#welcome-copy").textContent=isTeacher()?"Administrá actividades, revisá entregas y calificá los trabajos de tus alumnos.":"Consultá tus actividades, entregá tus trabajos y revisá tus calificaciones.";
}
function switchAuth(mode){
  authMode=mode;
  $$(".auth-tab").forEach(b=>b.classList.toggle("active",b.dataset.authMode===mode));
  $("#auth-title").textContent=mode==="login"?"Ingresar a Control de Tarea":"Crear una cuenta";
  $("#auth-description").textContent=mode==="login"?"Elegí tu perfil e ingresá con tu DNI y contraseña.":"Completá tus datos. Las cuentas de alumno se crean desde aquí; las cuentas de profesor requieren autorización del administrador.";
  $("#auth-name").classList.toggle("required",mode==="register");
  $("#auth-name").required=mode==="register";
  $("#auth-name").parentElement.classList.toggle("hidden",mode==="login");
  // El selector de perfil queda visible en modo demo y en Supabase.
  // En Supabase solo selecciona el perfil esperado; no concede permisos.
  $("#auth-submit").textContent=mode==="login"?"Ingresar al sistema →":"Crear cuenta →";
}
async function authSubmit(e){
  e.preventDefault();const id=$("#auth-dni").value.replace(/\D/g,""),password=$("#auth-password").value;
  if(!/^\d{7,8}$/.test(id)){toast("Ingresá un DNI válido de 7 u 8 números.");return;}
  if(password.length<6){toast("La contraseña debe tener al menos 6 caracteres.");return;}
  try{
    let account;
    const selectedRole=$("#auth-role").value;
    if(authMode==="register"){
      if(selectedRole==="teacher"){
        toast("Las cuentas de profesor deben ser habilitadas por un administrador. Seleccioná Alumno para registrarte.");
        return;
      }
      const name=$("#auth-name").value.trim();if(!name){toast("Ingresá tu nombre y apellido.");return;}
      account=await registerAccount({dni:id,name,password,role:"student"});
      toast("Cuenta de alumno creada correctamente.");
    }else {
      account=await loginAccount({dni:id,password});
      if(account.role!==selectedRole){
        await logoutAccount();
        throw new Error(selectedRole==="teacher"?"Esta cuenta no está registrada como profesor. Elegí Alumno o verificá tu cuenta.":"Esta cuenta no está registrada como alumno. Elegí Profesor o verificá tu cuenta.");
      }
    }
    setAccount(account);$("#auth-modal").classList.add("hidden");data=await getData();render();
  }catch(error){console.error(error);toast(error.message||"No se pudo completar la autenticación.");}
}
function applyTheme(theme){
  document.documentElement.dataset.theme=theme;
  localStorage.setItem("ct_theme",theme);
  const b=$("#theme-toggle");if(b)b.innerHTML=theme==="dark"?'☀ <span>Modo claro</span>':'☾ <span>Modo oscuro</span>';
}
function navigate(view){
  if((view==="students"||view==="subjects"||view==="attendance")&&!isTeacher()){toast("Esta sección es exclusiva del profesor.");return;}
  currentView=view;$$(".view").forEach(v=>v.classList.add("hidden"));$("#view-"+view)?.classList.remove("hidden");
  $$(".nav-link[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const titles={dashboard:"Panel principal",tasks:"Tareas y exámenes",deliveries:"Entregas",students:"Alumnos",subjects:"Materias y cursos",attendance:"Asistencia",calendar:"Calendario",grades:"Calificaciones",notifications:"Notificaciones"};
  if($("#page-title"))$("#page-title").textContent=titles[view]||"Control de Tarea";renderView(view);
}
function taskStatus(t){const mine=data.deliveries.find(d=>String(d.taskId)===String(t.id)&&d.studentDni===dni);return mine?"Entregada":expired(t)?"Vencida":"Pendiente";}
function taskCard(t){
  const status=taskStatus(t);
  const actions=isTeacher()?`<a class="small-action" href="editar.html?id=${encodeURIComponent(t.id)}">Editar</a><button class="small-action danger" data-delete="${t.id}">Eliminar</button>`:(status==="Pendiente"?`<button class="small-action gold-action" data-deliver="${t.id}">Entregar tarea</button>`:"");
  return `<article class="task-card"><div class="task-card-top"><span class="type-pill">${esc(t.type)}</span><span class="status-pill ${status.toLowerCase()}">${status}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><div class="task-meta"><span>▦ ${esc(t.subject)}</span><span>◷ ${fmt(t.due)}</span></div><div class="task-meta"><span>${esc(t.year)} · ${esc(t.division)}</span></div><div class="task-actions">${actions}</div></article>`;
}
function renderDashboard(){
 const tasks=data.tasks||[],mine=data.deliveries.filter(d=>d.studentDni===dni);
 $("#stat-total").textContent=tasks.length;$("#stat-pending").textContent=isTeacher()?tasks.filter(t=>!expired(t)).length:tasks.filter(t=>!mine.some(d=>String(d.taskId)===String(t.id))&&!expired(t)).length;
 $("#stat-done").textContent=isTeacher()?data.deliveries.length:mine.length;$("#stat-subjects").textContent=new Set(tasks.map(t=>t.subject)).size;
 $("#stat-label-one").textContent=isTeacher()?"Actividades publicadas":"Actividades disponibles";$("#stat-label-two").textContent=isTeacher()?"Dentro del plazo":"Pendientes";$("#stat-label-three").textContent=isTeacher()?"Entregas recibidas":"Mis entregas";$("#side-count").textContent=tasks.length;
 $("#recent-list").innerHTML=tasks.slice(0,4).map(t=>`<div class="activity-item"><div class="activity-symbol">▤</div><div class="activity-info"><strong>${esc(t.title)}</strong><small>${esc(t.subject)} · ${esc(t.year)} · Límite: ${fmt(t.due)}</small></div><span class="status-pill ${taskStatus(t).toLowerCase()}">${taskStatus(t)}</span></div>`).join("")||'<div class="empty-state">Todavía no hay actividades publicadas.</div>';
}
function renderTasks(){
 const q=($("#search-task")?.value||"").toLowerCase(),subject=$("#filter-subject")?.value||"",status=$("#filter-status")?.value||"",subjects=[...new Set(data.tasks.map(t=>t.subject))];
 if($("#filter-subject"))$("#filter-subject").innerHTML='<option value="">Todas las materias</option>'+subjects.map(s=>`<option ${s===subject?"selected":""}>${esc(s)}</option>`).join("");
 const list=data.tasks.filter(t=>(!q||(t.title+" "+t.subject).toLowerCase().includes(q))&&(!subject||t.subject===subject)&&(!status||(status==="done"?taskStatus(t)==="Entregada":status==="late"?taskStatus(t)==="Vencida":taskStatus(t)==="Pendiente")));
 $("#task-list").innerHTML=list.map(taskCard).join("")||'<div class="empty-state">No hay actividades que coincidan con la búsqueda.</div>';
}
function renderDeliveries(){
 const items=isTeacher()?data.deliveries:data.deliveries.filter(d=>d.studentDni===dni);
 $("#delivery-heading").textContent=isTeacher()?"Entregas recibidas":"Mis entregas";
 $("#delivery-list").innerHTML=items.length?`<table><thead><tr><th>Alumno</th><th>Actividad</th><th>Fecha</th><th>Nota</th><th>Estado</th>${isTeacher()?"<th>Acción</th>":""}</tr></thead><tbody>${items.map(d=>`<tr><td>${esc(d.student)}</td><td>${esc(data.tasks.find(t=>String(t.id)===String(d.taskId))?.title||"Actividad")}</td><td>${fmt(d.sentAt)}</td><td>${d.grade==null?"Sin calificar":`<b class="grade">${esc(d.grade)}/10</b>`}${d.feedback?`<small class="feedback">${esc(d.feedback)}</small>`:""}</td><td><span class="status-pill entregada">${d.grade==null?"Entregada":"Calificada"}</span></td>${isTeacher()?`<td><button class="small-action gold-action" data-grade="${d.id}">Poner nota</button></td>`:""}</tr>`).join("")}</tbody></table>`:'<div class="empty-state">Todavía no hay entregas registradas.</div>';
}
function renderStudents(){$("#student-list").innerHTML=`<table><thead><tr><th>Alumno</th><th>DNI</th><th>Cuenta</th></tr></thead><tbody>${(data.students||[]).map(a=>`<tr><td>${esc(a.name)}</td><td>${esc(a.dni)}</td><td>Alumno</td></tr>`).join("")||'<tr><td colspan="3">Todavía no hay alumnos registrados.</td></tr>'}</tbody></table>`;}
function renderSubjects(){const subjects=[...new Set(data.tasks.map(t=>t.subject))];$("#subject-list").innerHTML=subjects.map(s=>`<article class="subject-card"><span>▦</span><h3>${esc(s)}</h3><p>${data.tasks.filter(t=>t.subject===s).length} actividades publicadas</p></article>`).join("")||'<div class="empty-state">Todavía no hay materias.</div>';}
function renderAttendance(){$("#attendance-list").innerHTML=`<table><thead><tr><th>Alumno</th><th>Asistencia</th></tr></thead><tbody>${(data.students||[]).map(a=>`<tr><td>${esc(a.name)}</td><td><select data-attendance="${esc(a.dni)}"><option>Presente</option><option>Ausente</option><option>Tarde</option></select></td></tr>`).join("")}</tbody></table>`;}
function renderCalendar(){$("#calendar-list").innerHTML=[...data.tasks].sort((a,b)=>new Date(a.due)-new Date(b.due)).map(t=>`<div class="activity-item"><div class="date-tile">${new Date(t.due).getDate()}<small>${new Date(t.due).toLocaleDateString("es-AR",{month:"short"})}</small></div><div class="activity-info"><strong>${esc(t.title)}</strong><small>${esc(t.subject)} · ${fmt(t.due)}</small></div><span class="status-pill ${taskStatus(t).toLowerCase()}">${taskStatus(t)}</span></div>`).join("")||'<div class="empty-state">No hay fechas cargadas.</div>';}
function renderGrades(){const rows=isTeacher()?data.deliveries:data.deliveries.filter(d=>d.studentDni===dni);$("#grades-list").innerHTML=rows.length?`<table><thead><tr><th>Actividad</th><th>${isTeacher()?"Alumno":"Materia"}</th><th>Nota</th><th>Devolución</th></tr></thead><tbody>${rows.map(d=>`<tr><td>${esc(data.tasks.find(t=>String(t.id)===String(d.taskId))?.title||"Actividad")}</td><td>${isTeacher()?esc(d.student):esc(data.tasks.find(t=>String(t.id)===String(d.taskId))?.subject||"")}</td><td>${d.grade==null?"Pendiente":`<b class="grade">${esc(d.grade)}/10</b>`}</td><td>${esc(d.feedback||"Sin devolución")}</td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">Todavía no hay calificaciones.</div>';}
function renderNotifications(){$("#notifications-list").innerHTML=data.notifications.map(n=>`<div class="activity-item"><div class="activity-symbol">♢</div><div class="activity-info"><strong>${esc(n.title)}</strong><small>${esc(n.detail)} · ${fmt(n.date)}</small></div></div>`).join("")||'<div class="empty-state">No tenés notificaciones.</div>';$("#notification-count").textContent=data.notifications.length;}
function renderView(v){({dashboard:renderDashboard,tasks:renderTasks,deliveries:renderDeliveries,students:renderStudents,subjects:renderSubjects,attendance:renderAttendance,calendar:renderCalendar,grades:renderGrades,notifications:renderNotifications}[v]||(()=>{}))();}
function render(){renderDashboard();renderTasks();renderDeliveries();renderStudents();renderSubjects();renderGrades();renderNotifications();}
async function startApp(){
 const session=await currentAccount();data=await getData();if(!session){$("#auth-modal")?.classList.remove("hidden");return;}
 setAccount(session);$("#auth-modal")?.classList.add("hidden");render();
}
async function init(){
 applyTheme(localStorage.getItem("ct_theme")||"light");
 $("#theme-toggle")?.addEventListener("click",()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
 $$(".auth-tab").forEach(b=>b.addEventListener("click",()=>switchAuth(b.dataset.authMode)));
 $("#auth-form")?.addEventListener("submit",authSubmit);
 $("#profile-switch")?.addEventListener("click",async()=>{try{await logoutAccount();location.reload();}catch(e){toast(e.message);}});
 const session=await currentAccount();data=await getData();switchAuth("login");
 if(!session)$("#auth-modal")?.classList.remove("hidden");else{setAccount(session);$("#auth-modal")?.classList.add("hidden");}
 $$(".nav-link[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
 $$("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
 $("#search-task")?.addEventListener("input",renderTasks);$("#filter-subject")?.addEventListener("change",renderTasks);$("#filter-status")?.addEventListener("change",renderTasks);
 $("#task-list")?.addEventListener("click",async e=>{const del=e.target.closest("[data-delete]"),deliver=e.target.closest("[data-deliver]");if(del){if(!isTeacher()){toast("Solo el profesor puede eliminar tareas.");return;}if(confirm("¿Eliminar esta tarea?")){await deleteTask(del.dataset.delete);data=await getData();render();toast("Tarea eliminada.");}}if(deliver){if(role!=="student"){toast("Solo el alumno puede entregar tareas.");return;}const task=data.tasks.find(t=>String(t.id)===String(deliver.dataset.deliver));if(!task||expired(task)){toast("El plazo terminó o la tarea no existe.");return;}if(data.deliveries.some(d=>String(d.taskId)===String(task.id)&&d.studentDni===dni)){toast("Ya entregaste esta tarea.");return;}await createDelivery({taskId:task.id,student:userName,studentDni:dni});data=await getData();render();toast("¡Tarea entregada!");}});
 $("#delivery-list")?.addEventListener("click",async e=>{const btn=e.target.closest("[data-grade]");if(!btn||!isTeacher())return;const delivery=data.deliveries.find(d=>String(d.id)===String(btn.dataset.grade));if(!delivery)return;const grade=prompt("Ingresá una nota de 1 a 10:");if(grade===null)return;const n=Number(grade);if(!Number.isFinite(n)||n<1||n>10){toast("La nota debe estar entre 1 y 10.");return;}const feedback=prompt("Devolución para el alumno (opcional):")||"";await gradeDelivery(delivery.id,n,feedback);data=await getData();render();toast("Calificación guardada.");});
 $("#attendance-list")?.addEventListener("change",async e=>{if(e.target.matches("[data-attendance]")){await saveAttendance(e.target.dataset.attendance,e.target.value);data=await getData();toast("Asistencia actualizada.");}});
 $("#create-form")?.addEventListener("submit",async e=>{e.preventDefault();if(!isTeacher()){toast("Solo el profesor puede crear tareas.");return;}const f=new FormData(e.currentTarget);await createTask(Object.fromEntries(f.entries()));location.href="index.html";});
 const editForm=$("#edit-form");if(editForm){if(!isTeacher()){toast("Solo el profesor puede editar tareas.");setTimeout(()=>location.href="index.html",700);return;}const id=new URLSearchParams(location.search).get("id"),task=await getTask(id);if(!task){toast("No se encontró la tarea.");return;}for(const [key,value] of Object.entries(task)){const field=editForm.elements.namedItem(key);if(field&&typeof value==="string")field.value=value;}editForm.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(editForm);await updateTask(id,Object.fromEntries(f.entries()));location.href="index.html";});}
 render();
}
init().catch(e=>{console.error(e);toast("No se pudo iniciar la aplicación.");});
