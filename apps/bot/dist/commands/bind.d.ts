import { ChatInputCommandInteraction } from 'discord.js';
export declare const bindCommand: {
    data: import("discord.js").SlashCommandOptionsOnlyBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
};
