import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import {SUPABASE_URL,SUPABASE_ANON_KEY} from "./config.js";

(function(){


const PROGRAMS=["QMS","EMS","OHSMS","HRMP","ISMS","FSMS","TPM","Lean","5S","Six Sigma","BSC"];
const DOC_TYPES=[
  {key:"qa",abbr:"QA",label:"Dokumen QA",hint:"Laporan QA, checklist audit"},
  {key:"app",abbr:"AL",label:"Appreciation letter",hint:"Surat apresiasi dari klien"},
  {key:"testi",abbr:"TS",label:"Testimoni",hint:"Video lewat link Google Drive, surat atau foto lewat upload"}
];
const ACCEPT={"application/pdf":"PDF","image/jpeg":"JPG","image/png":"PNG","image/webp":"WEBP","video/mp4":"MP4","video/webm":"WEBM"};
function driveId(u){try{const x=new URL(u);if(!/(^|\.)google\.com$/.test(x.hostname))return null;const m=x.pathname.match(/\/d\/([\w-]{10,})/);return m?m[1]:x.searchParams.get("id")}catch(e){return null}}
function cleanProgram(v){return String(v||"").replace(/\s+/g," ").trim()}
function canonProgram(v,pool){const t=cleanProgram(v);if(!t)return"";const k=t.toLowerCase();return pool.find(p=>cleanProgram(p).toLowerCase()===k)||t}
function programPool(){return[...PROGRAMS,...S.rows.map(r=>r.program).filter(Boolean)]}
const EXT_TYPE={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",mp4:"video/mp4",webm:"video/webm"};
const $=s=>document.querySelector(s);
const SVGNS="http://www.w3.org/2000/svg";
const el=(tag,attrs,...kids)=>{const n=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(v==null||v===false)continue;if(k==="class")n.className=v;else if(k==="text")n.textContent=v;else if(k.startsWith("on"))n.addEventListener(k.slice(2),v);else n.setAttribute(k,v===true?"":v)}for(const c of kids.flat()){if(c==null||c===false)continue;n.append(c.nodeType?c:document.createTextNode(String(c)))}return n};
const sv=(tag,attrs,...kids)=>{const n=document.createElementNS(SVGNS,tag);if(attrs)for(const k in attrs){if(attrs[k]!=null)n.setAttribute(k,attrs[k])}for(const c of kids.flat()){if(c==null)continue;n.append(c.nodeType?c:document.createTextNode(String(c)))}return n};
const ICON={arrow:'<svg class="i" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>'};
const arrowBtn=(label,fn)=>{const b=el("button",{class:"arrow",type:"button","aria-label":label,title:label,onclick:fn});b.innerHTML=ICON.arrow;return b};

const S={mode:"loading",rows:[],db:null,assets:null,canWrite:false,sort:{k:"selesai",d:1},tab:"late",fQ:"",fProgram:"",fStatus:"",fYear:"",editing:null,progMetric:"capai"};
let col=null;

function todayISO(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
const TODAY=todayISO();
function daysBetween(a,b){return Math.round((Date.parse(b+"T00:00:00")-Date.parse(a+"T00:00:00"))/864e5)}
function fmtDate(iso){if(!iso)return"";const d=new Date(iso+"T00:00:00");return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}
function fmtSize(b){if(!b&&b!==0)return"";if(b<1024*1024)return Math.max(1,Math.round(b/1024))+" KB";return(b/1048576).toFixed(1).replace(".",",")+" MB"}
function fmtPct(v){return v==null||v===""?"–":(Math.round(v*10)/10).toString().replace(".",",")}
function num(v){return typeof v==="number"&&isFinite(v)?v:null}
function fmtRp(v){if(v==null)return"–";const a=Math.abs(v);const f=(x,u)=>"Rp "+x.toLocaleString("id-ID",{maximumFractionDigits:x<10?2:1})+" "+u;if(a>=1e12)return f(v/1e12,"T");if(a>=1e9)return f(v/1e9,"M");if(a>=1e6)return f(v/1e6,"jt");return"Rp "+Math.round(v).toLocaleString("id-ID")}
function fmtRpFull(v){return v==null?"":"Rp "+Math.round(v).toLocaleString("id-ID")}
function parseRp(s){const d=String(s).replace(/[^0-9]/g,"");return d?Number(d):null}
function sumBy(rows,k){return rows.reduce((t,r)=>t+(num(r[k])||0),0)}
function capai(r){const t=num(r.targetRp);if(!t||t<=0)return null;return(num(r.realisasiRp)||0)/t*100}
function valueAt(r,endISO){let best=null;for(const h of r.riwayat||[]){if((h.tgl||"")<=endISO&&(!best||h.tgl>best.tgl||(h.tgl===best.tgl&&(h.dicatat||"")>(best.dicatat||""))))best=h}return best?num(best.nilai)||0:0}
function finished(r){return!!r.tglSelesaiAktual}
function status(r){if(r.tglSelesaiAktual)return lateDays(r)>0?"late":"done";if(r.selesai&&r.selesai<TODAY)return"late";return"progress"}
function pillText(r){const st=status(r);return st==="late"?"Telat "+lateDays(r)+" hari":STATUS_LABEL[st]}
const STATUS_LABEL={progress:"On progress",late:"Late",done:"Selesai"};
function lateDays(r){if(!r.selesai)return 0;return Math.max(0,daysBetween(r.selesai,r.tglSelesaiAktual||TODAY))}
function finishNote(r){if(!r.tglSelesaiAktual)return"";const d=lateDays(r);return d>0?"Telat "+d+" hari":"Tepat waktu"}
function dueNote(r){if(finished(r))return"Selesai "+fmtDate(r.tglSelesaiAktual)+(lateDays(r)>0?"":" · Tepat waktu");if(!r.selesai)return"Jadwal belum diisi";const d=daysBetween(TODAY,r.selesai);if(d<0)return"Belum selesai";return d===0?"Jatuh tempo hari ini":d+" hari lagi"}
function people(r){return[r.pm&&("PM "+r.pm),r.pic&&("PIC "+r.pic)].filter(Boolean).join(" · ")}
function docsOf(r){const d=r.dokumen||{};return{qa:d.qa||[],app:d.app||[],testi:d.testi||[]}}
function docsComplete(r){const d=docsOf(r);return d.qa.length>0&&d.app.length>0&&d.testi.length>0}
function band(v,good,warn){if(v==null)return"";return v>=good?"good":v>=warn?"warn":"bad"}
function avg(a){const v=a.filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function months(n){const out=[];const t=new Date();for(let i=n-1;i>=0;i--){const d=new Date(t.getFullYear(),t.getMonth()-i,1);const e=new Date(d.getFullYear(),d.getMonth()+1,0);const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");let end=key+"-"+String(e.getDate()).padStart(2,"0");if(end>TODAY)end=TODAY;out.push({key,end,label:d.toLocaleDateString("id-ID",{month:"short"}),long:d.toLocaleDateString("id-ID",{month:"long",year:"numeric"})})}return out}

function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>{t.hidden=true},2600)}

function meter(v,kind){
  const isT=kind==="target";
  const cls=isT?band(v,100,80):band(v,85,85);
  const w=v==null?0:Math.max(0,Math.min(100,v));
  const over=v!=null&&v>100;
  return el("div",{class:"meter",title:over?"Melebihi 100%":null},
    el("div",{class:"track"+(over?" over":"")},el("div",{class:"fill "+cls,style:"width:"+w+"%"}),isT?null:el("div",{class:"tick",style:"left:85%"})),
    el("span",{class:"num"+(over?" over":"")},v==null?el("span",{class:"dash",text:"–"}):fmtPct(v)+"%"));
}
function spark(values,hi){const m=Math.max(1,...values);return el("div",{class:"spark","aria-hidden":"true"},values.map((v,i)=>el("i",{class:i===hi?"hi":null,style:"height:"+Math.max(8,v/m*100)+"%"})))}

/* ---------- filtering ---------- */
function yearOf(r){const d=r.tglSelesaiAktual||r.selesai;return d?d.slice(0,4):""}
function scoped(){return S.rows.filter(r=>(!S.fProgram||r.program===S.fProgram)&&(!S.fYear||yearOf(r)===S.fYear))}
function matchStatus(r){return!S.fStatus||status(r)===S.fStatus}
function visible(){
  const q=S.fQ.trim().toLowerCase();
  let rows=scoped().filter(r=>matchStatus(r)&&(!q||(r.nama||"").toLowerCase().includes(q)||(r.pic||"").toLowerCase().includes(q)||(r.pm||"").toLowerCase().includes(q)));
  const {k,d}=S.sort;
  const get=(r)=>k==="target"?capai(r):r[k];
  rows.sort((a,b)=>{let x=get(a),y=get(b);const nx=x==null||x==="",ny=y==null||y==="";if(nx&&ny)return 0;if(nx)return 1;if(ny)return-1;if(typeof x==="string")return x.localeCompare(y,"id")*d;return(x-y)*d});
  return rows;
}
function goList(patch){Object.assign(S,patch);$("#fStatus").value=S.fStatus;syncSortSelect();ddRefresh();renderTable();$("#daftar").scrollIntoView()}
function syncSortSelect(){const v=S.sort.k+":"+S.sort.d;const sel=$("#fSort");sel.value=[...sel.options].some(o=>o.value===v)?v:"";if(typeof ddRefresh==="function")ddRefresh();}

/* ---------- render ---------- */
function renderFilters(){setTimeout(ddRefresh,0);
  const years=[...new Set(S.rows.map(yearOf).filter(Boolean))].sort().reverse();
  const fy=$("#fYear");fy.replaceChildren(el("option",{value:"",text:"Semua tahun"}),...years.map(y=>el("option",{value:y,text:"Selesai "+y})));fy.value=years.includes(S.fYear)?S.fYear:"";S.fYear=fy.value;
  const progs=[...new Set(S.rows.map(r=>r.program).filter(Boolean))].sort();
  const fp=$("#fProgram");fp.replaceChildren(el("option",{value:"",text:"Semua program"}),...progs.map(p=>el("option",{value:p,text:p})));fp.value=progs.includes(S.fProgram)?S.fProgram:"";S.fProgram=fp.value;
}

function renderKpis(){
  const rows=scoped();const M=months(12);
  const run=rows.filter(r=>status(r)==="progress");
  const late=rows.filter(r=>status(r)==="late");
  const done=rows.filter(finished);
  const surveyed=rows.filter(r=>num(r.kepuasan)!=null).sort((a,b)=>(a.selesai||"").localeCompare(b.selesai||""));
  const sat=avg(surveyed.map(r=>r.kepuasan));
  const withT=rows.filter(r=>num(r.targetRp)>0);
  const sumT=sumBy(withT,"targetRp"),sumA=sumBy(withT,"realisasiRp");
  const prevEnd=M[M.length-2].end;const sumPrev=withT.reduce((t,r)=>t+valueAt(r,prevEnd),0);
  const hit=withT.filter(r=>capai(r)>=100).length;
  const docOk=done.filter(docsComplete).length;
  const byMonth=M.map(m=>rows.filter(r=>r.tglSelesaiAktual&&r.tglSelesaiAktual.slice(0,7)===m.key).length);
  const next6=[];{const t=new Date();for(let i=0;i<6;i++){const d=new Date(t.getFullYear(),t.getMonth()+i,1);const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");next6.push(run.filter(r=>r.selesai&&r.selesai.slice(0,7)===key).length)}}
  const card=(label,act,value,unit,deltaEl,viz,sub)=>el("article",{class:"card kpi"},
    el("div",{class:"ch"},el("h3",{text:label}),arrowBtn("Lihat "+label.toLowerCase(),act)),
    el("div",{class:"row"},el("div",{class:"vals"},el("div",{class:"big"},value,unit?el("small",{text:unit}):null),deltaEl),viz),
    el("div",{class:"sub",text:sub}));
  const pctDocs=k=>done.length?done.filter(r=>docsOf(r)[k].length).length/done.length*100:0;
  const tri=el("div",{class:"tri","aria-hidden":"true"},DOC_TYPES.map(t=>{const p=pctDocs(t.key);return el("div",null,el("i",{class:p>=100?"full":null,style:"height:"+Math.max(6,p*0.3)+"px"}),el("span",{text:t.abbr}))}));
  const growth=sumA-sumPrev;
  $("#kpis").replaceChildren(
    card("Total copart",()=>goList({fStatus:"",fQ:""}),String(rows.length),"",el("span",{class:"delta flat",text:new Set(rows.map(r=>r.program).filter(Boolean)).size+" program"}),spark(byMonth,byMonth.length-1),"Program selesai per bulan, 12 bulan terakhir"),
    card("On progress",()=>goList({fStatus:"progress"}),String(run.length),"",el("span",{class:late.length?"delta down":"delta flat",text:late.length+" late"}),spark(next6,0),"Jadwal selesai 6 bulan ke depan"),
    card("Survei kepuasan",()=>goList({sort:{k:"kepuasan",d:-1}}),sat==null?"–":fmtPct(sat),sat==null?"":"%",el("span",{class:"delta "+(sat==null?"flat":sat>=85?"":"down"),text:sat==null?"Belum ada survei":sat>=85?"Di atas 85%":"Di bawah 85%"}),spark(surveyed.slice(-12).map(r=>r.kepuasan),Math.min(surveyed.length,12)-1),"Rata-rata dari "+surveyed.length+" survei"),
    card("Nilai tercapai",()=>goList({sort:{k:"target",d:-1}}),withT.length?fmtRp(sumA):"–","",el("span",{class:"delta "+(growth>0?"":"flat"),text:growth>0?"+"+fmtRp(growth).replace("Rp ","")+" bulan ini":"Rp 0 bulan ini"}),
      el("div",{class:"gauge","aria-hidden":"true"},el("div",{class:"t"},el("b",{style:"width:"+(sumT?Math.min(100,sumA/sumT*100):0)+"%"})),el("span",{text:sumT?fmtPct(sumA/sumT*100)+"% dijanjikan":"–"})),
      withT.length?"Dari target dijanjikan "+fmtRp(sumT)+" · "+hit+"/"+withT.length+" copart tercapai":"Belum ada target yang dijanjikan")
  );
}

function renderTrend(){
  const omzetDate=r=>r.mulai||(r.dibuat||"").slice(0,10)||r.selesai||"";
  const rows=scoped().filter(r=>num(r.omzetRp)>0&&omzetDate(r));const M=months(12);
  const vals=M.map(m=>rows.reduce((t,r)=>t+(omzetDate(r)<=m.end?r.omzetRp:0),0));
  const target=0;
  const cur=vals[vals.length-1],prev=vals[vals.length-2];
  const card=$("#trendCard");
  const pct=prev>0?(cur-prev)/prev*100:null;
  const head=el("div",{class:"ch"},el("h2",{text:"Omzet (kumulatif)"}),el("div",{class:"tools"},arrowBtn("Lihat daftar per omzet",()=>goList({sort:{k:"omzetRp",d:-1}}))));
  const hl=el("div",{class:"headline"},el("span",{class:"big",text:fmtRp(cur)}),pct!=null?el("span",{class:"delta "+(pct>0?"":"flat"),text:(pct>0?"+":"")+fmtPct(pct)+"%"}):null,el("span",{class:"vs",text:"vs bulan lalu"}));
  if(!rows.length){card.replaceChildren(head,el("p",{class:"empty-mini",text:"Grafik muncul setelah copart memiliki omzet dan tanggal mulai proyek."}));return}
  const cw=Math.round(card.clientWidth-36)||640;const narrow=cw<480;
  const W=Math.max(280,cw),H=narrow?190:230,pl=4,pr=50,pt=14,pb=26;
  const top=niceMax(Math.max(target,...vals,1)*1.08);
  const x=i=>pl+(W-pl-pr)*(i/(M.length-1));const y=v=>pt+(H-pt-pb)*(1-v/top);
  const g=sv("svg",{viewBox:"0 0 "+W+" "+H,role:"img","aria-label":"Omzet kumulatif 12 bulan terakhir"});
  for(let k=0;k<=4;k++){const v=top*k/4;g.append(sv("line",{class:"gl",x1:pl,x2:W-pr,y1:y(v),y2:y(v)}),sv("text",{x:W-pr+8,y:y(v)+4},shortRp(v)))}
  const step=narrow?3:(W<560?2:1);
  M.forEach((m,i)=>{if((M.length-1-i)%step===0)g.append(sv("text",{x:x(i),y:H-6,"text-anchor":"middle"},m.label))});
  if(target>0)g.append(sv("line",{class:"tl",x1:pl,x2:W-pr,y1:y(target),y2:y(target)}));
  const pts=vals.map((v,i)=>[x(i),y(v)]);
  g.append(sv("path",{class:"ar",d:"M"+pts.map(p=>p.join(",")).join("L")+"L"+x(M.length-1)+","+y(0)+"L"+x(0)+","+y(0)+"Z"}));
  g.append(sv("path",{class:"ln",d:"M"+pts.map(p=>p.join(",")).join("L")}));
  const cursor=sv("line",{class:"cursor",y1:pt,y2:H-pb,x1:-10,x2:-10});
  const dot=sv("circle",{class:"dot",r:5,cx:pts[pts.length-1][0],cy:pts[pts.length-1][1]});
  g.append(cursor,dot);
  const tip=el("div",{class:"tip"});
  const box=el("div",{class:"chartbox"},g,tip);
  const show=i=>{const [px,py]=pts[i];dot.setAttribute("cx",px);dot.setAttribute("cy",py);cursor.setAttribute("x1",px);cursor.setAttribute("x2",px);
    const r=g.getBoundingClientRect();const sx=r.width/W;const add=vals[i]-(i>0?vals[i-1]:0);tip.replaceChildren(M[i].long,el("b",{text:fmtRp(vals[i])}),add>0?"+"+fmtRp(add)+" bulan ini":"Tidak ada omzet baru");
    const below=py*sx<70;tip.style.transform=below?"translate(-50%,16px)":"translate(-50%,-115%)";
    tip.style.left=Math.min(r.width-70,Math.max(70,px*sx))+"px";tip.style.top=(py*sx)+"px";tip.hidden=false};
  const pick=e=>{const r=g.getBoundingClientRect();const lx=(e.clientX-r.left)*(W/r.width);let best=0,bd=1e9;pts.forEach((p,i)=>{const d=Math.abs(p[0]-lx);if(d<bd){bd=d;best=i}});show(best)};
  g.addEventListener("pointermove",pick);g.addEventListener("pointerdown",pick);
  g.addEventListener("pointerleave",()=>{show(pts.length-1)});
  card.replaceChildren(head,hl,box,el("div",{class:"legend"},el("span",null,el("i"),"Omzet kumulatif, dihitung dari bulan mulai proyek")));
  requestAnimationFrame(()=>show(pts.length-1));
}
function niceMax(v){const p=Math.pow(10,Math.floor(Math.log10(v)));const m=v/p;const n=m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10;return n*p}
function shortRp(v){if(v>=1e12)return(v/1e12).toLocaleString("id-ID",{maximumFractionDigits:1})+" T";if(v>=1e9)return(v/1e9).toLocaleString("id-ID",{maximumFractionDigits:1})+" M";if(v>=1e6)return Math.round(v/1e6)+" jt";return v?Math.round(v/1e3)+" rb":"0"}

function renderProg(){
  const sel=S.fProgram;const rows=scoped();const by={};
  rows.forEach(r=>{const p=r.program||"Lainnya";(by[p]=by[p]||[]).push(r)});
  const card=$("#progCard");
  const seg=el("div",{class:"seg",role:"group","aria-label":"Ukuran"},
    el("button",{type:"button","aria-pressed":String(S.progMetric==="capai"),onclick:()=>{S.progMetric="capai";renderProg()}},"Pencapaian"),
    el("button",{type:"button","aria-pressed":String(S.progMetric==="sat"),onclick:()=>{S.progMetric="sat";renderProg()}},"Kepuasan"));
  const head=el("div",{class:"ch"},el("h2",{text:"Kinerja per program"}),el("div",{class:"tools"},seg));
  const items=Object.keys(by).map(p=>{const rs=by[p];let v;if(S.progMetric==="capai"){const w=rs.filter(r=>num(r.targetRp)>0);v=w.length?sumBy(w,"realisasiRp")/sumBy(w,"targetRp")*100:null}else v=avg(rs.map(r=>num(r.kepuasan)));return{p,v,n:rs.length}}).filter(it=>it.v!=null).sort((a,b)=>b.n-a.n||a.p.localeCompare(b.p)).slice(0,7);
  if(!items.length){card.replaceChildren(head,el("p",{class:"empty-mini",text:S.progMetric==="capai"?"Belum ada program dengan target dan pencapaian.":"Belum ada hasil survei kepuasan."}));return}
  const max=Math.max(100,...items.map(i=>i.v));const best=items.reduce((a,b)=>b.v>a.v?b:a);
  const top=best?best.v:null;const isHi=it=>sel?it.p===sel:it.v===top;
  const subText=sel?"Menampilkan "+sel+". Klik batangnya lagi untuk kembali ke semua program.":(S.progMetric==="capai"?"Total tercapai dibanding target yang dijanjikan tiap program. Klik batang untuk melihat satu program.":"Rata-rata survei kepuasan tiap program. Klik batang untuk melihat satu program.");
  card.replaceChildren(head,el("p",{class:"sub",style:"margin:0",text:subText}),
    el("div",{class:"bars"},items.map(it=>el("button",{type:"button",class:"bar"+(isHi(it)?" hi":""),"aria-pressed":String(it.p===sel),title:it.p===sel?"Klik untuk kembali ke semua program":it.p+": "+fmtPct(it.v)+"% · "+it.n+" copart",onclick:()=>{S.fProgram=S.fProgram===it.p?"":it.p;renderAll()}},
      el("div",{class:"col",style:"height:"+Math.max(4,it.v/max*100)+"%"},el("span",{class:"v",text:fmtPct(it.v)+"%"})),
      el("span",{class:"lbl",text:it.p})))));
}

const MIX_COLORS=["var(--blue)","var(--lav-2)","var(--yellow)","var(--grey-bar)","var(--blue-ink)","var(--good)"];
function renderMix(){
  const rows=scoped();const by={};rows.forEach(r=>{const p=r.program||"Lainnya";by[p]=(by[p]||0)+1});
  let items=Object.entries(by).sort((a,b)=>b[1]-a[1]);
  if(items.length>6){const rest=items.slice(5).reduce((t,x)=>t+x[1],0);items=items.slice(0,5).concat([["Lainnya",rest]])}
  const card=$("#mixCard");
  const head=el("div",{class:"ch"},el("h2",{text:"Komposisi program"}),arrowBtn("Lihat daftar copart",()=>goList({})));
  if(!items.length){card.replaceChildren(head,el("p",{class:"empty-mini",text:"Belum ada copart."}));return}
  const total=rows.length;const R=54,C=2*Math.PI*R;let off=0;
  const g=sv("svg",{viewBox:"0 0 140 140","aria-hidden":"true"});
  g.append(sv("circle",{cx:70,cy:70,r:R,fill:"none",stroke:"var(--card-2)","stroke-width":18}));
  items.forEach(([p,n],i)=>{const len=n/total*C;const gap=items.length>1?2:0;g.append(sv("circle",{cx:70,cy:70,r:R,fill:"none",stroke:MIX_COLORS[i%MIX_COLORS.length],"stroke-width":18,"stroke-dasharray":Math.max(0,len-gap)+" "+(C-len+gap),"stroke-dashoffset":-off}));off+=len});
  card.replaceChildren(head,el("div",{class:"donutwrap"},
    el("div",{class:"donut"},g,el("div",{class:"c"},el("div",null,el("b",{text:total}),el("span",{text:"copart"})))),
    el("ul",{class:"mix"},items.map(([p,n],i)=>el("li",null,el("i",{style:"background:"+MIX_COLORS[i%MIX_COLORS.length]}),el("span",{text:p}),el("b",{text:n}),el("em",{text:Math.round(n/total*100)+"%"}))))));
}

function renderMini(){
  const rows=scoped();
  const surveyed=rows.filter(r=>num(r.kepuasan)!=null).sort((a,b)=>b.kepuasan-a.kepuasan);
  const hi=surveyed[0],lo=surveyed.length>1?surveyed[surveyed.length-1]:null;
  const late=rows.filter(r=>status(r)==="late").sort((a,b)=>lateDays(b)-lateDays(a));
  const done=rows.filter(finished);const miss=done.filter(r=>!docsComplete(r));
  const mini=(label,act,big,who)=>el("article",{class:"card mini"},el("div",{class:"ch"},el("h3",{text:label}),act?arrowBtn(label,act):null),el("div",{class:"big",text:big}),el("div",{class:"who",text:who}));
  $("#mini4").replaceChildren(
    mini("Kepuasan tertinggi",hi?()=>openSheet(hi.id):null,hi?fmtPct(hi.kepuasan)+"%":"–",hi?hi.nama:"Belum ada survei"),
    mini("Kepuasan terendah",lo?()=>openSheet(lo.id):null,lo?fmtPct(lo.kepuasan)+"%":"–",lo?lo.nama:"Perlu minimal 2 survei"),
    mini("Program late",()=>{S.tab="late";renderFollow();$("#tindak").scrollIntoView()},String(late.length),late[0]?"Terlama: "+late[0].nama+" ("+lateDays(late[0])+" hari)":"Tidak ada program telat"),
    mini("Dokumen belum lengkap",()=>{S.tab="docs";renderFollow();$("#tindak").scrollIntoView()},String(miss.length),done.length?"Dari "+done.length+" program selesai":"Belum ada program selesai"));
}

function renderFollow(){
  const rows=scoped();
  const soon=rows.filter(r=>status(r)==="progress"&&r.selesai&&daysBetween(TODAY,r.selesai)<=60).sort((a,b)=>a.selesai.localeCompare(b.selesai));
  const late=rows.filter(r=>status(r)==="late").sort((a,b)=>lateDays(b)-lateDays(a));
  const docs=rows.filter(r=>finished(r)&&!docsComplete(r)).sort((a,b)=>(a.tglSelesaiAktual||"").localeCompare(b.tglSelesaiAktual||""));
  $("#cSoon").textContent=soon.length;$("#cLate").textContent=late.length;$("#cDocs").textContent=docs.length;
  [["soon","#tabSoon"],["late","#tabLate"],["docs","#tabDocs"]].forEach(([k,id])=>$(id).setAttribute("aria-selected",S.tab===k));
  const list=S.tab==="soon"?soon:S.tab==="late"?late:docs;const ul=$("#followList");
  const emptyMsg={soon:"Tidak ada program on progress yang jatuh tempo dalam 60 hari.",late:"Tidak ada program yang telat.",docs:"Semua program selesai sudah lengkap dokumennya."}[S.tab];
  if(!list.length){ul.replaceChildren(el("li",{class:"empty-mini"},emptyMsg));return}
  ul.replaceChildren(...list.slice(0,9).map(r=>{
    let right;
    if(S.tab==="soon"){const d=daysBetween(TODAY,r.selesai);right=el("div",{class:"when"},el("b",{text:d===0?"Hari ini":d+" hari lagi"}),fmtDate(r.selesai))}
    else if(S.tab==="late")right=el("div",{class:"when late"},el("b",{text:"Telat "+lateDays(r)+" hari"}),finished(r)?"Selesai "+fmtDate(r.tglSelesaiAktual):"Belum selesai");
    else right=docChips(r);
    return el("li",null,el("button",{class:"fitem",type:"button",onclick:()=>openSheet(r.id)},el("div",{class:"who"},el("b",{text:r.nama}),el("span",{text:[r.program,people(r)].filter(Boolean).join(" · ")})),right));
  }));
  if(list.length>9)ul.append(el("li",{class:"empty-mini",text:"+"+(list.length-9)+" copart lainnya ada di daftar di bawah."}));
}

function docChips(r){const dd=docsOf(r);return el("div",{class:"docs"},DOC_TYPES.map(t=>el("span",{class:"dk"+(dd[t.key].length?" on":""),title:t.label+": "+dd[t.key].length+" file",text:t.abbr})))}
function renderTable(){
  const rows=visible();const tb=$("#rows");const cards=$("#rcards");const empty=$("#regEmpty");
  document.querySelectorAll("th button").forEach(b=>{const on=b.dataset.sort===S.sort.k;b.toggleAttribute("data-active",on);b.textContent=b.textContent.replace(/ [↑↓]$/,"")+(on?(S.sort.d>0?" ↑":" ↓"):"")});
  const clear=()=>{tb.replaceChildren();cards.replaceChildren()};
  if(S.mode==="loading"){clear();empty.hidden=false;empty.replaceChildren(el("div",{class:"empty"},el("p",{text:"Memuat data copart…"})));return}
  if(!S.rows.length){
    clear();empty.hidden=false;
    empty.replaceChildren(el("div",{class:"empty"},el("h3",{text:"Belum ada copart"}),
      el("p",{text:S.canWrite?"Tambahkan copart pertama: nama perusahaan, program, nama PM, jadwal selesai, dan target yang dijanjikan. Nilai tercapai, hasil survei, dan dokumen dilengkapi selama proyek berjalan.":"Data copart akan tampil di sini setelah tim BSD menambahkannya."}),
      S.canWrite?el("button",{class:"btn primary",type:"button",onclick:()=>openSheet(null)},"Tambah copart"):null));
    return;
  }
  if(!rows.length){clear();empty.hidden=false;empty.replaceChildren(el("div",{class:"empty"},el("p",{text:"Tidak ada copart yang cocok dengan filter ini."})));return}
  empty.hidden=true;
    const money=r=>num(r.targetRp)>0?fmtRp(num(r.realisasiRp)||0)+" / "+fmtRp(r.targetRp):"Target dijanjikan belum diisi";
  tb.replaceChildren(...rows.map(r=>{
    const st=status(r);
    return el("tr",{tabindex:"0",onclick:()=>openSheet(r.id),onkeydown:e=>{if(e.key==="Enter")openSheet(r.id)}},
      el("td",{class:"name"},el("b",{text:r.nama}),people(r)?el("span",{text:people(r)}):null),
      el("td",null,r.program?el("span",{class:"chip",text:r.program}):el("span",{class:"dash",text:"–"})),
      el("td",{class:"omzet"},num(r.omzetRp)!=null?fmtRp(r.omzetRp):el("span",{class:"dash",text:"–"})),
      el("td",null,r.selesai?[fmtDate(r.selesai),el("span",{class:"date-sub"+(st==="late"?" late":""),text:dueNote(r)})]:el("span",{class:"dash",text:"–"})),
      el("td",null,el("span",{class:"pill "+st,text:pillText(r)})),
      el("td",null,meter(num(r.kepuasan),"sat")),
      el("td",null,meter(capai(r),"target"),el("span",{class:"money",text:money(r)})),
      el("td",null,docChips(r)));
  }));
  cards.replaceChildren(...rows.map(r=>{
    const st=status(r);
    return el("li",null,el("button",{class:"rcard",type:"button",onclick:()=>openSheet(r.id)},
      el("div",{class:"t"},el("div",null,el("b",{text:r.nama}),el("span",{text:[people(r),r.selesai&&("Jadwal "+fmtDate(r.selesai))].filter(Boolean).join(" · ")||"Jadwal selesai belum diisi"}))),
      el("div",{class:"tags"},r.program?el("span",{class:"chip",text:r.program}):null,el("span",{class:"pill "+st,text:pillText(r)}),el("span",{class:"sub"+(st==="late"?" late":""),text:dueNote(r)}),docChips(r)),
      el("div",{class:"m"},el("span",{text:"Omzet"}),el("b",{class:"omzet",text:num(r.omzetRp)!=null?fmtRp(r.omzetRp):"–"}),el("span",{text:"Kepuasan"}),meter(num(r.kepuasan),"sat"),el("span",{text:"Tercapai"}),el("div",null,meter(capai(r),"target"),el("span",{class:"money",text:money(r)})))));
  }));
}

function renderAll(){renderFilters();renderKpis();renderTrend();renderProg();renderMix();renderMini();renderFollow();renderTable();["#addBtn","#railAdd","#bbAdd"].forEach(s=>$(s).hidden=!S.canWrite)}

/* ---------- sheet (detail / edit) ---------- */
let draft=null,pendingUploads=[],removedIds=[],busy=false;
function blank(){return{nama:"",program:"",omzetRp:null,pm:"",pic:"",mulai:"",selesai:"",kepuasan:null,targetRp:null,realisasiRp:null,riwayat:[],catatan:"",dokumen:{qa:[],app:[],testi:[]}}}
function clone(o){return JSON.parse(JSON.stringify(o))}

function openSheet(id){
  const rec=id?S.rows.find(r=>r.id===id):null;
  if(id&&!rec)return;
  S.editing=id;S.draftId=id||crypto.randomUUID();draft=rec?clone(rec):blank();delete draft.id;
  draft.dokumen=docsOf(draft);pendingUploads=[];removedIds=[];
  renderSheet();
}
async function closeSheet(discard){
  if(discard&&pendingUploads.length&&S.assets){for(const a of pendingUploads){try{await S.assets.delete(a)}catch(e){}}}
  pendingUploads=[];removedIds=[];draft=null;S.editing=null;$("#sheetRoot").replaceChildren();
}

function renderSheet(focusId){
  const ro=!S.canWrite;const isNew=!S.editing;
  const root=$("#sheetRoot");
  const fld=(id,label,input,opts={})=>el("div",{class:"f"+(opts.full?" full":"")},el("label",{for:id,text:label}),input,opts.hint?el("span",{class:"hint",text:opts.hint}):null);
  const bind=(key,parse)=>e=>{draft[key]=parse?parse(e.target.value):e.target.value};
  const numParse=v=>v===""?null:Number(String(v).replace(",","."));

  const nama=el("input",{type:"text",id:"inNama",value:draft.nama,required:true,disabled:ro,placeholder:"Contoh: PT Maju Bersama",oninput:bind("nama")});
  const prog=el("input",{type:"text",id:"inProgram",value:draft.program,list:"progList",disabled:ro,placeholder:"QMS, EMS, HRMP…",oninput:bind("program",v=>v.trim()),onchange:e=>{const c=canonProgram(e.target.value,programPool());e.target.value=c;draft.program=c}});
  const progList=el("datalist",{id:"progList"},[...new Set([...PROGRAMS,...S.rows.map(r=>r.program).filter(Boolean)])].map(p=>el("option",{value:p})));
  const pm=el("input",{type:"text",id:"inPm",value:draft.pm||"",disabled:ro,placeholder:"Project manager",oninput:bind("pm")});
  const pic=el("input",{type:"text",id:"inPic",value:draft.pic||"",disabled:ro,placeholder:"Konsultan / PIC",oninput:bind("pic")});
  const mulai=el("input",{type:"date",id:"inMulai",value:draft.mulai||"",disabled:ro,oninput:bind("mulai")});
  const selesai=el("input",{type:"date",id:"inSelesai",value:draft.selesai||"",disabled:ro,oninput:bind("selesai")});
  const kep=el("div",{class:"suffix"},el("input",{type:"number",id:"inKepuasan",inputmode:"decimal",min:"0",step:"0.1",value:draft.kepuasan??"",disabled:ro,placeholder:"Contoh: 92",oninput:bind("kepuasan",numParse)}),el("span",{text:"%"}));
  const rpInput=(id,key)=>el("div",{class:"prefix"},el("span",{text:"Rp"}),el("input",{type:"text",id,inputmode:"numeric",autocomplete:"off",value:draft[key]==null?"":Math.round(draft[key]).toLocaleString("id-ID"),disabled:ro,placeholder:"0",oninput:e=>{const v=parseRp(e.target.value);draft[key]=v;e.target.value=v==null?"":v.toLocaleString("id-ID");updateProgress()}}));
  const tgtRp=rpInput("inTargetRp","targetRp");
  const omzet=rpInput("inOmzet","omzetRp");
  const progBox=isNew?null:el("div",{class:"progress-box",id:"progBox"});
  let progSection=null;
  if(!isNew){
    const entries=sortRiwayat(draft.riwayat||[]);
    let addForm=null;
    if(!ro){
      const tgl=el("input",{type:"date",id:"inTglCapai",value:TODAY,"aria-label":"Tanggal"});
      const nilai=el("div",{class:"prefix"},el("span",{text:"Rp"}),el("input",{type:"text",id:"inNilaiCapai",inputmode:"numeric",autocomplete:"off",placeholder:"Total tercapai","aria-label":"Total tercapai sampai tanggal ini",oninput:e=>{const v=parseRp(e.target.value);e.target.value=v==null?"":v.toLocaleString("id-ID")}}));
      const ket=el("input",{type:"text",id:"inKetCapai",placeholder:"Keterangan (opsional)","aria-label":"Keterangan"});
      const addErr=el("div",{class:"err",id:"capaiErr",role:"alert"});
      addForm=el("div",{class:"capai-add"},
        el("div",{class:"capai-row"},tgl,nilai,ket,el("button",{class:"btn primary",type:"button",id:"capaiBtn",onclick:()=>addCapai(tgl.value,parseRp($("#inNilaiCapai").value),ket.value.trim())},"Perbarui")),
        el("span",{class:"hint",text:"Isi total yang sudah tercapai sampai tanggal tersebut, bukan tambahannya."}),
        addErr);
    }
    const list=entries.length?el("ul",{class:"hist"},entries.map((h,i)=>{
      const prevE=entries[i+1];const delta=prevE?(num(h.nilai)||0)-(num(prevE.nilai)||0):null;
      const rm=ro?null:el("button",{class:"x",type:"button","aria-label":"Hapus catatan",title:"Hapus catatan",onclick:e=>{const b=e.currentTarget;if(b.dataset.armed){removeCapai(h.id)}else{b.dataset.armed="1";b.textContent="Hapus?";b.classList.add("armed")}}},"×");
      return el("li",null,el("span",{class:"d",text:fmtDate((h.tgl||"").slice(0,10))}),el("span",{class:"k",text:h.ket||""}),el("span",{class:"amt"},el("b",{text:fmtRpFull(h.nilai)}),delta!=null&&delta!==0?el("small",{class:delta>0?"up":"down",text:(delta>0?"+":"−")+fmtRp(Math.abs(delta))}):null),rm);
    })):el("p",{class:"hint",style:"margin:0",text:"Belum ada pencapaian yang dicatat."});
    const st=status(draft);
    let finish;
    if(finished(draft)){
      finish=el("section",{class:"finish fin "+st},
        el("div",{class:"finish-t"},el("span",{class:"pill "+st,text:pillText(draft)}),el("b",{text:"Selesai "+fmtDate(draft.tglSelesaiAktual)}),el("span",{class:"hint",text:draft.selesai?"Jadwal "+fmtDate(draft.selesai):""})),
        ro?null:el("button",{class:"btn ghost",type:"button",onclick:e=>{const b=e.currentTarget;if(!b.dataset.armed){b.dataset.armed="1";b.textContent="Yakin batalkan?";return}setFinish(null)}},"Batalkan status selesai"));
    }else{
      const fin=el("input",{type:"date",id:"inFinish",value:TODAY,max:TODAY,"aria-label":"Tanggal program selesai"});
      finish=el("section",{class:"finish "+st},
        el("div",{class:"finish-t"},el("span",{class:"pill "+st,text:pillText(draft)}),el("span",{class:"hint",text:draft.selesai?"Jadwal selesai "+fmtDate(draft.selesai):"Jadwal selesai belum diisi"})),
        ro?null:el("div",{class:"finish-row"},fin,el("button",{class:"btn primary",type:"button",id:"finishBtn",onclick:()=>setFinish(fin.value)},"Program selesai")),
        el("div",{class:"err",id:"finishErr",role:"alert"}));
    }
    progSection=[finish,el("section",{class:"capai"},
      el("div",{class:"capai-head"},el("legend",{text:"Pencapaian berjalan"}),el("span",{class:"capai-total",text:fmtRp(num(draft.realisasiRp)||0)+(num(draft.targetRp)?" dari "+fmtRp(draft.targetRp)+" dijanjikan":"")})),
      progBox,addForm,list)];
  }
  const cat=el("textarea",{id:"inCatatan",disabled:ro,placeholder:"Catatan singkat untuk tim BSD",oninput:bind("catatan")});cat.value=draft.catatan||"";
  const errBox=el("div",{class:"err",id:"formErr",role:"alert"});

  const docGroups=DOC_TYPES.map(t=>{
    const files=draft.dokumen[t.key];
    const removeAt=i=>{const [rm]=files.splice(i,1);if(rm&&rm.id&&rm.id!=="x"){if(pendingUploads.includes(rm.id)){pendingUploads=pendingUploads.filter(x=>x!==rm.id);S.assets&&S.assets.delete(rm.id).catch(()=>{})}else removedIds.push(rm.id)}renderSheet()};
    const listEl=el("ul",{class:"files"},files.map((f,i)=>{
      const xBtn=ro?null:el("button",{class:"x",type:"button","aria-label":"Hapus "+f.nama,title:"Hapus",onclick:()=>removeAt(i)},"×");
      if(f.link){
        const did=driveId(f.link);
        const prev=el("div",{class:"dpreview",hidden:true});
        const toggle=did?el("button",{class:"linkbtn",type:"button",onclick:e=>{if(prev.hidden&&!prev.firstChild)prev.append(el("iframe",{src:"https://drive.google.com/file/d/"+did+"/preview",allow:"autoplay; fullscreen",loading:"lazy",title:"Pratinjau "+f.nama}));prev.hidden=!prev.hidden;e.currentTarget.textContent=prev.hidden?"Lihat":"Tutup"}},"Lihat"):null;
        return el("li",{class:"flink"},el("div",{class:"frow"},el("span",{class:"ext drive",text:did?"DRIVE":"LINK"}),el("a",{href:f.link,target:"_blank",rel:"noopener",text:f.nama||"Buka tautan",title:f.link}),toggle,xBtn),prev);
      }
      const url=f.id&&f.id!=="x"?f.id:null;
      const ext=ACCEPT[f.tipe]||"FILE";
      const vis=f.tipe&&f.tipe.startsWith("image/")&&url?el("img",{class:"thumb",alt:"","data-path":url}):el("span",{class:"ext",text:ext});
      return el("li",null,el("div",{class:"frow"},vis,
        url?el("a",{"data-path":url,target:"_blank",rel:"noopener",text:f.nama,title:"Buka "+f.nama}):el("span",{style:"flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600",text:f.nama}),
        el("span",{class:"meta",text:fmtSize(f.ukuran)}),xBtn));
    }));
    let picker=null;
    if(!ro){
      if(S.assets){
        const inp=el("input",{type:"file",multiple:true,accept:".pdf,.jpg,.jpeg,.png,.webp",onchange:e=>{upload(t.key,[...e.target.files]);e.target.value=""}});
        picker=el("label",{class:"drop",ondragover:e=>{e.preventDefault();e.currentTarget.classList.add("over")},ondragleave:e=>e.currentTarget.classList.remove("over"),ondrop:e=>{e.preventDefault();e.currentTarget.classList.remove("over");upload(t.key,[...e.dataTransfer.files])}},inp,"Upload PDF atau gambar");
      }else if(S.mode==="sample"){
        picker=null;
      }else{
        picker=el("div",{class:"ro-note",text:"Anda tidak memiliki akses upload. Minta peran Editor ke admin BSD."});
      }
    }
    let linkRow=null;
    if(!ro&&S.mode!=="loading"){
      const li=el("input",{type:"url",placeholder:"Tempel link Google Drive","aria-label":"Link Google Drive untuk "+t.label,inputmode:"url"});
      const add=()=>{const v=li.value.trim();let u;try{u=new URL(v)}catch(e){toast("Link tidak valid. Salin link dari tombol Bagikan di Google Drive.");return}if(u.protocol!=="https:"){toast("Gunakan link https.");return}
        const did=driveId(v);files.push({link:v,nama:did?"File Google Drive":u.hostname,tipe:"link",tgl:new Date().toISOString()});renderSheet("doc")};
      li.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();add()}});
      linkRow=el("div",{class:"linkrow"},li,el("button",{class:"btn",type:"button",onclick:add},"Tambah link"));
    }
    return el("section",{class:"doc-group"},el("header",null,el("b",{text:t.label}),el("span",{text:files.length?files.length+" dokumen":t.hint})),files.length?listEl:null,el("div",{class:"uploading",id:"up_"+t.key}),linkRow,picker);
  });

  const foot=el("div",{class:"sheet-foot"});
  if(ro){foot.append(el("span",{class:"ro-note",text:"Anda hanya dapat melihat data ini."}),el("span",{class:"spacer"}),el("button",{class:"btn",type:"button",onclick:()=>closeSheet(true)},"Tutup"))}
  else{
    const delZone=el("div",{class:"confirm"});
    if(!isNew)delZone.append(el("button",{class:"btn danger",type:"button",onclick:()=>{delZone.replaceChildren("Hapus copart ini beserta dokumennya?",el("button",{class:"btn danger",type:"button",onclick:doDelete},"Ya, hapus"),el("button",{class:"btn ghost",type:"button",onclick:()=>renderSheet()},"Batal"))}},"Hapus"));
    foot.append(delZone,el("span",{class:"spacer"}),el("button",{class:"btn ghost",type:"button",onclick:()=>closeSheet(true)},"Batal"),el("button",{class:"btn primary",type:"submit",form:"copartForm",id:"saveBtn",disabled:busy||S.mode==="sample"},S.mode==="sample"?"Simpan (pratinjau)":"Simpan"));
  }

  const form=el("form",{id:"copartForm",class:"sheet-body",novalidate:true,onsubmit:e=>{e.preventDefault();save()}},
    progSection,
    el("fieldset",null,el("legend",{text:"Data copart"}),
      fld("inNama","Nama copart",nama,{full:true}),
      fld("inProgram","Program",el("div",null,prog,progList)),
      fld("inOmzet","Omzet (Rp)",omzet),
      fld("inPm","Nama PM",pm),
      fld("inPic","PIC / konsultan",pic),
      fld("inMulai","Mulai proyek",mulai),
      fld("inSelesai","Jadwal selesai",selesai,{hint:"Tanggal yang direncanakan"})),
    el("fieldset",null,el("legend",{text:"Hasil"}),
      fld("inKepuasan","Survei kepuasan",kep,{hint:"Indeks kepuasan klien dalam %"}),
      fld("inCatatan","Catatan",cat,{full:true})),
    el("fieldset",null,el("legend",{text:"Target yang dijanjikan"}),
      fld("inTargetRp","Target yang dijanjikan (Rp)",tgtRp,{hint:isNew?"Nilai yang sudah tercapai dicatat setelah proyek berjalan":"Ubah hanya jika target proyek direvisi"})),
    el("div",null,el("legend",{text:"Dokumen",style:"display:block"}),el("div",{style:"display:flex;flex-direction:column;gap:10px"},docGroups)),
    errBox);

  const sheet=el("div",{class:"sheet",role:"dialog","aria-modal":"true","aria-labelledby":"sheetTitle"},
    el("div",{class:"sheet-head"},el("h2",{id:"sheetTitle",text:isNew?"Copart baru":(draft.nama||"Copart")}),el("button",{class:"btn ghost",type:"button","aria-label":"Tutup",onclick:()=>closeSheet(true)},"Tutup")),
    form,foot);
  const prevScroll=root.querySelector(".sheet-body")?.scrollTop||0;
  root.replaceChildren(el("div",{class:"scrim",onclick:()=>closeSheet(true)}),sheet);
  form.scrollTop=prevScroll;
  hydrateFiles(sheet);
  updateProgress();
  if(!prevScroll&&!focusId&&isNew&&!ro)nama.focus();
}

function updateProgress(){
  const box=$("#progBox");if(!box||!draft)return;
  const t=num(draft.targetRp),a=num(draft.realisasiRp)||0;
  if(!t){box.replaceChildren(el("span",{class:"hint",text:"Isi target untuk melihat persentase pencapaian."}));return}
  const pct=a/t*100;const gap=t-a;
  box.replaceChildren(meter(pct,"target"),el("span",{class:"hint",text:gap>0?"Kurang "+fmtRpFull(gap)+" dari target yang dijanjikan":"Target yang dijanjikan tercapai, lebih "+fmtRpFull(-gap)}));
}
function newId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function sortRiwayat(r){return r.slice().sort((a,b)=>(b.tgl||"").localeCompare(a.tgl||"")||(b.dicatat||"").localeCompare(a.dicatat||""))}
function latestTotal(r){const s=sortRiwayat(r||[]);return s.length?num(s[0].nilai):null}
async function writeCapai(riwayat,msg){
  const total=latestTotal(riwayat);
  if(S.mode==="sample"||!col){draft.riwayat=riwayat;draft.realisasiRp=total;renderSheet("capai");toast(msg+" (pratinjau, tidak disimpan)");return true}
  try{
    await col.doc(S.editing).update({riwayat,realisasiRp:total,diubah:new Date().toISOString()});
    if(!draft)return true;
    draft.riwayat=riwayat;draft.realisasiRp=total;renderSheet("capai");toast(msg);return true;
  }catch(e){
    const box=$("#capaiErr");if(box)box.textContent=e&&(e.code==="invalid_argument"||e.code==="permission-denied")?"Anda tidak memiliki akses untuk mengubah data ini.":"Gagal menyimpan. Periksa koneksi lalu coba lagi.";
    return false;
  }
}
function currentRiwayat(){const rec=S.rows.find(r=>r.id===S.editing);const r=(rec&&rec.riwayat)||draft.riwayat||[];return clone(r)}
async function setFinish(date){
  const err=$("#finishErr");if(err)err.textContent="";
  if(date!==null&&!date){if(err)err.textContent="Isi tanggal program selesai.";return}
  if(date&&date>TODAY){if(err)err.textContent="Tanggal selesai tidak boleh setelah hari ini.";return}
  const btn=$("#finishBtn");if(btn){btn.disabled=true;btn.textContent="Menyimpan…"}
  if(S.mode==="sample"||!col){draft.tglSelesaiAktual=date;renderSheet("finish");return}
  try{
    await col.doc(S.editing).update({tglSelesaiAktual:date,diubah:new Date().toISOString()});
    if(!draft)return;draft.tglSelesaiAktual=date;renderSheet("finish");renderAll();
    toast(date?"Program ditandai selesai"+(lateDays(draft)>0?", telat "+lateDays(draft)+" hari":", tepat waktu"):"Status selesai dibatalkan");
  }catch(e){if(err)err.textContent=e&&(e.code==="invalid_argument")?"Anda tidak memiliki akses untuk mengubah data ini.":"Gagal menyimpan. Coba lagi.";if(btn){btn.disabled=false;btn.textContent="Program selesai"}}
}
async function addCapai(tgl,nilai,ket){
  const err=$("#capaiErr");
  if(!tgl){err.textContent="Isi tanggal pencapaian.";return}
  if(nilai==null||nilai<0){err.textContent="Isi total yang sudah tercapai sampai tanggal ini, dalam rupiah.";$("#inNilaiCapai").focus();return}
  const btn=$("#capaiBtn");if(btn){btn.disabled=true;btn.textContent="Menyimpan…"}
  const r=currentRiwayat();r.push({id:newId(),tgl,nilai,ket,dicatat:new Date().toISOString()});
  const ok=await writeCapai(r.slice(-200),"Pencapaian diperbarui");
  if(!ok&&btn){btn.disabled=false;btn.textContent="Perbarui"}
}
async function removeCapai(id){await writeCapai(currentRiwayat().filter(h=>h.id!==id),"Catatan pencapaian dihapus")}
async function upload(key,files){
  if(!S.assets||!files.length)return;
  const status=$("#up_"+key);
  for(const f of files){
    const ext=(f.name.split(".").pop()||"").toLowerCase();
    const type=ACCEPT[f.type]?f.type:EXT_TYPE[ext];
    if(!type){toast(f.name+": format tidak didukung. Simpan sebagai PDF atau gambar.");continue}
    if(f.size>20*1024*1024){toast(f.name+" lebih dari 20 MB. Kompres dulu lalu upload lagi.");continue}
    if(status)status.textContent="Mengunggah "+f.name+"…";
    try{
      const res=await S.assets.upload(f,{type});
      pendingUploads.push(res.id);
      if(!draft)return;
      draft.dokumen[key].push({id:res.id,nama:f.name,tipe:res.contentType||type,ukuran:res.sizeBytes||f.size,tgl:new Date().toISOString()});
    }catch(e){
      const m={too_large:"File terlalu besar (maks 20 MB).",unsupported_type:"Format file tidak didukung.",quota_or_state:"Kuota penyimpanan dashboard penuh.",rate_limited:"Terlalu banyak upload. Coba lagi sebentar.",not_granted:"Anda tidak memiliki akses upload."}[e&&e.code]||"Upload gagal. Coba lagi.";
      toast(f.name+": "+m);
    }
  }
  if(draft)renderSheet("doc");
}

async function save(){
  const err=$("#formErr");
  if(!draft.nama.trim()){err.textContent="Nama copart wajib diisi.";$("#inNama").focus();return}
  for(const [k,lbl,max] of [["kepuasan","Survei kepuasan",1000]]){
    const v=draft[k];if(v!=null&&(!isFinite(v)||v<0||v>max)){err.textContent=lbl+" harus angka 0–"+max+".";return}
  }
  if(draft.mulai&&draft.selesai&&draft.mulai>draft.selesai){err.textContent="Tanggal selesai tidak boleh sebelum tanggal mulai.";return}
  if(!col)return;
  busy=true;const btn=$("#saveBtn");if(btn){btn.disabled=true;btn.textContent="Menyimpan…"}
  const body=clone(draft);body.nama=body.nama.trim();body.program=canonProgram(body.program,programPool());body.diubah=new Date().toISOString();if(!S.editing)body.dibuat=body.diubah;
  const prev=S.editing?S.rows.find(r=>r.id===S.editing):null;
  body.riwayat=prev&&Array.isArray(prev.riwayat)?prev.riwayat:[];
  body.realisasiRp=latestTotal(body.riwayat);
  try{
    if(S.editing)await col.doc(S.editing).set(body);else await col.add(body);
    for(const id of removedIds){try{await S.assets.delete(id)}catch(e){}}
    pendingUploads=[];removedIds=[];
    const isNew=!S.editing;busy=false;closeSheet(false);toast(isNew?"Copart ditambahkan":"Perubahan disimpan");
  }catch(e){
    busy=false;
    err.textContent=e&&(e.code==="invalid_argument"||e.code==="permission-denied")?"Anda tidak memiliki akses untuk mengubah data ini.":e&&e.code==="quota_exceeded"?"Penyimpanan data penuh. Hapus copart yang tidak dipakai.":"Gagal menyimpan. Periksa koneksi lalu coba lagi.";
    if(btn){btn.disabled=false;btn.textContent="Simpan"}
  }
}

async function doDelete(){
  if(!col||!S.editing)return;
  const rec=S.rows.find(r=>r.id===S.editing);
  try{
    await col.doc(S.editing).delete();
    if(rec&&S.assets){const d=docsOf(rec);for(const f of [...d.qa,...d.app,...d.testi]){try{await S.assets.delete(f.id)}catch(e){}}}
    closeSheet(true);toast("Copart dihapus");
  }catch(e){$("#formErr").textContent="Gagal menghapus. Coba lagi."}
}

/* ---------- Supabase adapters ---------- */
function notice(msg){const n=$("#notice");n.textContent=msg||"";n.hidden=!msg}
function mapErr(e){const c=e&&(e.code||e.statusCode||e.status);const m=(e&&e.message)||"";
  if(c==="42501"||/row-level security|permission/i.test(m))return{code:"invalid_argument",message:m};
  if(String(c)==="413"||/exceeded the maximum allowed size|too large/i.test(m))return{code:"too_large",message:m};
  if(/mime type|invalid_mime/i.test(m))return{code:"unsupported_type",message:m};
  return{code:"upstream_error",message:m}}
const SB={client:null,user:null,member:null};
function rowsToState(rows){
  const out=rows.map(r=>Object.assign({},r.data||{},{id:r.id}));
  const pool=[...PROGRAMS];
  out.forEach(r=>{if(!r.program)return;const c=canonProgram(r.program,pool);if(!pool.some(p=>p.toLowerCase()===c.toLowerCase()))pool.push(c);r.program=c});
  return out;
}
function makeCol(){
  const t=()=>SB.client.from("copart");
  const clean=b=>{const o=Object.assign({},b);delete o.id;return o};
  return{
    doc:id=>({
      async set(body){const {error}=await t().update({data:clean(body),updated_at:new Date().toISOString()}).eq("id",id);if(error)throw mapErr(error)},
      async update(part){const cur=S.rows.find(r=>r.id===id)||{};const merged=Object.assign(clean(cur),part);const {error}=await t().update({data:merged,updated_at:new Date().toISOString()}).eq("id",id);if(error)throw mapErr(error);const i=S.rows.findIndex(r=>r.id===id);if(i>=0)S.rows[i]=Object.assign({id},merged)},
      async delete(){const {error}=await t().delete().eq("id",id);if(error)throw mapErr(error)}
    }),
    async add(body){const {error}=await t().insert({id:S.draftId,data:clean(body)});if(error)throw mapErr(error)}
  };
}
function makeAssets(){
  const b=()=>SB.client.storage.from("dokumen");
  return{
    async upload(file,opts){
      const safe=file.name.normalize("NFKD").replace(/[^\w.\-]+/g,"_").slice(-80)||"file";
      const path="copart/"+S.draftId+"/"+Date.now().toString(36)+"-"+safe;
      const {error}=await b().upload(path,file,{contentType:opts.type,upsert:false});
      if(error)throw mapErr(error);
      return{id:path,url:null,sizeBytes:file.size,contentType:opts.type};
    },
    async delete(path){const {error}=await b().remove([path]);if(error)throw mapErr(error);return{deleted:true}}
  };
}
const urlCache=new Map();
async function fileUrl(path){const hit=urlCache.get(path);if(hit&&hit.exp>Date.now())return hit.url;const {data,error}=await SB.client.storage.from("dokumen").createSignedUrl(path,3600);if(error)throw error;urlCache.set(path,{url:data.signedUrl,exp:Date.now()+50*60*1000});return data.signedUrl}
function hydrateFiles(root){
  root.querySelectorAll("[data-path]").forEach(n=>{
    const p=n.getAttribute("data-path");if(!p||p==="x")return;
    fileUrl(p).then(u=>{if(n.tagName==="IMG")n.src=u;else n.href=u}).catch(()=>{if(n.tagName==="A"){n.removeAttribute("href");n.title="File tidak dapat dibuka"}});
  });
}
async function callAccount(payload){
  const {data:{session}}=await SB.client.auth.getSession();
  const res=await fetch(SUPABASE_URL+"/functions/v1/kelola-akun",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON_KEY,"Authorization":"Bearer "+(session?session.access_token:SUPABASE_ANON_KEY)},body:JSON.stringify(payload)});
  let out={};try{out=await res.json()}catch(e){}
  if(!res.ok||out.error)throw{code:out.error||("http_"+res.status),message:out.detail||""};
  return out;
}


/* ---------- custom dropdowns for filters ---------- */
const DD=[];let ddOpen=null;
const ddPop=el("div",{class:"dd-pop",role:"listbox",hidden:true});
document.body.append(ddPop);
function enhanceSelect(sel){
  const wrap=sel.closest(".sel");wrap.classList.add("dd");
  const val=el("span",{class:"dd-val"});
  const btn=el("button",{type:"button",class:"dd-btn","aria-haspopup":"listbox","aria-expanded":"false","aria-label":sel.getAttribute("aria-label")||""},val);
  btn.insertAdjacentHTML("beforeend",'<svg class="dd-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  sel.hidden=true;wrap.append(btn);
  const item={sel,btn,val,sync(){const o=sel.options[sel.selectedIndex]||sel.options[0];val.textContent=o?o.textContent:"";wrap.classList.toggle("active",sel.selectedIndex>0)}};
  btn.addEventListener("click",e=>{e.stopPropagation();ddOpen===item?ddClose():ddShow(item)});
  btn.addEventListener("keydown",e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();ddShow(item,true)}});
  new MutationObserver(()=>item.sync()).observe(sel,{childList:true});
  DD.push(item);item.sync();return item;
}
function ddRefresh(){DD.forEach(d=>d.sync())}
function ddClose(focusBtn){if(!ddOpen)return;const d=ddOpen;ddOpen=null;d.btn.setAttribute("aria-expanded","false");d.btn.closest(".sel").classList.remove("open");ddPop.hidden=true;ddPop.replaceChildren();if(focusBtn)d.btn.focus()}
function ddPick(d,i){d.sel.selectedIndex=i;d.sel.dispatchEvent(new Event("change",{bubbles:true}));d.sync();ddClose(true)}
function ddShow(d,kb){
  ddClose();ddOpen=d;d.btn.setAttribute("aria-expanded","true");d.btn.closest(".sel").classList.add("open");
  const opts=[...d.sel.options];
  const items=opts.map((o,i)=>{const on=i===d.sel.selectedIndex;return el("button",{type:"button",role:"option",class:"dd-opt"+(on?" on":""),"aria-selected":String(on),"data-i":i,onclick:e=>{e.stopPropagation();ddPick(d,i)}},el("span",{text:o.textContent}),el("i",{class:"dd-check","aria-hidden":"true"}))});
  ddPop.replaceChildren(el("div",{class:"dd-head",text:d.btn.getAttribute("aria-label")}),...items);
  ddPop.hidden=false;
  const r=d.btn.getBoundingClientRect();const vw=document.documentElement.clientWidth,vh=window.innerHeight;
  const w=Math.max(r.width,220);ddPop.style.minWidth=w+"px";
  const pw=ddPop.offsetWidth,ph=ddPop.offsetHeight;
  let left=Math.min(Math.max(12,r.left),vw-pw-12);let top=r.bottom+8;
  if(top+ph>vh-12&&r.top-ph-8>12){top=r.top-ph-8;ddPop.classList.add("up")}else ddPop.classList.remove("up");
  ddPop.style.left=left+"px";ddPop.style.top=top+"px";
  const cur=items[d.sel.selectedIndex]||items[0];if(cur){cur.scrollIntoView({block:"nearest"});if(kb)cur.focus()}
}
ddPop.addEventListener("keydown",e=>{
  if(!ddOpen)return;const items=[...ddPop.querySelectorAll(".dd-opt")];const i=items.indexOf(document.activeElement);
  if(e.key==="ArrowDown"){e.preventDefault();(items[i+1]||items[0]).focus()}
  else if(e.key==="ArrowUp"){e.preventDefault();(items[i-1]||items[items.length-1]).focus()}
  else if(e.key==="Escape"||e.key==="Tab"){e.preventDefault();ddClose(true)}
});
document.addEventListener("click",e=>{if(ddOpen&&!ddPop.contains(e.target))ddClose()});
window.addEventListener("resize",()=>ddClose());
window.addEventListener("scroll",e=>{if(ddOpen&&!ddPop.contains(e.target))ddClose()},true);
["#fYear","#fProgram","#fStatus","#fSort"].forEach(id=>enhanceSelect($(id)));

/* ---------- wiring ---------- */
$("#today").textContent=new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
["#addBtn","#railAdd","#bbAdd"].forEach(s=>$(s).addEventListener("click",()=>openSheet(null)));
$("#fYear").addEventListener("change",e=>{S.fYear=e.target.value;renderAll()});
$("#fProgram").addEventListener("change",e=>{S.fProgram=e.target.value;renderAll()});
$("#fStatus").addEventListener("change",e=>{S.fStatus=e.target.value;renderTable()});
$("#fSort").addEventListener("change",e=>{const [k,d]=e.target.value.split(":");S.sort={k,d:Number(d)};renderTable()});
$("#fQ").addEventListener("input",e=>{S.fQ=e.target.value;renderTable()});
$("#tabSoon").addEventListener("click",()=>{S.tab="soon";renderFollow()});
$("#tabDocs").addEventListener("click",()=>{S.tab="docs";renderFollow()});
$("#tabLate").addEventListener("click",()=>{S.tab="late";renderFollow()});
document.querySelectorAll("th button").forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.sort;S.sort=S.sort.k===k?{k,d:-S.sort.d}:{k,d:k==="kepuasan"||k==="target"||k==="omzetRp"?-1:1};syncSortSelect();renderTable()}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ddOpen){ddClose(true);return}if(e.key==="Escape"){if(draft)closeSheet(true);else if(panelOpen)closePanel();closeMenu()}});
document.querySelectorAll("[data-nav]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();const t=document.getElementById(a.dataset.nav);if(t)t.scrollIntoView()}));
let resizeT;window.addEventListener("resize",()=>{clearTimeout(resizeT);resizeT=setTimeout(()=>{if(!$("#appView").hidden)renderTrend()},150)});
if("IntersectionObserver" in window){
  const setNav=id=>document.querySelectorAll("[data-nav]").forEach(a=>a.setAttribute("aria-current",String(a.dataset.nav===id)));
  const io=new IntersectionObserver(es=>{const v=es.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(v)setNav(v.target.id)},{rootMargin:"-30% 0px -60% 0px"});
  ["ringkasan","tindak","daftar"].forEach(id=>{const n=document.getElementById(id);if(n)io.observe(n)});
}

/* ---------- user menu ---------- */
const ROLE_LABEL={admin:"Admin",editor:"Editor",viewer:"Viewer"};
function closeMenu(){$("#userMenu").hidden=true;$("#userBtn").setAttribute("aria-expanded","false")}
$("#userBtn").addEventListener("click",e=>{e.stopPropagation();const m=$("#userMenu");m.hidden=!m.hidden;$("#userBtn").setAttribute("aria-expanded",String(!m.hidden))});
document.addEventListener("click",e=>{if(!e.target.closest("#userMenu"))closeMenu()});
$("#signOutBtn").addEventListener("click",()=>SB.client.auth.signOut());
$("#membersBtn").addEventListener("click",()=>{closeMenu();openMembers()});
$("#passwordBtn").addEventListener("click",()=>{closeMenu();openPassword()});
function renderUser(){
  const email=SB.user?SB.user.email:"";const m=SB.member||{};
  const name=m.nama||email.split("@")[0]||"";
  $("#userBtn").textContent=(name.match(/\b\w/g)||["?"]).slice(0,2).join("").toUpperCase();
  $("#umName").textContent=name;$("#umEmail").textContent=email;$("#umRole").textContent=ROLE_LABEL[m.role]||"";
  $("#membersBtn").hidden=m.role!=="admin";
}

/* ---------- side panels (members, password) ---------- */
let panelOpen=null,members=[];
function closePanel(){panelOpen=null;$("#sheetRoot").replaceChildren()}
function panel(title,...body){
  const sheet=el("div",{class:"sheet",role:"dialog","aria-modal":"true","aria-labelledby":"panelTitle"},
    el("div",{class:"sheet-head"},el("h2",{id:"panelTitle",text:title}),el("button",{class:"btn ghost",type:"button",onclick:closePanel},"Tutup")),
    el("div",{class:"sheet-body"},...body));
  $("#sheetRoot").replaceChildren(el("div",{class:"scrim",onclick:closePanel}),sheet);
}
const pwField=(id,label,auto)=>el("div",{class:"f"},el("label",{for:id,text:label}),el("input",{type:"password",id,autocomplete:auto||"new-password",minlength:"8"}));

function openPassword(){
  panelOpen="password";
  const err=el("div",{class:"err",role:"alert"});
  const btn=el("button",{class:"btn primary",type:"submit",style:"justify-content:center"},"Simpan password");
  const form=el("form",{class:"capai",novalidate:true,onsubmit:async e=>{
    e.preventDefault();err.textContent="";
    const a=$("#pwNew").value,b=$("#pwNew2").value;
    if(a.length<8){err.textContent="Password minimal 8 karakter.";return}
    if(a!==b){err.textContent="Kedua password tidak sama.";return}
    btn.disabled=true;btn.textContent="Menyimpan…";
    const {error}=await SB.client.auth.updateUser({password:a});
    btn.disabled=false;btn.textContent="Simpan password";
    if(error){err.textContent=/different from the old/i.test(error.message)?"Password baru harus berbeda dari yang lama.":"Gagal menyimpan password. Coba lagi.";return}
    closePanel();toast("Password diperbarui");
  }},el("legend",{text:"Password baru"}),pwField("pwNew","Password baru (min. 8 karakter)"),pwField("pwNew2","Ulangi password baru"),btn,err);
  panel("Ganti password",form);
  $("#pwNew").focus();
}

async function loadMembers(){const {data,error}=await SB.client.from("members").select("email,nama,role").order("nama",{ascending:true});if(error)throw error;members=data||[]}
async function openMembers(){
  panelOpen="members";
  try{await loadMembers()}catch(e){toast("Daftar anggota tidak dapat dimuat.");panelOpen=null;return}
  renderMembers();
}
function renderMembers(){
  if(panelOpen!=="members")return;
  const meEmail=(SB.user.email||"").toLowerCase();
  const roleSel=m=>{const s=el("select",{"aria-label":"Peran "+m.email,disabled:m.email===meEmail,onchange:async e=>{const {error}=await SB.client.from("members").update({role:e.target.value}).eq("email",m.email);if(error){toast("Gagal mengubah peran");}else{m.role=e.target.value;toast("Peran diperbarui")}}},["admin","editor","viewer"].map(r=>el("option",{value:r,text:ROLE_LABEL[r]})));s.value=m.role;return s};
  const resetRow=m=>{
    const box=el("div",{class:"mreset",hidden:true});
    const inp=el("input",{type:"password",autocomplete:"new-password",placeholder:"Password baru (min. 8)","aria-label":"Password baru untuk "+m.email});
    const save=el("button",{class:"btn primary",type:"button",onclick:async()=>{if(inp.value.length<8){toast("Password minimal 8 karakter");return}save.disabled=true;try{await callAccount({action:"set-password",email:m.email,password:inp.value});toast("Password "+m.email+" diperbarui");box.hidden=true;inp.value=""}catch(x){toast(x.code==="user_not_found"?"Akun login belum ada untuk email ini.":"Gagal mengatur password")}finally{save.disabled=false}}},"Simpan");
    box.append(inp,save);return box;
  };
  const list=el("ul",{class:"mlist"},members.map(m=>{
    const reset=resetRow(m);
    return el("li",{class:"mitem"},
      el("div",{class:"mrow"},
        el("div",{class:"mwho"},el("b",{text:m.nama||m.email.split("@")[0]}),el("span",{text:m.email+(m.email===meEmail?" (Anda)":"")})),
        el("label",{class:"sel flat"},roleSel(m)),
        m.email===meEmail?el("span",{class:"x",style:"visibility:hidden"},"×"):el("button",{class:"x",type:"button",title:"Hapus akses","aria-label":"Hapus akses "+m.email,onclick:async e=>{const b=e.currentTarget;if(!b.dataset.armed){b.dataset.armed="1";b.textContent="Hapus?";b.classList.add("armed");return}try{await callAccount({action:"delete",email:m.email});members=members.filter(x=>x.email!==m.email);renderMembers();toast("Akses dan akun dihapus")}catch(x){toast("Gagal menghapus akses")}}},"×")),
      m.email===meEmail?null:el("button",{class:"linkbtn",type:"button",onclick:()=>{reset.hidden=!reset.hidden;if(!reset.hidden)reset.querySelector("input").focus()}},"Atur ulang password"),
      reset);
  }));
  const err=el("div",{class:"err",id:"memErr",role:"alert"});
  const nama=el("input",{type:"text",id:"memNama",placeholder:"Nama",autocomplete:"off"});
  const email=el("input",{type:"email",id:"memEmail",placeholder:"email@perusahaan.co.id",autocomplete:"off"});
  const pass=el("input",{type:"password",id:"memPass",placeholder:"Password awal (min. 8 karakter)",autocomplete:"new-password"});
  const role=el("select",{id:"memRole","aria-label":"Peran"},el("option",{value:"editor",text:"Editor: input & upload"}),el("option",{value:"viewer",text:"Viewer: lihat saja"}),el("option",{value:"admin",text:"Admin: kelola akses"}));
  const add=el("button",{class:"btn primary",type:"button",id:"memAdd",style:"justify-content:center",onclick:async()=>{
    err.textContent="";const em=email.value.trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){err.textContent="Alamat email tidak valid.";return}
    if(members.some(m=>m.email===em)){err.textContent="Email ini sudah terdaftar.";return}
    if(pass.value.length<8){err.textContent="Password awal minimal 8 karakter.";return}
    add.disabled=true;add.textContent="Menyimpan…";
    try{await callAccount({action:"create",email:em,password:pass.value,nama:nama.value.trim(),role:role.value});await loadMembers();toast("Anggota ditambahkan. Berikan password awalnya secara langsung.");renderMembers()}
    catch(x){err.textContent=x.code==="forbidden"?"Hanya admin yang dapat menambah anggota.":x.code==="weak_password"?"Password awal minimal 8 karakter.":"Gagal menambah anggota. Coba lagi."}
    finally{add.disabled=false;add.textContent="Tambah anggota"}
  }},"Tambah anggota");
  panel("Kelola akses",
    el("section",{class:"capai"},el("legend",{text:"Tambah anggota BSD"}),el("div",{class:"f"},nama),el("div",{class:"f"},email),el("div",{class:"f"},pass),el("div",{class:"f"},role),add,
      el("span",{class:"hint",text:"Sampaikan password awal ke anggota secara langsung. Mereka bisa menggantinya lewat menu akun > Ganti password."}),err),
    el("div",null,el("legend",{text:members.length+" anggota",style:"display:block"}),list));
}

/* ---------- auth & boot ---------- */
function show(view){$("#authView").hidden=view!=="auth";$("#appView").hidden=view!=="app";$("#gateView").hidden=view!=="gate";$("#setupView").hidden=view!=="setup";$("#bootView").hidden=view!=="boot"}
function gate(title,msg){$("#gateTitle").textContent=title;$("#gateMsg").textContent=msg;show("gate")}

$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const err=$("#loginErr");err.textContent="";
  const btn=$("#loginBtn");btn.disabled=true;btn.textContent="Masuk…";
  const {error}=await SB.client.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPass").value});
  btn.disabled=false;btn.textContent="Masuk";
  if(error)err.textContent=/invalid login credentials/i.test(error.message)?"Email atau password salah.":/rate|too many/i.test(error.message)?"Terlalu banyak percobaan. Coba lagi beberapa menit lagi.":"Gagal masuk. Periksa koneksi lalu coba lagi.";
});
$("#forgotBtn").addEventListener("click",()=>{$("#loginErr").textContent="";toast("Hubungi admin BSD untuk mengatur ulang password Anda.")});
$("#gateSignOut").addEventListener("click",()=>SB.client.auth.signOut());

$("#bootForm").addEventListener("submit",async e=>{
  e.preventDefault();const err=$("#bootErr");err.textContent="";
  const email=$("#bootEmail").value.trim().toLowerCase(),a=$("#bootPass").value,b=$("#bootPass2").value;
  if(a.length<8){err.textContent="Password minimal 8 karakter.";return}
  if(a!==b){err.textContent="Kedua password tidak sama.";return}
  const btn=$("#bootBtn");btn.disabled=true;btn.textContent="Membuat akun…";
  try{
    await callAccount({action:"bootstrap",email,password:a});
    history.replaceState(null,"",location.pathname);
    const {error}=await SB.client.auth.signInWithPassword({email,password:a});
    if(error)throw{code:"login_failed"};
  }catch(x){err.textContent=x.code==="already_initialized"?"Akun admin pertama sudah pernah dibuat. Silakan masuk di halaman login.":x.code==="not_admin_member"?"Email ini tidak terdaftar sebagai admin.":"Gagal membuat akun. Coba lagi."}
  finally{btn.disabled=false;btn.textContent="Buat akun admin"}
});

let rowsChannel=null,refetchT=null;
async function fetchRows(){
  const {data,error}=await SB.client.from("copart").select("id,data").order("created_at",{ascending:true});
  if(error){S.mode="live";notice(/row-level|permission/i.test(error.message)?"Akses Anda ke data copart ditolak. Hubungi admin BSD.":"Data copart tidak dapat dimuat saat ini.");renderAll();return}
  notice("");S.mode="live";S.rows=rowsToState(data||[]);renderAll();
  if(draft&&S.editing&&!S.rows.find(r=>r.id===S.editing)){closeSheet(false);toast("Copart ini baru saja dihapus oleh pengguna lain")}
}
function stopData(){if(rowsChannel){SB.client.removeChannel(rowsChannel);rowsChannel=null}if(panelOpen)closePanel();if(draft)closeSheet(false);S.rows=[];S.mode="loading"}
function startData(){
  S.mode="loading";renderAll();fetchRows();
  rowsChannel=SB.client.channel("copart-changes").on("postgres_changes",{event:"*",schema:"public",table:"copart"},()=>{clearTimeout(refetchT);refetchT=setTimeout(fetchRows,300)}).subscribe();
}
async function onSession(session){
  stopData();SB.user=session?session.user:null;SB.member=null;
  if(!SB.user){show(location.hash==="#setup-admin"?"boot":"auth");return}
  const email=(SB.user.email||"").toLowerCase();
  const {data,error}=await SB.client.from("members").select("email,nama,role").eq("email",email).maybeSingle();
  if(error){gate("Tidak dapat memeriksa akses","Periksa koneksi lalu muat ulang halaman. Jika masalah berlanjut, hubungi admin BSD.");return}
  if(!data){gate("Akun belum terdaftar","Email "+SB.user.email+" belum ada di daftar anggota BSD. Minta admin BSD menambahkan Anda.");return}
  SB.member=data;
  S.canWrite=data.role==="admin"||data.role==="editor";
  S.assets=S.canWrite?makeAssets():null;
  renderUser();show("app");startData();
}
function boot(){
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY||String(SUPABASE_ANON_KEY).startsWith("ISI_")){show("setup");return}
  SB.client=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  col=makeCol();
  let lastUser;
  SB.client.auth.onAuthStateChange((event,session)=>{
    const uid=session&&session.user?session.user.id:null;
    if(event==="TOKEN_REFRESHED"||(event!=="SIGNED_OUT"&&uid===lastUser&&event!=="INITIAL_SESSION"))return;
    lastUser=uid;setTimeout(()=>onSession(session),0);
  });
  window.addEventListener("hashchange",()=>{if(!SB.user)show(location.hash==="#setup-admin"?"boot":"auth")});
}
boot();
})();
