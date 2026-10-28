// Plataformas, lojas e categorias são criadas sob demanda a partir do texto digitado.
import { cleanDisplayName, normalizeKey, slugify } from '../../../shared/domain.js';

async function uniquePlatformSlug(tx, name, excludeId = null) {
  const base = slugify(name) || 'plataforma';
  for (let i = 1; i < 1000; i += 1) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const taken = await tx.platform.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken || taken.id === excludeId) return candidate;
  }
  throw new Error('Não foi possível gerar um slug único');
}

export async function findOrCreatePlatform(tx, rawName) {
  const name = cleanDisplayName(rawName);
  const normalizedName = normalizeKey(name);
  const existing = await tx.platform.findUnique({ where: { normalizedName } });
  if (existing) return existing;
  const slug = await uniquePlatformSlug(tx, name);
  // Um slug antigo (de plataforma renomeada) cede lugar à nova plataforma.
  await tx.platformSlugAlias.deleteMany({ where: { slug } });
  return tx.platform.create({ data: { name, normalizedName, slug } });
}

export async function findOrCreateStore(tx, rawName) {
  const name = cleanDisplayName(rawName);
  const normalizedName = normalizeKey(name);
  return tx.store.upsert({
    where: { normalizedName },
    create: { name, normalizedName },
    update: {},
  });
}

export async function findOrCreateCategories(tx, names) {
  const result = [];
  for (const raw of names ?? []) {
    const name = cleanDisplayName(raw);
    const normalizedName = normalizeKey(name);
    if (!normalizedName) continue;
    result.push(
      await tx.category.upsert({
        where: { normalizedName },
        create: { name, normalizedName },
        update: {},
      }),
    );
  }
  return result;
}

/** Remove plataformas, lojas e categorias que ficaram sem nenhum jogo. */
export async function pruneOrphans(tx) {
  await tx.category.deleteMany({ where: { games: { none: {} } } });
  await tx.store.deleteMany({ where: { games: { none: {} } } });
  await tx.platform.deleteMany({ where: { games: { none: {} } } });
}

export { uniquePlatformSlug };
