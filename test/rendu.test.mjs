/**
 * Rend la page hors ligne, avec des réponses simulées de GitHub, Notion et
 * Supabase, et vérifie l'essentiel. `node test/rendu.test.mjs [sortie.html]`
 * Les TASKS.md et CLAUDE.md sont lus dans les dossiers voisins quand ils
 * existent (poste de travail), sinon les vérifications qui en dépendent
 * sont sautées.
 */
import fs from "node:fs";
import path from "node:path";
import worker from "../src/index.js";

const ICI = import.meta.dirname;
const lire = (p) => { try { return fs.readFileSync(path.join(ICI, "..", "..", p), "utf8"); } catch { return ""; } };
const il_y_a = (h) => new Date(Date.now() - h * 36e5).toISOString();
const jour = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

const reponses = {
  "/repos/LaKasbahSalam/kasbahcalendar": { html_url: "https://github.com/LaKasbahSalam/kasbahcalendar", default_branch: "main", pushed_at: il_y_a(5) },
  "/repos/LaKasbahSalam/kasbahcalendar/commits": [{ sha: "328f2371111", html_url: "#", commit: { message: "Calendrier : appui long sur une réservation\n\ndétail", committer: { date: il_y_a(20) } } }],
  "/repos/LaKasbahSalam/kasbahcalendar/branches": [{ name: "main" }, { name: "creation-reservation" }, { name: "fix/fiche-resa-chambre" }],
  "/repos/LaKasbahSalam/kasbahcalendar/compare/main...creation-reservation": { ahead_by: 1, commits: [{ commit: { committer: { date: il_y_a(80) } } }] },
  "/repos/LaKasbahSalam/kasbahcalendar/compare/main...fix%2Ffiche-resa-chambre": { ahead_by: 0, commits: [] },
  "/repos/LaKasbahSalam/kasbahcalendar/contents/TASKS.md": lire("KasbahCalendar/TASKS.md"),
  "/repos/LaKasbahSalam/kasbahcalendar/contents/supabase/migrations": [
    { type: "file", name: "20260920170000_annuler_vente_snack.sql" },
    { type: "file", name: "20260921200000_ventes_snack_export_parts.sql" },
    { type: "dir", name: "tests" },
  ],
  "/repos/LaKasbahSalam/Kasbah-Analytique": { html_url: "#", default_branch: "main" },
  "/repos/LaKasbahSalam/Kasbah-Analytique/commits": [{ sha: "639436e0000", html_url: "#", commit: { message: "Tableau de bord : fonction", committer: { date: il_y_a(1) } } }],
  "/repos/LaKasbahSalam/Kasbah-Analytique/branches": [{ name: "main" }],
  "/repos/LaKasbahSalam/Kasbah-Analytique/contents/CLAUDE.md": lire("Kasbah-Analytique/CLAUDE.md"),
  "/repos/LaKasbahSalam/Kasbah-Analytique/contents/supabase/migrations": [{ type: "file", name: "20260922090000_tableau_de_bord.sql" }],
  "/repos/LaKasbahSalam/snack-repas": { html_url: "#", default_branch: "main" },
  "/repos/LaKasbahSalam/snack-repas/commits": [{ sha: "2883493000", html_url: "#", commit: { message: "Journal Snack : client, vendeur", committer: { date: il_y_a(30) } } }],
  "/repos/LaKasbahSalam/snack-repas/branches": [{ name: "main" }],
  "/repos/LaKasbahSalam/snack-repas/contents/TASKS.md": lire("Snack & Repas/TASKS.md"),
  // tresorerie : dépôt pas encore créé -> 404
};

const supabase = {
  genere_le: new Date().toISOString(),
  sources: [
    { source: "beds24", derniere_reussite: il_y_a(8), derniere_tentative: il_y_a(8), statut: "ok", lignes: 298 },
    { source: "kasbah", derniere_reussite: il_y_a(8), derniere_tentative: il_y_a(8), statut: "ok", lignes: 3435 },
    { source: "v16", derniere_reussite: il_y_a(60), derniere_tentative: il_y_a(9), statut: "erreur", lignes: 40 },
  ],
  rappels: [
    { jour: jour(1), moment: "matin", envoye_at: il_y_a(30), blocs: ["departs"] },
    { jour: jour(1), moment: "soir", envoye_at: il_y_a(17), blocs: [] },
  ],
  tables_inconnues: ["snack_ventes"],
  occupation: ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]
    .map((m, i) => ({ mois: m + "-01", taux: [0.5, 0.4, 0.45, 0.3, 0.6, 0.856, 0.682, 0.541, 0.404, 0.19, 0.178, 0.25][i], en_cours: i === 11 })),
};

const titre = (t) => ({ type: "title", title: [{ plain_text: t }] });
const choix = (t) => ({ type: "select", select: t ? { name: t } : null });
const notion = { results: [
  { url: "#1", properties: { Nom: titre("Maintenance d'été de l'hôtel"), Statut: choix("À faire"), Deadline: { date: { start: jour(-8) } }, Area: choix("Confort"), Priorite: choix(null) } },
  { url: "#2", properties: { Nom: titre("Establish Volonteer System"), Statut: choix("À faire"), Priorite: choix("Urgent"), Owner: { type: "rich_text", rich_text: [{ plain_text: "Karim" }] } } },
  { url: "#3", properties: { Nom: titre("Outil d'analyse hôtel"), Statut: choix("En cours") } },
  { url: "#4", properties: { Nom: titre("Site internet"), Statut: choix("Terminé") } },
] };

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (u.host === "api.github.com") {
    const r = reponses[u.pathname];
    if (r === undefined) return new Response("", { status: 404 });
    return typeof r === "string" ? new Response(r) : json(r);
  }
  if (u.host === "api.notion.com") return json(notion);
  if (u.pathname.endsWith("/rpc/tableau_de_bord")) {
    return JSON.parse(opts.body).p_cle === "cle-ok" ? json(supabase) : new Response('{"message":"clé refusée"}', { status: 400 });
  }
  throw new Error("URL inattendue " + url);
};

const env = {
  MOT_DE_PASSE: "sesame", GITHUB_TOKEN: "x", NOTION_TOKEN: "x", SUPABASE_ANON_KEY: "sb_publishable_x", SUPABASE_CLE_TABLEAU: "cle-ok",
  SUPABASE_URL: "https://exemple.supabase.co", NOTION_BASE_PROJETS: "abc", GITHUB_ORG: "LaKasbahSalam",
};

let echecs = 0;
const verifier = (c, t) => { console.log(`${c ? "  ok  " : "ÉCHEC "} ${t}`); if (!c) echecs++; };

let r = await worker.fetch(new Request("https://t.dev/"), env);
verifier(r.status === 401 && (await r.text()).includes("mot_de_passe"), "sans cookie : formulaire de connexion");

let f = new FormData(); f.set("mot_de_passe", "non");
r = await worker.fetch(new Request("https://t.dev/connexion", { method: "POST", body: f }), env);
verifier(r.status === 401, "mauvais mot de passe refusé");

f = new FormData(); f.set("mot_de_passe", "sesame");
r = await worker.fetch(new Request("https://t.dev/connexion", { method: "POST", body: f }), env);
const cookie = (r.headers.get("Set-Cookie") || "").split(";")[0];
verifier(r.status === 303 && cookie.startsWith("kasbah_tdb="), "bon mot de passe : cookie posé");

r = await worker.fetch(new Request("https://t.dev/?rafraichir=1", { headers: { Cookie: cookie } }), env);
const page = await r.text();
verifier(r.status === 200, "page rendue");
verifier(/Envoi du CdR[\s\S]{0,400}En erreur/.test(page), "CdR en erreur signalé");
verifier(page.includes("Solde absent à 21h"), "synchro 20h : solde absent détecté");
verifier(page.includes("creation-reservation"), "branche en attente signalée");
verifier(page.includes("déjà fusionnée"), "branche fusionnée repérée");
verifier(page.includes("tresorerie") && page.includes("introuvable"), "dépôt absent : message clair");
verifier(page.includes("snack_ventes"), "table inconnue signalée");
verifier(!page.includes("Site internet"), "projets Notion terminés masqués");
verifier(page.includes("Maintenance d&#39;été") && page.includes("dans 8 j"), "échéance proche");
verifier(!/<script/i.test(page), "aucun script dans la page");
if (lire("KasbahCalendar/TASKS.md")) verifier(/Bloquant<\/span>[\s\S]{0,300}Snack : mise en service/.test(page), "migrations du snack en bloquant");
if (lire("Kasbah-Analytique/CLAUDE.md")) verifier(page.includes("Étape P4"), "étape en cours de l'analytique");

r = await worker.fetch(new Request("https://t.dev/?rafraichir=1", { headers: { Cookie: cookie } }),
  { ...env, GITHUB_TOKEN: "", NOTION_TOKEN: "", SUPABASE_CLE_TABLEAU: "mauvaise" });
const vide = await r.text();
verifier(r.status === 200 && vide.includes("Clé GitHub pas encore ajoutée") && vide.includes("refuse la clé"), "sans clés : page partielle avec explications");

r = await worker.fetch(new Request("https://t.dev/"), { ...env, MOT_DE_PASSE: "" });
verifier(r.status === 503, "sans mot de passe configuré : page fermée");

if (process.argv[2]) fs.writeFileSync(process.argv[2], page);
console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
