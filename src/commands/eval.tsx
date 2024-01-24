import type { SlashCommand } from "@lilybird/handlers";
import { ApplicationCommand } from "@lilybird/jsx";
import { file, inspect, write } from "bun";

const lastCodeBlock = file("lastCodeBlock.txt");

const evalCommnand: SlashCommand = {
    data: (
        <ApplicationCommand
            name="eval"
            description="evaluate some javascript code"
        />
    ),
    post: "GLOBAL",
    async run(interaction) {
        await interaction.deferReply();

        let result;
        const text = await lastCodeBlock.text();

        try {
            result = eval?.(text);
        } catch (error) {
            await interaction.editReply(String(error));
            return;
        }

        await interaction.editReply(inspect(result));
    }
};

export default evalCommnand;
