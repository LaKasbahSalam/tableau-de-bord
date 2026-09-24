/**
 * Lecture du registre — les fichiers de `pilotage/` du dépôt
 * Kasbah-Analytique, écrits par Claude à chaque séance.
 *
 * Le format est décrit dans `pilotage/README.md` : une ligne de titre qui
 * porte le tri (date · domaine · nature · projet), puis une ligne
 * « **Effet** : … », puis du texte libre.
 *
 * Chaque bloc garde **où il commence et où il finit** dans son fichier :
 * c'est ce qui permet à la page de le rouvrir, de le corriger ou de le
 * supprimer sans toucher au reste.
 */

export const DOMAINES = ["Revenus", "Coûts", "Clients", "Équipe", "Outils", "Conformité"];
export const NATURES = ["Décision", "Livraison", "Incident", "Dépense", "Risque"];

/** Un nom de projet → un dossier stable pour ses documents (`pilotage/documents/<slug>/`). */
export function slugProjet(nom) {
  return String(nom || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "projet";
}

const isoDepuisFr = (jjmmaaaa) => {
  // Accepte « 22/09/2026 » et « 18-19/09/2026 » (on garde le dernier jour).
  const m = String(jjmmaaaa).match(/^(\d{2})(?:-(\d{2}))?\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[4]}-${m[3]}-${m[2] || m[1]}`;
};

/**
 * Découpe un fichier en blocs, à partir de ses titres de niveau `marque`
 * (`##` pour les projets, `###` pour les faits). Rend, pour chacun, la
 * ligne de titre, le texte brut et ses bornes.
 */
function decouper(contenu, marque) {
  const lignes = String(contenu || "").split(/\r?\n/);
  const motif = new RegExp(`^${marque}\\s+(.+)$`);
  const blocs = [];
  lignes.forEach((ligne, i) => {
    const m = ligne.match(motif);
    if (!m) return;
    if (blocs.length) blocs[blocs.length - 1].fin = i - 1;
    blocs.push({ titre: m[1].trim(), debut: i, fin: lignes.length - 1 });
  });
  for (const b of blocs) {
    // On ne garde pas les lignes vides de la fin : elles appartiennent à la respiration du fichier.
    while (b.fin > b.debut && !lignes[b.fin].trim()) b.fin--;
    b.brut = lignes.slice(b.debut, b.fin + 1).join("\n");
    b.corps = lignes.slice(b.debut + 1, b.fin + 1);
  }
  return blocs;
}

/** `projets.md` → un projet par bloc `## Nom · Statut · Domaine · Responsable`. */
export function lireProjets(md) {
  return decouper(md, "##").map((b, index) => {
    const [nom, statut, domaine, responsable] = b.titre.split("·").map((x) => x.trim());
    let echeance = "";
    let texte = "";
    for (const ligne of b.corps) {
      const ech = ligne.match(/^\*\*Échéance\s*:\*\*\s*(.*)$/);
      if (ech) { echeance = ech[1].trim(); continue; }
      if (ligne.trim()) texte += (texte ? " " : "") + ligne.trim();
    }
    return {
      nom, statut: statut || "", domaine: domaine || "",
      responsable: responsable && responsable !== "—" ? responsable : "",
      echeance, texte,
      fichier: "projets.md", index, debut: b.debut, fin: b.fin, brut: b.brut, titre: b.titre,
    };
  }).filter((p) => p.nom);
}

/** Les fichiers de mois → une liste de faits, du plus récent au plus ancien. */
export function lireFaits(fichiers) {
  const faits = [];
  for (const f of fichiers) {
    const nomFichier = typeof f === "string" ? "" : f.nom;
    const contenu = typeof f === "string" ? f : f.contenu;
    decouper(contenu, "###").forEach((b, index) => {
      const [date, domaine, nature, projet] = b.titre.split("·").map((x) => x.trim());
      let effet = "";
      let texte = "";
      for (const ligne of b.corps) {
        const e = ligne.match(/^\*\*Effet\*\*\s*:\s*(.*)$/);
        if (e) { effet = e[1].trim(); continue; }
        if (ligne.trim()) texte += (texte ? " " : "") + ligne.trim();
      }
      faits.push({
        date: isoDepuisFr(date) || "", date_fr: date,
        domaine: domaine || "—", nature: nature || "—",
        projet: projet && projet !== "—" ? projet : "",
        effet, texte,
        fichier: nomFichier, index, debut: b.debut, fin: b.fin, brut: b.brut, titre: b.titre,
      });
    });
  }
  return faits.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Le bloc d'un fait, rattaché à un autre projet : seule la quatrième
 * position du titre change (« — » quand il n'y a plus de projet).
 */
export function faitAvecProjet(brut, projet) {
  const lignes = String(brut || "").split(/\r?\n/);
  const m = lignes[0].match(/^(###\s+)(.+)$/);
  if (!m) throw new Error("Ce bloc n'est pas un fait.");
  const parts = m[2].split("·").map((x) => x.trim());
  while (parts.length < 4) parts.push("—");
  parts[3] = String(projet || "").trim() || "—";
  lignes[0] = m[1] + parts.join(" · ");
  return lignes.join("\n");
}

/**
 * Remplace un bloc dans un fichier, ou le retire quand `nouveau` est vide.
 * `titreAttendu` est le garde-fou : si le fichier a bougé entre l'affichage
 * et l'enregistrement, on refuse plutôt que d'écraser le mauvais bloc.
 */
export function remplacerBloc(contenu, { debut, fin, titreAttendu }, nouveau) {
  const lignes = String(contenu || "").split(/\r?\n/);
  if (debut < 0 || fin >= lignes.length || debut > fin) {
    throw new Error("Le fichier a changé depuis l'affichage : recharge la page et recommence.");
  }
  const titreVu = (lignes[debut].match(/^#{2,3}\s+(.+)$/) || [])[1];
  if (!titreVu || titreVu.trim() !== String(titreAttendu).trim()) {
    throw new Error("Le fichier a changé depuis l'affichage : recharge la page et recommence.");
  }
  const remplacement = String(nouveau || "").trim();
  lignes.splice(debut, fin - debut + 1, ...(remplacement ? remplacement.split(/\r?\n/) : []));
  return lignes.join("\n").replace(/\n{4,}/g, "\n\n\n").replace(/\s*$/, "\n");
}

/** Combien de faits par domaine, sur les `jours` derniers jours. */
export function parDomaine(faits, jusqua, jours = 30) {
  const limite = new Date(new Date(jusqua + "T12:00:00Z") - jours * 864e5).toISOString().slice(0, 10);
  const compte = {};
  for (const f of faits) if (f.date >= limite) compte[f.domaine] = (compte[f.domaine] || 0) + 1;
  return compte;
}

// ---------------------------------------------------------------- Prévisions

/** « 20 000 MAD », « 10,8 », « 60 % » → le premier nombre, ou null. */
const nombres = (s) => (String(s || "").replace(/[\s  ]/g, "").replace(/,/g, ".").match(/\d+(?:\.\d+)?/g) || []).map(Number);
const premier = (s) => { const n = nombres(s); return n.length ? n[0] : null; };
/** « 3× à 4× » → [3, 4] ; « 5× » → [5, 5]. */
const fourchette = (s) => { const n = nombres(s); return n.length ? [n[0], n.length > 1 ? n[1] : n[0]] : null; };
/** « 60 % » ou « 0,6 » → 0.6. */
const part = (v) => (v == null ? null : v > 1 ? v / 100 : v);
const cle = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();

/** Les lignes `**Libellé :** valeur` d'un texte → { libellé normalisé: valeur }, et le reste en texte libre. */
function champs(lignes) {
  const vus = {};
  const reste = [];
  for (const ligne of lignes) {
    const m = ligne.match(/^\s*(?:[-*]\s+)?\*\*(.+?)\s*:\s*\*\*\s*(.*)$/);
    if (m) vus[cle(m[1])] = m[2].trim();
    else reste.push(ligne);
  }
  return { vus, reste };
}

/**
 * `previsions.md` → les réglages communs (en tête du fichier) et un
 * scénario par bloc `## Nom`. Un bloc sans « Lits » est une note (la
 * lecture, la conclusion) : il s'affiche comme du texte.
 *
 * Seules les hypothèses sont écrites dans le fichier ; tout ce qui en
 * découle (revenu, EBITDA, valorisations) est recalculé ici, pour qu'une
 * hypothèse corrigée corrige tout le reste.
 */
export function lirePrevisions(md) {
  const texte = String(md || "");
  const blocs = decouper(texte, "##");
  const tete = texte.split(/\r?\n/).slice(0, blocs.length ? blocs[0].debut : undefined);
  const { vus: g, reste: intro } = champs(tete.filter((l) => !/^#\s/.test(l)));

  const reglages = {
    taux: premier(g["taux"]) || 10.8,
    multiple_revenus: fourchette(g["multiple de revenus"]) || [1.5, 2.5],
    cap_rate: (fourchette(g["cap rate"]) || [10, 12]).map(part),
    source: (String(g["source"] || "").match(/https?:\/\/\S+/) || [""])[0].replace(/[)>]+$/, ""),
    // Le premier paragraphe seulement : la suite explique le fichier à qui l'édite.
    intro: intro.join("\n").trim().split(/\n\s*\n/)[0].split("\n").map((l) => l.trim()).join(" "),
  };

  const scenarios = [];
  const notes = [];
  blocs.forEach((b, index) => {
    const [nom, ...marques] = b.titre.split("·").map((x) => x.trim());
    const { vus, reste } = champs(b.corps);
    const base = { nom, index, fichier: "previsions.md", debut: b.debut, fin: b.fin, brut: b.brut, titre: b.titre };
    const corps = reste.join("\n").trim();
    if (vus["lits"] == null) { notes.push({ ...base, corps }); return; }

    const lits = premier(vus["lits"]);
    const to = part(premier(vus["taux d occupation"] ?? vus["to"]));
    const adr = premier(vus["adr"]);
    const charges = premier(vus["charges"]) || 0;
    const multiple = fourchette(vus["multiple d ebitda"] ?? vus["multiple"]) || [0, 0];
    const complet = lits != null && to != null && adr != null;
    // CA = lits × ADR × TO × 30 jours — la formule du classeur.
    const revenu_mois = complet ? lits * adr * to * 30 : null;
    const ebitda_mois = complet ? revenu_mois - charges : null;
    const ebitda_an_eur = complet ? (ebitda_mois * 12) / reglages.taux : null;
    const ca_an_eur = complet ? (revenu_mois * 12) / reglages.taux : null;
    scenarios.push({
      ...base,
      reference: marques.some((m) => /r[ée]f[ée]rence/i.test(m)),
      lits, to, adr, charges, multiple,
      revenu_mois, ebitda_mois, ebitda_an: complet ? ebitda_mois * 12 : null, ebitda_an_eur,
      texte: reste.map((l) => l.trim()).filter(Boolean).join(" "),
      valorisations: complet ? [
        { methode: "Multiple d'EBITDA", hypothese: `${fr(multiple[0])}× à ${fr(multiple[1])}×`,
          basse: ebitda_an_eur * multiple[0], haute: ebitda_an_eur * multiple[1] },
        { methode: "Multiple de revenus", hypothese: `${fr(reglages.multiple_revenus[0])}× à ${fr(reglages.multiple_revenus[1])}× le CA`,
          basse: ca_an_eur * reglages.multiple_revenus[0], haute: ca_an_eur * reglages.multiple_revenus[1] },
        { methode: "Cap rate", hypothese: `${fr(reglages.cap_rate[0] * 100)} % à ${fr(reglages.cap_rate[1] * 100)} %`,
          basse: ebitda_an_eur / Math.max(...reglages.cap_rate), haute: ebitda_an_eur / Math.min(...reglages.cap_rate) },
      ] : [],
    });
  });
  if (scenarios.length && !scenarios.some((s) => s.reference)) scenarios[0].reference = true;
  return { reglages, scenarios, notes };
}

const fr = (n) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
