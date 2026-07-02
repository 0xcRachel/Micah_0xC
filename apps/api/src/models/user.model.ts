export interface IUser {
  id?: number;
  discordId: string;
  username: string;
  deviceId?: string | null;
  verified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
