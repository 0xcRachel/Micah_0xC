import { SlashCommandBuilder } from 'discord.js';
export const helpCommand = {
    data: new SlashCommandBuilder().setName('help').setDescription('Show available commands'),
    async execute(interaction) {
        await interaction.reply({
            content: '/bind, /getkey, /profile, /reset-device, /help',
            ephemeral: true,
        });
    },
};
//# sourceMappingURL=help.js.map