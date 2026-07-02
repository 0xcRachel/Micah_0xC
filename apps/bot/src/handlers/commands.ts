import { Client, Collection, Events, GatewayIntentBits, type ChatInputCommandInteraction } from 'discord.js';
import { env } from '../config/env.js';
import { bindCommand } from '../commands/bind.js';
import { getkeyCommand } from '../commands/getkey.js';
import { profileCommand } from '../commands/profile.js';
import { resetDeviceCommand } from '../commands/reset-device.js';
import { helpCommand } from '../commands/help.js';

interface CommandHandler {
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export function createClient() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const commands = new Collection<string, CommandHandler>();

  commands.set(bindCommand.data.name, bindCommand);
  commands.set(getkeyCommand.data.name, getkeyCommand);
  commands.set(profileCommand.data.name, profileCommand);
  commands.set(resetDeviceCommand.data.name, resetDeviceCommand);
  commands.set(helpCommand.data.name, helpCommand);

  client.once(Events.ClientReady, () => {
    console.log('Discord bot ready');
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commands.get(interaction.commandName);
    if (!command) {
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
      }
    }
  });

  return { client, commands };
}

export async function startBot() {
  const { client } = createClient();
  await client.login(env.DISCORD_TOKEN);
}
