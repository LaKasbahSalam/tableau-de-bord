/** Rendu HTML — tout est calculé côté Worker, la page n'a pas de script. */
import { local, jourFr } from "./analyse.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Échappe, puis rend `code` et **gras** — le Markdown des TASKS.md. */
const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>");

const PASTILLE = { crit: "Bloquant", warn: "À voir", info: "Info", ok: "OK", idle: "—" };

const CSS = `
:root{
  --bg:#F3F5F3; --surface:#FFFFFF; --sunk:#E8ECE9; --ink:#17211E; --ink-2:#4B5A55; --ink-3:#6E7C77;
  --line:#D6DDD9; --accent:#0E6655; --accent-soft:#D5EAE4;
  --crit:#B42318; --crit-soft:#FBE4E1; --warn:#955E0F; --warn-soft:#F8EBD3; --ok:#2B7A4B; --ok-soft:#DDF0E3; --idle:#66726E; --idle-soft:#E6EAE8;
  --display:"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --body:"IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --mono:"IBM Plex Mono", ui-monospace, Consolas, monospace;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#0F1614; --surface:#17211E; --sunk:#1E2A26; --ink:#E6EEEB; --ink-2:#A9B7B2; --ink-3:#83928D;
    --line:#2A3833; --accent:#5CC4AD; --accent-soft:#16352E;
    --crit:#F07A6E; --crit-soft:#3A1D1A; --warn:#E3B062; --warn-soft:#352914; --ok:#6CCB8F; --ok-soft:#173222; --idle:#8E9C97; --idle-soft:#222D29;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.5;padding-inline:16px;padding-block:28px 56px}
.wrap{max-width:1180px;margin:0 auto;display:grid;gap:36px}
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
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px}
.chart svg{width:100%;height:auto;display:block}
.chart text{font-family:var(--mono);font-size:11px;fill:var(--ink-3)}
.chart .val{fill:var(--ink);font-size:11.5px}
.chart .bar{fill:var(--accent)} .chart .bar.encours{opacity:.4}
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

export function pageConnexion({ erreur, bloque }) {
  return `${tete("Tableau de bord Kasbah")}<div class="login">
<form method="post" action="/connexion">
  <div class="eyebrow">La Kasbah Salam · Fès</div>
  <h1 style="font-size:28px">Tableau de bord Kasbah</h1>
  ${erreur ? `<p class="err">${esc(erreur)}</p>` : ""}
  ${bloque ? "" : `<label for="mdp" class="eyebrow">Mot de passe</label>
  <input id="mdp" name="mot_de_passe" type="password" autocomplete="current-password" required autofocus>
  <button type="submit">Ouvrir</button>`}
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

function notionHtml(n) {
  if (!n.ok) return `<div class="panne">${md(n.erreur || "Notion n'est pas lu.")}</div>`;
  const ordre = ["En cours", "À faire", "En attente", "Plus tard", "Terminé", "Sans statut"];
  const compte = ordre.filter((k) => n.compte[k]).map((k) => `<span><b>${n.compte[k]}</b> ${esc(k.toLowerCase())}</span>`).join("");
  return `<div class="compte">${compte}</div><div class="tbl-scroll"><table>
    <thead><tr><th>Projet</th><th>Statut</th><th>Domaine</th><th>Responsable</th><th>Échéance</th></tr></thead>
    <tbody>${n.lignes.map((p) => `<tr>
      <td><a href="${esc(p.url)}">${esc(p.nom || "Sans titre")}</a></td>
      <td><span class="pill p-${p.niveau}">${esc(p.statut || "Sans statut")}${p.priorite === "Urgent" ? " · urgent" : ""}</span></td>
      <td>${esc(p.domaine || "—")}</td><td>${esc(p.responsable || "—")}</td>
      <td class="num">${esc(p.echeanceTexte)}</td></tr>`).join("")}</tbody></table></div>`;
}

export function pageTableau(v, lu) {
  const l = local(lu);
  const heure = `${String(l.h).padStart(2, "0")}h${String(l.m).padStart(2, "0")}`;
  const src = (nom, ok) => `<span class="pill p-${ok ? "ok" : "idle"}">${nom}${ok ? "" : " · non lu"}</span>`;
  return `${tete("Tableau de bord Kasbah")}<div class="wrap">
<header class="top">
  <div>
    <div class="eyebrow">La Kasbah Salam · Fès</div>
    <h1>Tableau de bord Kasbah</h1>
    <p>Tous les outils qui font tourner l'hôtel, sur une seule page : ce qui demande une action, les tâches automatiques, et où en est chaque projet.</p>
    <div class="srcs">${src("GitHub", v.etat.github)}${src("Notion", v.etat.notion)}${src("Supabase", v.etat.supabase)}</div>
  </div>
  <div class="stamp">
    <div><span class="eyebrow">Lu le ${jourFr(l.jour)} à</span><b>${heure}</b></div>
    <div><span class="eyebrow">Bloquant</span><b class="c">${v.compteurs.crit}</b></div>
    <div><span class="eyebrow">À voir</span><b class="w">${v.compteurs.warn}</b></div>
    <a class="btn" href="/?rafraichir=1">Relire maintenant</a>
  </div>
</header>

${chiffresHtml(v.chiffres)}

<section aria-labelledby="h-att">
  <div class="section-head"><h2 id="h-att">Ce qui demande une action</h2><p>Classé par gravité · qui est concerné, à droite</p></div>
  ${alertesHtml(v.alertes)}
</section>

<section aria-labelledby="h-flow">
  <div class="section-head"><h2 id="h-flow">Les tâches automatiques</h2><p>Heure du Maroc · les rappels se lisent dans la copie de 23h30, donc avec un jour de décalage</p></div>
  ${fluxHtml(v.flux)}
</section>

<section aria-labelledby="h-proj">
  <div class="section-head"><h2 id="h-proj">Les projets</h2><p>Lu sur GitHub : seul ce qui a été envoyé apparaît ici</p></div>
  ${v.projets.length ? `<div class="grid">${v.projets.map(projetHtml).join("")}</div>` : `<div class="panne">GitHub n'est pas lu : les fiches projet apparaîtront une fois la clé ajoutée.</div>`}
</section>

${occupationHtml(v.occupation)}

<section aria-labelledby="h-notion">
  <div class="section-head"><h2 id="h-notion">Les projets de Notion encore ouverts</h2><p>Hôtel Fès — Project Hub · hors terminés</p></div>
  ${notionHtml(v.notion)}
</section>

<footer><p>Lu en direct dans GitHub, Notion et Kasbah Analytics, en lecture seule. Les lectures sont gardées 3 minutes.</p><a class="btn" href="/deconnexion">Se déconnecter</a></footer>
</div></body></html>`;
}
