export declare class AppError extends Error {
    readonly code: number;
    readonly statusCode: number;
    constructor(code: number, statusCode: number, message: string);
}
