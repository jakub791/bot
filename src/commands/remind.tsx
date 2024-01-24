import type { SlashCommand } from "@lilybird/handlers";
import { ApplicationCommand } from "@lilybird/jsx";

const ping: SlashCommand = {
    data: (
        <ApplicationCommand
            name="ping"
            description="pong"
        />
    ),
    post: "GLOBAL",
    async run(interaction) {
        interaction;
        await interaction.deferReply();

        const { ws, rest } = await interaction.client.ping();

        await interaction.editReply(
            `🏓 WebSocket: \`${ws}ms\` | Rest: \`${rest}ms\``
        );
    }
};

export default ping;
