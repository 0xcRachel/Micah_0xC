export declare class ApiClient {
    private readonly baseUrl;
    constructor(baseUrl?: string);
    post<T>(path: string, body: unknown): Promise<T>;
    get<T>(path: string): Promise<T>;
}
