// Cloudflare Pages Function — /api/agent "Agent Mode Clinqoo" (SELF-CONTAINED)
// Agent AI mandiri: satu tujuan besar dieksekusi jadi langkah-langkah kecil
// SECARA OTOMATIS tanpa konfirmasi per langkah — seperti agen di platform builder.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function onRequestOptions() { return new Response(null, { status: 200, headers: CORS }); }

const RATE_LIMIT = { max: 10, windowMs: 60_000 };
const rateBuckets = new Map();
function rateLimitOk(ip) {
  const now = Date.now(); let b = rateBuckets.get(ip);
  if (!b || now - b.start >= RATE_LIMIT.windowMs) b = { start: now, count: 0 };
  b.count++; rateBuckets.set(ip, b);
  if (rateBuckets.size > 5000) for (const [k, v] of rateBuckets) if (now - v.start >= RATE_LIMIT.windowMs) rateBuckets.delete(k);
  return b.count <= RATE_LIMIT.max;
}
function clientIp(request) { try { return (request?.headers?.get('cf-connecting-ip')) || 'unknown'; } catch { return 'unknown'; } }

const ADMIN_EMAILS = new Set(['muzawwied@gmail.com']);
const DAILY_LIMIT = 25;
const ADMIN_DAILY_LIMIT = 500;
const QUOTA_MSG = 'Kuota AI Clinqoo hari ini sudah habis. Kuota reset otomatis setiap hari — silakan coba lagi besok.';
const MAX_PLAN_STEPS = 12;
const MAX_TRANSCRIPT = 40;
const DEFAULT_BUDGET_MS = 50_000;
const MAX_BUDGET_MS = 90_000;

const WORKERS_AI_MODELS = ['@cf/zai-org/glm-5.2', '@cf/deepseek-ai/deepseek-v4-flash-0731', '@cf/zai-org/glm-4.7-flash'];
const OPENROUTER_MODELS = ['nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3.5-lightning:free', 'openrouter/free'];
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3-flash-preview'];

// Personality + depth: simple requests stay fast; complex work gets substantive output.
const PLANNER_SYSTEM = `Kamu adalah STRATEGIST senior untuk Clinqoo Super Agent, platform pembuatan website dengan AI.
Kepribadian: tenang, proaktif, teliti, percaya diri tetapi jujur. Berpikir seperti technical lead yang bertanggung jawab atas hasil akhir, bukan sekadar chatbot.
Tugasmu: pecah TUJUAN user menjadi langkah eksekusi yang terurut, bernilai, dan konkret.
Untuk tujuan sederhana gunakan beberapa langkah yang cukup; untuk proyek kompleks gunakan discovery, arsitektur, implementasi, validasi, dan finalisasi bila relevan.
Balas HANYA JSON valid tanpa teks lain, format:
{"steps":[{"title":"judul langkah singkat (bahasa Indonesia)","detail":"apa yang dikerjakan, hasil yang diharapkan, dan kriteria keberhasilan"}]}
Aturan: maksimal 12 langkah; hindari langkah kosong/redundan; setiap langkah harus menghasilkan kemajuan nyata; jangan mengarang akses, data, file, sumber, atau aksi eksternal. Bahasa Indonesia.`;

const AGENT_SYSTEM = `Kamu adalah "Clinqoo Super Agent" — technical lead + researcher + builder + reviewer dalam satu agen.
PERSONALITY: proaktif, tajam, teliti, tenang, solutif, dan bertanggung jawab. Jangan terdengar seperti bot yang buru-buru. Ambil keputusan yang masuk akal tanpa bertanya balik jika informasi sudah cukup; nyatakan asumsi penting secara singkat.

DEPTH POLICY:
- Pertanyaan ringan/sederhana: jawab langsung dan padat.
- Coding, proyek, debugging, arsitektur, riset, atau keputusan teknis: jawab substantif dan terstruktur. Sertakan hasil, alasan teknis yang relevan, trade-off penting, risiko, dan cara verifikasi bila relevan.
- Jangan menambah panjang dengan pengulangan, basa-basi, atau teori yang tidak membantu. Prioritaskan kualitas hasil daripada banyak teks.

EXECUTION POLICY:
- Kerjakan langkah aktif sampai tuntas dengan konteks tujuan dan langkah sebelumnya.
- Jika menghasilkan kode/konten, buat versi final siap pakai, bukan placeholder.
- Untuk coding, periksa integrasi, edge case, keamanan dasar, dan kompatibilitas sebelum menyatakan selesai.
- Untuk analisis, bedakan fakta yang tersedia, asumsi, dan rekomendasi teknis.
- Lakukan self-review sebelum jawaban: apakah langkah ini benar-benar selesai, konsisten dengan tujuan, dan dapat diverifikasi?
- Jangan mengklaim telah mengubah file, deploy, browsing, memanggil tool, atau melakukan aksi eksternal jika memang tidak dilakukan.
- Jangan tampilkan chain-of-thought/proses berpikir internal. Tampilkan hanya alasan atau keputusan yang relevan bagi user.
- Bahasa Indonesia natural, profesional, hangat, dan jelas.`;

async function ensureTable(DB) {
  try { await DB.prepare('ALTER TABLE agent_tasks ADD COLUMN wa_number TEXT').run(); } catch (e) {}
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agent_tasks (id TEXT PRIMARY KEY,user_key TEXT,project_id TEXT,goal TEXT,status TEXT,plan TEXT,transcript TEXT,current_step INTEGER DEFAULT 0,result TEXT,error TEXT,created_at TEXT,updated_at TEXT)`).run();
  await DB.prepare('CREATE TABLE IF NOT EXISTS agent_events (id INTEGER PRIMARY KEY AUTOINCREMENT,task_id TEXT,user_key TEXT,kind TEXT,text TEXT,created_at TEXT)').run();
}
async function addEvent(DB, task_id, user_key, kind, text) { try { await DB.prepare('INSERT INTO agent_events (task_id,user_key,kind,text,created_at) VALUES (?,?,?,?,?)').bind(task_id,user_key,kind,String(text||'').slice(0,500),new Date().toISOString()).run(); } catch (e) {} }
async function loadTask(DB,id) { const row=await DB.prepare('SELECT * FROM agent_tasks WHERE id = ?').bind(id).first(); return row||null; }
async function saveTask(DB,t) { await DB.prepare('UPDATE agent_tasks SET status=?,plan=?,transcript=?,current_step=?,result=?,error=?,updated_at=? WHERE id=?').bind(t.status,t.plan,t.transcript,t.current_step,t.result,t.error,new Date().toISOString(),t.id).run(); }
function safeJson(s,fb) { try { const v=JSON.parse(s); return v??fb; } catch { return fb; } }
function taskJson(t) { return {id:t.id,project_id:t.project_id,goal:t.goal,status:t.status,plan:safeJson(t.plan,[]),transcript_len:safeJson(t.transcript,[]).length,current_step:t.current_step,result:t.result,error:t.error,created_at:t.created_at,updated_at:t.updated_at}; }

async function resolveUser(env,request) {
  try { const {initTables,getUserByToken,getToken}=await import('./auth/shared.js'); await initTables(env.DB); const token=getToken(request); if(!token)return null; const u=await getUserByToken(env.DB,token); if(u)return {key:'u'+u.id,email:String(u.email||'').toLowerCase()}; } catch {}
  return null;
}
async function quotaSpend(env,user,cost) {
  const day=new Date().toISOString().slice(0,10), limit=ADMIN_EMAILS.has(user.email)?ADMIN_DAILY_LIMIT:DAILY_LIMIT;
  try { await env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_quota (user_key TEXT,day TEXT,count INTEGER,PRIMARY KEY (user_key,day))').run(); const row=await env.DB.prepare('SELECT count FROM ai_quota WHERE user_key=? AND day=?').bind(user.key,day).first(); if(((row?row.count:0)+cost)>limit)return {exceeded:true}; await env.DB.prepare('INSERT INTO ai_quota (user_key,day,count) VALUES (?,?,?) ON CONFLICT(user_key,day) DO UPDATE SET count=count+?').bind(user.key,day,cost,cost).run(); return {exceeded:false}; } catch { return {exceeded:false}; }
}
async function getEnvKey(env,name) { if(env[name])return env[name]; if(!env.DB)return null; try { const row=await env.DB.prepare('SELECT value FROM env_vars WHERE key=?').bind(name).first(); return row?.value||null; } catch { return null; } }

async function aiCall(env,messages,orKey,gemKey) {
  // Give complex agent steps enough output headroom so useful details are not cut off.
  if(env.AI) for(const model of WORKERS_AI_MODELS) for(let tryN=1;tryN<=2;tryN++) {
    try { const result=await env.AI.run(model,{messages,max_tokens:4096}); const raw=(result&&(result.response||(typeof result==='string'?result:'')))||''; const text=raw||(result&&result.choices?.[0]?.message?.content)||''; if(text)return {text,model}; } catch {}
  }
  if(orKey) for(const model of OPENROUTER_MODELS) {
    try { const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+orKey},body:JSON.stringify({model,messages,max_tokens:4096,temperature:0.35})}); const data=await res.json().catch(()=>({})); const text=res.ok?(data?.choices?.[0]?.message?.content||''):''; if(text)return {text,model}; } catch {}
  }
  if(gemKey) for(const model of GEMINI_MODELS) {
    try { const sys=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'); const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})); const body={contents,generationConfig:{maxOutputTokens:4096,temperature:0.35}}; if(sys)body.systemInstruction={parts:[{text:sys}]}; const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':gemKey},body:JSON.stringify(body)}); const data=await res.json().catch(()=>({})); const text=res.ok?((data?.candidates?.[0]?.content?.parts)||[]).map(p=>p.text||'').join(''):''; if(text)return {text,model}; } catch {}
  }
  return {error:'Semua provider AI gagal'};
}

function parsePlan(text) {
  try { let s=String(text).replace(/```json/gi,'```').replace(/```/g,'').trim(); const a=s.indexOf('{'),b=s.lastIndexOf('}'); if(a!==-1&&b>a)s=s.slice(a,b+1); const obj=JSON.parse(s); const steps=Array.isArray(obj.steps)?obj.steps:(Array.isArray(obj)?obj:[]); const clean=steps.filter(x=>x&&x.title).slice(0,MAX_PLAN_STEPS).map(x=>({title:String(x.title),detail:String(x.detail||''),done:false})); if(clean.length)return clean; } catch {}
  return null;
}

async function agentTick(env,t,budgetMs,orKey,gemKey) {
  const deadline=Date.now()+budgetMs; let plan=safeJson(t.plan,[]), transcript=safeJson(t.transcript,[]);
  if(!plan.length) {
    const r=await aiCall(env,[{role:'system',content:PLANNER_SYSTEM},{role:'user',content:'TUJUAN USER:\n'+t.goal+'\n\nBuat rencana yang proporsional terhadap kompleksitas tujuan. Jangan menambah langkah hanya agar terlihat pintar.'}],orKey,gemKey);
    if(r.error){t.status='paused';t.error='Gagal menyusun rencana: '+r.error;await saveTask(env.DB,t);return t;}
    plan=parsePlan(r.text)||[{title:'Kerjakan tujuan langsung',detail:t.goal,done:false}]; t.plan=JSON.stringify(plan); t.status='running'; t.error=null; await saveTask(env.DB,t); addEvent(env.DB,t.id,t.user_key,'start','Tugas dimulai — '+plan.length+' langkah direncanakan.');
  }
  while(t.current_step<plan.length) {
    if(Date.now()>deadline){t.status='paused';t.error='Budget waktu tercapai — task siap di-resume otomatis dari langkah '+(t.current_step+1)+'.';await saveTask(env.DB,t);addEvent(env.DB,t.id,t.user_key,'paused',t.error);return t;}
    const step=plan[t.current_step];
    const msgs=[{role:'system',content:AGENT_SYSTEM},{role:'user',content:'TUJUAN: '+t.goal+'\n\nRENCANA:\n'+plan.map((p,i)=>(i+1)+'. '+p.title+(p.done?' (selesai)':'')).join('\n')+'\n\nLANGKAH SEKARANG ('+(t.current_step+1)+'/'+plan.length+'): '+step.title+(step.detail?'\n'+step.detail:'')+(transcript.length?'\n\nKONTEKS KERJA SEBELUMNYA:\n'+transcript.slice(-6).map(m=>(m.role==='user'?'[user] ':'[agent] ')+String(m.content).slice(0,700)).join('\n'):'')}];
    const r=await aiCall(env,msgs,orKey,gemKey); if(r.error){t.status='paused';t.error='Provider AI tidak tersedia: '+r.error;await saveTask(env.DB,t);addEvent(env.DB,t.id,t.user_key,'paused',t.error);return t;}
    transcript.push({role:'user',content:step.title+(step.detail?' — '+step.detail:'')}); transcript.push({role:'assistant',content:r.text}); if(transcript.length>MAX_TRANSCRIPT)transcript=transcript.slice(-MAX_TRANSCRIPT); plan[t.current_step].done=true; t.current_step++; t.plan=JSON.stringify(plan); t.transcript=JSON.stringify(transcript); t.status='running'; t.error=null; await saveTask(env.DB,t); addEvent(env.DB,t.id,t.user_key,'progress','Langkah '+t.current_step+'/'+plan.length+' selesai: '+step.title);
  }
  const doneMsgs=[{role:'system',content:AGENT_SYSTEM},{role:'user',content:'TUJUAN: '+t.goal+'\n\nHASIL KERJA PER LANGKAH:\n'+transcript.map(m=>(m.role==='assistant'?'[agent] ':'[user] ')+String(m.content).slice(0,900)).join('\n')+'\n\nFINALISASI UNTUK USER:\nBuat jawaban final yang substantif namun efisien. Wajib mencakup: (1) apa yang benar-benar selesai, (2) detail/keputusan teknis penting, (3) hasil atau artefak yang tersedia, (4) validasi/check yang dilakukan atau masih perlu dilakukan, dan (5) keterbatasan/asumsi bila ada. Gunakan heading/bullet bila membantu. Jangan mengarang aksi dan jangan tampilkan chain-of-thought.'}];
  const rf=await aiCall(env,doneMsgs,orKey,gemKey); t.result=rf.text||rf.error||'(rangkuman dilewati)'; t.status='done'; t.error=null; await saveTask(env.DB,t); addEvent(env.DB,t.id,t.user_key,'done','Tugas selesai. '+String(t.result||'').slice(0,300)); return t;
}

function json(obj,status){return new Response(JSON.stringify(obj),{status:status||200,headers:{'Content-Type':'application/json',...CORS}});}

export async function onRequestGet({request,env}) {
  if(!rateLimitOk(clientIp(request)))return json({error:'Terlalu banyak permintaan.'},429); const user=await resolveUser(env,request); if(!user)return json({error:'Login diperlukan',need_login:true},401); const id=new URL(request.url).searchParams.get('task_id')||''; if(!id)return json({error:'task_id wajib'},400);
  try { await ensureTable(env.DB); const t=await loadTask(env.DB,id); if(!t||t.user_key!==user.key)return json({error:'Task tidak ditemukan'},404); const ev=await env.DB.prepare('SELECT kind,text,created_at FROM agent_events WHERE task_id=? AND user_key=? ORDER BY id ASC LIMIT 100').bind(id,user.key).all(); return json({ok:true,task:taskJson(t),events:ev.results||[]}); } catch(e){return json({error:'Server error: '+e.message},500);}
}

export async function onRequestPost({request,env}) {
  if(!rateLimitOk(clientIp(request)))return json({error:'Terlalu banyak permintaan.'},429); const user=await resolveUser(env,request); if(!user)return json({error:'Login diperlukan',need_login:true},401);
  let body=null; try{body=await request.json();}catch{return json({error:'Body JSON tidak valid'},400);} const action=body?.action||'start';
  try {
    await ensureTable(env.DB);
    if(action==='status'){const t=await loadTask(env.DB,body.task_id||'');if(!t||t.user_key!==user.key)return json({error:'Task tidak ditemukan'},404);return json({ok:true,task:taskJson(t)});}
    if(action==='resume'){const t=await loadTask(env.DB,body.task_id||'');if(!t||t.user_key!==user.key)return json({error:'Task tidak ditemukan'},404);if(t.status==='done')return json({ok:true,task:taskJson(t),message:'Task sudah selesai.'});const q=await quotaSpend(env,user,1);if(q.exceeded)return json({quota_exhausted:true,error:QUOTA_MSG},429);const orKey=await getEnvKey(env,'OPENROUTER_API_KEY');const gemKey=await getEnvKey(env,'GEMINI_API_KEY');const budget=Math.min(parseInt(body.budget_seconds||'',10)*1000||DEFAULT_BUDGET_MS,MAX_BUDGET_MS);const done=await agentTick(env,t,budget,orKey,gemKey);return json({ok:true,task:taskJson(done)});}
    if(action==='start_bg'){const goal=String(body?.goal||'').trim();if(goal.length<3)return json({error:'Tulis tujuan tugas (minimal 3 karakter).'},400);const q=await quotaSpend(env,user,1);if(q.exceeded)return json({quota_exhausted:true,error:QUOTA_MSG},429);const now=new Date().toISOString();const t={id:'agt_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),user_key:user.key,project_id:String(body?.project_id||'')||null,goal,status:'queued',plan:'[]',transcript:'[]',current_step:0,result:null,error:null,wa_number:String(body?.wa_number||'').replace(/[^0-9+]/g,'')||null,created_at:now,updated_at:now};await env.DB.prepare('INSERT INTO agent_tasks (id,user_key,project_id,goal,status,plan,transcript,current_step,result,error,wa_number,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(t.id,t.user_key,t.project_id,t.goal,t.status,t.plan,t.transcript,t.current_step,t.result,t.error,t.wa_number,t.created_at,t.updated_at).run();addEvent(env.DB,t.id,t.user_key,'queued','Tugas masuk antrean — Clinqoo Agent Worker menjalankannya di latar belakang.');return json({ok:true,task:taskJson(t),background:true,message:'Tugas masuk antrean. Pantau progres via GET /api/agent?task_id='+t.id});}
    const goal=String(body?.goal||'').trim();if(goal.length<3)return json({error:'Tulis tujuan tugas (minimal 3 karakter).'},400);const q=await quotaSpend(env,user,1);if(q.exceeded)return json({quota_exhausted:true,error:QUOTA_MSG},429);const now=new Date().toISOString();const t={id:'agt_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),user_key:user.key,project_id:String(body?.project_id||'')||null,goal,status:'running',plan:'[]',transcript:'[]',current_step:0,result:null,error:null,created_at:now,updated_at:now};await env.DB.prepare('INSERT INTO agent_tasks (id,user_key,project_id,goal,status,plan,transcript,current_step,result,error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(t.id,t.user_key,t.project_id,t.goal,t.status,t.plan,t.transcript,t.current_step,t.result,t.error,t.created_at,t.updated_at).run();const orKey=await getEnvKey(env,'OPENROUTER_API_KEY');const gemKey=await getEnvKey(env,'GEMINI_API_KEY');const budget=Math.min(parseInt(body?.budget_seconds||'',10)*1000||DEFAULT_BUDGET_MS,MAX_BUDGET_MS);const done=await agentTick(env,t,budget,orKey,gemKey);return json({ok:true,task:taskJson(done)});
  } catch(e){return json({error:'Server error: '+e.message},500);}
}
