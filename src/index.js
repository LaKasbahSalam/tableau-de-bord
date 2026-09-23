/**
 * Tableau de bord Kasbah — Worker Cloudflare.
 *
 * À chaque ouverture, lit trois sources en lecture seule et rend une page :
 *   - GitHub   : TASKS.md, branches et derniers commits des 4 dépôts ;
 *   - Notion   : la base « 📁 Projets » du Project Hub ;
 *   - Supabase : `public.tableau_de_bord(cle)` de Kasbah Analytics — l'état
 *                des synchros de la nuit et des rappels Telegram.
 * Une source en panne ou sans clé n'empêche pas les autres de s'afficher.
 *
 * Les réponses sont gardées 3 minutes par instance ; `?rafraichir=1` force
 * une nouvelle lecture.
 */
import {
  lireTout, lireFichierRegistre, ecrireFichierRegistre,
  DOSSIER_DOCUMENTS, MAX_DOCUMENTS_PAR_PROJET, MAX_OCTETS_DOCUMENT,
  listerDocumentsProjet, lireDocumentBrut, ecrireDocument, supprimerDocument, octetsVersBase64,
} from "./sources.js";
import { analyser } from "./analyse.js";
import { pageTableau, pageEdition, pageDocuments, pageConnexion } from "./page.js";
import { lireProjets, lireFaits, remplacerBloc, slugProjet } from "./registre.js";

const COOKIE = "kasbah_tdb";
const DUREE_CACHE_MS = 3 * 60 * 1000;
let cache = null; // { quand, donnees }

// Valeurs publiques par défaut : la page marche aussi collée à la main dans
// l'éditeur de Cloudflare, sans wrangler.jsonc.
const PAR_DEFAUT = {
  SUPABASE_URL: "https://sebwcxxoxpfbliypzokp.supabase.co",
  GITHUB_ORG: "LaKasbahSalam",
};

export default {
  async fetch(requete, envBrut) {
    // Les valeurs collées dans Cloudflare traînent souvent un espace ou un
    // retour à la ligne : on les enlève une bonne fois ici.
    const propre = Object.fromEntries(Object.entries(envBrut || {})
      .map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    const env = { ...PAR_DEFAUT, ...propre };
    const url = new URL(requete.url);

    if (!env.MOT_DE_PASSE) {
      return html(pageConnexion({ erreur: "La page n'a pas encore de mot de passe : ajoute le secret MOT_DE_PASSE dans Cloudflare.", bloque: true }), 503);
    }
    // Deux mots de passe, une seule page : celui de l'équipe et celui de
    // l'associé. Deux, pour pouvoir couper l'un sans l'autre.
    const jeton = await empreinte(env.MOT_DE_PASSE);
    const jetonAssocie = env.MOT_DE_PASSE_INVESTISSEUR ? await empreinte(env.MOT_DE_PASSE_INVESTISSEUR) : null;

    if (url.pathname === "/connexion" && requete.method === "POST") {
      const form = await requete.formData();
      const donne = await empreinte(String(form.get("mot_de_passe") || ""));
      if (donne !== jeton && donne !== jetonAssocie) {
        return html(pageConnexion({ erreur: "Mot de passe incorrect." }), 401);
      }
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${donne}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}`,
        },
      });
    }

    if (url.pathname === "/deconnexion") {
      return new Response(null, {
        status: 303,
        headers: { Location: "/", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0` },
      });
    }

    const cookie = lireCookie(requete, COOKIE);
    const associe = jetonAssocie && cookie === jetonAssocie;
    if (cookie !== jeton && !associe) {
      return html(pageConnexion({}), 401);
    }

    // Modifier ou retirer un bloc du registre : réservé à l'équipe.
    if (url.pathname === "/modifier") {
      if (associe) return new Response("Réservé à l'équipe", { status: 403 });
      return modifier(requete, env, url);
    }

    // Ajouter ou retirer un document d'un projet : réservé à l'équipe.
    if (url.pathname === "/documents") {
      if (associe) return new Response("Réservé à l'équipe", { status: 403 });
      return documents(requete, env);
    }

    // Télécharger un document : équipe et associé, comme le reste du registre.
    if (url.pathname === "/document") {
      return telechargerDocument(env, url);
    }

    if (url.pathname !== "/") return new Response("Introuvable", { status: 404 });

    const donnees = await lues(env, url.searchParams.has("rafraichir"));
    return html(pageTableau(analyser(donnees, new Date()), new Date(cache.quand), associe));
  },
};

/** Retrouve un bloc dans un fichier du registre, par son rang. */
function blocDe(contenu, fichier, index) {
  const blocs = fichier === "projets.md"
    ? lireProjets(contenu)
    : lireFaits([{ nom: fichier, contenu }]).slice().sort((a, b) => a.index - b.index);
  return blocs.find((b) => b.index === Number(index));
}

/** Le formulaire, puis l'enregistrement — un commit par modification. */
async function modifier(requete, env, url) {
  const rendre = (params, status = 200) => html(pageEdition(params), status);

  if (requete.method === "GET") {
    const fichier = url.searchParams.get("f") || "";
    const index = url.searchParams.get("i") || "0";
    try {
      const { contenu } = await lireFichierRegistre(env, fichier);
      const bloc = blocDe(contenu, fichier, index);
      if (!bloc) return new Response("Bloc introuvable", { status: 404 });
      return rendre({ fichier, index, bloc, quoi: fichier === "projets.md" ? "projet" : "fait" });
    } catch (e) {
      return new Response(String(e.message || e), { status: 502 });
    }
  }

  if (requete.method !== "POST") return new Response("Méthode refusée", { status: 405 });

  const form = await requete.formData();
  const fichier = String(form.get("f") || "");
  const index = String(form.get("i") || "0");
  const titre = String(form.get("titre") || "");
  const texte = String(form.get("texte") || "");
  const supprimer = form.get("action") === "supprimer";

  try {
    const { contenu, sha } = await lireFichierRegistre(env, fichier);
    const bloc = blocDe(contenu, fichier, index);
    if (!bloc) throw new Error("Ce bloc n'existe plus : recharge la page.");
    const nouveauContenu = remplacerBloc(
      contenu,
      { debut: bloc.debut, fin: bloc.fin, titreAttendu: titre },
      supprimer ? "" : texte,
    );
    const quoi = fichier === "projets.md" ? "projet" : "fait";
    await ecrireFichierRegistre(env, fichier, nouveauContenu, sha,
      `${supprimer ? "Retire" : "Corrige"} un ${quoi} du registre (depuis le tableau de bord)`);
    cache = null; // la page doit relire tout de suite
    return new Response(null, { status: 303, headers: { Location: "/" } });
  } catch (e) {
    const secours = { titre, brut: texte };
    return rendre({ fichier, index, bloc: secours, erreur: String(e.message || e), quoi: fichier === "projets.md" ? "projet" : "fait" }, 409);
  }
}

/** Retrouve un projet de `projets.md` par son rang, pour connaître son nom (donc son dossier de documents). */
async function projetDe(env, index) {
  const { contenu } = await lireFichierRegistre(env, "projets.md");
  const projet = lireProjets(contenu).find((p) => p.index === Number(index));
  if (!projet) throw new Error("Ce projet n'existe plus : recharge la page.");
  return projet;
}

/** Un nom de fichier sûr : pas de chemin, pas de caractères qui dérangent Git ou une URL. */
function nomFichierSur(nom) {
  const propre = String(nom || "fichier").split(/[/\\]/).pop()
    .normalize("NFC").replace(/[^\w.\- ()À-ÿ]/g, "_").trim();
  return (propre || "fichier").slice(0, 120);
}

const TYPES_MIME = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain",
};
const typeMime = (nom) => TYPES_MIME[(nom.split(".").pop() || "").toLowerCase()] || "application/octet-stream";

/** La page d'un projet : ses documents, plus le formulaire d'ajout tant qu'il en reste la place. */
async function documents(requete, env) {
  const url = new URL(requete.url);
  const rendre = (index, nom, liste, erreur, status = 200) =>
    html(pageDocuments({ index, nom, documents: liste, erreur }), status);

  if (requete.method === "GET") {
    const index = url.searchParams.get("i") || "0";
    try {
      const projet = await projetDe(env, index);
      const liste = await listerDocumentsProjet(env, slugProjet(projet.nom));
      return rendre(index, projet.nom, liste);
    } catch (e) {
      return new Response(String(e.message || e), { status: 502 });
    }
  }

  if (requete.method !== "POST") return new Response("Méthode refusée", { status: 405 });

  const form = await requete.formData();
  const index = String(form.get("i") || "0");
  let projet;
  try {
    projet = await projetDe(env, index);
  } catch (e) {
    return new Response(String(e.message || e), { status: 404 });
  }
  const slug = slugProjet(projet.nom);

  if (form.get("action") === "supprimer") {
    const chemin = String(form.get("chemin") || "");
    const sha = String(form.get("sha") || "");
    if (!chemin.startsWith(`${DOSSIER_DOCUMENTS}/${slug}/`) || chemin.includes("..")) return new Response("Chemin refusé", { status: 400 });
    try {
      await supprimerDocument(env, chemin, sha, `Retire un document (${projet.nom}, depuis le tableau de bord)`);
      cache = null;
      return new Response(null, { status: 303, headers: { Location: `/documents?i=${index}` } });
    } catch (e) {
      const liste = await listerDocumentsProjet(env, slug);
      return rendre(index, projet.nom, liste, String(e.message || e), 409);
    }
  }

  const liste = await listerDocumentsProjet(env, slug);
  const echec = async (msg, status = 400) => rendre(index, projet.nom, liste, msg, status);

  const fichier = form.get("fichier");
  if (!fichier || typeof fichier === "string" || !fichier.size) return echec("Choisis un fichier.");
  if (liste.length >= MAX_DOCUMENTS_PAR_PROJET) {
    return echec(`Déjà ${MAX_DOCUMENTS_PAR_PROJET} documents sur ce projet : retire-en un avant d'en ajouter un autre.`);
  }
  if (fichier.size > MAX_OCTETS_DOCUMENT) {
    return echec(`Fichier trop lourd (${Math.round(fichier.size / 1024 / 1024)} Mo) : ${MAX_OCTETS_DOCUMENT / 1024 / 1024} Mo au maximum.`);
  }

  const nom = nomFichierSur(fichier.name);
  const chemin = `${DOSSIER_DOCUMENTS}/${slug}/${nom}`;
  const existant = liste.find((d) => d.nom === nom);
  try {
    const octets = new Uint8Array(await fichier.arrayBuffer());
    await ecrireDocument(env, chemin, octetsVersBase64(octets), existant ? existant.sha : null,
      `${existant ? "Remplace" : "Ajoute"} un document (${projet.nom}, depuis le tableau de bord)`);
    cache = null;
    return new Response(null, { status: 303, headers: { Location: `/documents?i=${index}` } });
  } catch (e) {
    return echec(String(e.message || e), 409);
  }
}

/** Le téléchargement d'un document, en proxy authentifié (le dépôt n'est pas public). */
async function telechargerDocument(env, url) {
  const chemin = url.searchParams.get("p") || "";
  if (!chemin.startsWith(`${DOSSIER_DOCUMENTS}/`) || chemin.includes("..")) return new Response("Chemin refusé", { status: 400 });
  try {
    const octets = await lireDocumentBrut(env, chemin);
    if (!octets) return new Response("Introuvable", { status: 404 });
    const nom = chemin.split("/").pop();
    return new Response(octets, {
      status: 200,
      headers: {
        "Content-Type": typeMime(nom),
        "Content-Disposition": `attachment; filename="${nom.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=300",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    return new Response(String(e.message || e), { status: 502 });
  }
}

/** Les lectures sont gardées 3 minutes, pour les deux vues. */
async function lues(env, forcer) {
  if (forcer || !cache || Date.now() - cache.quand > DUREE_CACHE_MS) {
    cache = { quand: Date.now(), donnees: await lireTout(env) };
  }
  return cache.donnees;
}

function html(corps, status = 200) {
  return new Response(corps, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function empreinte(texte) {
  const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("kasbah-tdb:" + texte));
  return [...new Uint8Array(octets)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function lireCookie(requete, nom) {
  const brut = requete.headers.get("Cookie") || "";
  for (const morceau of brut.split(";")) {
    const [k, ...v] = morceau.trim().split("=");
    if (k === nom) return v.join("=");
  }
  return null;
}
