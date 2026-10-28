export class AppError extends Error {
  /**
   * @param {number} status código HTTP
   * @param {string} message mensagem em PT-BR para a interface
   * @param {{ code?: string, fields?: Record<string,string> }} [extra]
   */
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = extra.code ?? defaultCode(status);
    this.fields = extra.fields;
  }
}

function defaultCode(status) {
  return (
    {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      415: 'UNSUPPORTED_MEDIA_TYPE',
      429: 'TOO_MANY_REQUESTS',
    }[status] ?? 'ERROR'
  );
}

export const notFound = (what = 'Registro') => new AppError(404, `${what} não encontrado`);
