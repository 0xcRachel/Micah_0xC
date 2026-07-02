export interface ISession {
  id?: number;
  discordId: string;
  deviceId: string;
  licenseId: string;
  jwt: string;
  createdAt?: Date;
  updatedAt?: Date;
}
