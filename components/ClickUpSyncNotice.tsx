export function ClickUpSyncNotice() {
  return (
    <div className="mx-auto mt-16 max-w-2xl rounded-[8px] border border-red-300 bg-red-50 px-4 py-3">
      <p className="text-xs font-semibold text-red-700">Límites del sync con ClickUp</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-red-700/90">
        <li>
          Los campos que se llenan automáticamente en ClickUp están fijos en el código
          (mapeo manual) — no se leen en vivo desde el Form nativo de ClickUp.
        </li>
        <li>
          El flag &quot;required&quot; de ClickUp no se usa como fuente de verdad; los campos
          obligatorios los define esta app.
        </li>
        <li>
          Si se agrega o cambia un campo en un Form de ClickUp, hay que avisar para
          actualizar el mapeo aquí manualmente.
        </li>
      </ul>
    </div>
  );
}
