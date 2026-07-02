export declare function createSuccessResponse<T>(data: T, message?: string): {
    success: boolean;
    code: 1000;
    message: string;
    data: T;
};
export declare function createErrorResponse(code: number, message: string, data?: unknown): {
    success: boolean;
    code: number;
    message: string;
    data: unknown;
};
