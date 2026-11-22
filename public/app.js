let state={employees:[],brands:[],processes:[],assignments:[],holidays:[],lastRoster:null};

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
async function api(url,opt){const r=await fetch(url,opt); if(!r.ok){const e=await r.json().catch(()=>({error:"Request failed"}));throw Error(e.error||"Request failed")} return r.json();}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function monthValue(){return new Date().toISOString().slice(0,7)}
function splitMonth(v){const [y,m]=v.split("-").map(Number);return {year:y,month:m-1}}
function go(page){$$(".page").forEach(x=>x.classList.remove("active"));$(`#${page}`).classList.add("active");$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));$("#pageTitle").textContent=page==="dashboard"?"Dashboard":document.querySelector(`[data-page="${page}"]`).textContent; if(page==="employees")loadEmployees(); if(page==="assignments")loadAssignments(); if(page==="rules")loadRules(); if(page==="coverage")loadCoverage(); if(page==="roster" && !state.lastRoster)generateRoster();}
$$(".nav").forEach(b=>b.onclick=()=>go(b.dataset.page));

async function init(){
  $("#dashMonth").value=monthValue();$("#rosterMonth").value=monthValue();$("#coverageMonth").value=monthValue();
  const [sum,employees,brands,processes,assignments,holidays]=await Promise.all([
    api("/api/summary"),api("/api/employees"),api("/api/brands"),api("/api/processes"),api("/api/assignments"),api("/api/holidays")
  ]);
  state={...state,employees,brands,processes,assignments,holidays};
  $("#summaryCards").innerHTML=[
    ["Active employees",sum.employees,"Roster resources"],
    ["Brands",sum.brands,"Client accounts"],
    ["Processes",sum.processes,"Coverage units"],
    ["Pods",sum.pods,"Operational teams"]
  ].map(c=>`<div class="card"><div class="label">${c[0]}</div><div class="value">${c[1]}</div><div class="sub">${c[2]}</div></div>`).join("");
}
async function generateRoster(){
  const val=$("#roster").classList.contains("active")?$("#rosterMonth").value:$("#dashMonth").value;
  const {year,month}=splitMonth(val);
  const data=await api("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({year,month})});
  state.lastRoster=data; renderRoster(data); renderConflictSummary(data.conflicts); toast("Roster generated and validated");
  if(!$("#roster").classList.contains("active")) go("roster");
}
function renderRoster(data){
  const days=[...new Set(data.roster.map(x=>x.date))];
  const byEmp={};data.roster.forEach(x=>(byEmp[x.employee_id]??=[]).push(x));
  $("#rosterMeta").innerHTML=`<div class="card" style="margin-bottom:16px;padding:13px"><span class="muted">Month:</span> <b>${new Date(data.year,data.month,1).toLocaleString("en-IN",{month:"long",year:"numeric"})}</b> &nbsp; · &nbsp; <span class="muted">Critical conflicts:</span> <b style="color:${data.conflicts.filter(x=>x.severity==="CRITICAL").length?"#d43b45":"#16865a"}">${data.conflicts.filter(x=>x.severity==="CRITICAL").length}</b></div>`;
  let h="<thead><tr><th>Employee</th><th>Pod</th>"+days.map(d=>`<th>${new Date(d).getDate()} ${new Date(d).toLocaleString("en-IN",{weekday:"short"})}</th>`).join("")+"</tr></thead><tbody>";
  for(const e of state.employees){const row=byEmp[e.id]||[];h+=`<tr><td><b>${e.name}</b><br><span class="muted">${e.weekly_off} off</span></td><td>${e.pod_name}</td>`+row.map(x=>`<td><span class="pill ${x.status==="WORK"?"work":"off"}">${x.status}</span></td>`).join("")+"</tr>"}
  $("#rosterTable").innerHTML=h+"</tbody>";
}
function renderConflictSummary(conflicts){
  const crit=conflicts.filter(x=>x.severity==="CRITICAL").length,warn=conflicts.filter(x=>x.severity==="WARNING").length;
  $("#conflictStats").innerHTML=[["Critical gaps",crit,"Must resolve"],["Review warnings",warn,"Manager review"],["Total issues",conflicts.length,"Before publish"]].map(c=>`<div class="card"><div class="label">${c[0]}</div><div class="value">${c[1]}</div><div class="sub">${c[2]}</div></div>`).join("");
  $("#conflicts").innerHTML=conflicts.length?conflicts.map(c=>`<div class="issue ${c.severity==="CRITICAL"?"crit":"warn"}"><div class="icon">${c.severity==="CRITICAL"?"!":"i"}</div><div><h4>${c.type} · ${c.date||"Configuration review"}</h4><p><b>${c.brand}</b> / ${c.process} — ${c.message}</p></div></div>`).join(""):`<div class="empty">No conflicts found for this roster period.</div>`;
}
async function loadCoverage(){
  const {year,month}=splitMonth($("#coverageMonth").value);
  const data=await api(`/api/brand-coverage?year=${year}&month=${month}`);
  const gaps=data.filter(x=>!x.ok);
  const summary=[["Coverage checks",data.length,"Required process/day combinations"],["Coverage gaps",gaps.length,"Need action"],["Coverage rate",data.length?Math.round(data.filter(x=>x.ok).length/data.length*100):100,"% satisfied"]];
  $("#conflictStats").innerHTML=summary.map(c=>`<div class="card"><div class="label">${c[0]}</div><div class="value">${c[1]}</div><div class="sub">${c[2]}</div></div>`).join("");
  $("#conflicts").innerHTML=gaps.length?gaps.slice(0,100).map(x=>`<div class="issue crit"><div class="icon">!</div><div><h4>${x.date} · ${x.brand} · ${x.process}</h4><p>Required <b>${x.required}</b> resource(s), available <b>${x.available}</b>.</p></div></div>`).join(""):`<div class="empty">All required coverage checks are satisfied.</div>`;
}
async function loadEmployees(){
 const e=state.employees.length?state.employees:await api("/api/employees");
 $("#employeesTable").innerHTML=`<thead><tr><th>ID</th><th>Employee</th><th>Email</th><th>Pod</th><th>Weekly off</th><th>Skills</th></tr></thead><tbody>${e.map(x=>`<tr><td>${x.id}</td><td><b>${x.name}</b></td><td>${x.email}</td><td>${x.pod_name}</td><td><span class="pill off">${x.weekly_off}</span></td><td>${x.skills}</td></tr>`).join("")}</tbody>`;
}
function populateAssignmentForm(){
 $("#aEmployee").innerHTML=state.employees.map(x=>`<option value="${x.id}">${x.name} — ${x.pod_name}</option>`).join("");
 $("#aBrand").innerHTML=state.brands.map(x=>`<option value="${x.id}">${x.name}</option>`).join("");
 updateProcesses();
}
$("#aBrand")?.addEventListener("change",updateProcesses);
function updateProcesses(){const b=Number($("#aBrand").value);$("#aProcess").innerHTML=state.processes.filter(x=>x.brand_id===b).map(x=>`<option value="${x.id}">${x.name}</option>`).join("")}
async function loadAssignments(){
 state.assignments=await api("/api/assignments");populateAssignmentForm();
 $("#assignmentsTable").innerHTML=`<thead><tr><th>Employee</th><th>Brand</th><th>Process</th><th>Action</th></tr></thead><tbody>${state.assignments.map(x=>`<tr><td>${x.employee_name}</td><td>${x.brand_name}</td><td>${x.process_name}</td><td><button class="btn danger small" onclick="removeAssignment(${x.id})">Remove</button></td></tr>`).join("")}</tbody>`;
}
async function addAssignment(){
 try{await api("/api/assignments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({employee_id:Number($("#aEmployee").value),brand_id:Number($("#aBrand").value),process_id:Number($("#aProcess").value)})});toast("Assignment added");loadAssignments()}catch(e){toast(e.message)}
}
async function removeAssignment(id){if(!confirm("Remove this assignment?"))return;await api(`/api/assignments/${id}`,{method:"DELETE"});toast("Assignment removed");loadAssignments()}
async function loadRules(){
 $("#brandsRules").innerHTML=state.brands.map(b=>`<div class="rule"><div><b>${b.name}</b><br><span>${b.pod_name}</span></div><span>${b.calendar==="365"?"365 DAYS":b.calendar==="SUN_OFF"?"SUNDAYS + HOLIDAYS OFF":"DAILY · HOLIDAYS OFF"}</span></div>`).join("");
 $("#holidays").innerHTML=state.holidays.map(h=>`<div class="rule"><div><b>${h.name}</b></div><span>${h.date}</span></div>`).join("");
}
function downloadCSV(){
 if(!state.lastRoster){toast("Generate a roster first");return}
 const rows=[["Date","Employee","Status"],...state.lastRoster.roster.map(x=>[x.date,x.employee_name,x.status])];
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="smart-roster.csv";a.click();
}
function showHelp(){$("#help").classList.remove("hidden")}function hideHelp(){$("#help").classList.add("hidden")}
init().catch(e=>toast(e.message));