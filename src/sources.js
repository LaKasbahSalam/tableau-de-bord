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
  const [github, notion, supabase] = await Promise.all([
    lireGithub(env).catch(echec),
    lireNotion(env).catch(echec),
    lireSupabase(env).catch(echec),
  ]);
  return { github, notion, supabase };
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

// ---------------------------------------------------------------- Notion

async function lireNotion(env) {
  if (!env.NOTION_TOKEN) return { ok: false, manque: "NOTION_TOKEN", erreur: "Clé Notion pas encore ajoutée." };
  const r = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_BASE_PROJETS}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 100 }),
  });
  if (r.status === 404) return { ok: false, erreur: "Notion ne trouve pas la base Projets : relie l'intégration à la page « Hôtel Fès — Project Hub » (••• → Connexions)." };
  if (!r.ok) throw new Error(`Notion ${r.status}`);
  const j = await r.json();
  const texte = (p) => {
    if (!p) return "";
    if (p.type === "title") return p.title.map((t) => t.plain_text).join("");
    if (p.type === "rich_text") return p.rich_text.map((t) => t.plain_text).join("");
    if (p.type === "select") return p.select ? p.select.name : "";
    if (p.type === "status") return p.status ? p.status.name : "";
    return "";
  };
  const projets = j.results.map((pg) => ({
    nom: texte(pg.properties["Nom"]),
    statut: texte(pg.properties["Statut"]),
    priorite: texte(pg.properties["Priorite"]),
    domaine: texte(pg.properties["Area"]),
    responsable: texte(pg.properties["Owner"]),
    echeance: pg.properties["Deadline"] && pg.properties["Deadline"].date ? pg.properties["Deadline"].date.start : null,
    url: pg.url,
  }));
  return { ok: true, donnees: projets };
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
    if (t.includes("clé refusée")) return { ok: false, erreur: "Supabase refuse la clé du tableau : recopier la valeur de SUPABASE_CLE_TABLEAU." };
    throw new Error(`Supabase ${r.status}`);
  }
  return { ok: true, donnees: await r.json() };
}
