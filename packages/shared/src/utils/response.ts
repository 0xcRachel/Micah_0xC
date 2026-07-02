import { HTTP_CODES } from '../constants/http.js';

export function createSuccessResponse<T>(data: T, message = 'Success') {
  return {
    success: true,
    code: HTTP_CODES.SUCCESS,
    message,
    data,
  };
}

export function createErrorResponse(code: number, message: string, data: unknown = {}) {
  return {
    success: false,
    code,
    message,
    data,
  };
}
