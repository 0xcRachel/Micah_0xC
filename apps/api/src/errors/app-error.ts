export class AppError extends Error {
  constructor(
    public readonly code: number,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
