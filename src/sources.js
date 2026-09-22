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

  const [projets, ...contenus] = await Promise.all([
    gh(`${base}/projets.md`, true),
    ...mois.map((n) => gh(`${base}/${n}`, true)),
  ]);
  return { ok: true, donnees: { projets: projets || "", mois: contenus.filter(Boolean) } };
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
