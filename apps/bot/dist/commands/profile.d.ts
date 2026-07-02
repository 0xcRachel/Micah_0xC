import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
export declare const profileCommand: {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
};
