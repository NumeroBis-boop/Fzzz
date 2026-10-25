/**
 * Bonus de vitesse de chasse lu dans le formulaire de Ressources.php :
 * `calculTempsChasse(' 8','19095')` (bonus, TDC actuel). Le bonus est
 * supposé égal au niveau de Vitesse de chasse.
 */
export function lireBonusChasse(doc: ParentNode): { bonus: number; tdc: number } | null {
  const attr = doc.querySelector("#AcquerirTerrain")?.getAttribute("onkeyup") ?? "";
  const m = /calculTempsChasse\(\s*'\s*(\d+)\s*'\s*,\s*'(\d+)'\s*\)/.exec(attr);
  return m ? { bonus: Number(m[1]), tdc: Number(m[2]) } : null;
}
