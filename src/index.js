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
import { lireTout } from "./sources.js";
import { analyser } from "./analyse.js";
import { pageTableau, pageInvestisseur, pageTechnique, pageConnexion } from "./page.js";

const COOKIE = "kasbah_tdb";
const COOKIE_INV = "kasbah_inv";
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

    // Vue de l'associé : son propre lien, son propre mot de passe, en
    // lecture seule. Elle ne montre ni branche ni migration.
    if (url.pathname.startsWith("/investisseur")) {
      if (!env.MOT_DE_PASSE_INVESTISSEUR) {
        return html(pageConnexion({ titre: "Kasbah — pilotage", erreur: "Cette page n'a pas encore de mot de passe : ajoute le secret MOT_DE_PASSE_INVESTISSEUR dans Cloudflare.", bloque: true }), 503);
      }
      const jetonInv = await empreinte(env.MOT_DE_PASSE_INVESTISSEUR);
      if (url.pathname === "/investisseur/connexion" && requete.method === "POST") {
        const form = await requete.formData();
        if ((await empreinte(String(form.get("mot_de_passe") || ""))) !== jetonInv) {
          return html(pageConnexion({ titre: "Kasbah — pilotage", action: "/investisseur/connexion", erreur: "Mot de passe incorrect." }), 401);
        }
        return new Response(null, {
          status: 303,
          headers: {
            Location: "/investisseur",
            "Set-Cookie": `${COOKIE_INV}=${jetonInv}; Path=/investisseur; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}`,
          },
        });
      }
      if (lireCookie(requete, COOKIE_INV) !== jetonInv) {
        return html(pageConnexion({ titre: "Kasbah — pilotage", action: "/investisseur/connexion" }), 401);
      }
      const donnees = await lues(env, url.searchParams.has("rafraichir"));
      return html(pageInvestisseur(analyser(donnees, new Date()), new Date(cache.quand)));
    }

    // La vue technique : ouverte à l'équipe comme à l'associé, qui lit
    // l'informatique et peut relever ce qui cloche.
    if (url.pathname === "/technique") {
      const jetons = await Promise.all([
        env.MOT_DE_PASSE ? empreinte(env.MOT_DE_PASSE) : null,
        env.MOT_DE_PASSE_INVESTISSEUR ? empreinte(env.MOT_DE_PASSE_INVESTISSEUR) : null,
      ]);
      const equipe = jetons[0] && lireCookie(requete, COOKIE) === jetons[0];
      const associe = jetons[1] && lireCookie(requete, COOKIE_INV) === jetons[1];
      if (!equipe && !associe) {
        return html(pageConnexion({ titre: "Kasbah — comment c'est construit", action: "/investisseur/connexion" }), 401);
      }
      const donnees = await lues(env, url.searchParams.has("rafraichir"));
      return html(pageTechnique(analyser(donnees, new Date()), new Date(cache.quand), associe && !equipe));
    }

    if (!env.MOT_DE_PASSE) {
      return html(pageConnexion({ erreur: "La page n'a pas encore de mot de passe : ajoute le secret MOT_DE_PASSE dans Cloudflare.", bloque: true }), 503);
    }
    const jeton = await empreinte(env.MOT_DE_PASSE);

    if (url.pathname === "/connexion" && requete.method === "POST") {
      const form = await requete.formData();
      if ((await empreinte(String(form.get("mot_de_passe") || ""))) !== jeton) {
        return html(pageConnexion({ erreur: "Mot de passe incorrect." }), 401);
      }
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${jeton}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}`,
        },
      });
    }

    if (url.pathname === "/deconnexion") {
      return new Response(null, {
        status: 303,
        headers: [
          ["Location", "/"],
          ["Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0`],
          ["Set-Cookie", `${COOKIE_INV}=; Path=/investisseur; Max-Age=0`],
        ],
      });
    }

    if (lireCookie(requete, COOKIE) !== jeton) {
      return html(pageConnexion({}), 401);
    }

    if (url.pathname !== "/") return new Response("Introuvable", { status: 404 });

    const donnees = await lues(env, url.searchParams.has("rafraichir"));
    return html(pageTableau(analyser(donnees, new Date()), new Date(cache.quand)));
  },
};

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
