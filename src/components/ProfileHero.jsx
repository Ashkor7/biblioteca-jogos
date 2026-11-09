import { FiCalendar } from 'react-icons/fi';
import Avatar from './Avatar.jsx';
import XpBar from './XpBar.jsx';
import { formatDate } from '../utils/format.js';

/**
 * Cabeçalho do jogador: banner, foto, nome, @usuário, título e XP.
 * Usado no perfil privado, no perfil público e (compacto) na visão geral.
 */
export default function ProfileHero({ profile, progress, actions, compact = false, showUsername = true }) {
  return (
    <section aria-label={`Perfil de ${profile.displayName}`} className="panel panel-accent">
      <div className="panel-body overflow-hidden">
        <div className={`relative ${compact ? 'h-20 sm:h-24' : 'h-32 sm:h-44 lg:h-52'} bg-panel-3`}>
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div
              aria-hidden="true"
              className="h-full w-full"
              style={{
                backgroundImage:
                  'linear-gradient(120deg, #a88bff33, transparent 45%), linear-gradient(300deg, #39e1ea26, transparent 50%), repeating-linear-gradient(135deg, #ffffff07 0 2px, transparent 2px 14px)',
              }}
            />
          )}
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-panel to-transparent" />
        </div>
        <div className={`relative flex flex-col gap-4 px-4 pb-4 sm:flex-row sm:items-end sm:px-6 sm:pb-6 ${compact ? '-mt-8' : '-mt-12 sm:-mt-16'}`}>
          <Avatar src={profile.avatarUrl} name={profile.displayName} size={compact ? 'md' : 'lg'} />
          <div className="min-w-0 flex-1">
            {profile.title && <p className="hud-label text-amber">{profile.title.name}</p>}
            <h1 className={`${compact ? 'text-2xl' : 'text-[clamp(1.7rem,4vw,2.6rem)]'} mt-0.5 font-bold break-words`}>
              {profile.displayName}
            </h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {showUsername && <span className="num">@{profile.username}</span>}
              {profile.joinedAt && (
                <span className="inline-flex items-center gap-1.5">
                  <FiCalendar aria-hidden="true" /> Na biblioteca desde {formatDate(profile.joinedAt)}
                </span>
              )}
            </p>
            {!compact && profile.bio && <p className="mt-2 max-w-[65ch] whitespace-pre-line text-[0.95rem] text-ink/90">{profile.bio}</p>}
          </div>
          <div className="w-full sm:w-64 lg:w-72">
            {progress && <XpBar progress={progress} compact={compact} />}
            {actions && <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
