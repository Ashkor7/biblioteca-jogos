import { useState } from 'react';
import { Link } from 'react-router';
import { FiUpload, FiDatabase } from 'react-icons/fi';
import { api } from '../services/api.js';
import { useLibraryMutation } from '../hooks/queries.js';
import { useToast } from '../hooks/useToast.js';
import PageHeader from '../components/PageHeader.jsx';

/** Lê (somente leitura, uma vez) o que a versão antiga deixou no navegador. */
function readOldBrowserData() {
  try {
    const raw = window.localStorage.getItem('jogos');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ImportPage() {
  const toast = useToast();
  const [found] = useState(readOldBrowserData);
  const [fileGames, setFileGames] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [report, setReport] = useState(null);

  const run = useLibraryMutation((games) => api.importLegacy(games), {
    onSuccess: (result) => {
      setReport(result);
      toast.success(`${result.imported} jogo(s) importado(s).`);
    },
    onError: (error) => toast.error(error.message),
  });

  async function onFile(event) {
    const file = event.target.files?.[0];
    setFileError(null);
    setFileGames(null);
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data?.games;
      if (!Array.isArray(list)) throw new Error('O arquivo não contém uma lista de jogos.');
      setFileGames(list);
    } catch (error) {
      setFileError(error instanceof SyntaxError ? 'Arquivo JSON inválido.' : error.message);
    }
  }

  return (
    <div className="page-enter max-w-3xl">
      <PageHeader title="Importar dados antigos">
        A primeira versão do app guardava os jogos só neste navegador. A importação copia esses registros para o banco de
        dados uma única vez; repetir não cria duplicatas.
      </PageHeader>

      <div className="space-y-5">
        <section className="panel">
          <div className="panel-body p-5">
            <h2 className="flex items-center gap-2 text-lg">
              <FiDatabase className="text-cyan" aria-hidden="true" /> Dados encontrados neste navegador
            </h2>
            {Array.isArray(found) && found.length > 0 ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  {found.length} jogo(s) da versão antiga. Capas em Base64 viram arquivos no servidor.
                </p>
                <button type="button" className="btn btn-primary mt-4" disabled={run.isPending} onClick={() => run.mutate(found)}>
                  {run.isPending ? 'Importando…' : `Importar ${found.length} jogo(s)`}
                </button>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">Nada da versão antiga foi encontrado neste navegador.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-body p-5">
            <h2 className="flex items-center gap-2 text-lg">
              <FiUpload className="text-cyan" aria-hidden="true" /> Arquivo JSON exportado
            </h2>
            <p className="mt-1 text-sm text-muted">
              No navegador antigo, abra o console (F12) e rode{' '}
              <code className="num text-ink">copy(localStorage.getItem(&apos;jogos&apos;))</code>, cole o conteúdo num arquivo
              <code className="num text-ink"> jogos.json</code> e envie aqui.
            </p>
            <label htmlFor="arquivo-json" className="field-label mt-4">
              Arquivo
            </label>
            <input id="arquivo-json" type="file" accept="application/json,.json" onChange={onFile} className="input" />
            {fileError && <p className="field-error">{fileError}</p>}
            {fileGames && (
              <button type="button" className="btn btn-primary mt-4" disabled={run.isPending} onClick={() => run.mutate(fileGames)}>
                {run.isPending ? 'Importando…' : `Importar ${fileGames.length} jogo(s) do arquivo`}
              </button>
            )}
          </div>
        </section>

        {report && (
          <section role="status" className="border border-cyan/50 bg-cyan-soft p-5">
            <h2 className="text-lg">Resultado</h2>
            <dl className="mt-2">
              <div className="readout"><dt>Recebidos</dt><dd className="num">{report.received}</dd></div>
              <div className="readout"><dt>Importados</dt><dd className="num text-ok">{report.imported}</dd></div>
              <div className="readout"><dt>Já existiam (ignorados)</dt><dd className="num">{report.skipped}</dd></div>
              <div className="readout"><dt>Com erro</dt><dd className="num text-danger">{report.failed.length}</dd></div>
            </dl>
            {[...report.failed, ...report.warnings].length > 0 && (
              <ul className="mt-3 text-sm text-muted">
                {[...report.failed, ...report.warnings].map((item, i) => (
                  <li key={i}>
                    {item.legacyId ? `#${item.legacyId}: ` : ''}
                    {item.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="mb-0 mt-3 text-sm">
              Jogos importados ficam marcados para revisão até você informar mídia, preço pago e loja.{' '}
              <Link to="/" className="text-cyan">
                Ver biblioteca
              </Link>
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
