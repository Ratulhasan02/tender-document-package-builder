import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {PDFDocument,StandardFonts,rgb} from "pdf-lib";
import "./styles.css";

const data={tender:{tender_id:"T-2026-0417",title:"Supply of IT Equipment",procuring_entity:"Example Directorate",bidder:"Example Company Ltd.",submission_deadline:"2026-10-20"},
requirements:[
{id:"R01",order:1,title_en:"Trade License",title_bn:"ট্রেড লাইসেন্স",mandatory:true,has_expiry:true},
{id:"R02",order:2,title_en:"TIN Certificate",title_bn:"টিআইএন সার্টিফিকেট",mandatory:true,has_expiry:false},
{id:"R03",order:3,title_en:"VAT Certificate",title_bn:"ভ্যাট সার্টিফিকেট",mandatory:true,has_expiry:true},
{id:"R04",order:4,title_en:"Bank Solvency Letter",title_bn:"ব্যাংক সলভেন্সি লেটার",mandatory:true,has_expiry:true},
{id:"R05",order:5,title_en:"Experience Certificate",title_bn:"অভিজ্ঞতার সার্টিফিকেট",mandatory:false,has_expiry:false},
{id:"R06",order:6,title_en:"Technical Proposal",title_bn:"টেকনিক্যাল প্রপোজাল",mandatory:true,has_expiry:false},
{id:"R07",order:7,title_en:"Financial Proposal",title_bn:"ফাইন্যান্সিয়াল প্রপোজাল",mandatory:true,has_expiry:false}]};

const T={en:{appTitle:"Tender Document Package Builder",subtitle:"Checked, ordered and submission-ready PDF packaging",language:"বাংলা",details:"Tender Details",documents:"Required Documents",uploads:"Uploaded PDFs",id:"Tender ID",title:"Title",entity:"Procuring Entity",bidder:"Bidder",deadline:"Submission Deadline",required:"Required",optional:"Optional",upload:"Upload PDF files",uploadHelp:"PDF only · up to 30 files · 50 MB total",none:"No PDF files uploaded.",pages:"pages",unmatched:"Not matched",expiry:"Expiry date",missing:"Missing",need:"Expiry date needed",expired:"Expired",notProvided:"Not provided",ok:"OK",remove:"Remove",generate:"Generate Package",blocked:"Resolve all blocking statuses before generating.",success:"Package generated successfully. The download should start automatically.",error:"Something went wrong.",invalid:"Only PDF files are accepted.",limit:"Upload limit exceeded.",footer:"Frontend only · No backend storage"},
bn:{appTitle:"টেন্ডার ডকুমেন্ট প্যাকেজ বিল্ডার",subtitle:"যাচাইকৃত, সঠিক ক্রমে সাজানো PDF প্যাকেজ",language:"English",details:"টেন্ডারের তথ্য",documents:"প্রয়োজনীয় ডকুমেন্ট",uploads:"আপলোড করা PDF",id:"টেন্ডার আইডি",title:"শিরোনাম",entity:"প্রকিউরিং প্রতিষ্ঠান",bidder:"বিডার",deadline:"জমাদানের শেষ তারিখ",required:"আবশ্যিক",optional:"ঐচ্ছিক",upload:"PDF ফাইল আপলোড করুন",uploadHelp:"শুধু PDF · সর্বোচ্চ ৩০টি · মোট ৫০ MB",none:"এখনও কোনো PDF আপলোড করা হয়নি।",pages:"পৃষ্ঠা",unmatched:"ম্যাচ হয়নি",expiry:"মেয়াদ শেষের তারিখ",missing:"অনুপস্থিত",need:"মেয়াদের তারিখ প্রয়োজন",expired:"মেয়াদ শেষ",notProvided:"দেওয়া হয়নি",ok:"ঠিক আছে",remove:"সরান",generate:"প্যাকেজ তৈরি করুন",blocked:"প্যাকেজ তৈরির আগে সব blocking status ঠিক করুন।",success:"প্যাকেজ সফলভাবে তৈরি হয়েছে। ডাউনলোড শুরু হবে।",error:"কিছু ভুল হয়েছে।",invalid:"শুধু PDF গ্রহণ করা হবে।",limit:"আপলোড সীমা অতিক্রম হয়েছে।",footer:"শুধু ব্রাউজারে কাজ করে · কোনো backend storage নেই"}};

async function countPages(file){const pdfjs=await import("pdfjs-dist");pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();return(await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise).numPages}
async function hashFile(file){const h=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function save(bytes,name){const u=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"})),a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}

async function buildPackage(){
 const source=new Map();
 for(const f of window.__files){source.set(f.id,await PDFDocument.load(await f.file.arrayBuffer()))}
 const included=data.requirements.filter(r=>window.__matches[r.id]).sort((a,b)=>a.order-b.order);
 const out=await PDFDocument.create(),font=await out.embedFont(StandardFonts.Helvetica);
 const cover=out.addPage([595,842]);let y=790;
 const draw=(s,size=12)=>{cover.drawText(String(s),{x:45,y,size,font});y-=size+10};
 draw("TENDER DOCUMENT PACKAGE",22);y-=8;
 draw(`Tender ID: ${data.tender.tender_id}`);draw(`Tender Title: ${data.tender.title}`);draw(`Procuring Entity: ${data.tender.procuring_entity}`);
 draw(`Bidder: ${data.tender.bidder}`);draw(`Submission Deadline: ${data.tender.submission_deadline}`);draw(`Package Made: ${new Date().toISOString().slice(0,10)}`);
 y-=10;draw("Included Documents",15);included.forEach((r,i)=>draw(`${i+1}. ${r.title_en}`));
 for(const r of included){const src=source.get(window.__matches[r.id]);const pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p))}
 const total=out.getPageCount();
 out.getPages().forEach((p,i)=>p.drawText(`${data.tender.tender_id} | Page ${i+1} of ${total}`,{x:45,y:18,size:8,font,color:rgb(.25,.25,.25)}));
 return out.save();
}

function App(){
 const[lang,setLang]=useState(localStorage.getItem("lang")||"en"),[files,setFiles]=useState([]),[matches,setMatches]=useState({}),[expiry,setExpiry]=useState({}),[error,setError]=useState(""),[message,setMessage]=useState("");
 const t=T[lang];useEffect(()=>localStorage.setItem("lang",lang),[lang]);
 const duplicates=useMemo(()=>{const c={};files.forEach(f=>c[f.hash]=(c[f.hash]||0)+1);return new Set(Object.keys(c).filter(k=>c[k]>1))},[files]);
 function status(r){const f=files.find(x=>x.id===matches[r.id]);if(!f)return r.mandatory?"missing":"optional";if(duplicates.has(f.hash))return"missing";if(r.has_expiry&&!expiry[r.id])return"need";if(r.has_expiry&&expiry[r.id]<data.tender.submission_deadline)return"expired";return"ok"}
 async function add(e){setError("");const selected=[...e.target.files];if(files.length+selected.length>30||[...files,...selected].reduce((a,f)=>a+f.size,0)>50*1024*1024){setError(t.limit);return}const a=[];for(const file of selected){if(file.type!=="application/pdf"){setError(t.invalid);continue}try{a.push({id:crypto.randomUUID(),file,name:file.name,size:file.size,pages:await countPages(file),hash:await hashFile(file)})}catch{setError(t.error)}}setFiles(v=>[...v,...a]);e.target.value=""}
 function remove(id){setFiles(v=>v.filter(f=>f.id!==id));setMatches(v=>Object.fromEntries(Object.entries(v).filter(([,x])=>x!==id)))}
 async function generate(){setError("");setMessage("");window.__files=files;window.__matches=matches;try{const bytes=await buildPackage();save(bytes,`${data.tender.tender_id}_Package.pdf`);setMessage(t.success)}catch(e){console.error(e);setError(t.error)}}
 const blocking=data.requirements.some(r=>["missing","need","expired"].includes(status(r))),used=new Set(Object.values(matches)),labels={missing:t.missing,need:t.need,expired:t.expired,optional:t.notProvided,ok:t.ok};
 return <div className="app"><header className="topbar"><div className="brand"><h1>{t.appTitle}</h1><p>{t.subtitle}</p></div><button className="lang-btn" onClick={()=>setLang(lang==="en"?"bn":"en")}>{t.language}</button></header>
 <main className="container">{error&&<div className="alert">{error}</div>}{message&&<div className="success">{message}</div>}<div className="grid">
 <section className="card"><h2>{t.details}</h2><div className="meta"><div className="meta-item"><small>{t.id}</small>{data.tender.tender_id}</div><div className="meta-item"><small>{t.title}</small>{data.tender.title}</div><div className="meta-item"><small>{t.entity}</small>{data.tender.procuring_entity}</div><div className="meta-item"><small>{t.bidder}</small>{data.tender.bidder}</div><div className="meta-item"><small>{t.deadline}</small>{data.tender.submission_deadline}</div></div>
 <h2 style={{marginTop:22}}>{t.documents}</h2>{data.requirements.map(r=><div className="requirement" key={r.id}><div className="req-main"><div className="req-title">{lang==="bn"?r.title_bn:r.title_en}</div><div className="req-sub">{r.id} · {r.mandatory?t.required:t.optional}{r.has_expiry?" · "+t.expiry:""}</div>
 <select className="select" value={matches[r.id]||""} onChange={e=>setMatches({...matches,[r.id]:e.target.value})}><option value="">{t.unmatched}</option>{files.filter(f=>!used.has(f.id)||f.id===matches[r.id]).map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select>
 {r.has_expiry&&matches[r.id]&&<input className="date" type="date" value={expiry[r.id]||""} onChange={e=>setExpiry({...expiry,[r.id]:e.target.value})}/>}</div><span className={"badge status "+status(r)}>{labels[status(r)]}</span></div>)}
 <div className="controls" style={{marginTop:16}}><button className="primary" disabled={blocking} onClick={generate}>{t.generate}</button>{blocking&&<span className="muted">{t.blocked}</span>}</div></section>
 <section className="card"><h2>{t.uploads}</h2><div className="dropzone"><div>{t.uploadHelp}</div><input className="file-input" type="file" accept="application/pdf" multiple onChange={add}/></div>{files.length===0?<div className="empty">{t.none}</div>:files.map(f=><div className="file-row" key={f.id}><div><div className="file-name">{f.name}</div><span className="muted">{f.pages} {t.pages} · {Math.ceil(f.size/1024)} KB</span></div><div className="controls"><span className="badge">{duplicates.has(f.hash)?t.duplicate:"PDF"}</span><button className="secondary" onClick={()=>remove(f.id)}>{t.remove}</button></div></div>)}</section>
 </div></main><div className="footer-note">AI DevFest 2026 · {t.footer}</div></div>
}
createRoot(document.getElementById("root")).render(<App/>);
