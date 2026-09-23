/**
 * Transforme les données brutes des trois sources en ce que la page
 * affiche : alertes classées, voyants des tâches automatiques, fiches
 * projet, projets Notion ouverts, occupation.
 */

import { lireProjets, lireFaits, parDomaine } from "./registre.js";

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

// ------------------------------------------------------------- Analyse

export function analyser({ github, registre, supabase }, maintenant) {
  const ici = local(maintenant);
  // La copie de l'appli passe à 23h30 : avant, le dernier jour visible est hier.
  const copieDuJour = ici.h * 60 + ici.m >= 23 * 60 + 45;
  const attendu = copieDuJour ? ici.jour : decaler(ici.jour, -1);

  const alertes = [];
  // `technique` : utile à l'équipe, sans intérêt pour l'associé à distance
  const alerte = (niveau, titre, detail, qui, technique = false) => alertes.push({ niveau, titre, detail, qui, technique });

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
    { heure: "20:00", titre: "Synchro caisse", desc: "La V16 récupère la caisse de l'appli. Se lit dans le message de 21h, qui porte le solde.",
      ...(sb ? (() => { const v = voyantRappel(rappels, "soir", attendu, "solde", copieOk);
        return v.niveau === "warn" ? { ...v, etat: "Solde absent à 21h" } : v; })() : inconnu) },
    { heure: "21:00", titre: "« Compter la caisse »", desc: "Message Telegram avec le relevé du classeur.",
      ...(sb ? voyantRappel(rappels, "soir", attendu, null, copieOk) : inconnu) },
    { heure: "22:00", titre: "Envoi du CdR", desc: "La V16 envoie son compte de résultat à l'analytique.",
      ...(sb ? voyantSource(sources.v16, maintenant) : inconnu) },
    { heure: "23:25", titre: "Réservations Beds24", desc: "Copie des réservations, en lecture seule.",
      ...(sb ? voyantSource(sources.beds24, maintenant) : inconnu) },
    { heure: "23:30", titre: "Copie de l'appli", desc: "Toutes les tables de l'appli sauf les sensibles.",
      ...(sb ? vKasbah : inconnu) },
  ];
  for (const f of flux) {
    if (f.niveau === "crit") alerte("crit", `${f.titre} (${f.heure}) : ${f.etat.toLowerCase()}`, f.detail, "Tâche automatique");
    else if (f.niveau === "warn") alerte("warn", `${f.titre} (${f.heure}) : ${f.etat.toLowerCase()}`, f.detail, "Tâche automatique");
  }
  if (sb && sb.tables_inconnues && sb.tables_inconnues.length) {
    alerte("warn", `${sb.tables_inconnues.length} nouvelle(s) table(s) dans l'appli sans décision de copie`,
      `\`${sb.tables_inconnues.join("`, `")}\` : à classer « copier » ou « exclure » dans \`kasbah_brut.tables\`, sinon l'analytique ne les voit pas.`, "Analytique", true);
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
          alerte("crit", i.titre, /pas toute|toutes seules/.test(ligneMigration) ? ligneMigration : `${ligneMigration} Une migration poussée sur GitHub ne s'applique pas toute seule.`, d.nom, true);
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
        alerte("warn", `Branche \`${b.nom}\` : ${b.en_avance} changement(s) pas encore dans ${d.principale}`,
          b.dernier ? `Dernier changement le ${quandFr(b.dernier)}, il y a ${age} jour(s).` : "", d.nom, true);
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
        const jour = (p.echeance || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (jour && p.statut !== "Plus tard") {
          const n = joursEntre(ici.jour, `${jour[3]}-${jour[2]}-${jour[1]}`);
          if (n < 0) {
            niveau = "warn";
            if (!/dépassée/i.test(echeanceTexte)) echeanceTexte += " · dépassée";
            alerte("warn", `${p.nom} : échéance dépassée depuis ${-n} jour(s)`, `Projet au statut « ${p.statut || "sans statut"} », échéance au ${jour[0]}.`, "Projets");
          } else if (n <= 10) {
            niveau = "warn";
            echeanceTexte += ` · dans ${n} j`;
            alerte("warn", `${p.nom} : échéance le ${jour[1]}/${jour[2]}`, `Projet au statut « ${p.statut || "sans statut"} », dans ${n} jour(s).`, "Projets");
          }
        }
        return { ...p, niveau, echeanceTexte };
      });
    // Un incident non suivi d'une livraison sur le même projet reste ouvert
    const recents = faits.filter((f) => joursEntre(f.date, ici.jour) <= 30);
    for (const f of recents.filter((x) => x.nature === "Incident" || x.nature === "Risque")) {
      const reparé = recents.some((x) => x.nature === "Livraison" && x.projet === f.projet && x.date > f.date);
      if (!reparé) alerte("warn", `${f.nature} ouvert : ${f.texte.slice(0, 80)}${f.texte.length > 80 ? "…" : ""}`, `${f.date_fr} · ${f.projet || f.domaine}${f.effet ? ` · ${f.effet}` : ""}`, "Registre");
    }
  }

  // --- Sources mal configurées
  for (const [nom, s] of [["GitHub", github], ["Registre", registre], ["Supabase", supabase]]) {
    if (!s.ok) alerte("info", `${nom} n'est pas lu`, s.erreur, "Configuration", true);
  }
  for (const d of depots) if (!d.ok) alerte("info", `${d.nom} n'est pas lu`, d.erreur, "GitHub", true);

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
    technique: registre.ok ? registre.donnees.technique : "",
    faits,
    faits_par_domaine: parDomaine(faits, ici.jour, 30),
    chiffres: sb ? sb.chiffres : null,
    occupation: sb ? sb.occupation : null,
    etat: { github: github.ok, registre: registre.ok, supabase: supabase.ok },
  };
}
