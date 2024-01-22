import { createHandler } from "@lilybird/handlers";
import { env } from "bun";
import { Intents, createClient } from "lilybird";

const listeners = await createHandler({
    dirs: {
        slashCommands: `${import.meta.dirname}/commands`,
        listeners: `${import.meta.dirname}/listeners`
    }
});

const token = env.TOKEN;
if (typeof token !== "string") throw new TypeError("token is not defined");

createClient({
    intents: [Intents.GUILDS, Intents.GUILD_MESSAGES, Intents.MESSAGE_CONTENT],
    token,
    ...listeners
});
