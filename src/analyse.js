/**
 * Transforme les données brutes des trois sources en ce que la page
 * affiche : alertes classées, voyants des tâches automatiques, fiches
 * projet, projets Notion ouverts, occupation.
 */

import { lireProjets, lireFaits, parDomaine, slugProjet, lireRecurrentes, lundiDe, numeroSemaine } from "./registre.js";

const FUSEAU = "Africa/Casablanca";

// ------------------------------------------------------------- Heures

export function local(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { jour: `${p.year}-${p.month}-${p.day}`, h: Number(p.hour), m: Number(p.minute) };
}
const decaler = (jour, n) => {
  const d = new Date(jour + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const jourFr = (jour) => (jour ? `${jour.slice(8, 10)}/${jour.slice(5, 7)}` : "—");
export const quandFr = (iso) => {
  if (!iso) return "—";
  const l = local(new Date(iso));
  return `${jourFr(l.jour)} à ${String(l.h).padStart(2, "0")}h${String(l.m).padStart(2, "0")}`;
};
const heuresDepuis = (iso, maintenant) => (maintenant - new Date(iso)) / 36e5;
const joursEntre = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);

// ------------------------------------------------------------- Listes de tâches

/** TASKS.md : sections « ## … », cases « - [ ] » en début de ligne. */
export function lireTaches(md) {
  const sections = [];
  let courante = { titre: "", items: [] };
  sections.push(courante);
  let dernier = null;
  for (const ligne of (md || "").split(/\r?\n/)) {
    const s = ligne.match(/^##\s+(.*)/);
    if (s) { courante = { titre: s[1].trim(), items: [] }; sections.push(courante); dernier = null; continue; }
    if (dernier && /^\s+\S/.test(ligne)) {
      dernier.lignes.push(ligne.trim().replace(/^(-|\d+\.)\s+/, ""));
      continue;
    }
    const c = ligne.match(/^- \[( |x|X)\]\s+(.*)/);
    if (!c) { if (/^\S/.test(ligne)) dernier = null; continue; }
    const brut = c[2].trim();
    const gras = brut.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    const titre = gras ? gras[1] : brut.replace(/\s+—\s+\d{2}\/\d{2}\/\d{4}.*$/, "");
    const reste = gras ? gras[2] : "";
    const note = (reste.match(/\*([^*]+)\*/) || [])[1] || "";
    const date = (brut.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] || "";
    dernier = { fait: c[1] !== " ", titre, note, date, section: courante.titre, lignes: [] };
    courante.items.push(dernier);
  }
  const tous = sections.flatMap((s) => s.items);
  const ouverts = tous.filter((i) => !i.fait && !/^fait/i.test(i.section));
  const faits = tous.filter((i) => i.fait);
  return { ouverts, faits };
}

/** CLAUDE.md de l'analytique : phases « - [ ] **P4 — … ** » et leurs sous-cases. */
export function lirePhases(md) {
  const phases = [];
  let courante = null;
  for (const ligne of (md || "").split(/\r?\n/)) {
    const p = ligne.match(/^- \[( |x|X)\]\s+\*\*(P\d+\s*—\s*[^*]+)\*\*/);
    if (p) { courante = { titre: p[2].trim(), faite: p[1] !== " ", ouverts: [] }; phases.push(courante); continue; }
    if (/^\S/.test(ligne)) courante = null;
    const s = ligne.match(/^  - \[ \]\s+(.*)/);
    if (s && courante) courante.ouverts.push(s[1].replace(/\*\*/g, "").trim());
  }
  return phases;
}

// ------------------------------------------------------------- Voyants

function voyantSource(src, maintenant) {
  if (!src) return { niveau: "idle", etat: "Jamais passée" };
  if (src.statut === "erreur") return { niveau: "crit", etat: "En erreur", detail: `Dernière tentative ${quandFr(src.derniere_tentative)} · dernière réussite ${quandFr(src.derniere_reussite)}` };
  if (!src.derniere_reussite) return { niveau: "crit", etat: "Jamais réussie" };
  const h = heuresDepuis(src.derniere_reussite, maintenant);
  const detail = `Dernière réussite ${quandFr(src.derniere_reussite)}${src.lignes != null ? ` · ${src.lignes.toLocaleString("fr-FR")} lignes` : ""}`;
  if (src.statut === "partiel") return { niveau: "warn", etat: "Partielle", detail };
  if (h <= 26) return { niveau: "ok", etat: "OK", detail };
  if (h <= 50) return { niveau: "warn", etat: "Nuit dernière manquée", detail };
  return { niveau: "crit", etat: `Arrêtée depuis ${Math.floor(h / 24)} jours`, detail };
}

function voyantRappel(rappels, moment, attendu, blocAttendu, copieOk) {
  if (!copieOk) return { niveau: "idle", etat: "Inconnu", detail: "La copie de l'appli n'a pas tourné : pas de nouvelles des rappels." };
  const derniers = rappels.filter((r) => r.moment === moment).sort((a, b) => (a.jour < b.jour ? 1 : -1));
  const dernier = derniers[0];
  if (!dernier) return { niveau: "crit", etat: "Aucune trace", detail: "Aucun envoi sur les 10 derniers jours." };
  const detail = `Dernier envoi ${quandFr(dernier.envoye_at)}`;
  if (dernier.jour < attendu) return { niveau: "crit", etat: `Rien depuis le ${jourFr(dernier.jour)}`, detail };
  if (blocAttendu && !(dernier.blocs || []).includes(blocAttendu)) {
    return { niveau: "warn", etat: "Parti incomplet", detail: `${detail} · sans le bloc « ${blocAttendu} »` };
  }
  return { niveau: "ok", etat: "Parti", detail };
}

// ------------------------------------------------------------- Consignes
//
// Chaque alerte dit trois choses : comment faire, à quoi on voit que c'est
// fini, et comment vérifier que ce n'est pas déjà fait sans que la page le
// sache (elle ne lit que ce qui est poussé et ce que la copie du soir rapporte).

const APPLI = "la base de l'appli (KasbahCalendar, réf. `tggdwwvdlrgncbntxkfs`)";
const ANALYTICS = "Kasbah Analytics (réf. `sebwcxxoxpfbliypzokp`)";
const RELIRE = "La page garde ses lectures 3 minutes : cliquer « Relire maintenant » avant de chercher plus loin.";

/** Les voyants qui lisent `analytique.fraicheur` : même vérification, source différente. */
const guideSynchro = (source, fonction, ou) => ({
  faire: `Lire l'erreur : ${ou} → Edge Functions → \`${fonction}\` → Logs. Puis relancer la fonction, ou attendre le passage de ce soir si la cause est réglée.`,
  fini: `La ligne \`${source}\` de \`analytique.fraicheur\` a une \`derniere_reussite\` d'aujourd'hui : le voyant repasse au vert.`,
  verifier: `${RELIRE} Sinon, dans ${ANALYTICS}, éditeur SQL : \`select * from analytique.fraicheur where source = '${source}'\` (c'est l'analytique : c'est elle qui note ses passages). Une réussite récente veut dire que c'est déjà reparti.`,
});

const guideRappel = (quand) => ({
  faire: `Regarder le groupe Telegram : le message de ${quand} est-il arrivé ? S'il manque, lire l'erreur dans ${APPLI} → Edge Functions → \`rappel-soir\` → Logs.`,
  fini: `Le message de ${quand} arrive dans le groupe ; le voyant repasse au vert le lendemain, après la copie de 23h30.`,
  verifier: `Le voyant lit la copie de 23h30, donc avec un jour de retard. Si le message est bien dans Telegram, le rappel marche : regarder plutôt le voyant « Copie de l'appli ».`,
});

const GUIDES_FLUX = {
  "Rappel du matin": guideRappel("8h"),
  "Synchro caisse": {
    faire: "Ouvrir le classeur V16 : les lignes de caisse du jour sont-elles arrivées ? Sinon, Extensions → Apps Script → Exécutions : l'exécution `syncCloture` de 14h (affichée 13h, en heure UTC) et son erreur. Menu Caisse → Synchroniser maintenant la rattrape, et le message part aussitôt.",
    fini: "Le message « On peut compter la caisse » porte le solde du jour.",
    verifier: "Si les lignes du jour sont dans la caisse de V16, la synchro a tourné : c'est seulement le message qui n'a pas lu le solde.",
  },
  "« Compter la caisse »": guideRappel("14h (16h si la synchro a manqué)"),
  "Envoi du CdR": {
    faire: "Dans le classeur V16 : Extensions → Apps Script → Exécutions, l'envoi de 22h et son erreur. Une fois la cause réglée, relancer la même fonction depuis cet écran.",
    fini: "La ligne `v16` de `analytique.fraicheur` a une réussite d'aujourd'hui.",
    verifier: guideSynchro("v16", "import-cdr", ANALYTICS).verifier,
  },
  "Réservations Beds24": {
    ...guideSynchro("beds24", "sync-beds24", ANALYTICS),
    faire: `Lire l'erreur : ${ANALYTICS} → Edge Functions → \`sync-beds24\` → Logs. « Partielle » veut souvent dire quota Beds24 atteint (100 crédits par 5 minutes) : le passage suivant rattrape.`,
  },
  "Copie de l'appli": {
    ...guideSynchro("kasbah", "sync-kasbah", ANALYTICS),
    faire: `Lire l'erreur : ${ANALYTICS} → Edge Functions → \`sync-kasbah\` → Logs. Si elle vient de l'appli, la suite est dans ${APPLI} → \`export-brut\` → Logs.`,
  },
};

// ------------------------------------------------------------- Analyse

export function analyser({ github, registre, supabase }, maintenant) {
  const ici = local(maintenant);
  // La copie de l'appli passe à 23h30 : avant, le dernier jour visible est hier.
  const copieDuJour = ici.h * 60 + ici.m >= 23 * 60 + 45;
  const attendu = copieDuJour ? ici.jour : decaler(ici.jour, -1);

  const alertes = [];
  // `technique` : utile à l'équipe, sans intérêt pour l'associé à distance
  // `guide` : { faire, fini, verifier } — comment faire, quand c'est fini, comment vérifier.
  const alerte = (niveau, titre, detail, qui, technique = false, guide = null) => alertes.push({ niveau, titre, detail, qui, technique, guide });

  // --- Tâches automatiques
  const sb = supabase.ok ? supabase.donnees : null;
  const sources = Object.fromEntries((sb ? sb.sources : []).map((s) => [s.source, s]));
  const rappels = sb ? sb.rappels : [];
  const vKasbah = sb ? voyantSource(sources.kasbah, maintenant) : null;
  const copieOk = vKasbah && vKasbah.niveau !== "crit";
  const inconnu = { niveau: "idle", etat: "Pas de données", detail: supabase.erreur || "" };

  const flux = [
    { heure: "08:00", titre: "Rappel du matin", desc: "Telegram : départs non payés du jour et du lendemain, plats du jour.",
      ...(sb ? voyantRappel(rappels, "matin", attendu, "departs", copieOk) : inconnu) },
    { heure: "14:00", titre: "Synchro caisse", desc: "La V16 récupère la caisse de l'appli et relève le solde. Se lit dans le message qui suit, qui porte le solde.",
      ...(sb ? (() => { const v = voyantRappel(rappels, "soir", attendu, "solde", copieOk);
        return v.niveau === "warn" ? { ...v, etat: "Solde absent du message" } : v; })() : inconnu) },
    { heure: "14:00", titre: "« Compter la caisse »", desc: "Message Telegram avec le relevé du classeur, juste après la synchro (16h si elle a manqué).",
      ...(sb ? voyantRappel(rappels, "soir", attendu, null, copieOk) : inconnu) },
    { heure: "22:00", titre: "Envoi du CdR", desc: "La V16 envoie son compte de résultat à l'analytique.",
      ...(sb ? voyantSource(sources.v16, maintenant) : inconnu) },
    { heure: "23:25", titre: "Réservations Beds24", desc: "Copie des réservations, en lecture seule.",
      ...(sb ? voyantSource(sources.beds24, maintenant) : inconnu) },
    { heure: "23:30", titre: "Copie de l'appli", desc: "Toutes les tables de l'appli sauf les sensibles.",
      ...(sb ? vKasbah : inconnu) },
  ];
  for (const f of flux) {
    if (f.niveau === "crit" || f.niveau === "warn") {
      alerte(f.niveau, `${f.titre} (${f.heure}) : ${f.etat.toLowerCase()}`, f.detail, "Tâche automatique", false, GUIDES_FLUX[f.titre]);
    }
  }
  if (sb && sb.tables_inconnues && sb.tables_inconnues.length) {
    const noms = sb.tables_inconnues.map((t) => `'${t}'`).join(", ");
    alerte("warn", `${sb.tables_inconnues.length} nouvelle(s) table(s) dans l'appli sans décision de copie`,
      `\`${sb.tables_inconnues.join("`, `")}\` : à classer « copier » ou « exclure » dans \`kasbah_brut.tables\`, sinon l'analytique ne les voit pas.`, "Analytique", true, {
        faire: `Écrire une migration dans \`Kasbah-Analytique/supabase/migrations/\`, sur le modèle de \`20260917100000_decisions_tables.sql\` : une ligne par table dans \`kasbah_brut.tables\` (« exclure » dès qu'elle porte un secret, un compte ou un e-mail), puis la retirer de \`kasbah_brut.tables_inconnues\`. La lancer dans ${ANALYTICS} : c'est l'analytique qui décide de ce qu'elle copie.`,
        fini: "Les tables ne sont plus dans `kasbah_brut.tables_inconnues` : l'alerte part à la lecture suivante.",
        verifier: `Dans ${ANALYTICS} : \`select * from kasbah_brut.tables where table_name in (${noms})\`. Si elles ont déjà une décision, il ne reste qu'à les retirer des inconnues.`,
      });
  }

  // --- Projets GitHub
  const projets = [];
  const depots = github.ok ? github.donnees : [];
  for (const d of depots) {
    const fiche = { nom: d.nom, sous_titre: d.sous_titre, url: d.url, kv: [], ouverts: [], recents: [], notes: [] };
    projets.push(fiche);
    if (!d.ok) { fiche.badge = { niveau: "idle", texte: "Pas lu" }; fiche.erreur = d.erreur; continue; }

    const c0 = d.commits[0];
    if (c0) fiche.kv.push(["Dernier changement", `${c0.message} · ${quandFr(c0.date)}`]);

    let critique = false;
    if (d.taches) {
      const t = lireTaches(d.taches);
      for (const i of t.ouverts) {
        const ligneMigration = [i.titre, ...i.lignes].find((l) => /appliquer.*migration|migration.*appliquer|migrations? à (lancer|appliquer)/i.test(l));
        const migration = Boolean(ligneMigration);
        if (migration) {
          critique = true;
          // Le dossier donne la base (voir le CLAUDE.md commun).
          const base = /analytique/i.test(d.nom) ? ANALYTICS : /calendar/i.test(d.nom) ? APPLI : "la base du dépôt (le dossier du fichier la donne)";
          alerte("crit", i.titre, /pas toute|toutes seules/.test(ligneMigration) ? ligneMigration : `${ligneMigration} Une migration poussée sur GitHub ne s'applique pas toute seule.`, d.nom, true, {
            faire: `Ouvrir le ou les fichiers \`.sql\` dans \`${d.nom}/supabase/migrations/\`, les coller un par un, dans l'ordre des noms, dans l'éditeur SQL de ${base}, puis *Run*. Avant, vérifier le nom du projet en haut à gauche de Supabase. Ensuite, cocher la tâche dans \`TASKS.md\` et pousser.`,
            fini: `La tâche « ${i.titre} » est cochée dans \`TASKS.md\` et poussée. L'alerte vit de la tâche ouverte, pas de la base : appliquée mais pas cochée, elle reste.`,
            verifier: `Dans ${base}, Table Editor ou Database → Functions : chercher ce que la migration crée (table, colonne, fonction). S'il existe déjà, la migration a tourné : il ne reste qu'à cocher la tâche.`,
          });
        }
        fiche.ouverts.push({ texte: i.titre, note: i.note, niveau: migration ? "crit" : (i.note ? "warn" : "") });
      }
      fiche.recents = t.faits.filter((i) => i.date).slice(0, 3);
      fiche.kv.push(["Tâches ouvertes", String(t.ouverts.length)]);
    }

    if (d.phases) {
      const ph = lirePhases(d.phases);
      // L'étape en cours : la première ouverte après la dernière terminée
      // (une étape de préparation peut rester ouverte derrière).
      const derniereFaite = ph.map((p) => p.faite).lastIndexOf(true);
      const apres = ph.findIndex((p, i) => i > derniereFaite && !p.faite);
      const k = apres >= 0 ? apres : ph.findIndex((p) => !p.faite);
      if (ph.length) {
        fiche.badge = { niveau: "info", texte: k < 0 ? "Toutes les étapes faites" : `Étape ${ph[k].titre.split(/\s/)[0]}` };
        fiche.kv.push(["Étapes faites", `${ph.filter((p) => p.faite).length} sur ${ph.length}`]);
        if (k >= 0) {
          fiche.kv.push(["En cours", ph[k].titre.replace(/^P\d+\s*—\s*/, "")]);
          fiche.ouverts = ph[k].ouverts.slice(0, 6).map((texte) => ({ texte, niveau: /^Karim/i.test(texte) ? "warn" : "" }));
        }
      }
    }

    const enAttente = d.branches.filter((b) => b.en_avance > 0);
    const fusionnees = d.branches.filter((b) => b.en_avance === 0);
    if (d.branches.length) {
      fiche.kv.push(["Branches", [
        enAttente.length ? `${enAttente.length} pas encore dans ${d.principale}` : "",
        fusionnees.length ? `${fusionnees.length} déjà fusionnée(s), à supprimer` : "",
      ].filter(Boolean).join(" · ") || "—"]);
    }
    for (const b of enAttente) {
      const age = b.dernier ? joursEntre(local(new Date(b.dernier)).jour, ici.jour) : null;
      if (age === null || age >= 2) {
        const comparer = d.url ? `[la comparaison sur GitHub](${d.url}/compare/${d.principale}...${encodeURIComponent(b.nom)})` : "la comparaison sur GitHub";
        alerte("warn", `Branche \`${b.nom}\` : ${b.en_avance} changement(s) pas encore dans ${d.principale}`,
          b.dernier ? `Dernier changement le ${quandFr(b.dernier)}, il y a ${age} jour(s).` : "", d.nom, true, {
            faire: `Ouvrir ${comparer}. Si le travail est bon : *Create pull request* puis *Merge*. S'il est abandonné : supprimer la branche (onglet Branches du dépôt).`,
            fini: `La branche n'a plus de changement d'avance sur ${d.principale}, ou n'existe plus.`,
            verifier: `Sur la comparaison, « There isn't anything to compare » veut dire que tout est déjà dans ${d.principale} : il ne reste qu'à supprimer la branche. En local, \`git log ${d.principale}..${b.nom}\` vide dit la même chose.`,
          });
      }
    }
    if (d.migrations && d.migrations.length) {
      fiche.migrations_recentes = d.migrations.slice(-5).reverse();
      fiche.kv.push(["Dernière migration", `\`${d.migrations[d.migrations.length - 1].replace(/\.sql$/, "")}\``]);
    }
    if (!d.taches && !d.phases) fiche.notes.push("Pas de liste de tâches dans ce dépôt.");

    fiche.badge = fiche.badge || (critique ? { niveau: "crit", texte: "Migration à lancer" }
      : enAttente.length ? { niveau: "warn", texte: "Branche en attente" }
      : { niveau: "ok", texte: "À jour" });
  }

  // --- Projets et registre (dossier pilotage/ de Kasbah-Analytique)
  const ORDRE = ["En cours", "À faire", "En attente", "Plus tard", "Terminé", ""];
  let vueProjets = { ok: registre.ok, erreur: registre.erreur, lignes: [], compte: {}, total: 0 };
  let faits = [];
  const documentsParProjet = registre.ok ? (registre.donnees.documents || {}) : {};
  if (registre.ok) {
    const tous = lireProjets(registre.donnees.projets);
    faits = lireFaits(registre.donnees.mois);
    vueProjets.total = tous.length;
    for (const p of tous) vueProjets.compte[p.statut || "Sans statut"] = (vueProjets.compte[p.statut || "Sans statut"] || 0) + 1;
    vueProjets.lignes = tous
      .filter((p) => p.statut !== "Terminé")
      .sort((a, b) => ORDRE.indexOf(a.statut) - ORDRE.indexOf(b.statut))
      .map((p) => {
        let niveau = p.statut === "En cours" ? "info" : "idle";
        let echeanceTexte = p.echeance && p.echeance !== "—" ? p.echeance : "—";
        // Ce qui s'est fait sur ce projet : les faits du registre qui le nomment.
        const faitsDuProjet = faits.filter((f) => f.projet === p.nom);
        const jour = (p.echeance || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (jour && p.statut !== "Plus tard") {
          const n = joursEntre(ici.jour, `${jour[3]}-${jour[2]}-${jour[1]}`);
          const dernier = faitsDuProjet[0];
          const guide = {
            faire: "Si le projet est fini : bouton « Modifier » du projet (section Les projets), statut `Terminé`. Sinon : une nouvelle échéance réaliste, ou le statut `Plus tard` s'il attend.",
            fini: "Statut `Terminé` ou `Plus tard`, ou une échéance à plus de 10 jours, enregistrée (un commit dans `pilotage/projets.md`).",
            verifier: dernier
              ? `Dernier fait rattaché au projet : ${dernier.date_fr}, ${dernier.nature.toLowerCase()} — « ${dernier.effet || dernier.texte.slice(0, 90)} ». Si c'est la fin du projet, seule la fiche n'a pas suivi. Le détail est sous le projet, section Les projets.`
              : "Aucun fait du registre n'est rattaché à ce projet : s'il a avancé, c'est le registre qui n'a pas suivi. Demander à l'équipe, puis l'écrire (compétence `registre`).",
          };
          if (n < 0) {
            niveau = "warn";
            if (!/dépassée/i.test(echeanceTexte)) echeanceTexte += " · dépassée";
            alerte("warn", `${p.nom} : échéance dépassée depuis ${-n} jour(s)`, `Projet au statut « ${p.statut || "sans statut"} », échéance au ${jour[0]}.`, "Projets", false, guide);
          } else if (n <= 10) {
            niveau = "warn";
            echeanceTexte += ` · dans ${n} j`;
            alerte("warn", `${p.nom} : échéance le ${jour[1]}/${jour[2]}`, `Projet au statut « ${p.statut || "sans statut"} », dans ${n} jour(s).`, "Projets", false, guide);
          }
        }
        return {
          ...p, niveau, echeanceTexte, documents: documentsParProjet[slugProjet(p.nom)] || [],
          // Programmé : les cases ouvertes du bloc. Fait : le registre, puis les cases cochées.
          programmees: (p.taches || []).filter((t) => !t.fait),
          faites: [
            ...faitsDuProjet.map((f) => ({ date: f.date, date_fr: f.date_fr, nature: f.nature, texte: f.effet || f.texte })),
            ...(p.taches || []).filter((t) => t.fait).map((t) => ({ date: "", date_fr: t.date || "", nature: "", texte: t.texte })),
          ],
        };
      });
    // Un incident non suivi d'une livraison sur le même projet reste ouvert
    const recents = faits.filter((f) => joursEntre(f.date, ici.jour) <= 30);
    for (const f of recents.filter((x) => x.nature === "Incident" || x.nature === "Risque")) {
      const reparé = recents.some((x) => x.nature === "Livraison" && x.projet === f.projet && x.date > f.date);
      if (!reparé) alerte("warn", `${f.nature} ouvert : ${f.texte.slice(0, 80)}${f.texte.length > 80 ? "…" : ""}`, `${f.date_fr} · ${f.projet || f.domaine}${f.effet ? ` · ${f.effet}` : ""}`, "Registre", false, {
        faire: `Réparer, puis écrire un fait « Livraison » qui le dit, rattaché au même projet (${f.projet ? `« ${f.projet} »` : "celui-ci n'en a pas : lui en choisir un d'abord"}). En fin de séance : compétence \`registre\`.`,
        fini: `Une Livraison datée après le ${f.date_fr}, sur le même projet. Sinon l'alerte tombe d'elle-même 30 jours après.`,
        verifier: `Souvent c'est réparé, mais la livraison est rattachée à un autre projet, ou l'un des deux faits n'a pas de projet. Dans « Ce qui s'est fait », regarder le menu projet des deux faits : les aligner suffit.`,
      });
    }
  }

  // --- La santé du tableau de bord lui-même
  //
  // Un outil qui vieillit en silence trompe tout le monde : la base Notion
  // et le message de 21h d'août l'ont montré. Il dit donc lui-même quand
  // il n'est plus tenu.
  if (registre.ok) {
    const dernier = faits.find((f) => f.date);
    const guideRegistre = {
      faire: "En fin de séance, demander à Claude de tenir le registre (compétence `registre`) : il écrit les faits dans `pilotage/AAAA-MM.md`, demande le projet de chacun, et pousse.",
      fini: "Un fait daté de moins de 14 jours, poussé sur GitHub.",
      verifier: "Un fait écrit mais pas poussé n'existe pas pour la page : `git status` et `git log origin/main..` dans `Kasbah-Analytique`. S'il y a un commit en attente, il suffit de pousser.",
    };
    if (!dernier) {
      alerte("warn", "Le registre est vide", "Aucun fait enregistré : la page ne raconte rien de ce qui se fait.", "Tableau de bord", false, guideRegistre);
    } else {
      const age = joursEntre(dernier.date, ici.jour);
      if (age >= 14) {
        alerte(age >= 30 ? "crit" : "warn", `Aucun fait enregistré depuis ${age} jours`,
          `Le dernier remonte au ${dernier.date_fr}. Sans écriture, la page continue d'afficher des chiffres justes, mais ne dit plus ce qui a été fait ni décidé.`, "Tableau de bord", false, guideRegistre);
      }
    }

    const guideTechnique = {
      faire: "Relire `pilotage/technique.md` (Kasbah-Analytique) avec ce qui a changé depuis, corriger, et mettre à jour la ligne « Dernière révision : JJ/MM/AAAA ». Pousser.",
      fini: "La date de révision a moins de 90 jours, et c'est poussé.",
      verifier: "`git log -1 -- pilotage/technique.md` dans Kasbah-Analytique : si le fichier a été revu sans changer la date, il suffit de la mettre à jour.",
    };
    const revue = (registre.donnees.technique || "").match(/Derni[èe]re r[ée]vision\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (revue) {
      const age = joursEntre(`${revue[3]}-${revue[2]}-${revue[1]}`, ici.jour);
      if (age >= 90) {
        alerte("warn", `La page technique n'a pas été revue depuis ${Math.round(age / 30)} mois`,
          `Dernière révision le ${revue[1]}/${revue[2]}/${revue[3]}. L'architecture a probablement bougé depuis : \`pilotage/technique.md\`.`, "Tableau de bord", false, guideTechnique);
      }
    } else if (registre.donnees.technique) {
      alerte("info", "La page technique ne porte pas de date de révision",
        "Ajouter une ligne « Dernière révision : JJ/MM/AAAA » permet de savoir quand elle a menti pour la dernière fois.", "Tableau de bord", true, guideTechnique);
    }

    const guideCle = {
      faire: "Sur GitHub : Settings → Developer settings → Fine-grained tokens → `tableau-de-bord` → *Regenerate token*. Coller le nouveau jeton dans Cloudflare : le Worker → Settings → Variables and Secrets → `GITHUB_TOKEN`. Puis noter la nouvelle date dans `pilotage/technique.md` (« Clé GitHub : expire le JJ/MM/AAAA »).",
      fini: "La date notée dans `technique.md` est à plus de 21 jours, et les voyants GitHub et Registre, en haut de la page, sont verts.",
      verifier: "La page sur GitHub (Fine-grained tokens) montre la vraie date d'expiration : si le jeton a déjà été renouvelé, il ne reste qu'à recopier la date dans `technique.md`.",
    };
    const cle = (registre.donnees.technique || "").match(/Cl[ée] GitHub[^\n]*expire le\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (cle) {
      const reste = joursEntre(ici.jour, `${cle[3]}-${cle[2]}-${cle[1]}`);
      if (reste < 0) {
        alerte("crit", "La clé GitHub a expiré", `Échue le ${cle[1]}/${cle[2]}/${cle[3]} : la page ne lit plus ni les tâches, ni le registre, ni les projets.`, "Tableau de bord", false, guideCle);
      } else if (reste <= 21) {
        alerte("warn", `La clé GitHub expire dans ${reste} jours`,
          `Le ${cle[1]}/${cle[2]}/${cle[3]}. À renouveler avant, sinon la page devient grise du jour au lendemain.`, "Tableau de bord", false, guideCle);
      }
    } else if (registre.donnees.technique && !/Cl[ée] GitHub[^\n]*sans expiration/i.test(registre.donnees.technique)) {
      alerte("info", "L'expiration de la clé GitHub n'est notée nulle part",
        "L'écrire dans `pilotage/technique.md` (« Clé GitHub : expire le JJ/MM/AAAA », ou « sans expiration ») pour ne pas la découvrir le jour où tout devient gris.", "Tableau de bord", false, {
          faire: "Sur GitHub, Settings → Developer settings → Fine-grained tokens : lire la date d'expiration du jeton `tableau-de-bord`, et l'écrire dans `pilotage/technique.md`, section « Dates à surveiller ».",
          fini: "La ligne « Clé GitHub : expire le JJ/MM/AAAA » (ou « sans expiration ») est poussée.",
          verifier: "Chercher « Clé GitHub » dans `technique.md` : si la ligne existe mais avec une autre tournure, la page ne la reconnaît pas. La réécrire telle quelle.",
        });
    }
  }

  // --- Tâches récurrentes : une ligne par tâche, une colonne par semaine
  // (lundi → dimanche, comme les résumés de la semaine) : cette semaine en
  // premier, puis les quatre à venir.
  const NB_SEMAINES = 5;
  const recurrentes = { ok: registre.ok, semaines: [], lignes: [] };
  if (registre.ok) {
    const cetteSemaine = lundiDe(ici.jour);
    recurrentes.semaines = Array.from({ length: NB_SEMAINES }, (_, k) => {
      const lundi = decaler(cetteSemaine, 7 * k);
      return { lundi, numero: numeroSemaine(lundi), du: jourFr(lundi), au: jourFr(decaler(lundi, 6)), en_cours: lundi === cetteSemaine };
    });
    recurrentes.lignes = lireRecurrentes(registre.donnees.recurrent).map((t) => ({
      ...t,
      cases: recurrentes.semaines.map((s) => ({
        lundi: s.lundi,
        etat: t.faites.includes(s.lundi) ? "fait" : (t.depuis && s.lundi < t.depuis) ? "avant"
          : s.en_cours ? "en_cours" : s.lundi > cetteSemaine ? "a_venir" : "manque",
      })),
    }));
  }

  // --- Sources mal configurées
  const SECRETS = { GitHub: "`GITHUB_TOKEN`", Registre: "`GITHUB_TOKEN`", Supabase: "`SUPABASE_URL` et `SUPABASE_CLE_TABLEAU`" };
  const guideSource = (secrets) => ({
    faire: `Lire le message ci-dessus. Le plus souvent, un secret du Worker manque ou a changé : Cloudflare → le Worker → Settings → Variables and Secrets → ${secrets}.`,
    fini: "La pastille de la source, en haut de la page, est verte.",
    verifier: `${RELIRE} Une panne passagère de GitHub ou de Supabase se règle seule.`,
  });
  for (const [nom, s] of [["GitHub", github], ["Registre", registre], ["Supabase", supabase]]) {
    if (!s.ok) alerte("info", `${nom} n'est pas lu`, s.erreur, "Configuration", true, guideSource(SECRETS[nom]));
  }
  for (const d of depots) {
    if (!d.ok) alerte("info", `${d.nom} n'est pas lu`, d.erreur, "GitHub", true, {
      ...guideSource(SECRETS.GitHub),
      faire: `Vérifier que le dépôt \`${d.nom}\` existe encore dans LaKasbahSalam, et que le jeton \`tableau-de-bord\` y a accès (GitHub → Fine-grained tokens → Repository access).`,
      fini: "La fiche du dépôt, section Les outils, montre de nouveau ses tâches.",
    });
  }

  const rang = { crit: 0, warn: 1, info: 2 };
  alertes.sort((a, b) => rang[a.niveau] - rang[b.niveau]);

  return {
    alertes,
    projets_depots: projets,
    migrations_recentes: projets.flatMap((f) => (f.migrations_recentes || []).map((nom) => ({ depot: f.nom, nom: nom.replace(/\.sql$/, "") }))),
    compteurs: { crit: alertes.filter((a) => a.niveau === "crit").length, warn: alertes.filter((a) => a.niveau === "warn").length },
    flux,
    projets,
    projets_ouverts: vueProjets,
    // Tous les projets, terminés compris, pour le menu « projet » de chaque fait.
    noms_projets: registre.ok ? lireProjets(registre.donnees.projets).map((p) => p.nom) : [],
    technique: registre.ok ? registre.donnees.technique : "",
    faits,
    faits_par_domaine: parDomaine(faits, ici.jour, 30),
    chiffres: sb ? sb.chiffres : null,
    semaine: registre.ok ? registre.donnees.semaine : "",
    recurrentes,
    occupation: sb ? sb.occupation : null,
    etat: { github: github.ok, registre: registre.ok, supabase: supabase.ok },
  };
}
