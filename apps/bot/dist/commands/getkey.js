import { SlashCommandBuilder } from 'discord.js';
import { ApiClient } from '../services/api-client.js';
export const getkeyCommand = {
    data: new SlashCommandBuilder()
        .setName('getkey')
        .setDescription('Create a license for your bound device')
        .addStringOption((option) => option.setName('device_id').setDescription('Device identifier').setRequired(true)),
    async execute(interaction) {
        const deviceId = interaction.options.getString('device_id', true);
        const client = new ApiClient();
        const result = await client.post('/license/create', {
            discordId: interaction.user.id,
            deviceId,
        });
        await interaction.reply({ content: `License request sent: ${JSON.stringify(result)}`, ephemeral: true });
    },
};
//# sourceMappingURL=getkey.js.map