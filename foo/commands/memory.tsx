import type { SlashCommand } from "@lilybird/handlers";
import { ApplicationCommand } from "@lilybird/jsx";
import { memoryUsage } from "process";

const { rss } = memoryUsage;

const memory: SlashCommand = {
    data: (
        <ApplicationCommand
            name="memory"
            description="Show how much memory the bbt uses"
        />
    ),
    post: "GLOBAL",
    async run(interaction) {
        await interaction.reply(`${(rss() / 1048576).toFixed(2)} MB`);
    }
};

export default memory;
