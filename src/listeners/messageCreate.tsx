import { Event } from "@lilybird/handlers";
import { ActionRow, Button } from "@lilybird/jsx";
import { ButtonStyle } from "lilybird";
import { extname, basename } from "path";

const githubLineUrlRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:github)\.com\/(?<repository>[a-zA-Z0-9-_]+\/[A-Za-z0-9_.-]+)\/blob\/(?<path>.+?)#L(?<firstLineNumber>\d+)[-~]?L?(?<secondLineNumber>\d*)/i;

function safeSlice<T extends string | unknown[]>(input: T, length: number): T {
    return (input.length > length ? input.slice(0, length) : input) as T;
}

const messageCreate: Event<"messageCreate"> = {
    event: "messageCreate",
    async run(message) {
        if (message.content === undefined || message.content === "") return;

        const match = githubLineUrlRegex.exec(message.content);
        const groups = match?.groups;
        if (groups === undefined) return;

        const { repository, path } = groups;
        let extension = extname(path).slice(1);
        const firstLineNumber = Number.parseInt(groups.firstLineNumber) - 1;
        const secondLineNumber = Number.parseInt(groups.secondLineNumber);

        const contentUrl = `https://raw.githubusercontent.com/${repository}/${path}`;
        const response = await fetch(contentUrl);
        const content = await response.text();
        const lines = content.split("\n");

        if (
            secondLineNumber - firstLineNumber > 25 &&
            lines.length > secondLineNumber
        ) {
            message.react("❌");
            return;
        }

        let text = "";

        for (let i = 0; i < lines.length; i++) {
            if (i < firstLineNumber || i >= secondLineNumber) continue;

            const line = lines[i];
            text += `${line}\n`;
        }

        text = text.slice(0, -1);

        if (extension === "zig") extension = "rs";

        await message.reply({
            content: `***${basename(path)}*** — *(L${firstLineNumber + 1}${
                secondLineNumber ? `-L${secondLineNumber}` : ""
            })*\n\`\`\`${extension}\n${safeSlice(
                text,
                2000 - 6 - extension.length
            )}\n\`\`\``,
            components: [
                <ActionRow>
                    <Button
                        style={ButtonStyle.Link}
                        url={`https://github.com/${repository}/blob/${path}#L${
                            firstLineNumber + 1
                        }${secondLineNumber ? `-L${secondLineNumber}` : ""}`}
                        label={repository}
                    />
                </ActionRow>
            ]
        });
    }
};

export default messageCreate;
