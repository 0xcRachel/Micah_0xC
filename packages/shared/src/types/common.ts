export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  mongodbUri: string;
  jwtSecret: string;
  jwtExpire: string;
  clientUrl: string;
  apiPrefix: string;
  logLevel: string;
}

export interface JwtPayload {
  discordId: string;
  deviceId: string;
  licenseId: string;
  iat?: number;
  exp?: number;
}

export interface ApiContext {
  requestId: string;
}
