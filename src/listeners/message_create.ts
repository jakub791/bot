import { Event } from "@lilybird/handlers";
import { write } from "bun";

function parseCodeBlock(content: string): {
    code: string;
    language: string | null;
} {
    // Get the breakpoint between language and the content
    const terminator = content.indexOf("\n");
    // The length for a code block is 3 (the 3 sub ticks)
    const maybeLanguage = content.substring(3, terminator);
    // The contents of the code block is everything between the language and the code block termination
    const context = content.substring(terminator + 1, content.length - 4);

    return {
        code: context,
        language: maybeLanguage.length === 0 ? null : maybeLanguage
    };
}

const supportedLanguages = ["js", "javascript"];

const event: Event<"messageCreate"> = {
    event: "messageCreate",
    async run(message) {
        const content = message.content;
        if (typeof content === "undefined") return;

        const { language, code } = parseCodeBlock(content);

        if (language === null || !supportedLanguages.includes(language)) return;

        write("lastCodeBlock.txt", code);
    }
};

export default event;
