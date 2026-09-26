/** Rendu HTML — tout est calculé côté Worker, la page n'a pas de script. */
import { local, jourFr } from "./analyse.js";
import { rendreMarkdown } from "./markdown.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Échappe, puis rend `code` et **gras** — le Markdown des TASKS.md. */
// Liens [texte](https://…) : http et https seulement, jamais « javascript: ».
// Traités avant l'italique, qui mangerait une étoile d'adresse.
const md = (s) => esc(s).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>");

const PASTILLE = { crit: "Bloquant", warn: "À voir", info: "Info", ok: "OK", idle: "—" };

const CSS = `
:root{
  /* Charte Kasbah — reprise du thème Looker (looker-theme-source-v2.png) */
  --bg:#F6F0E6; --surface:#FFFCF7; --sunk:#EFE7D9; --ink:#2A221C; --ink-2:#5C4E41; --ink-3:#8A7A68;
  --line:#DFD3BF; --accent:#2E5FB3; --accent-soft:#DEE7F7;
  --crit:#C1430E; --crit-soft:#F8E0D3; --warn:#8A6410; --warn-soft:#FBEED5; --ok:#1F8C5D; --ok-soft:#DBEFE4; --idle:#8A7A68; --idle-soft:#EBE3D5;
  --display:"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --body:"IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --mono:"IBM Plex Mono", ui-monospace, Consolas, monospace;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#211B16; --surface:#2A221C; --sunk:#342A22; --ink:#F5EEE2; --ink-2:#CBBDA3; --ink-3:#9B8B78;
    --line:#3E342A; --accent:#6E96D4; --accent-soft:#1E2B40;
    --crit:#E4703F; --crit-soft:#3A2018; --warn:#EDA92B; --warn-soft:#342612; --ok:#4FB183; --ok-soft:#16301F; --idle:#9B8B78; --idle-soft:#2E2620;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.5;padding-inline:16px;padding-block:28px 56px}
.wrap{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:36px}
h1,h2,h3{font-family:var(--display);text-wrap:balance;margin:0;line-height:1.15}
h1{font-size:clamp(28px,4vw,40px);font-weight:700;letter-spacing:-.01em}
h2{font-size:20px;font-weight:700}
h3{font-size:17px;font-weight:700}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.mono{font-family:var(--mono);font-size:.92em}
code{font-family:var(--mono);font-size:.86em;background:var(--sunk);padding:1px 5px;border-radius:4px;word-break:break-word}
a{color:var(--accent)}
a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.top{display:flex;flex-wrap:wrap;gap:16px 32px;align-items:flex-end;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:20px}
.top p{margin:6px 0 0;color:var(--ink-2);max-width:62ch}
.stamp{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}
.stamp div{display:grid}
.stamp b{font-family:var(--mono);font-weight:500;font-size:22px;font-variant-numeric:tabular-nums}
.stamp b.c{color:var(--crit)} .stamp b.w{color:var(--warn)}
.btn{font-family:var(--mono);font-size:12px;text-decoration:none;border:1px solid var(--line);border-radius:6px;padding:6px 10px;color:var(--ink);background:var(--surface);white-space:nowrap}
.btn:hover{border-color:var(--accent)}
.srcs{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.section-head{display:flex;gap:12px;align-items:baseline;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px}
.section-head p{margin:0;color:var(--ink-3);font-size:13px}
.alerts{list-style:none;margin:0;padding:0;background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.alerts li{display:grid;grid-template-columns:92px 1fr auto;gap:6px 16px;padding:14px 18px;border-top:1px solid var(--line);align-items:start}
.alerts li:first-child{border-top:0}
.alerts .what b{font-weight:600}
.alerts .what p{margin:2px 0 0;color:var(--ink-2);font-size:14px}
.alerts .who{font-size:12px;color:var(--ink-3);font-family:var(--mono);white-space:nowrap;padding-top:2px}
.vide{padding:18px;color:var(--ok);font-weight:500}
.pill{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:11px;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:999px;white-space:nowrap;justify-self:start;align-self:start}
.pill::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.p-crit{color:var(--crit);background:var(--crit-soft)}
.p-warn{color:var(--warn);background:var(--warn-soft)}
.p-ok{color:var(--ok);background:var(--ok-soft)}
.p-idle{color:var(--idle);background:var(--idle-soft)}
.p-info{color:var(--accent);background:var(--accent-soft)}
.p-test{color:#B85C00;background:#FDE8D2}
.faits .statut{margin-top:8px}
.faits a{color:var(--accent)}
@media (max-width:640px){ .alerts li{grid-template-columns:1fr} .alerts .who{white-space:normal} }
.flow-scroll{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px}
.flow{display:grid;grid-template-columns:repeat(6,minmax(150px,1fr));min-width:900px}
.step{padding:16px 16px 18px;border-left:1px solid var(--line);display:grid;gap:6px;align-content:start}
.step:first-child{border-left:0}
.step time{font-family:var(--mono);font-size:22px;font-weight:500;font-variant-numeric:tabular-nums}
.step .rail{height:4px;border-radius:2px;background:var(--idle-soft);margin:2px 0 4px}
.step.n-ok .rail{background:var(--ok)} .step.n-warn .rail{background:var(--warn)} .step.n-crit .rail{background:var(--crit)}
.step h3{font-size:15px}
.step p{margin:0;font-size:13px;color:var(--ink-2)}
.step .pill{white-space:normal}
.step .last{font-family:var(--mono);font-size:11.5px;color:var(--ink-3)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
@media (max-width:400px){.grid{grid-template-columns:1fr}}
.proj{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px 18px 16px;display:grid;gap:12px;align-content:start}
.proj .hd{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.proj h3 a{color:inherit;text-decoration:none}
.proj h3 a:hover{text-decoration:underline}
.proj .sub{font-size:13px;color:var(--ink-3);margin-top:2px}
.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0;font-size:13.5px}
.kv dt{color:var(--ink-3)} .kv dd{margin:0;min-width:0;overflow-wrap:anywhere}
.todo{list-style:none;margin:0;padding:0;display:grid;gap:7px;font-size:14px}
.todo li{display:grid;grid-template-columns:14px 1fr;gap:8px}
.todo li::before{content:"";width:10px;height:10px;border:1.5px solid var(--ink-3);border-radius:3px;margin-top:5px}
.todo li.warn::before{border-color:var(--warn);background:var(--warn-soft)}
.todo li.crit::before{border-color:var(--crit);background:var(--crit-soft)}
.todo li.done::before{border-color:var(--ok);background:var(--ok)}
.todo small{display:block;color:var(--ink-3);font-size:12.5px}
.label{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:-4px}
.note{font-size:13px;color:var(--ink-2);background:var(--sunk);border-radius:6px;padding:8px 10px;margin:0}
.chiffres{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px 12px;display:grid;gap:2px;align-content:start}
.kpi h3{font-size:15px}
.kpi .aide{margin:0 0 8px;font-size:12px;color:var(--ink-3)}
.kpi .deux{display:grid;grid-template-columns:auto 1fr;align-items:baseline;gap:4px 12px;margin:0;border-top:1px solid var(--line);padding-top:10px}
.kpi dt{font-size:11.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.04em;font-family:var(--mono)}
.kpi dd{margin:0;text-align:right;font-family:var(--mono);font-weight:500;font-size:20px;font-variant-numeric:tabular-nums;letter-spacing:-.02em;white-space:nowrap}
.kpi dt + dd{color:var(--ink)}
.kpi dt:last-of-type ~ dd{color:var(--ink-2)}
.sous-bande{margin:10px 0 0;font-size:13px;color:var(--ink-3)}
.faits{list-style:none;margin:0;padding:0;display:grid;gap:0;background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden;counter-reset:f}
.faits li{display:grid;grid-template-columns:120px 1fr;gap:6px 18px;padding:16px 18px;border-top:1px solid var(--line)}
.faits li:first-child{border-top:0}
.faits .quand{display:grid;gap:2px;align-content:start}
.faits .quand b{font-family:var(--mono);font-weight:500;font-size:14px;font-variant-numeric:tabular-nums}
.faits .quand span{font-size:11.5px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3)}
.faits .etiq{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.faits .proj{font-size:12px;color:var(--ink-3);font-family:var(--mono)}
.choix-projet{margin:0;display:inline}
.choix-projet select{font-family:var(--mono);font-size:12px;color:var(--ink-2);background:transparent;border:1px dotted var(--line);border-radius:6px;padding:2px 6px;max-width:100%;cursor:pointer}
.choix-projet select:hover,.choix-projet select:focus-visible{border-color:var(--accent);color:var(--accent);outline:none}
.choix-projet select.sans{color:var(--ink-3);font-style:italic}
.role{margin-bottom:8px}
.faits p{margin:0;font-size:14px;color:var(--ink-2)}
.faits .effet{color:var(--ink);font-weight:500;margin-bottom:4px}
@media (max-width:640px){.faits li{grid-template-columns:1fr}}
.dom{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.dom span{font-size:12.5px;font-family:var(--mono);color:var(--ink-2);background:var(--sunk);border-radius:999px;padding:4px 10px}
.dom b{font-weight:500;color:var(--ink)}
.doc{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:22px 24px}
.doc h2{font-size:19px;margin:26px 0 10px}
.doc h2:first-child{margin-top:0}
.doc h3{font-size:16px;margin:20px 0 8px}
.doc p{margin:0 0 12px;max-width:72ch}
.doc ul,.doc ol{margin:0 0 14px;padding-left:22px;max-width:72ch}
.doc li{margin-bottom:6px}
.doc table{min-width:520px}
.doc .tbl-scroll{margin:0 0 16px;border-radius:8px}
.liens{display:flex;gap:10px;flex-wrap:wrap}
.editer{display:inline-block;margin-top:8px;font-family:var(--mono);font-size:11.5px;color:var(--ink-3);text-decoration:none;border-bottom:1px dotted var(--line)}
.editer:hover{color:var(--accent);border-color:var(--accent)}
.docs{list-style:none;margin:0 0 2px;padding:0;display:grid;gap:3px;font-size:13px;max-width:220px}
.docs a{overflow-wrap:anywhere}
.docs-gerer{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:8px}
.docs-gerer li{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px;background:var(--sunk);border-radius:8px}
.docs-gerer li a{flex:1;min-width:0;overflow-wrap:anywhere}
.docs-gerer li span{font-size:12px;color:var(--ink-3);white-space:nowrap}
.docs-gerer form{margin:0}
.docs-gerer button{font:inherit;font-size:12.5px;font-weight:600;padding:6px 10px;border:0;border-radius:6px;cursor:pointer;background:var(--crit-soft);color:var(--crit)}
.edition input[type=file]{font:inherit;font-size:13.5px;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
.edition input[type=text],.edition input[type=url]{font:inherit;font-size:13.5px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);width:100%;display:block;margin-top:6px}
.edition{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:20px 22px;display:grid;gap:14px}
.edition textarea{font-family:var(--mono);font-size:13.5px;line-height:1.55;width:100%;min-height:260px;padding:14px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);resize:vertical}
.edition .boutons{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.edition button{font:inherit;font-size:14px;font-weight:600;padding:9px 16px;border:0;border-radius:8px;cursor:pointer}
.edition .garder{background:var(--accent);color:var(--surface)}
.edition .retirer{background:var(--crit-soft);color:var(--crit)}
.edition .aide{font-size:13px;color:var(--ink-3);margin:0}
.edition .err{color:var(--crit);font-size:14px;margin:0}
.sommaire{display:flex;gap:6px;flex-wrap:wrap;margin:-18px 0 -12px}
.sommaire a{font-family:var(--mono);font-size:12px;text-decoration:none;color:var(--ink-2);border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 11px}
.sommaire a:hover{border-color:var(--accent);color:var(--accent)}
.doc-repli{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:0}
.doc-repli + .doc-repli{margin-top:12px}
.doc-repli summary{cursor:pointer;padding:15px 18px;font-weight:600;font-family:var(--display)}
.doc-repli summary:hover{color:var(--accent)}
.doc-repli[open] summary{border-bottom:1px solid var(--line)}
.doc-repli .doc{border:0;padding:18px 20px 6px}
.doc-repli .tbl-scroll{border:0;border-radius:0}
.prev-kpi dd small{display:block;font-size:12px;font-weight:400;letter-spacing:0;margin-top:2px}
.prev-kpi .pill{margin-top:10px}
.prev{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.prev table{min-width:1040px}
.prev td:first-child{min-width:250px}
.prev td small{display:block;color:var(--ink-3);font-size:12.5px;max-width:46ch;margin-top:2px}
.prev tr.ref td:first-child b::after{content:"référence";margin-left:8px;font-family:var(--mono);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);background:var(--accent-soft);border-radius:999px;padding:2px 7px;vertical-align:1px}
.prev .sous-bande a{color:var(--accent)}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px}
.chart svg{width:100%;height:auto;display:block}
.chart text{font-family:var(--mono);font-size:11px;fill:var(--ink-3)}
.chart .val{fill:var(--ink);font-size:11.5px}
.chart .bar{fill:var(--accent)} .chart .bar.encours{fill:#EDA92B;opacity:1}
.chart .grid-l{stroke:var(--line);stroke-width:1}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--ink-3);margin-top:8px}
.tbl-scroll{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;min-width:620px;font-size:14px}
th,td{text-align:left;padding:10px 14px;border-top:1px solid var(--line);vertical-align:top}
thead th{border-top:0;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);font-weight:500;background:var(--sunk)}
td.num{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
td a{text-decoration:none} td a:hover{text-decoration:underline}
.compte{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--ink-2);margin-bottom:10px}
.compte b{font-family:var(--mono);font-weight:500}
.panne{background:var(--surface);border:1px dashed var(--line);border-radius:10px;padding:16px 18px;color:var(--ink-2);font-size:14px}
footer{border-top:1px solid var(--line);padding-top:16px;color:var(--ink-3);font-size:13px;display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap}
footer p{margin:0;max-width:80ch}
.login{min-height:70vh;display:grid;place-items:center}
.login form{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:28px;display:grid;gap:14px;width:min(380px,100%)}
.login input{font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);width:100%}
.login button{font:inherit;font-weight:600;padding:10px 12px;border:0;border-radius:8px;background:var(--accent);color:var(--surface);cursor:pointer}
.login .err{color:var(--crit);font-size:14px;margin:0}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}
`;

const tete = (titre) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${esc(titre)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${CSS}</style></head><body>`;

export function pageConnexion({ erreur, bloque, titre = "Tableau de bord Kasbah", action = "/connexion", retour }) {
  return `${tete(titre)}<div class="login">
<form method="post" action="${esc(action)}">
  <div class="eyebrow">La Kasbah Salam · Fès</div>
  <h1 style="font-size:28px">${esc(titre)}</h1>
  ${erreur ? `<p class="err">${esc(erreur)}</p>` : ""}
  ${bloque ? "" : `<label for="mdp" class="eyebrow">Mot de passe</label>
  <input id="mdp" name="mot_de_passe" type="password" autocomplete="current-password" required autofocus>
  <button type="submit">Ouvrir</button>`}
  ${retour ? `<a class="btn" href="${esc(retour)}">← Retour au tableau de bord</a>` : ""}
</form></div></body></html>`;
}

function alertesHtml(alertes) {
  if (!alertes.length) return `<div class="alerts"><div class="vide">Rien ne demande d'action pour l'instant.</div></div>`;
  return `<ul class="alerts">${alertes.map((a) => `<li>
    <span class="pill p-${a.niveau}">${PASTILLE[a.niveau]}</span>
    <div class="what"><b>${md(a.titre)}</b>${a.detail ? `<p>${md(a.detail)}</p>` : ""}</div>
    <span class="who">${esc(a.qui)}</span></li>`).join("")}</ul>`;
}

function fluxHtml(flux) {
  return `<div class="flow-scroll"><div class="flow">${flux.map((f) => `<div class="step n-${f.niveau}">
    <time>${f.heure}</time><div class="rail"></div>
    <h3>${esc(f.titre)}</h3><p>${esc(f.desc)}</p>
    <span class="pill p-${f.niveau}">${esc(f.etat)}</span>
    ${f.detail ? `<span class="last">${esc(f.detail)}</span>` : ""}</div>`).join("")}</div></div>`;
}

function projetHtml(p) {
  const badge = p.badge || { niveau: "idle", texte: "—" };
  return `<article class="proj">
    <div class="hd"><div><h3>${p.url ? `<a href="${esc(p.url)}">${esc(p.nom)}</a>` : esc(p.nom)}</h3><div class="sub">${esc(p.sous_titre)}</div></div>
    <span class="pill p-${badge.niveau}">${esc(badge.texte)}</span></div>
    ${p.erreur ? `<p class="note">${md(p.erreur)}</p>` : ""}
    ${p.kv.length ? `<dl class="kv">${p.kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${md(v)}</dd>`).join("")}</dl>` : ""}
    ${p.ouverts.length ? `<div class="label">Ouvert</div><ul class="todo">${p.ouverts.map((o) =>
      `<li class="${o.niveau || ""}"><span>${md(o.texte)}${o.note ? `<small>${md(o.note)}</small>` : ""}</span></li>`).join("")}</ul>` : ""}
    ${p.recents && p.recents.length ? `<div class="label">Derniers terminés</div><ul class="todo">${p.recents.map((r) =>
      `<li class="done"><span>${md(r.titre)} <small>${esc(r.date)}</small></span></li>`).join("")}</ul>` : ""}
    ${p.notes.map((n) => `<p class="note">${md(n)}</p>`).join("")}
  </article>`;
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const dh = (v) => (v == null ? "—" : `${Math.round(Number(v)).toLocaleString("fr-FR")} DH`);
const moisLong = (iso) => (iso ? `${MOIS_FR[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : "—");
const pourcent = (v) => (v == null ? "—" : `${(Number(v) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);

/** La bande du haut : cinq indicateurs, chacun sur l'exercice et sur le mois. */
function chiffresHtml(ch) {
  if (!ch || (!ch.exercice && !ch.mois)) {
    return `<section aria-labelledby="h-chiffres">
      <div class="section-head"><h2 id="h-chiffres">Les chiffres</h2></div>
      <div class="panne">Pas encore de chiffres : ils viennent de Kasbah Analytics, qui n'est pas lu.</div></section>`;
  }
  const ex = ch.exercice || {}, mo = ch.mois || {};
  const moisNom = ch.mois_libelle ? MOIS_FR[Number(ch.mois_libelle.slice(5, 7)) - 1] : "mois en cours";
  const exNom = `Exercice ${ch.exercice_libelle || "en cours"}`;
  // Une tuile = un indicateur ; deux lignes, l'exercice puis le mois. L'ADR
  // change de source selon la période (voir docs/LOOKER_STUDIO.md).
  const tuiles = [
    { titre: "Revenu", aide: "Total des produits du CdR",
      lignes: [[exNom, dh(ex.revenu)], [moisNom, dh(mo.revenu)]] },
    { titre: "Résultat net", aide: "Ligne « RÉSULTAT NET » du CdR",
      lignes: [[exNom, dh(ex.resultat_net)], [moisNom, dh(mo.resultat_net)]] },
    { titre: "Marge restauration", aide: "Ventes moins achats : breakfast, repas, snack",
      lignes: [[exNom, dh(ex.marge_restauration)], [moisNom, dh(mo.marge_restauration)]] },
    { titre: "ADR", aide: "Encaissé (CdR) sur les mois terminés ; facturé (appli) pour le mois en cours, seul juste avant la fin du mois",
      lignes: [
        [`${exNom} · encaissé`, dh(ex.adr_encaisse)],
        [`${moisNom} · facturé`, dh(mo.adr_facture)],
      ] },
    { titre: "Taux d'occupation", aide: "Places vendues sur 17 places",
      lignes: [[exNom, pourcent(ex.taux_occupation)], [moisNom, pourcent(mo.taux_occupation)]] },
  ];
  return `<section aria-labelledby="h-chiffres">
  <div class="section-head"><h2 id="h-chiffres">Les chiffres</h2>
    <p>Argent : compte de résultat de la V16, au mois de l'encaissement · le mois en cours est forcément partiel</p></div>
  <div class="chiffres">${tuiles.map((t) => `<article class="kpi">
      <h3>${esc(t.titre)}</h3><p class="aide">${esc(t.aide)}</p>
      <dl class="deux">${t.lignes.map(([label, valeur]) => `<dt>${esc(label)}</dt><dd>${esc(valeur)}</dd>`).join("")}</dl>
    </article>`).join("")}</div>
  ${ex.mois_comptes ? `<p class="sous-bande">Exercice en cours : ${ex.mois_comptes} mois comptés, de ${esc(moisLong(ex.depuis))} à ${esc(moisLong(ex.jusqua))}${ex.adr_encaisse_mois ? `, dont ${ex.adr_encaisse_mois} terminés pour l'ADR encaissé` : ""}.</p>` : ""}
</section>`;
}

const eur = (v) => (v == null ? "—" : `${Math.round(Number(v)).toLocaleString("fr-FR")} €`);
/** « 50 633 € » devient « 51 k€ » : les valorisations se lisent en ordre de grandeur. */
const kEur = (v) => (v == null ? "—" : `${Math.round(Number(v) / 1000).toLocaleString("fr-FR")} k€`);
const fourchetteK = (a, b) => `${Math.round(a / 1000).toLocaleString("fr-FR")} à ${kEur(b)}`;
const ecartFr = (e) => (e == null ? "" : `${e >= 0 ? "+" : "−"}${Math.abs(Math.round(e * 100))} %`);

/** Les scénarios du modèle « Hôtel + Extension », et le prévu face au réel. */
function previsionsHtml(p, peutEditer = false) {
  if (!p || (!p.scenarios.length && !p.notes.length)) {
    return `<div class="panne">Pas encore de prévisions : elles se lisent dans <span class="mono">pilotage/previsions.md</span> du dépôt Kasbah-Analytique.</div>`;
  }
  const valeur = (v, unite) => (unite === "pourcent" ? pourcent(v) : dh(v));
  const comparaison = p.comparaison.length ? `<div class="label" style="margin-bottom:8px">Prévu contre réel · scénario « ${esc(p.reference)} »</div>
  <div class="chiffres prev-kpi">${p.comparaison.map((c) => `<article class="kpi">
      <h3>${esc(c.titre)}</h3><p class="aide">${esc(c.aide)}</p>
      <dl class="deux"><dt>Prévu</dt><dd>${esc(valeur(c.prevu, c.unite))}</dd><dt>Réel</dt><dd>${esc(valeur(c.reel, c.unite))}</dd></dl>
      ${c.ecart == null ? "" : `<span class="pill p-${c.niveau}">${esc(ecartFr(c.ecart))} face au prévu</span>`}
    </article>`).join("")}</div>` : "";

  const lignes = p.scenarios.map((x) => `<tr${x.reference ? ' class="ref"' : ""}>
      <td><b>${esc(x.nom)}</b>${x.texte ? `<small>${md(x.texte)}</small>` : ""}</td>
      <td class="num">${esc(x.lits ?? "—")}</td>
      <td class="num">${esc(pourcent(x.to))}</td>
      <td class="num">${esc(dh(x.adr))}</td>
      <td class="num">${esc(dh(x.revenu_mois))}</td>
      <td class="num">${esc(dh(x.charges))}</td>
      <td class="num">${esc(dh(x.ebitda_mois))}</td>
      <td class="num">${esc(dh(x.ebitda_an))}<small>${esc(eur(x.ebitda_an_eur))}</small></td>
      <td class="num">${esc(x.valorisations[0] ? x.valorisations[0].hypothese : "—")}</td>
      <td class="num">${x.valorisations[0] ? esc(fourchetteK(x.valorisations[0].basse, x.valorisations[0].haute)) : "—"}</td>
      ${peutEditer ? `<td class="num"><a class="editer" href="/modifier?f=previsions.md&i=${x.index}">Modifier</a></td>` : ""}
    </tr>`).join("");

  const croisees = p.scenarios.filter((x) => x.valorisations.length).flatMap((x) => x.valorisations.map((v, i) => `<tr>
      <td>${i === 0 ? `<b>${esc(x.nom)}</b>` : ""}</td><td>${esc(v.methode)}</td><td class="num">${esc(v.hypothese)}</td>
      <td class="num">${esc(eur(v.basse))}</td><td class="num">${esc(eur(v.haute))}</td></tr>`)).join("");

  const r = p.reglages;
  return `<div class="prev">
  ${r.intro ? `<p class="note">${md(r.intro)}</p>` : ""}
  ${comparaison}
  <div class="tbl-scroll"><table>
    <thead><tr><th>Scénario</th><th>Lits</th><th>TO</th><th>ADR</th><th>Revenu / mois</th><th>Charges / mois</th><th>EBITDA / mois</th><th>EBITDA / an</th><th>Multiple</th><th>Valorisation</th>${peutEditer ? "<th></th>" : ""}</tr></thead>
    <tbody>${lignes}</tbody></table></div>
  ${croisees ? `<details class="doc-repli"><summary>Valorisation : trois méthodes croisées</summary>
    <div class="tbl-scroll"><table><thead><tr><th>Scénario</th><th>Méthode</th><th>Hypothèse</th><th>Basse</th><th>Haute</th></tr></thead><tbody>${croisees}</tbody></table></div></details>` : ""}
  ${p.notes.map((n) => `<details class="doc-repli"><summary>${esc(n.nom)}</summary>
    <article class="doc">${rendreMarkdown(n.corps)}${peutEditer ? `<a class="editer" href="/modifier?f=previsions.md&i=${n.index}">Modifier</a>` : ""}</article></details>`).join("")}
  <p class="sous-bande" style="margin:0">Revenu = lits × ADR × TO × 30 jours ; EBITDA = revenu − charges ; 1 € = ${esc(String(r.taux).replace(".", ","))} MAD. Tout est recalculé depuis les hypothèses${r.source ? ` · <a href="${esc(r.source)}" target="_blank" rel="noopener">le classeur d'origine</a>` : ""}.</p>
</div>`;
}

function occupationHtml(occ) {
  if (!occ || !occ.length) return "";
  const W = 520, H = 230, base = 190, haut = 10, g = 40, d = 510;
  const pas = (d - g) / occ.length, larg = Math.min(50, pas * 0.66);
  const y = (v) => base - (base - haut) * v;
  const lignes = [0, 0.25, 0.5, 0.75, 1].map((v) =>
    `<line class="grid-l" x1="${g}" x2="${d}" y1="${y(v)}" y2="${y(v)}"${v ? ' stroke-dasharray="2 4"' : ""}/><text x="${g - 8}" y="${y(v) + 4}" text-anchor="end">${v * 100}</text>`).join("");
  const barres = occ.map((o, i) => {
    const t = Math.max(0, Math.min(1, Number(o.taux) || 0));
    const cx = g + pas * i + pas / 2;
    const mois = new Date(o.mois + "T12:00:00Z").toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
    return `<rect class="bar${o.en_cours ? " encours" : ""}" x="${(cx - larg / 2).toFixed(1)}" y="${y(t).toFixed(1)}" width="${larg.toFixed(1)}" height="${(base - y(t)).toFixed(1)}" rx="3"/>
      <text class="val" x="${cx.toFixed(1)}" y="${(y(t) - 6).toFixed(1)}" text-anchor="middle">${(t * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</text>
      <text x="${cx.toFixed(1)}" y="210" text-anchor="middle">${esc(mois)}</text>`;
  }).join("");
  const resume = occ.map((o) => `${o.mois.slice(0, 7)} : ${Math.round((Number(o.taux) || 0) * 1000) / 10} %`).join(", ");
  return `<section aria-labelledby="h-num">
  <div class="section-head"><h2 id="h-num">Taux d'occupation</h2><p>12 derniers mois · le détail est dans Looker Studio</p></div>
  <div class="panel chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Taux d'occupation : ${esc(resume)}">${lignes}${barres}</svg>
  <div class="legend"><span>en %, vue <span class="mono">v_occupation</span></span><span>barre claire = mois en cours</span></div></div></section>`;
}

function projetsHtml(p, peutEditer = false) {
  if (!p.ok) return `<div class="panne">${md(p.erreur || "Le registre n'est pas lu.")}</div>`;
  const ordre = ["En cours", "À faire", "En attente", "Plus tard", "Terminé", "Sans statut"];
  const compte = ordre.filter((k) => p.compte[k]).map((k) => `<span><b>${p.compte[k]}</b> ${esc(k.toLowerCase())}</span>`).join("");
  return `<div class="compte">${compte}</div><div class="tbl-scroll"><table>
    <thead><tr><th>Projet</th><th>Statut</th><th>Domaine</th><th>Responsable</th><th>Échéance</th><th>Documents</th>${peutEditer ? "<th></th>" : ""}</tr></thead>
    <tbody>${p.lignes.map((x) => `<tr>
      <td><b>${esc(x.nom)}</b>${x.texte ? `<br><small>${esc(x.texte.slice(0, 140))}${x.texte.length > 140 ? "…" : ""}</small>` : ""}</td>
      <td><span class="pill p-${x.niveau}">${esc(x.statut || "Sans statut")}</span></td>
      <td>${esc(x.domaine || "—")}</td><td>${esc(x.responsable || "—")}</td>
      <td class="num">${esc(x.echeanceTexte)}</td>
      <td>${(x.documents || []).length ? `<ul class="docs">${x.documents.map((d) =>
        `<li><a href="${d.url ? esc(d.url) : `/document?p=${encodeURIComponent(d.chemin)}`}"${d.url ? ' target="_blank" rel="noopener"' : ""}>${esc(d.nom)}</a></li>`).join("")}</ul>` : ""}
        ${peutEditer ? `<a class="editer" href="/documents?i=${x.index}">${(x.documents || []).length ? `Gérer (${x.documents.length}/10)` : "+ Ajouter"}</a>` : (!(x.documents || []).length ? "—" : "")}</td>
      ${peutEditer ? `<td class="num"><a class="editer" href="/modifier?f=projets.md&i=${x.index}">Modifier</a></td>` : ""}
      </tr>`).join("")}</tbody></table></div>`;
}

/** Le registre : ce qui a été fait, classé. */
/**
 * Le projet d'un fait : un menu déroulant pour l'équipe (le choix part tout
 * de suite, un commit), une simple étiquette pour l'associé.
 */
function projetDuFait(f, projets, peutEditer) {
  if (!peutEditer) return f.projet ? `<span class="proj">${esc(f.projet)}</span>` : "";
  // Un projet retiré de la liste reste affiché tel quel, pour ne rien changer sans le vouloir.
  const hors = f.projet && !projets.includes(f.projet);
  const options = [
    `<option value=""${f.projet ? "" : " selected"}>— aucun projet —</option>`,
    ...(hors ? [`<option value="${esc(f.projet)}" selected>${esc(f.projet)} (plus dans la liste)</option>`] : []),
    ...projets.map((p) => `<option value="${esc(p)}"${p === f.projet ? " selected" : ""}>${esc(p)}</option>`),
  ].join("");
  return `<form class="choix-projet" method="post" action="/projet-du-fait">
    <input type="hidden" name="f" value="${esc(f.fichier)}"><input type="hidden" name="i" value="${f.index}"><input type="hidden" name="titre" value="${esc(f.titre)}">
    <select name="projet" class="${f.projet ? "" : "sans"}" aria-label="Projet de ce fait" title="Changer le projet de ce fait" onchange="this.form.submit()">${options}</select>
  </form>`;
}

function faitsHtml(faits, limite = 40, peutEditer = false, projets = []) {
  if (!faits || !faits.length) return `<div class="panne">Rien d'enregistré pour l'instant.</div>`;
  return `<ol class="faits">${faits.slice(0, limite).map((f) => `<li>
    <div class="quand"><b>${esc(f.date_fr)}</b><span>${esc(f.domaine)}</span></div>
    <div class="quoi">
      <div class="etiq"><span class="pill p-${f.nature === "Incident" || f.nature === "Risque" ? "warn" : f.nature === "Décision" ? "info" : "ok"}">${esc(f.nature)}</span>${projetDuFait(f, projets, peutEditer)}</div>
      ${f.effet ? `<p class="effet">${md(f.effet)}</p>` : ""}
      <p>${md(f.texte)}</p>
      ${f.statut ? `<p class="statut"><span class="pill p-test">${esc(f.statut)}</span></p>` : ""}
      ${peutEditer ? `<a class="editer" href="/modifier?f=${encodeURIComponent(f.fichier)}&i=${f.index}">Modifier</a>` : ""}
    </div></li>`).join("")}</ol>`;
}

/** Le fichier technique commence par son propre titre : la section l'a déjà. */
const sansPremierTitre = (md) => {
  const texte = String(md || "");
  if (!texte.startsWith("# ")) return texte;
  const saut = texte.indexOf(String.fromCharCode(10));
  return saut === -1 ? "" : texte.slice(saut + 1);
};

export function pageTableau(v, lu, associe = false) {
  const l = local(lu);
  const heure = `${String(l.h).padStart(2, "0")}h${String(l.m).padStart(2, "0")}`;
  const src = (nom, ok) => `<span class="pill p-${ok ? "ok" : "idle"}">${nom}${ok ? "" : " \u00b7 non lu"}</span>`;
  const domaines = Object.entries(v.faits_par_domaine || {}).sort((a, b) => b[1] - a[1]);
  // L'associé voit les mêmes chiffres et le même registre ; ce qu'on lui
  // épargne, ce sont les alertes de mécanique interne (branches, migrations).
  const alertes = associe ? v.alertes.filter((a) => !a.technique) : v.alertes;

  const sommaire = [
    ["chiffres", "Les chiffres"],
    ["previsions", "Les prévisions"],
    ["action", "\u00c0 faire"],
    ["faits", "Ce qui s'est fait"],
    ["nuit", "Les t\u00e2ches automatiques"],
    ["projets", "Les projets"],
    ...(associe ? [] : [["depots", "Les outils"]]),
    ["technique", "Comment c'est construit"],
  ];

  return `${tete("Tableau de bord Kasbah")}<div class="wrap">
<header class="top">
  <div>
    <div class="role">${associe ? `<span class="pill p-warn">Connecté : investisseur</span>` : `<span class="pill p-info">Connecté : admin</span>`}</div>
    <div class="eyebrow">La Kasbah Salam \u00b7 F\u00e8s</div>
    <h1>Tableau de bord Kasbah</h1>
    <p>O\u00f9 en est l'h\u00f4tel, en une page : les chiffres, ce qui demande une action, ce qui a \u00e9t\u00e9 fait ou d\u00e9cid\u00e9, et comment tout \u00e7a est construit. Lu en direct, rien n'est saisi \u00e0 la main.</p>
    <div class="srcs">${src("GitHub", v.etat.github)}${src("Registre", v.etat.registre)}${src("Supabase", v.etat.supabase)}</div>
  </div>
  <div class="stamp">
    <div><span class="eyebrow">Lu le ${jourFr(l.jour)} \u00e0</span><b>${heure}</b></div>
    <div><span class="eyebrow">Bloquant</span><b class="c">${alertes.filter((a) => a.niveau === "crit").length}</b></div>
    <div><span class="eyebrow">\u00c0 voir</span><b class="w">${alertes.filter((a) => a.niveau === "warn").length}</b></div>
    <a class="btn" href="/?rafraichir=1">Relire maintenant</a>
  </div>
</header>

<nav class="sommaire" aria-label="Sommaire">${sommaire.map(([id, nom]) => `<a href="#${id}">${nom}</a>`).join("")}</nav>

<section id="chiffres" aria-labelledby="h-chiffres">
  ${chiffresHtml(v.chiffres)}
</section>

<section id="previsions" aria-labelledby="h-prev">
  <div class="section-head"><h2 id="h-prev">Les prévisions</h2><p>Modèle « Hôtel + Extension » · <span class="mono">pilotage/previsions.md</span></p></div>
  ${previsionsHtml(v.previsions, !associe)}
</section>

<section id="action" aria-labelledby="h-att">
  <div class="section-head"><h2 id="h-att">Ce qui demande une action</h2><p>Class\u00e9 par gravit\u00e9 \u00b7 qui est concern\u00e9, \u00e0 droite</p></div>
  ${alertesHtml(alertes)}
</section>

<section id="faits" aria-labelledby="h-faits">
  <div class="section-head"><h2 id="h-faits">Ce qui s'est fait</h2><p>Registre tenu \u00e0 chaque s\u00e9ance \u00b7 l'effet est en t\u00eate de chaque fait</p></div>
  ${domaines.length ? `<div class="dom">${domaines.map(([d, n]) => `<span><b>${n}</b> ${esc(d.toLowerCase())}</span>`).join("")}<span>sur 30 jours</span></div>` : ""}
  ${faitsHtml(v.faits, 12, !associe, v.noms_projets || [])}
</section>

<section id="nuit" aria-labelledby="h-flow">
  <div class="section-head"><h2 id="h-flow">Les t\u00e2ches automatiques</h2><p>Heure du Maroc \u00b7 les rappels se lisent dans la copie de 23h30, donc avec un jour de d\u00e9calage</p></div>
  ${fluxHtml(v.flux)}
</section>

<section id="projets" aria-labelledby="h-proj-ouverts">
  <div class="section-head"><h2 id="h-proj-ouverts">Les projets</h2><p>Hors termin\u00e9s \u00b7 <span class="mono">pilotage/projets.md</span></p></div>
  ${projetsHtml(v.projets_ouverts, !associe)}
</section>

${associe ? "" : `<section id="depots" aria-labelledby="h-proj">
  <div class="section-head"><h2 id="h-proj">Les outils</h2><p>Lu sur GitHub : seul ce qui a \u00e9t\u00e9 envoy\u00e9 appara\u00eet ici</p></div>
  ${v.projets_depots && v.projets_depots.length ? `<div class="grid">${v.projets_depots.map(projetHtml).join("")}</div>`
    : `<div class="panne">GitHub n'est pas lu : les fiches appara\u00eetront une fois la cl\u00e9 ajout\u00e9e.</div>`}
</section>`}

${occupationHtml(v.occupation)}

<section id="technique" aria-labelledby="h-doc">
  <div class="section-head"><h2 id="h-doc">Comment c'est construit</h2><p>Sans code \u00b7 tenu dans <span class="mono">pilotage/technique.md</span></p></div>
  ${v.technique ? `<details class="doc-repli"><summary>Architecture, fonctions, secrets, et ce qui est fragile</summary>
    <article class="doc">${rendreMarkdown(sansPremierTitre(v.technique))}</article></details>`
    : `<div class="panne">La page technique n'est pas encore \u00e9crite (<span class="mono">pilotage/technique.md</span>).</div>`}
  ${v.migrations_recentes && v.migrations_recentes.length ? `<details class="doc-repli"><summary>Derni\u00e8res migrations \u00e9crites (appliqu\u00e9es \u00e0 la main dans Supabase)</summary>
    <div class="tbl-scroll"><table><thead><tr><th>D\u00e9p\u00f4t</th><th>Migration</th></tr></thead><tbody>${
      v.migrations_recentes.map((m) => `<tr><td>${esc(m.depot)}</td><td class="mono">${esc(m.nom)}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
</section>

<footer><p>Chiffres : compte de r\u00e9sultat du classeur de tr\u00e9sorerie et r\u00e9servations Beds24, recopi\u00e9s chaque nuit. Registre et projets : tenus \u00e0 chaque s\u00e9ance de travail. Les lectures sont gard\u00e9es 3 minutes.</p><a class="btn" href="/deconnexion">Se d\u00e9connecter</a></footer>
</div></body></html>`;
}


/**
 * Le formulaire d'un bloc : son texte brut, tel qu'il est dans le fichier.
 * Enregistrer écrit un commit dans le dépôt ; supprimer retire le bloc.
 */
export function pageEdition({ fichier, index, bloc, erreur, quoi }) {
  return `${tete("Modifier — tableau de bord Kasbah")}<div class="wrap">
<header class="top">
  <div>
    <div class="eyebrow">La Kasbah Salam · Fès</div>
    <h1>Modifier ${quoi === "projet" ? "un projet" : quoi === "scénario" ? "un scénario" : "un fait"}</h1>
    <p>Le texte ci-dessous est celui du fichier <span class="mono">pilotage/${esc(fichier)}</span>. Ce qui est enregistré ici devient un commit dans le dépôt : rien ne se perd, tout se retrouve.</p>
  </div>
  <div class="stamp"><a class="btn" href="/">← Retour au tableau de bord</a></div>
</header>

<form class="edition" method="post" action="/modifier">
  ${erreur ? `<p class="err">${esc(erreur)}</p>` : ""}
  <input type="hidden" name="f" value="${esc(fichier)}">
  <input type="hidden" name="i" value="${esc(index)}">
  <input type="hidden" name="titre" value="${esc(bloc.titre)}">
  <label class="label" for="texte">Le bloc, en Markdown</label>
  <textarea id="texte" name="texte" spellcheck="true">${esc(bloc.brut)}</textarea>
  <p class="aide">${quoi === "projet"
    ? "Première ligne : <code>## Nom · Statut · Domaine · Responsable</code>. Statuts : En cours, À faire, En attente, Plus tard, Terminé."
    : quoi === "scénario"
    ? "Première ligne : <code>## Nom</code> (ajouter <code>· Référence</code> pour le scénario comparé au réel). Puis les hypothèses : <code>**Lits :**</code>, <code>**Taux d'occupation :**</code>, <code>**ADR :**</code>, <code>**Charges :**</code> (MAD par mois), <code>**Multiple d'EBITDA :**</code>. Le revenu, l'EBITDA et les valorisations se recalculent seuls."
    : "Première ligne : <code>### JJ/MM/AAAA · Domaine · Nature · Projet</code>. Domaines : Revenus, Coûts, Clients, Équipe, Outils, Conformité. Natures : Décision, Livraison, Incident, Dépense, Risque."}</p>
  <div class="boutons">
    <button class="garder" type="submit" name="action" value="enregistrer">Enregistrer</button>
    <button class="retirer" type="submit" name="action" value="supprimer" onclick="return confirm('Supprimer ce bloc ?')">Supprimer</button>
    <a class="btn" href="/">Annuler</a>
  </div>
</form>
</div></body></html>`;
}

/**
 * Les documents d'un projet : jusqu'à 10, chacun ajouté ou retiré en commit
 * dans `pilotage/documents/<projet>/` du dépôt Kasbah-Analytique.
 */
export function pageDocuments({ index, nom, documents, erreur }) {
  const plein = documents.length >= 10;
  return `${tete("Documents — tableau de bord Kasbah")}<div class="wrap">
<header class="top">
  <div>
    <div class="eyebrow">La Kasbah Salam · Fès</div>
    <h1>Documents — ${esc(nom)}</h1>
    <p>Jusqu'à 10 documents par projet, gardés dans <span class="mono">pilotage/documents/</span> du dépôt Kasbah-Analytique. Chaque ajout ou retrait devient un commit, donc réversible.</p>
  </div>
  <div class="stamp"><a class="btn" href="/#projets">← Retour au tableau de bord</a></div>
</header>

<div class="edition">
  ${erreur ? `<p class="err">${esc(erreur)}</p>` : ""}

  ${documents.length ? `<ul class="docs-gerer">${documents.map((d) => `<li>
    <a href="${d.url ? esc(d.url) : `/document?p=${encodeURIComponent(d.chemin)}`}"${d.url ? ' target="_blank" rel="noopener"' : ""}>${esc(d.nom)}</a>
    <span>${d.url ? "lien" : `${Math.max(1, Math.round(d.taille / 1024)).toLocaleString("fr-FR")} Ko`}</span>
    <form method="post" action="/documents" onsubmit="return confirm('Retirer ${esc(d.nom).replace(/'/g, "\\'")} ?')">
      <input type="hidden" name="i" value="${esc(index)}">
      <input type="hidden" name="action" value="supprimer">
      <input type="hidden" name="chemin" value="${esc(d.chemin)}">
      <input type="hidden" name="sha" value="${esc(d.sha)}">
      <button type="submit">Retirer</button>
    </form>
  </li>`).join("")}</ul>` : `<p class="aide">Aucun document pour l'instant.</p>`}

  ${plein ? `<p class="aide">10 documents, le maximum par projet : retire-en un pour en ajouter un autre.</p>` : `
  <form method="post" action="/documents" enctype="multipart/form-data">
    <input type="hidden" name="i" value="${esc(index)}">
    <label class="label" for="fichier">Ajouter un document (15 Mo maximum)</label>
    <input id="fichier" name="fichier" type="file" required>
    <div class="boutons"><button class="garder" type="submit">Envoyer</button></div>
  </form>
  <p class="aide" style="text-align:center;margin:2px 0">— ou —</p>
  <form method="post" action="/documents">
    <input type="hidden" name="i" value="${esc(index)}">
    <input type="hidden" name="action" value="lien">
    <label class="label" for="nomLien">Coller un lien (Google Drive, autre)</label>
    <input id="nomLien" name="nom" type="text" placeholder="Nom, ex. Devis climatisation" required>
    <input name="url" type="url" placeholder="https://drive.google.com/…" required>
    <div class="boutons"><button class="garder" type="submit">Ajouter le lien</button></div>
  </form>`}
</div>
</div></body></html>`;
}
