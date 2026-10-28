import { describe, it, expect } from 'vitest';
import { emptyGameForm, formToPayload, makeGameResolver, gameToForm } from './gameForm.js';

const resolve = (values, opts) => makeGameResolver(opts)({ ...emptyGameForm, ...values });

describe('formulário de jogo (contrato compartilhado com a API)', () => {
  it('exige preço original, pago e loja para jogo adquirido', async () => {
    const { errors } = await resolve({ title: 'Halo', platform: 'Xbox', condition: 'DIGITAL' });
    expect(Object.keys(errors).sort()).toEqual(['originalPrice', 'paidPrice', 'store']);
  });

  it('lista de desejos não exige preço pago nem loja', async () => {
    const { errors } = await resolve({ title: 'Halo', platform: 'Xbox', condition: 'WISHLIST' });
    expect(errors).toEqual({});
  });

  it('exige escolher a condição e valida horas e preços', async () => {
    const { errors } = await resolve({ title: 'Halo', platform: 'Xbox', hours: 'muitas', paidPrice: '-5' });
    expect(errors.condition).toBeDefined();
    expect(errors.hours.message).toMatch(/12,5/);
  });

  it('converte para o payload da API', () => {
    const payload = formToPayload({
      ...emptyGameForm,
      title: 'Cyberpunk 2077',
      condition: 'DIGITAL',
      platform: 'Steam',
      store: 'Nuuvem',
      originalPrice: '199,90',
      paidPrice: '79,90',
      hours: '12,5',
      categories: ['RPG'],
    });
    expect(payload).toMatchObject({
      ownershipStatus: 'OWNED',
      mediaType: 'DIGITAL',
      playTimeMinutes: 750,
      currentWishPrice: null,
      coverUrl: null,
    });
  });

  it('desejo descarta loja/preço pago mesmo se preenchidos', () => {
    const payload = formToPayload({ ...emptyGameForm, condition: 'WISHLIST', store: 'X', paidPrice: '10' });
    expect(payload).toMatchObject({ ownershipStatus: 'WISHLIST', mediaType: null, store: null, paidPrice: null });
  });

  it('carrega um jogo da API no formulário', () => {
    const form = gameToForm({
      title: 'A',
      ownershipStatus: 'OWNED',
      mediaType: 'PHYSICAL',
      platform: { name: 'Wii' },
      store: { name: 'Loja' },
      originalPrice: '100.00',
      paidPrice: '80.50',
      currentWishPrice: null,
      purchasedAt: '2026-01-02T00:00:00.000Z',
      playStatus: 'COMPLETED',
      playTimeMinutes: 90,
      ratingStars: 4,
      reviewText: null,
      categories: [{ name: 'Party' }],
    });
    expect(form).toMatchObject({ condition: 'PHYSICAL', paidPrice: '80,50', hours: '1,5', purchasedAt: '2026-01-02' });
  });
});
