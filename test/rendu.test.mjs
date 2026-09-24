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
  "/repos/LaKasbahSalam/Kasbah-Analytique/contents/pilotage/technique.md": `# Comment c'est construit

| Brique | Ce que c'est |
|---|---|
| KasbahCalendar | L'application de l'équipe |

## Ce qui est fragile

1. **Les migrations s'appliquent à la main.** Pousser sur GitHub ne change rien à la base.
2. Pas d'intégration continue : les tests tournent sur le poste de qui travaille.
`,
  "/repos/LaKasbahSalam/Kasbah-Analytique/contents/pilotage/2026-09.md": `# Septembre 2026

### ${jour(1).slice(8, 10)}/${jour(1).slice(5, 7)}/${jour(1).slice(0, 4)} · Revenus · Décision · Snack

**Effet** : sur un panini à 40 DH, le vendeur touche 16,67 DH et la maison 5 DH.

Le vendeur touche une prime sur ce qu'il vend.

### ${jour(3).slice(8, 10)}/${jour(3).slice(5, 7)}/${jour(3).slice(0, 4)} · Outils · Incident · Snack

**Effet** : aucune vente n'a pu aboutir pendant une soirée.

La fonction de vente échouait à chaque appel.
`,
  "/repos/LaKasbahSalam/Kasbah-Analytique/contents/pilotage/previsions.md": lire("Kasbah-Analytique/pilotage/previsions.md"),
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

// Ce que le faux dépôt a écrit, pour vérifier le contenu du commit
export const ecrits = [];

// Un petit « GitHub » en mémoire pour pilotage/documents/ : assez pour
// tester l'aller-retour complet (ajout, liste, téléchargement, retrait).
const docsStore = {};
let prochainShaDoc = 1;

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (u.host === "api.github.com") {
    // Le vrai GitHub rend un `path` en clair (espaces compris) dans son JSON ;
    // seule l'URL de la requête est encodée. On décode pour retrouver le
    // même chemin que le code envoie et que les tests comparent.
    const enChemin = decodeURIComponent(u.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ""));
    if (/^pilotage\/documents(\/|$)/.test(enChemin)) {
      if (opts.method === "PUT") {
        const corps = JSON.parse(opts.body);
        if (corps.sha && (!docsStore[enChemin] || docsStore[enChemin].sha !== corps.sha)) return new Response("", { status: 409 });
        const sha = `sha-doc-${prochainShaDoc++}`;
        docsStore[enChemin] = { contenuBase64: corps.content, sha, taille: atob(corps.content).length };
        return json({ content: { sha } });
      }
      if (opts.method === "DELETE") {
        const corps = JSON.parse(opts.body);
        if (!docsStore[enChemin] || docsStore[enChemin].sha !== corps.sha) return new Response("", { status: 409 });
        delete docsStore[enChemin];
        return json({});
      }
      if (enChemin === "pilotage/documents") {
        const slugs = [...new Set(Object.keys(docsStore).map((c) => c.split("/")[2]).filter(Boolean))];
        return slugs.length ? json(slugs.map((s) => ({ type: "dir", name: s }))) : new Response("", { status: 404 });
      }
      const dossier = enChemin.match(/^pilotage\/documents\/([^/]+)$/);
      if (dossier) {
        const fichiers = Object.keys(docsStore).filter((c) => c.startsWith(`${enChemin}/`));
        return fichiers.length
          ? json(fichiers.map((c) => ({ type: "file", name: c.split("/").pop(), path: c, size: docsStore[c].taille, sha: docsStore[c].sha })))
          : new Response("", { status: 404 });
      }
      const doc = docsStore[enChemin];
      if (!doc) return new Response("", { status: 404 });
      const octets = Uint8Array.from(atob(doc.contenuBase64), (c) => c.charCodeAt(0));
      return new Response(octets, { status: 200 });
    }
    // Écriture d'un fichier du registre
    if (opts.method === "PUT") {
      const corps = JSON.parse(opts.body);
      const octets = Uint8Array.from(atob(corps.content), (c) => c.charCodeAt(0));
      ecrits.push({ chemin: u.pathname, contenu: new TextDecoder().decode(octets), message: corps.message, sha: corps.sha });
      return json({ commit: { sha: "abc" } });
    }
    // Lecture avec empreinte (l'édition en a besoin) : même contenu, encodé
    if (/\/contents\/pilotage\/[^/]+$/.test(u.pathname) && !opts.headers?.Accept?.includes("raw")) {
      const brut = reponses[u.pathname];
      if (typeof brut !== "string") return new Response("", { status: 404 });
      const octets = new TextEncoder().encode(brut);
      let binaire = "";
      for (const o of octets) binaire += String.fromCharCode(o);
      return json({ content: btoa(binaire), sha: "sha-du-fichier" });
    }
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

/** Le titre du premier fait du fichier d'exemple, tel qu'il est écrit. */
const faitsTitre = () => {
  const brut = reponses["/repos/LaKasbahSalam/Kasbah-Analytique/contents/pilotage/2026-09.md"];
  return (brut.match(/^### (.+)$/m) || [])[1];
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
verifier(!(page.match(/<section id="projets"[\s\S]*?<\/section>/) || [""])[0].includes("Site internet"), "projets terminés masqués");
verifier(page.includes("Maintenance d&#39;été") && /dans \d+ j/.test(page), "échéance proche signalée");
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

// --- Une seule page : le mot de passe de l'associé ouvre la même adresse
let fi = new FormData(); fi.set("mot_de_passe", "associe");
r = await worker.fetch(new Request("https://t.dev/connexion", { method: "POST", body: fi }), env);
const cookieAssocie = (r.headers.get("Set-Cookie") || "").split(";")[0];
verifier(r.status === 303 && cookieAssocie.startsWith("kasbah_tdb=") && cookieAssocie !== cookie,
  "le mot de passe de l'associé ouvre la même page, avec sa propre empreinte");

r = await worker.fetch(new Request("https://t.dev/?rafraichir=1", { headers: { Cookie: cookieAssocie } }), env);
const vueAssocie = await r.text();
verifier(r.status === 200 && vueAssocie.includes("Tableau de bord Kasbah"), "page rendue pour l'associé");
verifier(vueAssocie.replace(/[\u202f\u00a0]/g, " ").includes("110 000 DH"), "il voit les chiffres");
verifier(vueAssocie.includes("panini à 40 DH"), "il voit le registre");
verifier(vueAssocie.includes("Comment c'est construit") && vueAssocie.includes("<table>"), "il voit la partie technique");
verifier(!vueAssocie.includes("creation-reservation"), "la mécanique interne (branches) lui est épargnée");
verifier(vueAssocie.includes("Les tâches automatiques"), "il voit l'état des tâches de la nuit");

r = await worker.fetch(new Request("https://t.dev/investisseur", { headers: { Cookie: cookie } }), env);
verifier(r.status === 404, "plus de page séparée pour l'associé");

const sommaire = (page.match(/class="sommaire"[\s\S]*?<\/nav>/) || [""])[0];
verifier(/#chiffres/.test(sommaire) && /#technique/.test(sommaire) && /#depots/.test(sommaire),
  "le sommaire mène à toutes les sections, la vue équipe comprise");
verifier(!sommaire.includes("#depots") === false, "la section outils n'est que pour l'équipe");

// --- Modifier un bloc du registre
r = await worker.fetch(new Request("https://t.dev/modifier?f=2026-09.md&i=0", { headers: { Cookie: cookie } }), env);
const form = await r.text();
verifier(r.status === 200 && form.includes("<textarea"), "le formulaire s'ouvre sur le bloc");
verifier(form.includes("Revenus · Décision · Snack".replace(/·/g, "·")), "le texte brut du bloc y est");
verifier(form.includes('name="titre"'), "le titre attendu voyage avec le formulaire, comme garde-fou");

const champs = new FormData();
champs.set("f", "2026-09.md");
champs.set("i", "0");
champs.set("titre", (page.match(/./) && faitsTitre()) || "");
champs.set("texte", "### 21/09/2026 · Revenus · Décision · Snack\n\n**Effet** : corrigé depuis la page.\n\nTexte revu.");
champs.set("action", "enregistrer");
r = await worker.fetch(new Request("https://t.dev/modifier", { method: "POST", body: champs, headers: { Cookie: cookie } }), env);
verifier(r.status === 303, "enregistrer renvoie au tableau de bord");
verifier(ecrits.length === 1 && ecrits[0].contenu.includes("corrigé depuis la page"), "le fichier écrit contient la correction");
verifier(ecrits[0].contenu.includes("Outils · Incident"), "l'autre fait du fichier est intact");
verifier(ecrits[0].sha === "sha-du-fichier", "l'empreinte est renvoyée : pas d'écrasement d'une version plus récente");

// Un titre qui ne correspond plus : on refuse plutôt que d'écraser le mauvais bloc
const faux = new FormData();
faux.set("f", "2026-09.md"); faux.set("i", "0"); faux.set("titre", "un titre qui n'existe pas");
faux.set("texte", "peu importe"); faux.set("action", "enregistrer");
r = await worker.fetch(new Request("https://t.dev/modifier", { method: "POST", body: faux, headers: { Cookie: cookie } }), env);
verifier(r.status === 409 && ecrits.length === 1, "un bloc qui a bougé n'est pas écrasé");

// Supprimer
const retrait = new FormData();
retrait.set("f", "2026-09.md"); retrait.set("i", "0"); retrait.set("titre", faitsTitre());
retrait.set("action", "supprimer");
r = await worker.fetch(new Request("https://t.dev/modifier", { method: "POST", body: retrait, headers: { Cookie: cookie } }), env);
verifier(r.status === 303 && ecrits.length === 2 && !ecrits[1].contenu.includes("panini"), "supprimer retire le bloc");
verifier(ecrits[1].contenu.includes("Outils · Incident"), "et ne touche pas au reste du fichier");
verifier(/Retire un fait/.test(ecrits[1].message), "le commit dit ce qui a été fait");

// L'associé ne peut pas modifier
r = await worker.fetch(new Request("https://t.dev/modifier?f=2026-09.md&i=0", { headers: { Cookie: cookieAssocie } }), env);
verifier(r.status === 403, "l'associé ne peut pas modifier le registre");
verifier(!vueAssocie.includes("/modifier"), "et n'en voit même pas les liens");
verifier(page.includes("/modifier"), "l'équipe, elle, a un lien Modifier sur chaque bloc");

// --- Qui est connecté, en haut à gauche
verifier(page.includes("Connecté : admin") && !page.includes("Connecté : investisseur"), "l'équipe se voit connectée en admin");
verifier(vueAssocie.includes("Connecté : investisseur") && !vueAssocie.includes("Connecté : admin"), "l'associé se voit connecté en investisseur");

// --- Le projet d'un fait, choisi dans un menu déroulant
verifier(page.includes('action="/projet-du-fait"') && page.includes('<option value="Tableau de bord Kasbah">'), "l'équipe a un menu des projets sur chaque fait");
verifier(page.includes('<option value="Site internet">'), "les projets terminés sont proposés aussi");
verifier(page.includes('value="Snack" selected>Snack (plus dans la liste)'), "un projet absent de la liste reste affiché, sans être changé");
verifier(!vueAssocie.includes("/projet-du-fait") && vueAssocie.includes('<span class="proj">Snack</span>'), "l'associé voit le projet, sans menu");

const rattacher = (projet, cle = cookie, titre = faitsTitre()) => {
  const fp = new FormData();
  fp.set("f", "2026-09.md"); fp.set("i", "0"); fp.set("titre", titre); fp.set("projet", projet);
  return worker.fetch(new Request("https://t.dev/projet-du-fait", { method: "POST", body: fp, headers: { Cookie: cle } }), env);
};
let avant = ecrits.length;
r = await rattacher("Tableau de bord Kasbah");
let ecritProjet = ecrits[ecrits.length - 1];
verifier(r.status === 303 && ecrits.length === avant + 1, "choisir un projet écrit un commit et renvoie au registre");
verifier(ecritProjet.contenu.includes(`${faitsTitre().replace(/· Snack$/, "· Tableau de bord Kasbah")}\n`), "seul le projet change dans le titre du fait");
verifier(ecritProjet.contenu.includes("panini à 40 DH") && ecritProjet.contenu.includes("Outils · Incident · Snack"), "le reste du fichier est intact");
verifier(/au projet « Tableau de bord Kasbah »/.test(ecritProjet.message), "le commit dit à quel projet le fait est rattaché");

r = await rattacher("");
verifier(r.status === 303 && ecrits[ecrits.length - 1].contenu.includes(faitsTitre().replace(/· Snack$/, "· —")), "« aucun projet » écrit un tiret");

avant = ecrits.length;
r = await rattacher("Projet inventé");
verifier(r.status === 409 && ecrits.length === avant && (await r.text()).includes("pas dans la liste"), "un projet hors de la liste est refusé");
r = await rattacher("Tableau de bord Kasbah", cookie, "un titre qui a bougé");
verifier(r.status === 409 && ecrits.length === avant, "un fait qui a bougé n'est pas écrasé");
r = await rattacher("Tableau de bord Kasbah", cookieAssocie);
verifier(r.status === 403 && ecrits.length === avant, "l'associé ne peut pas changer le projet d'un fait");

// --- Le tableau de bord surveille sa propre fraîcheur
const vieux = (nb) => ({
  github: { ok: true, donnees: [] },
  registre: { ok: true, donnees: {
    projets: "",
    technique: "Dernière révision : 01/01/2026.\n\nClé GitHub : expire le 05/01/2026.",
    mois: [{ nom: "2026-01.md", contenu: `### ${jour(nb).slice(8, 10)}/${jour(nb).slice(5, 7)}/${jour(nb).slice(0, 4)} · Outils · Livraison · X\n\nUn fait.` }],
  } },
  supabase: { ok: false, erreur: "" },
});
const titres = (v) => v.alertes.map((a) => a.titre).join(" | ");

let vue = analyser(vieux(40), new Date());
verifier(/Aucun fait enregistré depuis 40 jours/.test(titres(vue)), "un registre abandonné depuis 40 jours est signalé");
verifier(vue.alertes.some((a) => a.niveau === "crit" && /Aucun fait/.test(a.titre)), "au-delà d'un mois, c'est bloquant");
verifier(/page technique n'a pas été revue/.test(titres(vue)), "une page technique trop vieille est signalée");
verifier(/clé GitHub a expiré/.test(titres(vue)), "une clé GitHub échue est signalée");

vue = analyser(vieux(3), new Date());
verifier(!/Aucun fait enregistré/.test(titres(vue)), "un registre tenu ne déclenche rien");

// --- Documents par projet : jusqu'à 10, ajoutés et retirés en commit
// Projet 0 dans le fixture ci-dessus : "Tableau de bord Kasbah".
const cheminDoc = "pilotage/documents/tableau-de-bord-kasbah/notes.txt";

r = await worker.fetch(new Request("https://t.dev/documents?i=0", { headers: { Cookie: cookie } }), env);
const pageDocsVide = await r.text();
verifier(r.status === 200 && pageDocsVide.includes("Tableau de bord Kasbah"), "la page documents s'ouvre sur le bon projet");
verifier(pageDocsVide.includes("Aucun document pour l'instant"), "aucun document au départ");

let fd = new FormData();
fd.set("i", "0");
fd.set("fichier", new Blob(["contenu du fichier"], { type: "text/plain" }), "notes.txt");
r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: fd, headers: { Cookie: cookie } }), env);
verifier(r.status === 303, "l'ajout d'un document renvoie à la page du projet");

r = await worker.fetch(new Request("https://t.dev/documents?i=0", { headers: { Cookie: cookie } }), env);
const pageDocsUn = await r.text();
verifier(pageDocsUn.includes("notes.txt"), "le document ajouté apparaît dans sa page");

r = await worker.fetch(new Request("https://t.dev/?rafraichir=1", { headers: { Cookie: cookie } }), env);
const pageAvecDoc = await r.text();
verifier(pageAvecDoc.includes(`/document?p=${encodeURIComponent(cheminDoc)}`) && pageAvecDoc.includes("Gérer (1/10)"),
  "le tableau de bord montre le document et le compte sur la ligne du projet");

r = await worker.fetch(new Request(`https://t.dev/document?p=${encodeURIComponent(cheminDoc)}`, { headers: { Cookie: cookie } }), env);
verifier(r.status === 200 && (await r.text()) === "contenu du fichier", "le téléchargement rend le contenu exact");

r = await worker.fetch(new Request(`https://t.dev/document?p=${encodeURIComponent(cheminDoc)}`, { headers: { Cookie: cookieAssocie } }), env);
verifier(r.status === 200, "l'associé peut aussi télécharger un document");

r = await worker.fetch(new Request("https://t.dev/documents?i=0", { headers: { Cookie: cookieAssocie } }), env);
verifier(r.status === 403, "l'associé ne peut pas gérer les documents");

let fdAssocie = new FormData();
fdAssocie.set("i", "0");
fdAssocie.set("fichier", new Blob(["intrus"], { type: "text/plain" }), "intrus.txt");
r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: fdAssocie, headers: { Cookie: cookieAssocie } }), env);
verifier(r.status === 403, "l'associé ne peut pas ajouter de document");

r = await worker.fetch(new Request(`https://t.dev/document?p=${encodeURIComponent("pilotage/documents/../../technique.md")}`, { headers: { Cookie: cookie } }), env);
verifier(r.status === 400, "un chemin qui sort du dossier documents est refusé");

// Neuf de plus : la limite de 10 par projet doit se déclencher au onzième
for (let i = 2; i <= 10; i++) {
  const f = new FormData();
  f.set("i", "0");
  f.set("fichier", new Blob(["x"], { type: "text/plain" }), `doc${i}.txt`);
  r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: f, headers: { Cookie: cookie } }), env);
}
verifier(r.status === 303, "le dixième document passe encore");
let fdTropPlein = new FormData();
fdTropPlein.set("i", "0");
fdTropPlein.set("fichier", new Blob(["x"], { type: "text/plain" }), "doc11.txt");
r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: fdTropPlein, headers: { Cookie: cookie } }), env);
const pagePleine = await r.text();
verifier(r.status === 400 && pagePleine.includes("Déjà 10 documents"), "le onzième document est refusé, la limite de 10 expliquée");

// Retirer le tout premier document
r = await worker.fetch(new Request("https://t.dev/documents?i=0", { headers: { Cookie: cookie } }), env);
const blocNotes = (await r.text()).split("<li>").find((seg) => seg.includes("notes.txt")) || "";
const shaNotes = blocNotes.match(/name="sha" value="([^"]+)"/)?.[1];
const retraitDoc = new FormData();
retraitDoc.set("i", "0"); retraitDoc.set("action", "supprimer");
retraitDoc.set("chemin", cheminDoc); retraitDoc.set("sha", shaNotes || "");
r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: retraitDoc, headers: { Cookie: cookie } }), env);
verifier(r.status === 303, "retirer un document renvoie à la page du projet");
r = await worker.fetch(new Request("https://t.dev/documents?i=0", { headers: { Cookie: cookie } }), env);
verifier(!(await r.text()).includes(">notes.txt<"), "le document retiré n'apparaît plus");

// --- Un lien (Google Drive, ou autre) plutôt qu'un fichier
// À ce stade, le projet 0 a 9 documents (doc2 à doc10) : une place reste.
let fdLien = new FormData();
fdLien.set("i", "0"); fdLien.set("action", "lien");
fdLien.set("nom", "Devis climatisation"); fdLien.set("url", "https://drive.google.com/xyz");
r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: fdLien, headers: { Cookie: cookie } }), env);
verifier(r.status === 303, "ajouter un lien renvoie à la page du projet");

r = await worker.fetch(new Request("https://t.dev/?rafraichir=1", { headers: { Cookie: cookie } }), env);
const pageAvecLien = await r.text();
verifier(pageAvecLien.includes('href="https://drive.google.com/xyz"') && pageAvecLien.includes("Devis climatisation"),
  "le lien pointe directement vers Google Drive, sans passer par le proxy de téléchargement");
verifier(/href="https:\/\/drive\.google\.com\/xyz"[^>]*target="_blank"/.test(pageAvecLien), "le lien s'ouvre dans un nouvel onglet");

let fdLienTropPlein = new FormData();
fdLienTropPlein.set("i", "0"); fdLienTropPlein.set("action", "lien");
fdLienTropPlein.set("nom", "Encore un"); fdLienTropPlein.set("url", "https://drive.google.com/autre");
r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: fdLienTropPlein, headers: { Cookie: cookie } }), env);
verifier(r.status === 400 && (await r.text()).includes("Déjà 10 documents"), "un lien de trop se heurte à la même limite de 10");

let fdLienInvalide = new FormData();
fdLienInvalide.set("i", "0"); fdLienInvalide.set("action", "lien");
fdLienInvalide.set("nom", "Mauvais lien"); fdLienInvalide.set("url", "pas-une-url");
r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: fdLienInvalide, headers: { Cookie: cookie } }), env);
verifier(r.status === 400 && (await r.text()).includes("doit commencer par http"), "un lien qui n'est pas une URL est refusé");

// Remplacer un lien existant (même nom) : même fichier, pas un onzième
let fdLienRemplace = new FormData();
fdLienRemplace.set("i", "0"); fdLienRemplace.set("action", "lien");
fdLienRemplace.set("nom", "Devis climatisation"); fdLienRemplace.set("url", "https://drive.google.com/nouveau");
r = await worker.fetch(new Request("https://t.dev/documents", { method: "POST", body: fdLienRemplace, headers: { Cookie: cookie } }), env);
verifier(r.status === 303, "remplacer un lien du même nom passe, même le projet étant plein");
r = await worker.fetch(new Request("https://t.dev/documents?i=0", { headers: { Cookie: cookie } }), env);
const pageLienRemplace = await r.text();
verifier(pageLienRemplace.includes("https://drive.google.com/nouveau") && !pageLienRemplace.includes("https://drive.google.com/xyz"),
  "le lien est remplacé, pas dupliqué");

// --- Les prévisions (modèle « Hôtel + Extension », pilotage/previsions.md)
const { lirePrevisions } = await import("../src/registre.js");
const prevTexte = reponses["/repos/LaKasbahSalam/Kasbah-Analytique/contents/pilotage/previsions.md"];
if (prevTexte) {
  const prev = lirePrevisions(prevTexte);
  const actuel = prev.scenarios.find((s) => s.nom === "État actuel");
  verifier(prev.scenarios.length === 4 && prev.notes.length === 1, "quatre scénarios et une note de lecture");
  verifier(actuel && actuel.reference && Math.round(actuel.revenu_mois) === 35190 && Math.round(actuel.ebitda_mois) === 15190,
    "état actuel : 35 190 DH de revenu et 15 190 DH d'EBITDA par mois, comme le classeur");
  verifier(actuel && Math.round(actuel.valorisations[0].basse) === 50633 && Math.round(actuel.valorisations[0].haute) === 67511,
    "état actuel : valorisation 50 633 à 67 511 € (EBITDA × 3 à 4)");
  verifier(actuel && Math.round(actuel.valorisations[2].basse) === 140648 && Math.round(actuel.valorisations[2].haute) === 168778,
    "cap rate 10 à 12 % : 140 648 à 168 778 €");
  const dvt = prev.scenarios.find((s) => /2030/.test(s.nom));
  verifier(dvt && Math.round(dvt.ebitda_an) === 573600 && Math.round(dvt.valorisations[0].haute) === 424889, "Kasbah 2030 : 573 600 DH par an, jusqu'à 424 889 €");
  verifier(prev.reglages.source.startsWith("https://docs.google.com/"), "le lien vers le classeur est repris");

  const p2 = page.replace(/[  ]/g, " ");
  verifier(page.indexOf("Les prévisions") > page.indexOf("Les chiffres") && page.indexOf("Les prévisions") < page.indexOf("Ce qui demande une action"),
    "les prévisions viennent juste après les chiffres");
  verifier(p2.includes("35 190 DH") && p2.includes("51 à 68 k€"), "le tableau des scénarios est rendu");
  // Réel : TO 35,2 % face à 60 % ; résultat net des 2 mois terminés (15 000 − 2 000) / 2 = 6 500 face à 15 190
  verifier(p2.includes("Prévu contre réel") && p2.includes("6 500 DH") && p2.includes("−41 % face au prévu"), "prévu contre réel, sans le mois en cours");
  verifier(page.includes("/modifier?f=previsions.md&i=0"), "l'équipe peut modifier un scénario");
  verifier(vueAssocie.includes("Les prévisions") && !vueAssocie.includes("f=previsions.md"), "l'associé voit les prévisions, sans les modifier");

  r = await worker.fetch(new Request("https://t.dev/modifier?f=previsions.md&i=1", { headers: { Cookie: cookie } }), env);
  const formPrev = await r.text();
  verifier(r.status === 200 && formPrev.includes("Modifier un scénario") && formPrev.includes("## 2nd lieu"), "le formulaire d'un scénario s'ouvre");
  const fp = new FormData();
  fp.set("f", "previsions.md"); fp.set("i", "1"); fp.set("titre", "2nd lieu");
  fp.set("texte", "## 2nd lieu\n\n- **Lits :** 25\n- **Taux d'occupation :** 60 %\n- **ADR :** 115 MAD\n- **Charges :** 27 000 MAD par mois\n- **Multiple d'EBITDA :** 4 à 5");
  r = await worker.fetch(new Request("https://t.dev/modifier", { method: "POST", body: fp, headers: { Cookie: cookie } }), env);
  const ecritPrev = ecrits[ecrits.length - 1];
  verifier(r.status === 303 && r.headers.get("Location") === "/#previsions" && ecritPrev.chemin.endsWith("pilotage/previsions.md")
    && ecritPrev.contenu.includes("**Lits :** 25") && ecritPrev.contenu.includes("## Premium") && /scénario/.test(ecritPrev.message),
    "corriger un scénario écrit un commit, sans toucher aux autres");
}

if (process.argv[2]) fs.writeFileSync(process.argv[2], page);
if (process.argv[3]) fs.writeFileSync(process.argv[3], vueAssocie);
console.log(echecs ? `\n${echecs} échec(s)` : "\nTout est bon.");
process.exit(echecs ? 1 : 0);
