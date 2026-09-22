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
  "/repos/LaKasbahSalam/Kasbah-Analytique/contents/pilotage": [
    { type: "file", name: "projets.md" }, { type: "file", name: "2026-09.md" }, { type: "file", name: "README.md" },
  ],
  "/repos/LaKasbahSalam/Kasbah-Analytique/contents/pilotage/projets.md": `# Projets

## Tableau de bord Kasbah · En cours · Outils · Claude

**Échéance :** —

La page qui réunit les chiffres et l'état des outils.

## Maintenance d'été de l'hôtel · À faire · Coûts · —

**Échéance :** ${jour(-8).slice(8, 10)}/${jour(-8).slice(5, 7)}/${jour(-8).slice(0, 4)}

## Site internet · Terminé · Clients · Karim
`,
  "/repos/LaKasbahSalam/Kasbah-Analytique/contents/pilotage/2026-09.md": `# Septembre 2026

### ${jour(1).slice(8, 10)}/${jour(1).slice(5, 7)}/${jour(1).slice(0, 4)} · Revenus · Décision · Snack

**Effet** : sur un panini à 40 DH, le vendeur touche 16,67 DH et la maison 5 DH.

Le vendeur touche une prime sur ce qu'il vend.

### ${jour(3).slice(8, 10)}/${jour(3).slice(5, 7)}/${jour(3).slice(0, 4)} · Outils · Incident · Snack

**Effet** : aucune vente n'a pu aboutir pendant une soirée.

La fonction de vente échouait à chaque appel.
`,
  // tresorerie : dépôt pas encore créé -> 404
};

const supabase = {
  genere_le: new Date().toISOString(),
  chiffres: {
    exercice_libelle: "2026-2027",
    mois_libelle: new Date().toISOString().slice(0, 7),
    exercice: { revenu: 110000, resultat_net: 15000, marge_restauration: 8500, ventes_restauration: 25000,
      places_vendues: 550, capacite: 1564, taux_occupation: 0.3517,
      adr_encaisse: 141.54, adr_encaisse_mois: 2, adr_facture: 174.55, adr_facture_mois: 2,
      mois_comptes: 3, depuis: "2026-07-01", jusqua: "2026-09-01" },
    mois: { revenu: 20000, resultat_net: 2000, marge_restauration: 1500, ventes_restauration: 5000,
      places_vendues: 100, capacite: 510, taux_occupation: 0.1961,
      adr_encaisse: null, adr_encaisse_mois: 0, adr_facture: 220, adr_facture_mois: 1,
      mois_comptes: 1, depuis: "2026-09-01", jusqua: "2026-09-01" },
  },
  sources: [
    { source: "beds24", derniere_reussite: il_y_a(8), derniere_tentative: il_y_a(8), statut: "ok", lignes: 298 },
    { source: "kasbah", derniere_reussite: il_y_a(8), derniere_tentative: il_y_a(8), statut: "ok", lignes: 3435 },
    { source: "v16", derniere_reussite: il_y_a(60), derniere_tentative: il_y_a(9), statut: "erreur", lignes: 40 },
  ],
  rappels: [
    { jour: jour(0), moment: "matin", envoye_at: il_y_a(6), blocs: ["departs"] },
    { jour: jour(0), moment: "soir", envoye_at: il_y_a(2), blocs: [] },
  ],
  tables_inconnues: ["snack_ventes"],
  occupation: ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]
    .map((m, i) => ({ mois: m + "-01", taux: [0.5, 0.4, 0.45, 0.3, 0.6, 0.856, 0.682, 0.541, 0.404, 0.19, 0.178, 0.25][i], en_cours: i === 11 })),
};

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (u.host === "api.github.com") {
    const r = reponses[u.pathname];
    if (r === undefined) return new Response("", { status: 404 });
    return typeof r === "string" ? new Response(r) : json(r);
  }
  if (u.pathname.endsWith("/rpc/tableau_de_bord")) {
    return JSON.parse(opts.body).p_cle === "cle-ok" ? json(supabase) : new Response('{"message":"clé refusée"}', { status: 400 });
  }
  throw new Error("URL inattendue " + url);
};

const env = {
  MOT_DE_PASSE: "sesame", MOT_DE_PASSE_INVESTISSEUR: "associe", GITHUB_TOKEN: "x", SUPABASE_ANON_KEY: "sb_publishable_x", SUPABASE_CLE_TABLEAU: "cle-ok",
  SUPABASE_URL: "https://exemple.supabase.co", GITHUB_ORG: "LaKasbahSalam",
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
verifier(page.indexOf("Les chiffres") < page.indexOf("Ce qui demande une action"), "les chiffres sont tout en haut");
const nombres = page.replace(/[  ]/g, " ");
verifier(nombres.includes("110 000 DH") && nombres.includes("20 000 DH"), "revenu : exercice et mois en cours");
verifier(nombres.includes("15 000 DH") && nombres.includes("2 000 DH"), "résultat net sur les deux périodes");
verifier(nombres.includes("8 500 DH") && nombres.includes("1 500 DH"), "marge restauration sur les deux périodes");
verifier(nombres.includes("142 DH") && nombres.includes("220 DH"), "ADR : encaissé sur l'exercice, facturé sur le mois");
verifier(/encaissé<\/dt>/.test(page) && /facturé<\/dt>/.test(page), "chaque ADR dit d'où il vient");
verifier(page.includes("35,2 %") && page.includes("19,6 %"), "taux d'occupation sur les deux périodes");
verifier(page.includes("Exercice 2026-2027"), "libellé de l'exercice");
verifier(page.includes("creation-reservation"), "branche en attente signalée");
verifier(page.includes("déjà fusionnée"), "branche fusionnée repérée");
verifier(page.includes("tresorerie") && page.includes("introuvable"), "dépôt absent : message clair");
verifier(page.includes("snack_ventes"), "table inconnue signalée");
verifier(!page.includes("Site internet"), "projets terminés masqués");
verifier(page.includes("Maintenance d&#39;été") && page.includes("dans 8 j"), "échéance proche signalée");
verifier(!/<script/i.test(page), "aucun script dans la page");

r = await worker.fetch(new Request("https://t.dev/?rafraichir=1", { headers: { Cookie: cookie } }),
  { ...env, GITHUB_TOKEN: "", SUPABASE_CLE_TABLEAU: "mauvaise" });
const vide = await r.text();
verifier(vide.includes("Pas encore de chiffres"), "sans Supabase : la bande de chiffres l'explique");
verifier(r.status === 200 && vide.includes("Clé GitHub pas encore ajoutée") && vide.includes("refuse la clé"), "sans clés : page partielle avec explications");

r = await worker.fetch(new Request("https://t.dev/"), { ...env, MOT_DE_PASSE: "" });
verifier(r.status === 503, "sans mot de passe configuré : page fermée");

// Détection des migrations à appliquer, sur un TASKS.md d'exemple : ne
// dépend pas des fichiers du poste, qui changent au fil du travail.
const { analyser } = await import("../src/analyse.js");
const exemple = `# Tâches

## À faire

- [ ] **Snack : mise en service de ce qui est déjà écrit** — *3 étapes*
  - Appliquer les migrations \`20260920170000_annuler_vente_snack.sql\` dans l'éditeur SQL Supabase.
  - Vérifier que la fonction a bien été redéployée.

- [ ] **Autre chose, sans SQL**

## Fait
- [x] Déjà fait — 20/09/2026
`;
const vueExemple = analyser({
  github: { ok: true, donnees: [{ nom: "KasbahCalendar", sous_titre: "", ok: true, principale: "main", commits: [], branches: [], taches: exemple, migrations: [] }] },
  registre: { ok: false, erreur: "" }, supabase: { ok: false, erreur: "" },
}, new Date());
const bloquantes = vueExemple.alertes.filter((a) => a.niveau === "crit");
verifier(bloquantes.length === 1 && bloquantes[0].titre.startsWith("Snack : mise en service"), "une migration à appliquer devient une alerte bloquante");
verifier(vueExemple.projets[0].ouverts.length === 2, "les deux tâches ouvertes sont reprises, la tâche faite non");

// --- La vue de l'associé
r = await worker.fetch(new Request("https://t.dev/investisseur"), env);
verifier(r.status === 401 && (await r.text()).includes("/investisseur/connexion"), "vue associé : mot de passe demandé, sur son propre formulaire");

let fi = new FormData(); fi.set("mot_de_passe", "sesame");
r = await worker.fetch(new Request("https://t.dev/investisseur/connexion", { method: "POST", body: fi }), env);
verifier(r.status === 401, "le mot de passe de l'équipe n'ouvre pas la vue associé");

fi = new FormData(); fi.set("mot_de_passe", "associe");
r = await worker.fetch(new Request("https://t.dev/investisseur/connexion", { method: "POST", body: fi }), env);
const cookieInv = (r.headers.get("Set-Cookie") || "").split(";")[0];
verifier(r.status === 303 && cookieInv.startsWith("kasbah_inv="), "vue associé : cookie posé");

// ?rafraichir : la lecture gardée en mémoire est celle du test précédent, sans clés
r = await worker.fetch(new Request("https://t.dev/investisseur?rafraichir=1", { headers: { Cookie: cookieInv } }), env);
const inv = await r.text();
verifier(r.status === 200 && inv.includes("Kasbah — pilotage"), "vue associé rendue");
verifier(inv.includes("panini à 40 DH"), "le registre y est, avec l'effet en tête");
verifier(inv.includes("Décision") && inv.includes("Incident"), "les faits sont classés par nature");
verifier(inv.replace(/[  ]/g, " ").includes("110 000 DH"), "les chiffres y sont : l'associé voit tout");
verifier(!inv.includes("creation-reservation") && !inv.includes("migration"), "aucun détail technique dans la vue associé");
verifier(!inv.includes("Relire maintenant"), "pas de bouton de relecture : la vue est en lecture seule");

r = await worker.fetch(new Request("https://t.dev/investisseur", { headers: { Cookie: cookie } }), env);
verifier(r.status === 401, "le cookie de l'équipe n'ouvre pas la vue associé");

if (process.argv[2]) fs.writeFileSync(process.argv[2], page);
if (process.argv[3]) fs.writeFileSync(process.argv[3], inv);
console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
