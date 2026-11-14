import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_LOCAL_DEMO } from "./config.js";

const STORAGE_KEY = "control_tarea_v2";
const ACCOUNTS_KEY = "ct_accounts";
const SESSION_KEY = "ct_session";
const initialData = {
  tasks: [
    {id:1,title:"Trabajo práctico: introducción a la programación",type:"Tarea",subject:"Programación",year:"5° año",division:"1° división",due:"2026-11-18T23:59",description:"Resolver las consignas vistas en clase y entregar el archivo con el código fuente.",created:new Date().toISOString()},
    {id:2,title:"Evaluación de funciones y gráficos",type:"Examen",subject:"Matemática",year:"5° año",division:"1° división",due:"2026-11-20T23:59",description:"Evaluación de los contenidos trabajados durante la unidad.",created:new Date().toISOString()},
    {id:3,title:"Lectura y análisis de texto",type:"Tarea",subject:"Lengua y Literatura",year:"5° año",division:"1° división",due:"2026-11-14T23:59",description:"Leer el material de estudio y responder las preguntas de comprensión.",created:new Date().toISOString()}
  ], deliveries: [], students: [], notifications: [], grades: [], attendance: []
};
let supabase = null;
let activeProfile = null;

async function client(){
  if(USE_LOCAL_DEMO) return null;
  if(!supabase){
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  }
  return supabase;
}
export const isSupabaseMode = () => !USE_LOCAL_DEMO;
export function getConfiguredSession(){
  if(USE_LOCAL_DEMO){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null")}catch{return null}}
  return activeProfile;
}
function readStore(){try{const saved=localStorage.getItem(STORAGE_KEY);return saved?{...structuredClone(initialData),...JSON.parse(saved)}:structuredClone(initialData)}catch{return structuredClone(initialData)}}
function writeStore(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return data}
function dniEmail(dni){return `${String(dni).replace(/\D/g,"")}@controldetarea.com`;}
function profileFrom(p){return p?{id:p.id,dni:p.dni,name:p.full_name,role:p.role,year:p.year,division:p.division}:null;}

export async function restoreSession(){
  if(USE_LOCAL_DEMO) return getConfiguredSession();
  const sb=await client();const {data:{session},error}=await sb.auth.getSession();
  if(error) throw error;
  if(!session){activeProfile=null;return null;}
  const {data,error:profileError}=await sb.from("profiles").select("id,dni,full_name,role,year,division").eq("id",session.user.id).single();
  if(profileError) throw profileError;
  activeProfile=profileFrom(data);return activeProfile;
}
export async function registerAccount({dni,name,password,role="student"}){
  dni=String(dni||"").replace(/\D/g,"");
  if(!/^\d{7,8}$/.test(dni)) throw new Error("El DNI debe tener 7 u 8 números.");
  if(!String(name||"").trim()) throw new Error("Ingresá tu nombre y apellido.");
  if(String(password||"").length<6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  if(USE_LOCAL_DEMO){
    const accounts=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"[]");
    if(accounts.some(a=>a.dni===dni)) throw new Error("Ya existe una cuenta con ese DNI.");
    const account={dni,password,name,role:"student"};accounts.push(account);localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
    const session={dni,name,role};localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;
  }
  const sb=await client();
  const {data,error}=await sb.auth.signUp({email:dniEmail(dni),password,options:{data:{dni,full_name:name,role:"student"}}});
  if(error) throw error;
  if(!data.session) throw new Error("La cuenta se creó, pero Supabase exige confirmar un correo que no se utiliza en este sistema. En Supabase desactivá Authentication → Sign In / Providers → Email → Confirm email y luego iniciá sesión.");
  const {data:profile,error:profileError}=await sb.from("profiles").select("id,dni,full_name,role,year,division").eq("id",data.user.id).single();
  if(profileError) throw profileError;
  activeProfile=profileFrom(profile);return activeProfile;
}
export async function loginAccount({dni,password}){
  dni=String(dni||"").replace(/\D/g,"");
  if(!/^\d{7,8}$/.test(dni)) throw new Error("Ingresá un DNI válido de 7 u 8 números.");
  if(USE_LOCAL_DEMO){
    const accounts=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"[]");const a=accounts.find(x=>x.dni===dni&&x.password===password);
    if(!a) throw new Error("DNI o contraseña incorrectos.");
    const session={dni:a.dni,name:a.name,role:a.role};localStorage.setItem(SESSION_KEY,JSON.stringify(session));return session;
  }
  const sb=await client();const {data,error}=await sb.auth.signInWithPassword({email:dniEmail(dni),password});
  if(error) throw new Error("DNI o contraseña incorrectos.");
  const {data:profile,error:profileError}=await sb.from("profiles").select("id,dni,full_name,role,year,division").eq("id",data.user.id).single();
  if(profileError) throw profileError;
  activeProfile=profileFrom(profile);return activeProfile;
}
export async function logoutAccount(){
  if(USE_LOCAL_DEMO){localStorage.removeItem(SESSION_KEY);return;}
  const sb=await client();const {error}=await sb.auth.signOut();if(error)throw error;activeProfile=null;
}
export async function getData(){
  if(USE_LOCAL_DEMO){const d=readStore();d.students=JSON.parse(localStorage.getItem(ACCOUNTS_KEY)||"[]").filter(a=>a.role==="student").map((a,i)=>({id:i+1,dni:a.dni,name:a.name}));return d;}
  const sb=await client();
  const teacherMode=activeProfile?.role==="teacher";
  const [tasksQ,deliveriesQ,studentsQ,attendanceQ]=await Promise.all([
    sb.from("tasks").select("*").order("created_at",{ascending:false}),
    sb.from("deliveries").select("*,profiles!deliveries_student_id_fkey(full_name,dni),tasks(title,subject)"),
    teacherMode?sb.from("profiles").select("id,dni,full_name,year,division").eq("role","student"):Promise.resolve({data:[],error:null}),
    teacherMode?sb.from("attendance").select("*").order("created_at",{ascending:false}):Promise.resolve({data:[],error:null})
  ]);
  for(const q of [tasksQ,deliveriesQ,studentsQ,attendanceQ])if(q.error)throw q.error;
  return {
    tasks:(tasksQ.data||[]).map(t=>({id:t.id,title:t.title,type:t.type,subject:t.subject,year:t.year,division:t.division,due:(()=>{const d=new Date(t.due_at);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)})(),description:t.description,created:t.created_at})),
    deliveries:(deliveriesQ.data||[]).map(d=>({id:d.id,taskId:d.task_id,student:d.profiles?.full_name||"Alumno",studentDni:d.profiles?.dni,sentAt:d.submitted_at,grade:d.grade,feedback:d.feedback})),
    students:(studentsQ.data||[]).map(s=>({id:s.id,dni:s.dni,name:s.full_name,year:s.year,division:s.division})),
    notifications:[],grades:[],attendance:(attendanceQ.data||[]).map(a=>({id:a.id,studentDni:a.student_dni,status:a.status,date:a.attendance_date}))
  };
}
export async function saveData(data){
  if(USE_LOCAL_DEMO)return writeStore(data);
  // La asistencia se guarda individualmente mediante saveAttendance.
  return data;
}
export async function getTask(id){return (await getData()).tasks.find(t=>String(t.id)===String(id))||null;}
export async function createTask(task){
  if(USE_LOCAL_DEMO){const d=readStore();const item={...task,id:Date.now(),created:new Date().toISOString()};d.tasks.unshift(item);writeStore(d);return item;}
  const sb=await client();const {data,error}=await sb.from("tasks").insert({title:task.title,type:task.type,subject:task.subject,year:task.year,division:task.division,due_at:new Date(task.due).toISOString(),description:task.description}).select().single();if(error)throw error;
  return {id:data.id,...task,created:data.created_at};
}
export async function updateTask(id,changes){
  if(USE_LOCAL_DEMO){const d=readStore(),i=d.tasks.findIndex(t=>String(t.id)===String(id));if(i<0)throw new Error("No se encontró la actividad.");d.tasks[i]={...d.tasks[i],...changes};writeStore(d);return d.tasks[i];}
  const sb=await client();const payload={title:changes.title,type:changes.type,subject:changes.subject,year:changes.year,division:changes.division,due_at:new Date(changes.due).toISOString(),description:changes.description};const {data,error}=await sb.from("tasks").update(payload).eq("id",id).select().single();if(error)throw error;return data;
}
export async function deleteTask(id){
  if(USE_LOCAL_DEMO){const d=readStore();d.tasks=d.tasks.filter(t=>String(t.id)!==String(id));writeStore(d);return true;}
  const sb=await client();const {error}=await sb.from("tasks").delete().eq("id",id);if(error)throw error;return true;
}
export async function createDelivery(delivery){
  if(USE_LOCAL_DEMO){const d=readStore(),item={...delivery,id:Date.now(),sentAt:new Date().toISOString()};d.deliveries.push(item);writeStore(d);return item;}
  const sb=await client();const {data,error}=await sb.from("deliveries").insert({task_id:delivery.taskId}).select().single();if(error)throw error;return {id:data.id,taskId:data.task_id,student:delivery.student,studentDni:delivery.studentDni,sentAt:data.submitted_at};
}
export async function gradeDelivery(id,grade,feedback=""){
  if(USE_LOCAL_DEMO){const d=readStore(),item=d.deliveries.find(x=>String(x.id)===String(id));if(!item)throw new Error("No se encontró la entrega.");item.grade=grade;item.feedback=feedback;item.gradedAt=new Date().toISOString();writeStore(d);return item;}
  const sb=await client();const {data,error}=await sb.from("deliveries").update({grade,feedback}).eq("id",id).select().single();if(error)throw error;return data;
}
export async function saveAttendance(studentDni,status){
  if(USE_LOCAL_DEMO){const d=readStore();d.attendance.push({studentDni,status,date:new Date().toISOString()});writeStore(d);return;}
  const sb=await client();const {data:student,error:lookupError}=await sb.from("profiles").select("id").eq("dni",studentDni).single();if(lookupError)throw lookupError;const {error}=await sb.from("attendance").insert({student_id:student.id,student_dni:studentDni,status});if(error)throw error;
}
export async function getApiStatus(){return USE_LOCAL_DEMO?{mode:"local",message:"Modo demostración: configurá Supabase para sincronizar datos."}:{mode:"supabase",message:"Conectado a Supabase."};}
