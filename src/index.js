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
import { lireTout, lireFichierRegistre, ecrireFichierRegistre } from "./sources.js";
import { analyser } from "./analyse.js";
import { pageTableau, pageEdition, pageConnexion } from "./page.js";
import { lireProjets, lireFaits, remplacerBloc } from "./registre.js";

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
