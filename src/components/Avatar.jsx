import { useState } from 'react';

const SIZES = { sm: 'h-10 w-10 text-sm', md: 'h-16 w-16 text-xl', lg: 'h-24 w-24 text-3xl sm:h-32 sm:w-32 sm:text-4xl' };

/** Foto do jogador numa moldura chanfrada; sem foto, mostra as iniciais. */
export default function Avatar({ src, name, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className={`avatar-frame shrink-0 ${SIZES[size]} ${className}`}>
      {src && !failed ? (
        <img src={src} alt={`Foto de ${name}`} className="h-full w-full bg-panel-3 object-cover" onError={() => setFailed(true)} />
      ) : (
        <div role="img" aria-label={`${name} — sem foto`} className="flex h-full w-full items-center justify-center bg-panel-3 font-display font-bold text-muted">
          {initials || '?'}
        </div>
      )}
    </div>
  );
}
