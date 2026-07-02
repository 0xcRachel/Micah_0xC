import { SlashCommandBuilder } from 'discord.js';
export const profileCommand = {
    data: new SlashCommandBuilder().setName('profile').setDescription('Show your Discord profile info'),
    async execute(interaction) {
        await interaction.reply({
            content: `Discord ID: ${interaction.user.id}\nUsername: ${interaction.user.username}`,
            ephemeral: true,
        });
    },
};
//# sourceMappingURL=profile.js.map