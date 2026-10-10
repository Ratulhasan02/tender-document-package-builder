import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import data from "../requirements.json";
import { translations } from "./i18n.js";
import "./styles.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const MAX_FILES = 30;
const MAX_BYTES = 50 * 1024 * 1024;
const BLOCKING = new Set(["missing", "need", "expired", "duplicate"]);
const STATUS_META = {
  ok: { icon: "✓", tone: "ok" },
  notProvided: { icon: "–", tone: "muted" },
  missing: { icon: "✕", tone: "bad" },
  need: { icon: "!", tone: "warn" },
  expired: { icon: "✕", tone: "bad" },
  duplicate: { icon: "!", tone: "warn" },
};

/* ---------- helpers ---------- */
const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.ceil(b / 1024)) + " KB");

async function readPdf(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hash = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const pages = doc.numPages;
  await doc.destroy();
  return { pages, hash };
}

function save(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const GENERIC = new Set(["certificate", "letter", "proposal", "of", "the"]);
const ALIAS = { licence: "license" };
const tokens = (s) =>
  s.toLowerCase().replace(/\.pdf$/, "").split(/[^a-z0-9]+/).filter(Boolean).map((w) => ALIAS[w] || w);

function suggest(file, reqs, takenReqIds) {
  const ft = new Set(tokens(file.name));
  let best = null, score = 0;
  for (const r of reqs) {
    if (takenReqIds.has(r.id)) continue;
    const s = tokens(r.title_en).filter((w) => !GENERIC.has(w) && ft.has(w)).length;
    if (s > score) { score = s; best = r; }
  }
  return best;
}

/* ---------- PDF generation ---------- */
const safe = (s) => String(s).replace(/[^\x20-\x7E]/g, "?");

function wrap(text, font, size, max) {
  const words = safe(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(next, size) > max && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function buildPackage(files, matches, reqs, expiry, tender) {
  const byId = new Map(files.map((f) => [f.id, f]));
  const included = reqs.filter((r) => byId.has(matches[r.id])).sort((a, b) => a.order - b.order);

  const sources = new Map();
  for (const r of included) {
    const f = byId.get(matches[r.id]);
    sources.set(r.id, await PDFDocument.load(await f.file.arrayBuffer()));
  }

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const cover = out.addPage([595, 842]);
  let y = 790;
  const left = 45, width = 505;
  const line = (text, size = 12, f = font) => {
    for (const l of wrap(text, f, size, width)) {
      if (y < 50) return;
      cover.drawText(l, { x: left, y, size, font: f });
      y -= size + 6;
    }
    y -= 4;
  };

  line("TENDER DOCUMENT PACKAGE", 22, bold);
  y -= 6;
  line(`Tender ID: ${tender.tender_id}`);
  line(`Tender Title: ${tender.title}`);
  line(`Procuring Entity: ${tender.procuring_entity}`);
  line(`Bidder: ${tender.bidder}`);
  line(`Submission Deadline: ${tender.submission_deadline}`);
  line(`Package Made: ${new Date().toISOString().slice(0, 10)}`);
  y -= 8;
  line("Included Documents", 15, bold);

  let start = 2;
  included.forEach((r, i) => {
    const n = sources.get(r.id).getPageCount();
    const range = n === 1 ? `page ${start}` : `pages ${start}-${start + n - 1}`;
    start += n;
    const exp = r.has_expiry && expiry[r.id] ? ` (expires ${expiry[r.id]})` : "";
    line(`${i + 1}. ${r.title_en} - ${range}${exp}`);
  });

  for (const r of included) {
    const src = sources.get(r.id);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }

  const total = out.getPageCount();
  out.getPages().forEach((p, i) =>
    p.drawText(`${tender.tender_id} | Page ${i + 1} of ${total}`, {
      x: 45, y: 18, size: 8, font, color: rgb(0.25, 0.25, 0.25),
    })
  );
  return out.save();
}

/* ---------- app ---------- */
function App() {
  const [lang, setLang] = useState(() => (localStorage.getItem("lang") === "bn" ? "bn" : "en"));
  const [files, setFiles] = useState([]);
  const [matches, setMatches] = useState({});
  const [expiry, setExpiry] = useState({});
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const t = translations[lang];
  const tender = data.tender;
  const reqs = useMemo(() => [...data.requirements].sort((a, b) => a.order - b.order), []);

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const fileById = useMemo(() => new Map(files.map((f) => [f.id, f])), [files]);
  const duplicates = useMemo(() => {
    const c = {};
    files.forEach((f) => (c[f.hash] = (c[f.hash] || 0) + 1));
    return new Set(Object.keys(c).filter((k) => c[k] > 1));
  }, [files]);
  const reqByFile = useMemo(() => {
    const m = new Map();
    reqs.forEach((r) => matches[r.id] && m.set(matches[r.id], r));
    return m;
  }, [reqs, matches]);

  function status(r) {
    const f = fileById.get(matches[r.id]);
    if (!f) return r.mandatory ? "missing" : "notProvided";
    if (duplicates.has(f.hash)) return "duplicate";
    if (r.has_expiry) {
      if (!expiry[r.id]) return "need";
      if (expiry[r.id] < tender.submission_deadline) return "expired";
    }
    return "ok";
  }

  const statuses = Object.fromEntries(reqs.map((r) => [r.id, status(r)]));
  const blockers = reqs.filter((r) => BLOCKING.has(statuses[r.id]));
  const mandatory = reqs.filter((r) => r.mandatory);
  const readyCount = mandatory.filter((r) => statuses[r.id] === "ok").length;
  const pct = mandatory.length ? Math.round((readyCount / mandatory.length) * 100) : 100;
  const totalPages = 1 + reqs.reduce((a, r) => a + (fileById.get(matches[r.id])?.pages || 0), 0);
  const takenReqs = new Set(Object.keys(matches));
  const usedFiles = new Set(Object.values(matches));

  async function addFiles(list) {
    const selected = [...list];
    if (!selected.length) return;
    const errs = [];
    const pdfs = [];
    for (const f of selected) {
      if (isPdf(f)) pdfs.push(f);
      else errs.push(t.invalidType.replace("{name}", f.name));
    }
    const total = files.reduce((a, f) => a + f.size, 0) + pdfs.reduce((a, f) => a + f.size, 0);
    if (files.length + pdfs.length > MAX_FILES || total > MAX_BYTES) {
      setErrors([...errs, t.limit]);
      return;
    }
    setBusy("reading");
    setMessage("");
    const added = [];
    for (const file of pdfs) {
      try {
        const { pages, hash } = await readPdf(file);
        added.push({ id: crypto.randomUUID(), file, name: file.name, size: file.size, pages, hash });
      } catch (e) {
        errs.push((e && e.name === "PasswordException" ? t.protectedPdf : t.damagedPdf).replace("{name}", file.name));
      }
    }
    setFiles((v) => [...v, ...added]);
    setErrors(errs);
    setBusy("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(id) {
    const affected = Object.entries(matches).filter(([, v]) => v === id).map(([k]) => k);
    setFiles((v) => v.filter((f) => f.id !== id));
    setMatches((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id)));
    setExpiry((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !affected.includes(k))));
  }

  function setMatch(reqId, fileId) {
    setMatches((m) => {
      const n = { ...m };
      if (fileId) n[reqId] = fileId; else delete n[reqId];
      return n;
    });
    setExpiry((e) => {
      const n = { ...e };
      delete n[reqId];
      return n;
    });
  }

  function autoMatch() {
    const taken = new Set(Object.keys(matches));
    const used = new Set(Object.values(matches));
    const next = { ...matches };
    for (const f of files) {
      if (used.has(f.id)) continue;
      const r = suggest(f, reqs, taken);
      if (r) { next[r.id] = f.id; taken.add(r.id); used.add(f.id); }
    }
    setMatches(next);
  }

  async function generate() {
    setErrors([]);
    setMessage("");
    setBusy("generating");
    try {
      const bytes = await buildPackage(files, matches, reqs, expiry, tender);
      save(bytes, `${tender.tender_id}_Package.pdf`);
      setMessage(t.success);
    } catch (e) {
      console.error(e);
      setErrors([t.genError]);
    } finally {
      setBusy("");
    }
  }

  const reqTitle = (r) => (lang === "bn" ? r.title_bn : r.title_en);
  const canGenerate = blockers.length === 0 && !busy;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>{t.appTitle}</h1>
          <p>{t.subtitle}</p>
        </div>
        <button className="lang-btn" onClick={() => setLang(lang === "en" ? "bn" : "en")}>{t.language}</button>
      </header>

      <main className="container">
        <div aria-live="polite">
          {errors.map((m, i) => (
            <div className="banner bad" key={i}>
              <span>{m}</span>
              <button className="link" onClick={() => setErrors((v) => v.filter((_, j) => j !== i))}>{t.dismiss}</button>
            </div>
          ))}
          {message && (
            <div className="banner ok">
              <span>{message}</span>
              <button className="link" onClick={() => setMessage("")}>{t.dismiss}</button>
            </div>
          )}
        </div>

        <section className="panel readiness">
          <div className="readiness-main">
            <h2>{t.readiness}</h2>
            <p className="big">{t.readyOf.replace("{a}", readyCount).replace("{b}", mandatory.length)}</p>
            <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
              <div className="bar-fill" style={{ width: pct + "%" }} />
            </div>
            <p className="muted">{t.pagesEst.replace("{n}", totalPages)}</p>
          </div>
          <div className="readiness-side">
            <button className="primary" disabled={!canGenerate} onClick={generate}>
              {busy === "generating" && <span className="spinner" aria-hidden="true" />} {busy === "generating" ? t.generating : t.generate}
            </button>
            {blockers.length === 0 && files.length > 0 && <p className="ok-text">{t.allReady}</p>}
          </div>
          {blockers.length > 0 && (
            <div className="blockers">
              <strong>{t.blockedTitle}</strong>
              <ul>
                {blockers.map((r) => (
                  <li key={r.id}>{reqTitle(r)}: {t.status[statuses[r.id]]}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="grid">
          <section className="panel">
            <h2>{t.details}</h2>
            <dl className="meta">
              <div><dt>{t.id}</dt><dd>{tender.tender_id}</dd></div>
              <div><dt>{t.title}</dt><dd>{tender.title}</dd></div>
              <div><dt>{t.entity}</dt><dd>{tender.procuring_entity}</dd></div>
              <div><dt>{t.bidder}</dt><dd>{tender.bidder}</dd></div>
              <div><dt>{t.deadline}</dt><dd>{tender.submission_deadline}</dd></div>
            </dl>

            <h2 className="spaced">{t.documents}</h2>
            {reqs.map((r) => {
              const s = statuses[r.id];
              const meta = STATUS_META[s];
              const matched = matches[r.id];
              return (
                <div className={"req " + meta.tone} key={r.id}>
                  <div className="req-head">
                    <div>
                      <div className="req-title">{reqTitle(r)}</div>
                      <div className="req-sub">{r.mandatory ? t.required : t.optional}</div>
                    </div>
                    <span className={"badge " + meta.tone}><span aria-hidden="true">{meta.icon}</span> {t.status[s]}</span>
                  </div>
                  <select
                    className="select"
                    aria-label={reqTitle(r)}
                    value={matched || ""}
                    onChange={(e) => setMatch(r.id, e.target.value)}
                  >
                    <option value="">{t.unmatched}</option>
                    {files.filter((f) => !usedFiles.has(f.id) || f.id === matched).map((f) => (
                      <option value={f.id} key={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {r.has_expiry && matched && (
                    <label className="date-field">
                      <span>{t.expiryLabel}</span>
                      <input
                        className="date"
                        type="date"
                        value={expiry[r.id] || ""}
                        onChange={(e) => setExpiry({ ...expiry, [r.id]: e.target.value })}
                      />
                      <small>{t.expiryHint.replace("{d}", tender.submission_deadline)}</small>
                    </label>
                  )}
                  {t.hint[s] && <p className="hint">{t.hint[s]}</p>}
                </div>
              );
            })}
          </section>

          <section className="panel">
            <h2>{t.uploads}</h2>
            <div
              className={"dropzone" + (drag ? " drag" : "")}
              aria-busy={busy === "reading"}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            >
              <p className="drop-title">{busy === "reading" ? t.reading : t.dropTitle}</p>
              <button className="secondary" disabled={busy === "reading"} onClick={() => inputRef.current?.click()}>{t.browse}</button>
              <p className="muted">{t.uploadHelp}</p>
              <input
                ref={inputRef}
                className="hidden-input"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <button className="secondary wide" disabled={Boolean(busy)} onClick={autoMatch}>{t.autoMatch}</button>
            )}

            {files.length === 0 ? (
              <div className="empty">{t.none}</div>
            ) : (
              files.map((f) => {
                const used = reqByFile.get(f.id);
                const sug = !used ? suggest(f, reqs, takenReqs) : null;
                return (
                  <div className="file-row" key={f.id}>
                    <div className="file-info">
                      <div className="file-name" title={f.name}>{f.name}</div>
                      <span className="muted">{f.pages} {t.pages} · {fmtSize(f.size)}</span>
                      <div className="file-use">
                        {used ? (
                          <span className="chip ok">{t.matchedTo}: {reqTitle(used)}</span>
                        ) : sug ? (
                          <span className="chip">
                            {t.suggested}: {reqTitle(sug)}{" "}
                            <button className="link" onClick={() => setMatch(sug.id, f.id)}>{t.apply}</button>
                          </span>
                        ) : (
                          <span className="chip muted-chip">{t.notUsed}</span>
                        )}
                      </div>
                      {duplicates.has(f.hash) && <p className="hint warn-text">{t.duplicateWarn}</p>}
                    </div>
                    <button className="secondary" disabled={Boolean(busy)} onClick={() => removeFile(f.id)}>{t.remove}</button>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>
      <div className="footer-note">AI DevFest 2026 · {t.footer}</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);