import { env } from '../config/env.js';

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl = env.API_URL) {
    this.baseUrl = baseUrl;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return response.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    return response.json() as Promise<T>;
  }
}
