import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
export declare const resetDeviceCommand: {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
};
