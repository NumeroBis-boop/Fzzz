// @ts-check
/*
 * Classeur.js
 * Fichier Excel (.xlsx) écrit sans bibliothèque : les fichiers XML du format
 * Office Open XML dans un zip sans compression.
 **********************************************************************/

/**
 * @typedef {string|number|null|{v?: string|number|null, f?: string, s?: string}} CelluleClasseur
 *   texte, nombre, ou {v: valeur (en cache pour une formule), f: formule en anglais, s: style}
 * @typedef {{nom: string, lignes: CelluleClasseur[][], largeurs?: number[], figer?: {lignes: number, colonnes: number}, hauteurs?: Object<number, number>}} FeuilleClasseur
 */

const TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** @type {Object<string, number>} rang du style dans les <cellXfs> de STYLES_XLSX */
const STYLES_CELLULE = { gras: 1, duree: 2, note: 3, vertical: 4, diagonale: 5, saisie: 6 };

const ENTETE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_TABLEUR = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_LIENS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PAQUET = "http://schemas.openxmlformats.org/package/2006/relationships";

const STYLES_XLSX = `${ENTETE_XML}<styleSheet xmlns="${NS_TABLEUR}">
<numFmts count="1"><numFmt numFmtId="164" formatCode="[h]:mm:ss"/></numFmts>
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="11"/><color rgb="FF666666"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" textRotation="90"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** 1er janvier 1980 au format des zip : une date fixe, sans lire d'horloge. */
const DATE_ZIP = (1 << 5) | 1;

/** @type {Uint32Array|null} */
let TABLE_CRC32 = null;

class Classeur {
  /**
   * Fichier .xlsx des feuilles données. Les formules gardent leur valeur
   * calculée, pour les lecteurs qui ne recalculent pas à l'ouverture.
   *
   * @static
   * @method xlsx
   * @param {FeuilleClasseur[]} feuilles
   * @return {Uint8Array<ArrayBuffer>}
   */
  static xlsx(feuilles) {
    const rangs = feuilles.map((f, i) => i + 1),
      texte = new TextEncoder();
    const types =
      `${ENTETE_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      rangs
        .map(
          (r) =>
            `<Override PartName="/xl/worksheets/sheet${r}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("") +
      `</Types>`;
    const paquet =
      `${ENTETE_XML}<Relationships xmlns="${NS_PAQUET}">` +
      `<Relationship Id="rId1" Type="${NS_LIENS}/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`;
    // recalcul à l'ouverture : la vitesse d'attaque d'une case peut avoir changé le résultat
    const classeur =
      `${ENTETE_XML}<workbook xmlns="${NS_TABLEUR}" xmlns:r="${NS_LIENS}"><sheets>` +
      feuilles
        .map(
          (f, i) =>
            `<sheet name="${Classeur.echapper(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join("") +
      `</sheets><calcPr fullCalcOnLoad="1"/></workbook>`;
    const liens =
      `${ENTETE_XML}<Relationships xmlns="${NS_PAQUET}">` +
      rangs
        .map(
          (r) =>
            `<Relationship Id="rId${r}" Type="${NS_LIENS}/worksheet" Target="worksheets/sheet${r}.xml"/>`,
        )
        .join("") +
      `<Relationship Id="rId${feuilles.length + 1}" Type="${NS_LIENS}/styles" Target="styles.xml"/>` +
      `</Relationships>`;
    /** @type {[string, string][]} */
    const parties = [
      ["[Content_Types].xml", types],
      ["_rels/.rels", paquet],
      ["xl/workbook.xml", classeur],
      ["xl/_rels/workbook.xml.rels", liens],
      ["xl/styles.xml", STYLES_XLSX],
      ...feuilles.map((f, i) => /** @type {[string, string]} */ ([
        `xl/worksheets/sheet${i + 1}.xml`,
        Classeur._feuille(f),
      ])),
    ];
    return Classeur.zip(parties.map(([nom, xml]) => ({ nom, octets: texte.encode(xml) })));
  }
  /**
   * @private
   * @param {FeuilleClasseur} f
   * @return {string}
   */
  static _feuille(f) {
    const figer = f.figer || { lignes: 0, colonnes: 0 };
    let vue = "";
    if (figer.lignes || figer.colonnes) {
      const volet =
        figer.lignes && figer.colonnes ? "bottomRight" : figer.lignes ? "bottomLeft" : "topRight";
      vue =
        `<sheetViews><sheetView workbookViewId="0"><pane` +
        (figer.colonnes ? ` xSplit="${figer.colonnes}"` : "") +
        (figer.lignes ? ` ySplit="${figer.lignes}"` : "") +
        ` topLeftCell="${Classeur.colonne(figer.colonnes + 1)}${figer.lignes + 1}" activePane="${volet}" state="frozen"/>` +
        `</sheetView></sheetViews>`;
    }
    const largeurs = (f.largeurs || [])
      .map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`)
      .join("");
    const lignes = f.lignes
      .map((ligne, i) => {
        const hauteur = f.hauteurs && f.hauteurs[i + 1],
          cellules = ligne
            .map((c, j) => Classeur._cellule(`${Classeur.colonne(j + 1)}${i + 1}`, c))
            .join("");
        if (!cellules && !hauteur) return "";
        return `<row r="${i + 1}"${hauteur ? ` ht="${hauteur}" customHeight="1"` : ""}>${cellules}</row>`;
      })
      .join("");
    return (
      `${ENTETE_XML}<worksheet xmlns="${NS_TABLEUR}">${vue}` +
      (largeurs ? `<cols>${largeurs}</cols>` : "") +
      `<sheetData>${lignes}</sheetData></worksheet>`
    );
  }
  /**
   * @private
   * @param {string} ref
   * @param {CelluleClasseur} c
   * @return {string}
   */
  static _cellule(ref, c) {
    if (c == null || c === "") return "";
    const d = typeof c == "object" ? c : { v: c },
      style = d.s ? ` s="${STYLES_CELLULE[d.s]}"` : "",
      valeur = typeof d.v == "number" && Number.isFinite(d.v) ? `<v>${d.v}</v>` : "";
    if (d.f) return `<c r="${ref}"${style}><f>${Classeur.echapper(d.f)}</f>${valeur}</c>`;
    if (typeof d.v == "number") return valeur ? `<c r="${ref}"${style}>${valeur}</c>` : "";
    if (d.v == null || d.v === "") return "";
    return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${Classeur.echapper(d.v)}</t></is></c>`;
  }
  /**
   * Texte sûr dans un fichier XML : caractères spéciaux échappés, caractères
   * de contrôle (interdits en XML) retirés.
   *
   * @static
   * @method echapper
   * @param {string} texte
   * @return {string}
   */
  static echapper(texte) {
    return String(texte)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
  /**
   * Lettres de la colonne n (1 → A, 27 → AA).
   *
   * @static
   * @method colonne
   * @param {number} n
   * @return {string}
   */
  static colonne(n) {
    let lettres = "";
    for (; n > 0; n = Math.floor((n - 1) / 26))
      lettres = String.fromCharCode(65 + ((n - 1) % 26)) + lettres;
    return lettres;
  }
  /**
   * Zip sans compression (méthode « stored »).
   *
   * @static
   * @method zip
   * @param {{nom: string, octets: Uint8Array}[]} fichiers
   * @return {Uint8Array<ArrayBuffer>}
   */
  static zip(fichiers) {
    /** @type {Uint8Array[]} */
    const morceaux = [],
      central = [];
    let position = 0;
    for (const f of fichiers) {
      const nom = new TextEncoder().encode(f.nom),
        crc = Classeur.crc32(f.octets),
        taille = f.octets.length;
      // version 2.0, sans drapeau, sans compression, heure 0
      const commun = [
        [2, 20],
        [2, 0],
        [2, 0],
        [2, 0],
        [2, DATE_ZIP],
        [4, crc],
        [4, taille],
        [4, taille],
        [2, nom.length],
        [2, 0],
      ];
      morceaux.push(Classeur._champs([[4, 0x04034b50], ...commun]), nom, f.octets);
      central.push(
        Classeur._champs([
          [4, 0x02014b50],
          [2, 20],
          ...commun,
          [2, 0],
          [2, 0],
          [2, 0],
          [4, 0],
          [4, position],
        ]),
        nom,
      );
      position += 30 + nom.length + taille;
    }
    const tailleCentral = central.reduce((n, m) => n + m.length, 0),
      fin = Classeur._champs([
        [4, 0x06054b50],
        [2, 0],
        [2, 0],
        [2, fichiers.length],
        [2, fichiers.length],
        [4, tailleCentral],
        [4, position],
        [2, 0],
      ]),
      tout = [...morceaux, ...central, fin],
      octets = new Uint8Array(tout.reduce((n, m) => n + m.length, 0));
    let i = 0;
    for (const m of tout) {
      octets.set(m, i);
      i += m.length;
    }
    return octets;
  }
  /**
   * Champs [taille en octets, valeur] à la suite, petit-boutiste.
   *
   * @private
   * @param {number[][]} champs
   * @return {Uint8Array}
   */
  static _champs(champs) {
    const vue = new DataView(new ArrayBuffer(champs.reduce((n, [taille]) => n + taille, 0)));
    let i = 0;
    for (const [taille, valeur] of champs) {
      if (taille == 2) vue.setUint16(i, valeur, true);
      else vue.setUint32(i, valeur, true);
      i += taille;
    }
    return new Uint8Array(vue.buffer);
  }
  /**
   * CRC-32 des zip.
   *
   * @static
   * @method crc32
   * @param {Uint8Array} octets
   * @return {number}
   */
  static crc32(octets) {
    if (!TABLE_CRC32) {
      TABLE_CRC32 = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        TABLE_CRC32[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < octets.length; i++)
      crc = TABLE_CRC32[(crc ^ octets[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  /**
   * Fait enregistrer le fichier par le navigateur.
   *
   * @static
   * @method telecharger
   * @param {Uint8Array<ArrayBuffer>} octets
   * @param {string} nom
   */
  static telecharger(octets, nom) {
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([octets], { type: TYPE_XLSX }));
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    // libérée plus tard : Firefox lit l'adresse après le clic
    setTimeout(() => URL.revokeObjectURL(lien.href), 60000);
  }
}
