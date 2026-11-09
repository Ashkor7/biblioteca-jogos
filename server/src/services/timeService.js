// "Hoje", semana e mês no fuso do app (APP_TIMEZONE), para colunas DATE.
import { config } from '../config.js';
import { todayIn } from '../../../shared/domain.js';

export const todayIso = (now = new Date()) => todayIn(config.APP_TIMEZONE, now);

/** "AAAA-MM-DD" → Date à meia-noite UTC (formato que o Prisma grava em colunas DATE). */
export const dateOnly = (iso) => new Date(`${iso}T00:00:00.000Z`);

export const todayDate = () => dateOnly(todayIso());
