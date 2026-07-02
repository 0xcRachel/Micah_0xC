import { HTTP_CODES } from '../constants/http.js';
export function createSuccessResponse(data, message = 'Success') {
    return {
        success: true,
        code: HTTP_CODES.SUCCESS,
        message,
        data,
    };
}
export function createErrorResponse(code, message, data = {}) {
    return {
        success: false,
        code,
        message,
        data,
    };
}
