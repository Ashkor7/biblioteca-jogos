import multer from 'multer';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

// Arquivos ficam em memória só até a validação dos bytes; depois vão para o disco
// com nome gerado pelo servidor (lib/storage.js).
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadBytes,
    files: config.MAX_IMAGES_PER_GAME,
    fields: 20,
    fieldSize: 1024 * 1024,
  },
  fileFilter(_req, file, cb) {
    if (!/^image\//.test(file.mimetype)) {
      cb(new AppError(415, `"${file.originalname}" não é uma imagem. Envie JPG, PNG, WebP, GIF ou AVIF.`));
      return;
    }
    cb(null, true);
  },
});
