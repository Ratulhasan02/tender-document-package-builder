import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { translations } from "./i18n";
import "./styles.css";

const demoRequirements = {
  tender: {
    tender_id: "T-2026-0417",
    title: "Supply of IT Equipment",
    procuring_entity: "Example Directorate",
    bidder: "Example Company Ltd.",
    submission_deadline: "2026-10-20"
  },
  requirements: [
    {id:"R01",order:1,title_en:"Trade License",title_bn:"ট্রেড লাইসেন্স",mandatory:true,has_expiry:true},
    {id:"R02",order:2,title_en:"TIN Certificate",title_bn:"টিআইএন সার্টিফিকেট",mandatory:true,has_expiry:false},
    {id:"R03",order:3,title_en:"VAT Certificate",title_bn:"ভ্যাট সার্টিফিকেট",mandatory:true,has_expiry:true},
    {id:"R04",order:4,title_en:"Bank Solvency Letter",title_bn:"ব্যাংক সলভেন্সি লেটার",mandatory:true,has_expiry:true},
    {id:"R05",order:5,title_en:"Experience Certificate",title_bn:"অভিজ্ঞতার সার্টিফিকেট",mandatory:false,has_expiry:false},
    {id:"R06",order:6,title_en:"Technical Proposal",title_bn:"টেকনিক্যাল প্রপোজাল",mandatory:true,has_expiry:false},
    {id:"R07",order:7,title_en:"Financial Proposal",title_bn:"ফাইন্যান্সিয়াল প্রপোজাল",mandatory:true,has_expiry:false}
  ]
};

function App() {
  const [lang, setLang] = useState(localStorage.getItem("lang") || "en");
  const [data, setData] = useState(demoRequirements);
  const [files, setFiles] = useState([]);
  const t = translations[lang];

  useEffect(() => localStorage.setItem("lang", lang), [lang]);

  async function handleFiles(e) {
    const selected = [...e.target.files];
    const valid = selected.filter(f => f.type === "application/pdf");
    setFiles(prev => [...prev, ...valid.map(file => ({name:file.name, size:file.size}))]);
    e.target.value = "";
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><h1>{t.appTitle}</h1><p>{t.subtitle}</p></div>
      <button className="lang-btn" onClick={() => setLang(lang === "en" ? "bn" : "en")}>{t.language}</button>
    </header>
    <main className="container">
      <div className="grid">
        <section className="card">
          <h2>{t.tenderDetails}</h2>
          <div className="meta">
            <div className="meta-item"><small>{t.tenderId}</small>{data.tender.tender_id}</div>
            <div className="meta-item"><small>{t.title}</small>{data.tender.title}</div>
            <div className="meta-item"><small>{t.entity}</small>{data.tender.procuring_entity}</div>
            <div className="meta-item"><small>{t.bidder}</small>{data.tender.bidder}</div>
            <div className="meta-item"><small>{t.deadline}</small>{data.tender.submission_deadline}</div>
          </div>
          <h2 style={{marginTop:22}}>{t.requirements}</h2>
          {data.requirements.sort((a,b)=>a.order-b.order).map(r =>
            <div className="requirement" key={r.id}>
              <div className="req-main">
                <div className="req-title">{lang==="bn"?r.title_bn:r.title_en}</div>
                <div className="req-sub">{r.id} · {r.has_expiry ? t.expiry : ""}</div>
              </div>
              <span className={"badge "+(r.mandatory?"required":"optional")}>{r.mandatory?t.required:t.optional}</span>
            </div>
          )}
        </section>
        <section className="card">
          <h2>{t.uploadTitle}</h2>
          <div className="dropzone">
            <div>{t.uploadHelp}</div>
            <input className="file-input" type="file" accept="application/pdf" multiple onChange={handleFiles}/>
          </div>
          <div style={{marginTop:18}}>
            {files.length === 0 ? <div className="empty">{t.noFiles}</div> :
              files.map((f,i)=><div className="file-row" key={i}><span className="file-name">{f.name}</span><span className="muted">{Math.ceil(f.size/1024)} KB</span></div>)}
          </div>
        </section>
      </div>
    </main>
    <div className="footer-note">AI DevFest 2026 · Frontend only</div>
  </div>
}
createRoot(document.getElementById("root")).render(<App />);
