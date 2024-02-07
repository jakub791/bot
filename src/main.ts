import { createHandler } from "@lilybird/handlers";
import { env } from "bun";
import { Intents, createClient } from "lilybird";

const { dirname } = import.meta;

const listeners = await createHandler({
    dirs: {
        slashCommands: `${dirname}/commands`,
        listeners: `${dirname}/listeners`
    }
});

const token = env.TOKEN;
if (typeof token !== "string") throw new TypeError("token is not defined");

createClient({
    intents: [Intents.GUILDS, Intents.GUILD_MESSAGES, Intents.MESSAGE_CONTENT],
    token,
    ...listeners
});
