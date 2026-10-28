import { useState } from 'react';

/** Capa com proporção fixa 3:4, texto alternativo e fallback quando falta ou falha. */
export default function CoverImage({ src, title, platform, className = '', sizes }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  const initials = (title ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden bg-panel-3 ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt={`Capa de ${title}`}
          loading="lazy"
          decoding="async"
          sizes={sizes}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`${title} — sem capa`}
          className="flex h-full w-full flex-col justify-between p-3"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, #ffffff06 0 2px, transparent 2px 10px)',
          }}
        >
          <span className="num text-[0.7rem] text-faint">sem capa</span>
          <span className="font-display text-4xl font-bold text-line-strong" aria-hidden="true">
            {initials}
          </span>
          {platform && <span className="truncate text-xs text-faint">{platform}</span>}
        </div>
      )}
    </div>
  );
}
