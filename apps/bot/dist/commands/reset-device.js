import { SlashCommandBuilder } from 'discord.js';
import { ApiClient } from '../services/api-client.js';
export const resetDeviceCommand = {
    data: new SlashCommandBuilder().setName('reset-device').setDescription('Reset your linked device'),
    async execute(interaction) {
        const client = new ApiClient();
        const result = await client.post('/device/reset', {
            discordId: interaction.user.id,
            deviceId: '',
        });
        await interaction.reply({ content: `Reset request sent: ${JSON.stringify(result)}`, ephemeral: true });
    },
};
//# sourceMappingURL=reset-device.js.map