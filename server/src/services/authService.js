import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { PLACEHOLDER_RE } from '../config.js';

const BCRYPT_COST = 12;
// Hash usado quando o e-mail não existe, para o tempo de resposta não revelar contas.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('conta-inexistente', BCRYPT_COST));

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyCredentials(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) throw new AppError(401, 'E-mail ou senha incorretos', { code: 'INVALID_CREDENTIALS' });
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

/**
 * Cadastro público. A mensagem para e-mail repetido é a mesma do login para
 * não ajudar quem tenta descobrir contas (a rota tem limite por IP).
 */
export async function registerUser(email, password) {
  if (PLACEHOLDER_RE.test(password)) {
    throw new AppError(400, 'Confira os campos destacados', { fields: { password: 'Escolha uma senha sua' } });
  }
  const passwordHash = await hashPassword(password);
  try {
    return await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new AppError(409, 'Não foi possível criar a conta com esse e-mail. Se ele já é seu, entre pela tela de login.', {
        code: 'EMAIL_UNAVAILABLE',
      });
    }
    throw error;
  }
}

/** Cria o proprietário ou redefine a senha se o e-mail já existir. */
export async function upsertOwner(email, password) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido');
  if (!password || password.length < 10) throw new Error('A senha precisa ter pelo menos 10 caracteres');
  if (PLACEHOLDER_RE.test(password)) {
    throw new Error('Essa é a senha de exemplo do .env.example. Escolha uma senha sua.');
  }
  const passwordHash = await hashPassword(password);
  return prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), passwordHash },
    update: { passwordHash },
    select: { id: true, email: true, createdAt: true },
  });
}
