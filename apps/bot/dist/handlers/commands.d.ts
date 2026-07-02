import { Client, Collection, type ChatInputCommandInteraction } from 'discord.js';
interface CommandHandler {
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
export declare function createClient(): {
    client: Client<boolean>;
    commands: Collection<string, CommandHandler>;
};
export declare function startBot(): Promise<void>;
export {};
