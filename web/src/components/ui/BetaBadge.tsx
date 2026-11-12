// Badge Beta. El diseno usa accent/amber para el texto, que sobre accent/amber-bg no llega a AA
// (2,8:1); se usa accent/on-amber, el token de texto de la misma familia (6,4:1 en Light).
export function BetaBadge() {
  return (
    <span className="inline-flex items-center rounded-pill bg-amber-bg px-2.5 py-[3px] text-12 font-bold text-on-amber">
      Beta
    </span>
  );
}
