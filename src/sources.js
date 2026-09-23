/**
 * Lecture des trois sources. Chaque source rend { ok, donnees } ou
 * { ok: false, erreur } — jamais d'exception vers la page.
 */

export const DEPOTS = [
  { cle: "calendar", nom: "KasbahCalendar", depot: "kasbahcalendar", taches: "TASKS.md", migrations: "supabase/migrations",
    sous_titre: "L'appli de l'équipe · Lovable + Supabase" },
  { cle: "analytique", nom: "Kasbah-Analytique", depot: "Kasbah-Analytique", phases: "CLAUDE.md", migrations: "supabase/migrations",
    sous_titre: "Base d'analyse + Looker Studio" },
  { cle: "snack", nom: "Fiche repas · Snack", depot: "snack-repas", taches: "TASKS.md",
    sous_titre: "Classeur Google + script" },
  { cle: "tresorerie", nom: "Exercices V16", depot: "tresorerie",
    sous_titre: "Trésorerie · Caisse, Banque, CB, CdR, Bilan" },
];

export async function lireTout(env) {
  const [github, registre, supabase] = await Promise.all([
    lireGithub(env).catch(echec),
    lireRegistre(env).catch(echec),
    lireSupabase(env).catch(echec),
  ]);
  return { github, registre, supabase };
}

const echec = (e) => ({ ok: false, erreur: String(e && e.message ? e.message : e) });

// ---------------------------------------------------------------- GitHub

async function lireGithub(env) {
  if (!env.GITHUB_TOKEN) return { ok: false, manque: "GITHUB_TOKEN", erreur: "Clé GitHub pas encore ajoutée." };
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const gh = async (chemin, brut = false) => {
    const r = await fetch(`https://api.github.com${chemin}`, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: brut ? "application/vnd.github.raw" : "application/vnd.github+json",
        "User-Agent": "kasbah-tableau-de-bord",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status} sur ${chemin}`);
    return brut ? r.text() : r.json();
  };

  const depots = await Promise.all(DEPOTS.map(async (d) => {
    const base = `/repos/${org}/${d.depot}`;
    try {
      const infos = await gh(base);
      if (!infos) return { ...d, ok: false, erreur: `Dépôt ${org}/${d.depot} introuvable (pas encore créé, ou le jeton n'y a pas accès).` };
      const principale = infos.default_branch;
      const [commits, branches, taches, phases, migrations] = await Promise.all([
        gh(`${base}/commits?sha=${principale}&per_page=5`),
        gh(`${base}/branches?per_page=50`),
        d.taches ? gh(`${base}/contents/${d.taches}`, true) : null,
        d.phases ? gh(`${base}/contents/${d.phases}`, true) : null,
        d.migrations ? gh(`${base}/contents/${d.migrations}`) : null,
      ]);
      const autres = (branches || []).filter((b) => b.name !== principale).slice(0, 12);
      const comparaisons = await Promise.all(autres.map(async (b) => {
        const c = await gh(`${base}/compare/${encodeURIComponent(principale)}...${encodeURIComponent(b.name)}`);
        return {
          nom: b.name,
          en_avance: c ? c.ahead_by : null,
          dernier: c && c.commits && c.commits.length ? c.commits[c.commits.length - 1].commit.committer.date : null,
        };
      }));
      return {
        ...d, ok: true, url: infos.html_url, principale, pousse_le: infos.pushed_at,
        commits: (commits || []).map((c) => ({ message: c.commit.message.split("\n")[0], date: c.commit.committer.date, sha: c.sha.slice(0, 7), url: c.html_url })),
        branches: comparaisons,
        taches, phases,
        migrations: Array.isArray(migrations) ? migrations.filter((f) => f.type === "file" && f.name.endsWith(".sql")).map((f) => f.name).sort() : [],
      };
    } catch (e) {
      return { ...d, ok: false, erreur: String(e.message || e) };
    }
  }));
  return { ok: true, donnees: depots };
}

// ---------------------------------------------------------------- Registre

/**
 * `pilotage/` du dépôt Kasbah-Analytique : les projets et les faits, écrits
 * par Claude. Même clé GitHub que le reste — rien de plus à configurer.
 */
async function lireRegistre(env) {
  if (!env.GITHUB_TOKEN) return { ok: false, manque: "GITHUB_TOKEN", erreur: "Clé GitHub pas encore ajoutée : le registre est dans le dépôt Kasbah-Analytique." };
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const base = `/repos/${org}/Kasbah-Analytique/contents/pilotage`;
  const gh = async (chemin, brut = false) => {
    const r = await fetch(`https://api.github.com${chemin}`, {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: brut ? "application/vnd.github.raw" : "application/vnd.github+json",
        "User-Agent": "kasbah-tableau-de-bord",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status} sur ${chemin}`);
    return brut ? r.text() : r.json();
  };

  const dossier = await gh(base);
  if (!dossier) return { ok: false, erreur: "Le dossier `pilotage/` n'existe pas encore dans le dépôt Kasbah-Analytique (ou il n'est pas poussé)." };

  const mois = dossier
    .filter((f) => f.type === "file" && /^\d{4}-\d{2}\.md$/.test(f.name))
    .map((f) => f.name).sort().reverse().slice(0, 4); // 4 derniers mois

  const [projets, technique, documents, ...contenus] = await Promise.all([
    gh(`${base}/projets.md`, true),
    gh(`${base}/technique.md`, true),
    listerTousDocuments(env),
    ...mois.map((n) => gh(`${base}/${n}`, true)),
  ]);
  return {
    ok: true,
    donnees: {
      projets: projets || "",
      technique: technique || "",
      documents,
      mois: mois.map((nom, i) => ({ nom, contenu: contenus[i] || "" })).filter((f) => f.contenu),
    },
  };
}

// ---------------------------------------------------------------- Supabase

async function lireSupabase(env) {
  const manque = ["SUPABASE_ANON_KEY", "SUPABASE_CLE_TABLEAU"].filter((k) => !env[k]);
  if (manque.length) return { ok: false, manque: manque.join(", "), erreur: "Clés Supabase pas encore ajoutées." };
  const cle = env.SUPABASE_ANON_KEY;
  const entetes = { apikey: cle, "Content-Type": "application/json" };
  if (!cle.startsWith("sb_")) entetes.Authorization = `Bearer ${cle}`;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/tableau_de_bord`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({ p_cle: env.SUPABASE_CLE_TABLEAU }),
  });
  if (r.status === 404) return { ok: false, erreur: "La fonction tableau_de_bord n'existe pas encore : lancer la migration 20260922090000_tableau_de_bord.sql dans l'éditeur SQL de Kasbah Analytics." };
  if (!r.ok) {
    const t = await r.text();
    if (t.includes("clé refusée")) {
      const n = env.SUPABASE_CLE_TABLEAU.length;
      return { ok: false, erreur: `Supabase refuse la clé du tableau : recopier la valeur de SUPABASE_CLE_TABLEAU (reçue : ${n} caractères, attendu : 64). Pour la réafficher : \`select cle from tableau_de_bord.cle;\` dans l'éditeur SQL.` };
    }
    throw new Error(`Supabase ${r.status}`);
  }
  return { ok: true, donnees: await r.json() };
}


// ------------------------------------------------- Écrire dans le registre

const DEPOT_REGISTRE = "Kasbah-Analytique";
const NOM_VALIDE = /^(projets|technique|\d{4}-\d{2})\.md$/;

function entetesGithub(env, brut = false) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: brut ? "application/vnd.github.raw" : "application/vnd.github+json",
    "User-Agent": "kasbah-tableau-de-bord",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

/** Un fichier du registre, avec son empreinte (`sha`) — nécessaire pour écrire. */
export async function lireFichierRegistre(env, nom) {
  if (!NOM_VALIDE.test(nom)) throw new Error("Nom de fichier refusé.");
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const r = await fetch(`https://api.github.com/repos/${org}/${DEPOT_REGISTRE}/contents/pilotage/${nom}`,
    { headers: entetesGithub(env) });
  if (!r.ok) throw new Error(`GitHub ${r.status} à la lecture de ${nom}`);
  const j = await r.json();
  // atob rend des octets : il faut les relire en UTF-8, sinon les accents se perdent.
  const octets = Uint8Array.from(atob(j.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
  return { contenu: new TextDecoder().decode(octets), sha: j.sha };
}

/** Écrit le fichier, en commit. `sha` garantit qu'on n'écrase pas une version plus récente. */
export async function ecrireFichierRegistre(env, nom, contenu, sha, message) {
  if (!NOM_VALIDE.test(nom)) throw new Error("Nom de fichier refusé.");
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const octets = new TextEncoder().encode(contenu);
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  const r = await fetch(`https://api.github.com/repos/${org}/${DEPOT_REGISTRE}/contents/pilotage/${nom}`, {
    method: "PUT",
    headers: entetesGithub(env),
    body: JSON.stringify({ message, content: btoa(binaire), sha }),
  });
  if (r.status === 409) throw new Error("Quelqu'un a modifié le fichier entre-temps. Recharge la page et recommence.");
  if (r.status === 403 || r.status === 404) {
    throw new Error("GitHub refuse d'écrire : la clé doit avoir la permission « Contents : Read and write » sur le dépôt Kasbah-Analytique.");
  }
  if (!r.ok) throw new Error(`GitHub ${r.status} à l'écriture de ${nom}`);
}

// -------------------------------------------- Documents attachés à un projet

/**
 * Un document par ligne, jusqu'à 10 : `pilotage/documents/<slug-du-projet>/<fichier>`
 * du dépôt Kasbah-Analytique. Même clé GitHub, même logique de commit que le
 * reste du registre — un ajout ou un retrait est réversible dans l'historique.
 */
export const DOSSIER_DOCUMENTS = "pilotage/documents";
export const MAX_DOCUMENTS_PAR_PROJET = 10;
export const MAX_OCTETS_DOCUMENT = 15 * 1024 * 1024; // 15 Mo — au-delà, l'API Contents de GitHub devient peu fiable.

/** Octets → base64, par blocs pour ne pas bloquer le Worker sur un gros fichier. */
export function octetsVersBase64(octets) {
  let binaire = "";
  const PAS = 0x8000;
  for (let i = 0; i < octets.length; i += PAS) {
    binaire += String.fromCharCode.apply(null, octets.subarray(i, i + PAS));
  }
  return btoa(binaire);
}

/** Les documents de tous les projets, un appel par dossier trouvé sous `pilotage/documents/`. */
async function listerTousDocuments(env) {
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const gh = async (chemin) => {
    const r = await fetch(`https://api.github.com${chemin}`, { headers: entetesGithub(env) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status} sur ${chemin}`);
    return r.json();
  };
  const racine = await gh(`/repos/${org}/${DEPOT_REGISTRE}/contents/${DOSSIER_DOCUMENTS}`);
  if (!Array.isArray(racine)) return {};
  const dossiers = racine.filter((f) => f.type === "dir");
  const listes = await Promise.all(dossiers.map((d) => gh(`/repos/${org}/${DEPOT_REGISTRE}/contents/${DOSSIER_DOCUMENTS}/${d.name}`)));
  const documents = {};
  dossiers.forEach((d, i) => {
    documents[d.name] = (Array.isArray(listes[i]) ? listes[i] : [])
      .filter((f) => f.type === "file")
      .map((f) => ({ nom: f.name, chemin: f.path, taille: f.size, sha: f.sha }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  });
  return documents;
}

/** Les documents d'un seul projet — utilisé par la page d'ajout/retrait, sans relire tout le reste. */
export async function listerDocumentsProjet(env, slug) {
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const r = await fetch(`https://api.github.com/repos/${org}/${DEPOT_REGISTRE}/contents/${DOSSIER_DOCUMENTS}/${slug}`,
    { headers: entetesGithub(env) });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GitHub ${r.status} à la lecture des documents de ${slug}`);
  const liste = await r.json();
  return (Array.isArray(liste) ? liste : [])
    .filter((f) => f.type === "file")
    .map((f) => ({ nom: f.name, chemin: f.path, taille: f.size, sha: f.sha }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

/** Le contenu brut d'un document (octets), pour le proposer au téléchargement. */
export async function lireDocumentBrut(env, chemin) {
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const r = await fetch(`https://api.github.com/repos/${org}/${DEPOT_REGISTRE}/contents/${chemin}`,
    { headers: entetesGithub(env, true) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status} à la lecture de ${chemin}`);
  return r.arrayBuffer();
}

/** Écrit (ou remplace, si `sha` est fourni) un document. `contenuBase64` : le fichier encodé en base64. */
export async function ecrireDocument(env, chemin, contenuBase64, sha, message) {
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const r = await fetch(`https://api.github.com/repos/${org}/${DEPOT_REGISTRE}/contents/${chemin}`, {
    method: "PUT",
    headers: entetesGithub(env),
    body: JSON.stringify({ message, content: contenuBase64, ...(sha ? { sha } : {}) }),
  });
  if (r.status === 409) throw new Error("Quelqu'un a modifié ce dossier entre-temps. Recharge la page et recommence.");
  if (r.status === 403 || r.status === 404) {
    throw new Error("GitHub refuse d'écrire : la clé doit avoir la permission « Contents : Read and write » sur le dépôt Kasbah-Analytique.");
  }
  if (r.status === 422) throw new Error("GitHub refuse ce fichier (nom ou taille) : renomme-le et réessaie.");
  if (!r.ok) throw new Error(`GitHub ${r.status} à l'écriture de ${chemin}`);
}

/** Supprime un document. */
export async function supprimerDocument(env, chemin, sha, message) {
  const org = env.GITHUB_ORG || "LaKasbahSalam";
  const r = await fetch(`https://api.github.com/repos/${org}/${DEPOT_REGISTRE}/contents/${chemin}`, {
    method: "DELETE",
    headers: entetesGithub(env),
    body: JSON.stringify({ message, sha }),
  });
  if (r.status === 409) throw new Error("Quelqu'un a modifié ce fichier entre-temps. Recharge la page et recommence.");
  if (!r.ok) throw new Error(`GitHub ${r.status} à la suppression de ${chemin}`);
}
