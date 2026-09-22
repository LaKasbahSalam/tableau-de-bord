/**
 * Lecture du registre — les fichiers de `pilotage/` du dépôt
 * Kasbah-Analytique, écrits par Claude à chaque séance.
 *
 * Le format est décrit dans `pilotage/README.md` : une ligne de titre qui
 * porte le tri (date · domaine · nature · projet), puis une ligne
 * « **Effet** : … », puis du texte libre.
 */

export const DOMAINES = ["Revenus", "Coûts", "Clients", "Équipe", "Outils", "Conformité"];
export const NATURES = ["Décision", "Livraison", "Incident", "Dépense", "Risque"];

const isoDepuisFr = (jjmmaaaa) => {
  // Accepte « 22/09/2026 » et « 18-19/09/2026 » (on garde le dernier jour).
  const m = jjmmaaaa.match(/^(\d{2})(?:-(\d{2}))?\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[4]}-${m[3]}-${m[2] || m[1]}`;
};

/** `projets.md` → un projet par bloc `## Nom · Statut · Domaine · Responsable`. */
export function lireProjets(md) {
  const projets = [];
  let courant = null;
  for (const ligne of (md || "").split(/\r?\n/)) {
    const titre = ligne.match(/^##\s+(.+)$/);
    if (titre) {
      const [nom, statut, domaine, responsable] = titre[1].split("·").map((x) => x.trim());
      courant = { nom, statut: statut || "", domaine: domaine || "", responsable: responsable && responsable !== "—" ? responsable : "", echeance: "", texte: "" };
      projets.push(courant);
      continue;
    }
    if (!courant) continue;
    const ech = ligne.match(/^\*\*Échéance\s*:\*\*\s*(.*)$/);
    if (ech) { courant.echeance = ech[1].trim(); continue; }
    if (ligne.trim()) courant.texte += (courant.texte ? " " : "") + ligne.trim();
  }
  return projets.filter((p) => p.nom && !/^Projets$/i.test(p.nom));
}

/** Les fichiers de mois → une liste de faits, du plus récent au plus ancien. */
export function lireFaits(fichiers) {
  const faits = [];
  for (const contenu of fichiers) {
    let courant = null;
    for (const ligne of (contenu || "").split(/\r?\n/)) {
      const titre = ligne.match(/^###\s+(.+)$/);
      if (titre) {
        const [date, domaine, nature, projet] = titre[1].split("·").map((x) => x.trim());
        courant = {
          date: isoDepuisFr(date) || "", date_fr: date,
          domaine: domaine || "—", nature: nature || "—",
          projet: projet && projet !== "—" ? projet : "",
          effet: "", texte: "",
        };
        faits.push(courant);
        continue;
      }
      if (!courant) continue;
      const effet = ligne.match(/^\*\*Effet\*\*\s*:\s*(.*)$/);
      if (effet) { courant.effet = effet[1].trim(); continue; }
      if (ligne.trim()) courant.texte += (courant.texte ? " " : "") + ligne.trim();
    }
  }
  return faits.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Combien de faits par domaine, sur les `jours` derniers jours. */
export function parDomaine(faits, jusqua, jours = 30) {
  const limite = new Date(new Date(jusqua + "T12:00:00Z") - jours * 864e5).toISOString().slice(0, 10);
  const compte = {};
  for (const f of faits) if (f.date >= limite) compte[f.domaine] = (compte[f.domaine] || 0) + 1;
  return compte;
}
