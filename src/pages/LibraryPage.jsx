import { Link } from 'react-router';
import { FiPlus } from 'react-icons/fi';
import LibraryBrowser from '../components/LibraryBrowser.jsx';
import WithRail from '../components/ContextRail.jsx';
import { LibraryStatsWidget, NowPlayingWidget, RecentActivityWidget } from '../components/RailWidgets.jsx';

export default function LibraryPage() {
  return (
    <div className="page-enter">
      <WithRail
        label="Resumo da biblioteca"
        rail={
          <>
            <LibraryStatsWidget />
            <NowPlayingWidget />
            <RecentActivityWidget />
          </>
        }
      >
        <LibraryBrowser
          title={<h1 className="panel-heading">Biblioteca de jogos</h1>}
          actions={
            <Link to="/jogos/novo" className="btn btn-primary btn-sm ml-1 hidden h-9 sm:inline-flex">
              <FiPlus aria-hidden="true" /> Adicionar
            </Link>
          }
        />
      </WithRail>
    </div>
  );
}
