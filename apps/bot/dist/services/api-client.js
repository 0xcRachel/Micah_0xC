import { env } from '../config/env.js';
export class ApiClient {
    baseUrl;
    constructor(baseUrl = env.API_URL) {
        this.baseUrl = baseUrl;
    }
    async post(path, body) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        return response.json();
    }
    async get(path) {
        const response = await fetch(`${this.baseUrl}${path}`);
        return response.json();
    }
}
//# sourceMappingURL=api-client.js.map