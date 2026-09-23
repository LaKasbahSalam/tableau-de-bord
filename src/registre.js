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
