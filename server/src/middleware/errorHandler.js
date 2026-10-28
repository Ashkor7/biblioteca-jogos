import multer from 'multer';
import { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `Imagem maior que ${config.MAX_UPLOAD_MB} MB`,
      LIMIT_FILE_COUNT: `Envie no máximo ${config.MAX_IMAGES_PER_GAME} imagens por vez`,
      LIMIT_UNEXPECTED_FILE: 'Campo de arquivo inesperado',
    };
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return new AppError(status, messages[err.code] ?? 'Falha no envio do arquivo');
  }
  if (err?.type === 'entity.too.large') return new AppError(413, 'Requisição grande demais');
  if (err?.type === 'entity.parse.failed') return new AppError(400, 'JSON inválido no corpo da requisição');
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return new AppError(404, 'Registro não encontrado');
    if (err.code === 'P2002') return new AppError(409, 'Já existe um registro com esses dados');
    if (err.code === 'P2003') return new AppError(409, 'Registro em uso por outros dados');
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return new AppError(503, 'Banco de dados indisponível. Verifique se o PostgreSQL está em execução.', {
      code: 'DATABASE_UNAVAILABLE',
    });
  }
  return null;
}

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, `Rota ${req.method} ${req.path} não existe`));
}

export function errorHandler(err, req, res, _next) {
  const appError = toAppError(err);
  if (!appError) {
    console.error(`[erro] ${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erro inesperado no servidor. Tente novamente.' },
    });
  }
  if (appError.status >= 500) console.error(`[erro] ${req.method} ${req.originalUrl}`, err);
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.fields ? { fields: appError.fields } : {}),
    },
  });
}
