import { SlashCommandBuilder } from 'discord.js';
import { ApiClient } from '../services/api-client.js';
export const bindCommand = {
    data: new SlashCommandBuilder()
        .setName('bind')
        .setDescription('Bind your Discord account to a device')
        .addStringOption((option) => option.setName('device_id').setDescription('Device identifier').setRequired(true)),
    async execute(interaction) {
        const deviceId = interaction.options.getString('device_id', true);
        const client = new ApiClient();
        const result = await client.post('/bind', {
            deviceId,
            discordId: interaction.user.id,
        });
        await interaction.reply({ content: `Binding request sent: ${JSON.stringify(result)}`, ephemeral: true });
    },
};
//# sourceMappingURL=bind.js.map