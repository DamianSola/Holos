export function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="date-range">
      <label>Desde
        <input type="date" value={from} onChange={(event) => onChange(event.target.value, to)} />
      </label>
      <label>Hasta
        <input type="date" value={to} onChange={(event) => onChange(from, event.target.value)} />
      </label>
      {(from || to) && <button className="secondary-button" type="button" onClick={() => onChange("", "")}>Limpiar</button>}
    </div>
  );
}

export function datedListPath(path: string, from: string, to: string) {
  if (!from || !to) return path;
  const params = new URLSearchParams({ from, to });
  return `${path}?${params.toString()}`;
}
