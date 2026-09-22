/**
 * Un rendu Markdown minuscule, pour les pages du registre écrites à la main
 * (`pilotage/technique.md`). Volontairement limité à ce qu'on écrit
 * vraiment : titres, paragraphes, listes (numérotées ou non), tableaux,
 * `code`, **gras**, *italique*. Tout est échappé avant d'être rendu : rien
 * de ce qui vient d'un fichier n'arrive en HTML.
 */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enLigne = (s) => esc(s)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
  .replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>");

const cellules = (ligne) => ligne.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const estSeparateur = (ligne) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(ligne) && ligne.includes("-");

export function rendreMarkdown(md) {
  const lignes = (md || "").split(/\r?\n/);
  const html = [];
  let liste = null;   // "ul" | "ol"
  let para = [];

  const finirPara = () => {
    if (para.length) { html.push(`<p>${enLigne(para.join(" "))}</p>`); para = []; }
  };
  const finirListe = () => {
    if (liste) { html.push(`</${liste}>`); liste = null; }
  };

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];

    if (!ligne.trim()) { finirPara(); finirListe(); continue; }

    const titre = ligne.match(/^(#{1,4})\s+(.*)$/);
    if (titre) {
      finirPara(); finirListe();
      const n = Math.min(titre[1].length + 1, 4); // # devient h2 : le h1 est celui de la page
      html.push(`<h${n}>${enLigne(titre[2])}</h${n}>`);
      continue;
    }

    // Tableau : une ligne de cellules suivie d'un séparateur
    if (ligne.trim().startsWith("|") && estSeparateur(lignes[i + 1] || "")) {
      finirPara(); finirListe();
      const entetes = cellules(ligne);
      const corps = [];
      i += 2;
      while (i < lignes.length && lignes[i].trim().startsWith("|")) corps.push(cellules(lignes[i++]));
      i--;
      html.push(`<div class="tbl-scroll"><table><thead><tr>${entetes.map((c) => `<th>${enLigne(c)}</th>`).join("")}</tr></thead>`
        + `<tbody>${corps.map((r) => `<tr>${r.map((c) => `<td>${enLigne(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    const puce = ligne.match(/^\s*[-*]\s+(.*)$/);
    const numero = ligne.match(/^\s*\d+\.\s+(.*)$/);
    if (puce || numero) {
      finirPara();
      const type = puce ? "ul" : "ol";
      if (liste !== type) { finirListe(); html.push(`<${type}>`); liste = type; }
      html.push(`<li>${enLigne((puce || numero)[1])}</li>`);
      continue;
    }

    if (liste && /^\s{2,}\S/.test(ligne)) { // suite d'un point de liste
      const dernier = html.pop();
      html.push(dernier.replace(/<\/li>$/, ` ${enLigne(ligne.trim())}</li>`));
      continue;
    }

    finirListe();
    para.push(ligne.trim());
  }
  finirPara(); finirListe();
  return html.join("\n");
}
