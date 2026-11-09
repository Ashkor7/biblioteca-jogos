/** Tabela de apoio dos gráficos (primeira coluna é o cabeçalho da linha). */
export default function DataTable({ caption, columns, rows, footer }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[var(--table-min,28rem)] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-panel-2">
            {columns.map((c, i) => (
              <th key={c} scope="col" className={`px-3 py-2 font-display font-semibold text-muted ${i === 0 ? 'text-left' : 'text-right'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-line">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-3 py-2 text-left font-normal text-ink">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="num px-3 py-2 text-right">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-line-strong bg-panel-2">
              {footer.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${i === 0 ? 'text-left font-display font-semibold' : 'num text-right'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
