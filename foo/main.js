// @bun
// node_modules/@lilybird/handlers/dist/handler.js
import {join} from "path";
async function createHandler({ dirs, prefix }) {
  const handler = new Handler(dirs, prefix);
  return {
    listeners: await handler.buildListeners(),
    setup: async (client) => {
      await handler.registerGlobalCommands(client);
      await handler.registerGuildCommands(client);
    }
  };
}

class Handler {
  guildSlashCommands = new Map;
  globalSlashCommands = new Map;
  messageCommands = new Map;
  events = new Map;
  messageCommandAliases = new Map;
  dirs;
  prefix;
  #globMatcher = new Bun.Glob("**/*.{ts,tsx,js,jsx}");
  constructor(dirs, prefix) {
    this.dirs = dirs;
    this.prefix = prefix ?? "!";
  }
  async registerGlobalCommands(client) {
    await client.rest.bulkOverwriteGlobalApplicationCommand(client.user.id, [...this.globalSlashCommands.values()].map((e) => e.data));
  }
  async registerGuildCommands(client) {
    for await (const command of this.guildSlashCommands.values()) {
      if (Array.isArray(command.post)) {
        const temp = [];
        for (let i = 0;i < command.post.length; i++)
          temp.push(client.rest.createGuildApplicationCommand(client.user.id, command.post[i], command.data));
        await Promise.all(temp);
      } else
        await client.rest.createGuildApplicationCommand(client.user.id, command.post, command.data);
    }
  }
  async readSlashCommandDir(dir = this.dirs.slashCommands) {
    if (typeof dir === "undefined")
      return false;
    const files = this.#globMatcher.scan(dir);
    for await (const fileName of files) {
      if (fileName.endsWith(".d.ts"))
        continue;
      const command = (await import(join(dir, fileName))).default;
      if (typeof command === "undefined")
        continue;
      if (fileName.startsWith("/guild") || command.post !== "GLOBAL")
        this.guildSlashCommands.set(command.data.name, command);
      else
        this.globalSlashCommands.set(command.data.name, command);
    }
    return true;
  }
  async readEventDir(dir = this.dirs.listeners) {
    if (typeof dir === "undefined")
      return false;
    const files = this.#globMatcher.scan(dir);
    for await (const fileName of files) {
      if (fileName.endsWith(".d.ts"))
        continue;
      const event = (await import(join(dir, fileName))).default;
      if (typeof event === "undefined")
        continue;
      this.events.set(event.event, event);
    }
    return true;
  }
  async readMessageCommandDir(dir = this.dirs.messageCommands) {
    if (typeof dir === "undefined")
      return false;
    const files = this.#globMatcher.scan(dir);
    for await (const fileName of files) {
      if (fileName.endsWith(".d.ts"))
        continue;
      const command = (await import(join(dir, fileName))).default;
      if (typeof command === "undefined")
        continue;
      if (typeof command.alias !== "undefined" && command.alias.length > 0) {
        if (command.alias.length === 1)
          this.messageCommandAliases.set(command.alias[0], command.name);
        else
          for (let i = 0, { length } = command.alias;i < length; i++)
            this.messageCommandAliases.set(command.alias[i], command.name);
      }
      this.messageCommands.set(command.name, command);
    }
    return true;
  }
  async onInteraction(interaction) {
    if (interaction.isApplicationCommandInteraction()) {
      await this.globalSlashCommands.get(interaction.data.name)?.run(interaction);
      if (interaction.inGuild())
        await this.guildSlashCommands.get(interaction.data.name)?.run(interaction);
    } else if (interaction.isAutocompleteInteraction()) {
      await this.globalSlashCommands.get(interaction.data.name)?.autocomplete?.(interaction);
      if (interaction.inGuild())
        await this.guildSlashCommands.get(interaction.data.name)?.autocomplete?.(interaction);
    }
  }
  async onMessage(message) {
    if (message.author.bot || (await message.fetchChannel()).isDM())
      return;
    if (message.content?.startsWith(this.prefix)) {
      const args = message.content.slice(this.prefix.length).trim().split(/\s+/g);
      if (args.length === 0)
        return;
      const alias = args.shift().toLowerCase();
      let command = this.messageCommands.get(alias);
      let name = alias;
      if (typeof command === "undefined") {
        name = this.messageCommandAliases.get(alias);
        if (typeof name !== "string")
          return;
        command = this.messageCommands.get(name);
        if (typeof command === "undefined")
          return;
      }
      if (command.enabled ?? true)
        await command.run(message, args, { name, alias });
    }
  }
  async buildListeners() {
    const slashCommandsExist = await this.readSlashCommandDir();
    const messageCommandsExist = await this.readMessageCommandDir();
    const eventsExist = await this.readEventDir();
    let interactionCreateFn = undefined;
    let messageCreateFn = undefined;
    const listeners = {};
    if (eventsExist) {
      for (const [name, event] of this.events) {
        if (name === "interactionCreate") {
          interactionCreateFn = event.run;
          continue;
        }
        if (name === "messageCreate") {
          messageCreateFn = event.run;
          continue;
        }
        listeners[name] = event.run;
      }
    }
    if (!slashCommandsExist)
      listeners.interactionCreate = interactionCreateFn;
    else if (typeof interactionCreateFn !== "undefined") {
      listeners.interactionCreate = async (interaction) => {
        await interactionCreateFn(interaction);
        await this.onInteraction(interaction);
      };
    } else {
      listeners.interactionCreate = async (interaction) => {
        await this.onInteraction(interaction);
      };
    }
    if (!messageCommandsExist)
      listeners.messageCreate = messageCreateFn;
    else if (typeof messageCreateFn !== "undefined") {
      listeners.messageCreate = async (message) => {
        await messageCreateFn(message);
        await this.onMessage(message);
      };
    } else {
      listeners.messageCreate = async (message) => {
        await this.onMessage(message);
      };
    }
    return listeners;
  }
}
// src/main.ts
var {env } = globalThis.Bun;

// node_modules/lilybird/dist/http/cdn.js
var getFormat = function(hash, format, allowsGIF = true) {
  if (!allowsGIF && format === ".gif")
    throw new Error("Invalid image format");
  if (typeof format !== "undefined")
    return format;
  if (hash.startsWith("a_"))
    return ".gif";
  return ".jpg";
};
var getSize = function(size) {
  if (typeof size === "undefined")
    return "";
  return `?size=${size}`;
};
function defaultUserAvatarURL(index, options) {
  return `${CDNURL}embed/avatars/${index}${".png"}${getSize(options?.size)}`;
}
function userAvatarURL(userId, userAvatar, options) {
  return `${CDNURL}avatars/${userId}/${userAvatar}${getFormat(userAvatar, options?.format)}${getSize(options?.size)}`;
}
function guildMemberAvatarURL(guildId, userId, memberAvatar, options) {
  return `${CDNURL}guilds/${guildId}/users/${userId}/avatars/${memberAvatar}${getFormat(memberAvatar, options?.format)}${getSize(options?.size)}`;
}
var CDNURL = "https://cdn.discordapp.com/";

// node_modules/lilybird/dist/factories/user.js
class User {
  id;
  username;
  discriminator;
  globalName;
  avatar;
  bot;
  system;
  mfaEnabled;
  banner;
  accentColor;
  locale;
  verified;
  email;
  flags;
  premiumType;
  publicFlags;
  avatarDecoration;
  member;
  constructor(client, user) {
    this.id = user.id;
    this.username = user.username;
    this.discriminator = user.discriminator;
    this.globalName = user.global_name;
    this.avatar = user.avatar;
    this.bot = user.bot ?? false;
    this.system = user.system ?? false;
    this.mfaEnabled = user.mfa_enabled ?? false;
    this.banner = user.banner;
    this.accentColor = user.accent_color;
    this.locale = user.locale;
    this.verified = user.verified ?? false;
    this.email = user.email;
    this.flags = user.flags ?? 0;
    this.premiumType = user.premium_type ?? 0;
    this.publicFlags = user.public_flags ?? 0;
    this.avatarDecoration = user.avatar_decoration;
    if ("member" in user)
      this.member = new GuildMember(client, user.member);
  }
  avatarURL(options) {
    if (this.avatar === null)
      return defaultUserAvatarURL(this.#calculateIndex(), options);
    return userAvatarURL(this.id, this.avatar, options);
  }
  #calculateIndex() {
    if (this.discriminator === "0")
      return ((BigInt(this.id) >> 22n) % 6n).toString();
    return (+this.discriminator % 5).toString();
  }
}

// node_modules/lilybird/dist/factories/guild-member.js
class GuildMember {
  user;
  nick;
  avatar;
  roles;
  joinedAt;
  premiumSince;
  deaf;
  mute;
  flags;
  pending;
  permissions;
  communicationDisabledUntil;
  guildId;
  client;
  constructor(client, member) {
    this.client = client;
    this.nick = member.nick;
    this.avatar = member.avatar;
    this.roles = member.roles;
    this.deaf = member.deaf;
    this.mute = member.mute;
    this.joinedAt = new Date(member.joined_at);
    this.flags = member.flags ?? 0;
    this.pending = member.pending ?? false;
    this.permissions = member.permissions;
    if (typeof member.user !== "undefined")
      this.user = new User(client, member.user);
    if (member.premium_since != null)
      this.premiumSince = new Date(member.premium_since);
    if (member.communication_disabled_until != null)
      this.communicationDisabledUntil = new Date(member.communication_disabled_until);
    if ("guild_id" in member)
      this.guildId = member.guild_id;
  }
  async modify(options) {
    if (!this.guildId)
      throw new Error("Something went wrong trying to modify the member");
    if (typeof options.communication_disabled_until !== "undefined" && options.communication_disabled_until instanceof Date)
      options.communication_disabled_until = options.communication_disabled_until.toISOString();
    if (typeof options.flags !== "undefined")
      options.flags.reduce((prev, curr) => prev | curr, 0);
    await this.client.rest.modifyGuildMember(this.guildId, this.user.id, options);
  }
  avatarURL(options) {
    if (this.avatar == null)
      return this.user.avatarURL(options);
    if (typeof this.guildId === "undefined")
      throw new Error("Something went wrong and the guild id does not exist");
    return guildMemberAvatarURL(this.guildId, this.user.id, this.avatar, options);
  }
}
// node_modules/lilybird/dist/factories/message.js
class Message {
  id;
  author;
  channelId;
  content;
  timestamp;
  editedTimestamp = undefined;
  tts;
  mentionsEveryone;
  mentions;
  mentionedRoles;
  mentionedChannels;
  attachments;
  embeds;
  reactions;
  nonce;
  pinned;
  webhookId;
  type;
  activity;
  application;
  applicationId;
  messageReference;
  flags;
  referencedMessage;
  interaction;
  thread;
  components;
  stickerItems;
  stickers;
  position;
  roleSubscriptionData;
  resolved;
  guildId;
  member;
  client;
  constructor(client, message) {
    this.client = client;
    this.id = message.id;
    this.channelId = message.channel_id;
    this.content = message.content;
    this.tts = message.tts;
    this.mentionsEveryone = message.mention_everyone;
    this.mentionedRoles = message.mention_roles;
    this.mentionedChannels = message.mention_channels?.map((channel2) => new MentionChannel(client, channel2)) ?? [];
    this.attachments = message.attachments;
    this.embeds = message.embeds;
    this.reactions = message.reactions;
    this.nonce = message.nonce;
    this.pinned = message.pinned;
    this.webhookId = message.webhook_id;
    this.type = message.type;
    this.activity = message.activity;
    this.application = message.application;
    this.applicationId = message.application_id;
    this.messageReference = message.message_reference;
    this.flags = message.flags ?? 0;
    this.interaction = message.interaction;
    this.components = message.components;
    this.stickerItems = message.sticker_items;
    this.stickers = message.stickers;
    this.position = message.position;
    this.roleSubscriptionData = message.role_subscription_data;
    this.resolved = message.resolved;
    this.guildId = message.guild_id;
    if (typeof message.author !== "undefined")
      this.author = new User(client, message.author);
    if (typeof message.timestamp !== "undefined")
      this.timestamp = new Date(message.timestamp);
    if (typeof message.mentions !== "undefined")
      this.mentions = message.mentions.map((mention) => new User(client, mention));
    if (typeof message.member !== "undefined")
      this.member = new GuildMember(client, message.member);
    if (typeof message.thread !== "undefined")
      this.thread = channelFactory(client, message.thread);
    if (message.referenced_message != null)
      this.referencedMessage = new Message(client, message.referenced_message);
    if (message.edited_timestamp != null)
      this.editedTimestamp = new Date(message.edited_timestamp);
  }
  async reply(content, options) {
    let flags = 0;
    let data;
    let files;
    if (typeof content === "string") {
      if (typeof options !== "undefined") {
        const { suppressEmbeds, suppressNotifications, files: f, ...obj } = options;
        if (suppressEmbeds)
          flags |= 4;
        if (suppressNotifications)
          flags |= 4096;
        files = f;
        data = {
          ...obj,
          content
        };
      } else
        data = { content };
    } else {
      const { suppressEmbeds, suppressNotifications, files: f, ...obj } = content;
      if (suppressEmbeds)
        flags |= 4;
      if (suppressNotifications)
        flags |= 4096;
      files = f;
      data = obj;
    }
    return new Message(this.client, await this.client.rest.createMessage(this.channelId, {
      ...data,
      flags,
      message_reference: {
        message_id: this.id
      }
    }, files));
  }
  async edit(content, options) {
    let flags = 0;
    let data;
    let files;
    if (typeof content === "string") {
      if (typeof options !== "undefined") {
        const { suppressEmbeds, files: f, ...obj } = options;
        if (suppressEmbeds)
          flags = 4;
        files = f;
        data = {
          ...obj,
          content,
          flags
        };
      } else
        data = { content, flags };
    } else {
      const { suppressEmbeds, files: f, ...obj } = content;
      if (suppressEmbeds)
        flags = 4;
      files = f;
      data = {
        ...obj,
        flags
      };
    }
    return new Message(this.client, await this.client.rest.editMessage(this.channelId, this.id, data, files));
  }
  async react(emoji, isCustomEmoji = false) {
    await this.client.rest.createReaction(this.channelId, this.id, emoji, isCustomEmoji);
  }
  async delete(reason) {
    await this.client.rest.deleteMessage(this.channelId, this.id, reason);
  }
  async crosspost() {
    await this.client.rest.crosspostMessage(this.channelId, this.id);
  }
  async pin() {
    await this.client.rest.pinMessage(this.channelId, this.id);
  }
  async unpin() {
    await this.client.rest.unpinMessage(this.channelId, this.id);
  }
  async startThread(options) {
    if (typeof options === "string")
      options = { name: options };
    return channelFactory(this.client, await this.client.rest.startThreadFromMessage(this.channelId, this.id, options));
  }
  async fetchChannel() {
    return channelFactory(this.client, await this.client.rest.getChannel(this.channelId));
  }
  hasContent() {
    return typeof this.content !== "undefined";
  }
  hasAttachments() {
    return typeof this.attachments !== "undefined";
  }
  hasEmbeds() {
    return typeof this.embeds !== "undefined";
  }
  hasComponents() {
    return typeof this.components !== "undefined";
  }
  hasStickers() {
    return typeof this.stickers !== "undefined";
  }
}

// node_modules/lilybird/dist/factories/channel.js
function channelFactory(client, channel2, resolved = false) {
  switch (channel2.type) {
    case 0: {
      return new GuildTextChannel(client, channel2, resolved);
    }
    case 1: {
      return new DMChannel(client, channel2, resolved);
    }
    case 2: {
      return new GuildVoiceChannel(client, channel2, resolved);
    }
    case 3: {
      return new GroupDMChannel(client, channel2, resolved);
    }
    case 5: {
      return new GuildAnnouncementChannel(client, channel2, resolved);
    }
    case 4: {
      return new GuildChannelCategory(client, channel2, resolved);
    }
    case 10:
    case 11:
    case 12: {
      return new ThreadChannel(client, channel2, resolved);
    }
    case 13:
    case 14: {
      return new GuildChannel(client, channel2, resolved);
    }
    case 15:
    case 16: {
      return new ThreadLikeChannel(client, channel2, resolved);
    }
  }
}

class Channel {
  id;
  type;
  lastPinTimestamp;
  flags;
  client;
  constructor(client, channel2, resolved) {
    this.client = client;
    this.id = channel2.id;
    this.type = channel2.type;
    this.lastPinTimestamp = channel2.last_pin_timestamp;
    this.flags = channel2.flags ?? 0;
    if (resolved) {
      if (typeof channel2.permissions !== "undefined")
        this.permissions = channel2.permissions;
    }
  }
  async send(content, options) {
    let flags = 0;
    let data;
    let files;
    if (typeof content === "string") {
      if (typeof options !== "undefined") {
        const { suppressEmbeds, suppressNotifications, files: f, ...obj } = options;
        if (suppressEmbeds)
          flags |= 4;
        if (suppressNotifications)
          flags |= 4096;
        files = f;
        data = {
          ...obj,
          content
        };
      } else
        data = { content };
    } else {
      const { suppressEmbeds, suppressNotifications, files: f, ...obj } = content;
      if (suppressEmbeds)
        flags |= 4;
      if (suppressNotifications)
        flags |= 4096;
      files = f;
      data = obj;
    }
    return new Message(this.client, await this.client.rest.createMessage(this.id, {
      ...data,
      flags
    }, files));
  }
  isText() {
    return this.type === 0;
  }
  isDM() {
    return this.type === 1;
  }
  isVoice() {
    return this.type === 2;
  }
  isGroupDM() {
    return this.type === 3;
  }
  isCategory() {
    return this.type === 4;
  }
  isAnnouncement() {
    return this.type === 5;
  }
  isAnnouncementThread() {
    return this.type === 10;
  }
  isPublicThread() {
    return this.type === 11;
  }
  isPrivateThread() {
    return this.type === 12;
  }
  isStageVoice() {
    return this.type === 13;
  }
  isDirectory() {
    return this.type === 14;
  }
  isForum() {
    return this.type === 15;
  }
  isMedia() {
    return this.type === 16;
  }
}

class MentionChannel extends Channel {
  guildId;
  name;
  constructor(client, channel2) {
    super(client, channel2, false);
    this.guildId = channel2.guild_id;
    this.name = channel2.name;
  }
}

class GuildChannel extends Channel {
  guildId;
  name;
  position;
  permissionOverwrites;
  nsfw;
  topic;
  lastMessageId;
  parentId;
  defaultAutoArchiveDuration;
  constructor(client, channel2, resolved) {
    super(client, channel2, resolved);
    this.guildId = channel2.guild_id;
    this.name = channel2.name;
    this.position = channel2.position;
    this.permissionOverwrites = channel2.permission_overwrites;
    this.nsfw = channel2.nsfw;
    this.topic = channel2.topic;
    this.lastMessageId = channel2.last_message_id;
    this.parentId = channel2.parent_id;
    this.defaultAutoArchiveDuration = channel2.default_auto_archive_duration;
  }
}

class GuildTextChannel extends GuildChannel {
  rateLimitPerUser;
  constructor(client, channel2, resolved) {
    super(client, channel2, resolved);
    this.rateLimitPerUser = channel2.rate_limit_per_user;
  }
}

class GuildAnnouncementChannel extends GuildChannel {
}

class GuildVoiceChannel extends Channel {
  guildId;
  name;
  position;
  permissionOverwrites;
  lastMessageId;
  parentId;
  nsfw;
  rateLimitPerUser;
  rtcRegion;
  userLimit;
  bitrate;
  videoQualityMode;
  constructor(client, channel2, resolved) {
    super(client, channel2, resolved);
    this.guildId = channel2.guild_id;
    this.name = channel2.name;
    this.position = channel2.position;
    this.permissionOverwrites = channel2.permission_overwrites;
    this.lastMessageId = channel2.last_message_id;
    this.parentId = channel2.parent_id;
    this.nsfw = channel2.nsfw;
    this.rateLimitPerUser = channel2.rate_limit_per_user;
    this.rtcRegion = channel2.rtc_region;
    this.userLimit = channel2.user_limit;
    this.bitrate = channel2.bitrate;
    this.videoQualityMode = channel2.video_quality_mode ?? 1;
  }
}

class DMChannel extends Channel {
  lastMessageId;
  recipients;
  constructor(client, channel2, resolved) {
    super(client, channel2, resolved);
    this.lastMessageId = channel2.last_message_id;
    this.recipients = channel2.recipients.map((user4) => new User(client, user4));
  }
}

class GroupDMChannel extends DMChannel {
  name;
  icon;
  ownerId;
  applicationId;
  managed;
  constructor(client, channel2, resolved) {
    super(client, channel2, resolved);
    this.name = channel2.name;
    this.icon = channel2.icon;
    this.ownerId = channel2.owner_id;
    this.applicationId = channel2.application_id;
    this.managed = channel2.managed;
  }
  isManaged() {
    return !!this.managed;
  }
}

class GuildChannelCategory extends Channel {
  permissionOverwrites;
  name;
  nsfw;
  position;
  guildId;
  rateLimitPerUser;
  constructor(client, channel2, resolved) {
    super(client, channel2, resolved);
    this.permissionOverwrites = channel2.permission_overwrites;
    this.name = channel2.name;
    this.nsfw = channel2.nsfw;
    this.position = channel2.position;
    this.guildId = channel2.guild_id;
    this.rateLimitPerUser = channel2.rate_limit_per_user;
  }
}

class ThreadChannel extends Channel {
  guildId;
  parentId;
  ownerId;
  name;
  lastMessageId;
  messageCount;
  memberCount;
  threadMetadata;
  totalMessageSent;
  member;
  defaultThreadRateLimitPerUser;
  constructor(client, channel2, resolved) {
    super(client, channel2, resolved);
    this.guildId = channel2.guild_id;
    this.parentId = channel2.parent_id;
    this.ownerId = channel2.owner_id;
    this.name = channel2.name;
    this.lastMessageId = channel2.last_message_id;
    this.messageCount = channel2.message_count;
    this.memberCount = channel2.member_count;
    this.threadMetadata = channel2.thread_metadata;
    this.totalMessageSent = channel2.total_message_sent;
    this.defaultThreadRateLimitPerUser = channel2.default_thread_rate_limit_per_user ?? 0;
    if (typeof channel2.member !== "undefined")
      this.member = new ThreadMember(client, channel2.member);
    if ("newly_created" in channel2)
      this.newlyCreated = channel2.newly_created;
  }
  hasMember() {
    return typeof this.member !== "undefined";
  }
}

class ThreadMember {
  id;
  userId;
  joinTimestamp;
  flags;
  member;
  constructor(client, member) {
    this.id = member.id;
    this.userId = member.user_id;
    this.joinTimestamp = new Date(member.join_timestamp);
    this.flags = member.flags;
    if (typeof member.member !== "undefined")
      this.member = new GuildMember(client, member.member);
  }
}

class ThreadLikeChannel extends Channel {
  availableTags;
  appliedTags;
  defaultThreadRateLimitPerUser;
  defaultSortOrder;
  defaultForumLayout;
  defaultReactionEmoji;
  constructor(client, channel2, resolved) {
    super(client, channel2, resolved);
    this.availableTags = channel2.available_tags;
    this.appliedTags = channel2.applied_tags;
    this.defaultThreadRateLimitPerUser = channel2.default_thread_rate_limit_per_user;
    this.defaultSortOrder = channel2.default_sort_order;
    this.defaultForumLayout = channel2.default_forum_layout;
    this.defaultReactionEmoji = channel2.default_reaction_emoji;
  }
}

// node_modules/lilybird/dist/factories/guild.js
function guildFactory(client, guild) {
  if ("joined_at" in guild)
    return new NewGuild(client, guild);
  if ("unavailable" in guild)
    return guild;
  return new Guild(client, guild);
}

class Guild {
  id;
  name;
  icon;
  iconHash;
  splash;
  discoverySplash;
  owner;
  ownerId;
  permissions;
  afkChannelId;
  afkTimeout;
  widgetEnabled;
  widgetChannelId;
  verificationLevel;
  defaultMessageNotifications;
  explicitContentFilter;
  roles;
  emojis;
  features;
  mfaLevel;
  applicationId;
  systemChannelId;
  systemChannelFlags;
  rulesChannelId;
  maxPresences;
  maxMembers;
  vanityUrlCode;
  description;
  banner;
  premiumTier;
  premiumSubscriptionCount;
  preferredLocale;
  publicUpdatesChannelId;
  maxVideoChannelUsers;
  maxStageVideoChannelUsers;
  approximateMemberCount;
  approximatePresenceCount;
  welcomeScreen;
  nsfwLevel;
  stickers;
  premiumProgressBarEnabled;
  safetyAlertsChannelId;
  client;
  constructor(client, guild) {
    this.client = client;
    this.id = guild.id;
    this.name = guild.name;
    this.icon = guild.icon;
    this.iconHash = guild.icon_hash;
    this.splash = guild.splash;
    this.discoverySplash = guild.discovery_splash;
    this.owner = guild.owner;
    this.ownerId = guild.owner_id;
    this.permissions = guild.permissions;
    this.afkChannelId = guild.afk_channel_id;
    this.afkTimeout = guild.afk_timeout;
    this.widgetEnabled = guild.widget_enabled;
    this.widgetChannelId = guild.widget_channel_id;
    this.verificationLevel = guild.verification_level;
    this.defaultMessageNotifications = guild.default_message_notifications;
    this.explicitContentFilter = guild.explicit_content_filter;
    this.roles = guild.roles;
    this.emojis = guild.emojis;
    this.features = guild.features;
    this.mfaLevel = guild.mfa_level;
    this.applicationId = guild.application_id;
    this.systemChannelId = guild.system_channel_id;
    this.systemChannelFlags = guild.system_channel_flags;
    this.rulesChannelId = guild.rules_channel_id;
    this.maxPresences = guild.max_presences;
    this.maxMembers = guild.max_members;
    this.vanityUrlCode = guild.vanity_url_code;
    this.description = guild.description;
    this.banner = guild.banner;
    this.premiumTier = guild.premium_tier;
    this.premiumSubscriptionCount = guild.premium_subscription_count ?? 0;
    this.preferredLocale = guild.preferred_locale;
    this.publicUpdatesChannelId = guild.public_updates_channel_id;
    this.maxVideoChannelUsers = guild.max_video_channel_users;
    this.maxStageVideoChannelUsers = guild.max_stage_video_channel_users;
    this.approximateMemberCount = guild.approximate_member_count;
    this.approximatePresenceCount = guild.approximate_presence_count;
    this.welcomeScreen = guild.welcome_screen;
    this.nsfwLevel = guild.nsfw_level;
    this.stickers = guild.stickers ?? [];
    this.premiumProgressBarEnabled = guild.premium_progress_bar_enabled;
    this.safetyAlertsChannelId = guild.safety_alerts_channel_id;
  }
}

class NewGuild extends Guild {
  joinedAt;
  large;
  unavailable;
  memberCount;
  voiceStates;
  members;
  channels;
  threads;
  presences;
  stageInstances;
  guildScheduledEvents;
  constructor(client, guild) {
    super(client, guild);
    this.joinedAt = guild.joined_at;
    this.large = guild.large;
    this.unavailable = guild.unavailable ?? false;
    this.memberCount = guild.member_count;
    this.voiceStates = guild.voice_states;
    this.members = guild.members.map((member) => new GuildMember(client, member));
    this.channels = guild.channels.map((channel3) => channelFactory(client, channel3));
    this.threads = guild.threads.map((channel3) => channelFactory(client, channel3));
    this.presences = guild.presences;
    this.stageInstances = guild.stage_instances;
    this.guildScheduledEvents = guild.guild_scheduled_events;
  }
}
// node_modules/lilybird/dist/factories/interaction.js
function interactionFactory(client, interaction) {
  const data = interactionDataFactory(interaction);
  if ("guild_id" in interaction)
    return new GuildInteraction(client, interaction, true, data);
  return new DMInteraction(client, interaction, false, data);
}
var interactionDataFactory = function(interaction) {
  switch (interaction.type) {
    case 1:
      return;
    case 2:
    case 4: {
      return new ApplicationCommandData(interaction.data);
    }
    case 3: {
      return new MessageComponentData(interaction.data);
    }
    case 5: {
      return new ModalSubmitData(interaction.data);
    }
  }
};

class Interaction {
  client;
  id;
  applicationId;
  type;
  token;
  version = 1;
  locale;
  entitlements;
  data;
  message = undefined;
  #inGuild;
  constructor(client, interaction, isGuild, data) {
    this.#inGuild = isGuild;
    this.client = client;
    this.id = interaction.id;
    this.applicationId = interaction.application_id;
    this.type = interaction.type;
    this.token = interaction.token;
    this.locale = interaction.locale;
    this.entitlements = interaction.entitlements;
    this.data = data;
    if ("message" in interaction)
      this.message = new Message(client, interaction.message);
  }
  async reply(content, options) {
    let flags = 0;
    let data;
    let files;
    if (typeof content === "string") {
      if (typeof options !== "undefined") {
        const { ephemeral, suppressEmbeds, files: f, ...obj } = options;
        if (ephemeral)
          flags |= 64;
        if (suppressEmbeds)
          flags |= 4;
        files = f;
        data = {
          ...obj,
          content,
          flags
        };
      } else {
        data = {
          content,
          flags
        };
      }
    } else {
      const { ephemeral, suppressEmbeds, files: f, ...obj } = content;
      if (ephemeral)
        flags |= 64;
      if (suppressEmbeds)
        flags |= 4;
      files = f;
      data = {
        ...obj,
        flags
      };
    }
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: 4,
      data
    }, files);
  }
  async deferReply(ephemeral = false) {
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: 5,
      data: {
        flags: ephemeral ? 64 : 0
      }
    });
  }
  async deferComponentReply(ephemeral = false) {
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: 6,
      data: {
        flags: ephemeral ? 64 : 0
      }
    });
  }
  async updateComponents(content, options) {
    let flags = 0;
    let data;
    let files;
    if (typeof content === "string") {
      if (typeof options !== "undefined") {
        const { ephemeral, suppressEmbeds, files: f, ...obj } = options;
        if (ephemeral)
          flags |= 64;
        if (suppressEmbeds)
          flags |= 4;
        files = f;
        data = {
          ...obj,
          content,
          flags
        };
      } else {
        data = {
          content,
          flags
        };
      }
    } else {
      const { ephemeral, suppressEmbeds, files: f, ...obj } = content;
      if (ephemeral)
        flags |= 64;
      if (suppressEmbeds)
        flags |= 4;
      files = f;
      data = {
        ...obj,
        flags
      };
    }
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: 7,
      data
    }, files);
  }
  async showChoices(choices) {
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: 8,
      data: { choices }
    });
  }
  async showModal(titleOrOptions, id, components) {
    let data;
    if (typeof titleOrOptions === "string") {
      data = {
        title: titleOrOptions,
        custom_id: id,
        components
      };
    } else {
      const { id: custom_id, ...obj } = titleOrOptions;
      data = {
        ...obj,
        custom_id
      };
    }
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: 9,
      data
    });
  }
  async followUp(content, options) {
    let flags = 0;
    let data;
    let files;
    if (typeof content === "string") {
      if (typeof options !== "undefined") {
        const { ephemeral, suppressEmbeds, files: f, ...obj } = options;
        if (ephemeral)
          flags |= 64;
        if (suppressEmbeds)
          flags |= 4;
        files = f;
        data = {
          ...obj,
          content,
          flags
        };
      } else {
        data = {
          content,
          flags
        };
      }
    } else {
      const { ephemeral, suppressEmbeds, files: f, ...obj } = content;
      if (ephemeral)
        flags |= 64;
      if (suppressEmbeds)
        flags |= 4;
      files = f;
      data = {
        ...obj,
        flags
      };
    }
    return new Message(this.client, await this.client.rest.createFollowupMessage(this.client.user.id, this.token, data, files));
  }
  async editReply(content, options) {
    let data;
    let files;
    if (typeof content === "string") {
      if (typeof options !== "undefined") {
        const { files: f, ...obj } = options;
        files = f;
        data = {
          ...obj,
          content
        };
      } else {
        data = {
          content
        };
      }
    } else {
      const { files: f, ...obj } = content;
      files = f;
      data = obj;
    }
    await this.client.rest.editOriginalInteractionResponse(this.client.user.id, this.token, data, files);
  }
  async editFollowUp(messageId, content, options) {
    let data;
    let files;
    if (typeof content === "string") {
      if (typeof options !== "undefined") {
        const { files: f, ...obj } = options;
        files = f;
        data = {
          ...obj,
          content
        };
      } else {
        data = {
          content
        };
      }
    } else {
      const { files: f, ...obj } = content;
      files = f;
      data = obj;
    }
    await this.client.rest.editFollowupMessage(this.client.user.id, this.token, messageId, data, files);
  }
  async deleteReply() {
    await this.client.rest.deleteOriginalInteractionResponse(this.client.application.id, this.token);
  }
  async deleteFollowUp(messageId) {
    await this.client.rest.deleteFollowupMessage(this.client.application.id, this.token, messageId);
  }
  isPingInteraction() {
    return this.type === 1;
  }
  isApplicationCommandInteraction() {
    return this.type === 2;
  }
  isAutocompleteInteraction() {
    return this.type === 4;
  }
  isMessageComponentInteraction() {
    return this.type === 3;
  }
  isModalSubmitInteraction() {
    return this.type === 5;
  }
  inGuild() {
    return this.#inGuild;
  }
  inDM() {
    return !this.#inGuild;
  }
}

class GuildInteraction extends Interaction {
  guildId;
  channel;
  channelId;
  member;
  appPermissions;
  guildLocale;
  constructor(client, interaction, isDM, data) {
    super(client, interaction, isDM, data);
    this.guildId = interaction.guild_id;
    this.channel = channelFactory(client, interaction.channel);
    this.channelId = interaction.channel_id;
    this.member = new GuildMember(client, interaction.member);
    this.appPermissions = interaction.app_permissions;
    this.guildLocale = interaction.guild_locale;
  }
}

class DMInteraction extends Interaction {
  user;
  constructor(client, interaction, isDM, data) {
    super(client, interaction, isDM, data);
    this.user = new User(client, interaction.user);
  }
}

class ApplicationCommandData {
  id;
  name;
  type;
  resolved;
  guildId;
  targetId;
  #stringOptions = new Map;
  #numberOptions = new Map;
  #integerOptions = new Map;
  #booleanOptions = new Map;
  #userOptions = new Map;
  #channelOptions = new Map;
  #roleOptions = new Map;
  #mentionableOptions = new Map;
  #attachmentOptions = new Map;
  #focused;
  #subCommandGroup;
  #subCommand;
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.resolved = data.resolved;
    this.guildId = data.guild_id;
    this.targetId = data.target_id;
    this.#parseOptions(data.options);
  }
  #parseOptions(options) {
    if (!options)
      return;
    for (let i = 0, { length } = options;i < length; i++) {
      const option = options[i];
      if (option.focused) {
        if (typeof option.value === "undefined")
          continue;
        this.#focused = { name: option.name, value: option.value };
        continue;
      }
      switch (option.type) {
        case 1: {
          this.#subCommand = option.name;
          this.#parseOptions(option.options);
          return;
        }
        case 2: {
          this.#subCommandGroup = option.name;
          this.#parseOptions(option.options);
          return;
        }
        case 3: {
          if (typeof option.value !== "string")
            throw new Error("Something unexpected happened");
          this.#stringOptions.set(option.name, option.value);
          break;
        }
        case 4: {
          if (typeof option.value !== "number")
            throw new Error("Something unexpected happened");
          this.#integerOptions.set(option.name, option.value);
          break;
        }
        case 10: {
          if (typeof option.value !== "number")
            throw new Error("Something unexpected happened");
          this.#numberOptions.set(option.name, option.value);
          break;
        }
        case 5: {
          if (typeof option.value !== "boolean")
            throw new Error("Something unexpected happened");
          this.#booleanOptions.set(option.name, option.value);
          break;
        }
        case 6: {
          if (typeof option.value !== "string")
            throw new Error("Something unexpected happened");
          this.#userOptions.set(option.name, option.value);
          break;
        }
        case 7: {
          if (typeof option.value !== "string")
            throw new Error("Something unexpected happened");
          this.#channelOptions.set(option.name, option.value);
          break;
        }
        case 8: {
          if (typeof option.value !== "string")
            throw new Error("Something unexpected happened");
          this.#roleOptions.set(option.name, option.value);
          break;
        }
        case 9: {
          if (typeof option.value !== "string")
            throw new Error("Something unexpected happened");
          this.#mentionableOptions.set(option.name, option.value);
          break;
        }
        case 11: {
          if (typeof this.resolved?.attachments === "undefined")
            throw new Error("Something unexpected happened");
          if (typeof option.value !== "string")
            throw new Error("Something unexpected happened");
          this.#attachmentOptions.set(option.name, this.resolved.attachments[option.value].url);
          break;
        }
      }
    }
  }
  isGuildApplicationCommand() {
    return typeof this.guildId !== "undefined";
  }
  isUIApplicationCommand() {
    return typeof this.targetId !== "undefined";
  }
  getFocused() {
    return this.#focused;
  }
  get subCommand() {
    return this.#subCommand;
  }
  get subCommandGroup() {
    return this.#subCommandGroup;
  }
  getString(name, assert = false) {
    if (assert) {
      if (!this.#stringOptions.has(name))
        throw new NotFoundError("String");
    }
    return this.#stringOptions.get(name);
  }
  getNumber(name, assert = false) {
    if (assert) {
      if (!this.#numberOptions.has(name))
        throw new NotFoundError("Number");
    }
    return this.#numberOptions.get(name);
  }
  getInteger(name, assert = false) {
    if (assert) {
      if (!this.#integerOptions.has(name))
        throw new NotFoundError("Integer");
    }
    return this.#integerOptions.get(name);
  }
  getBoolean(name, assert = false) {
    if (assert) {
      if (!this.#booleanOptions.has(name))
        throw new NotFoundError("Boolean");
    }
    return this.#booleanOptions.get(name);
  }
  getUser(name, assert = false) {
    if (assert) {
      if (!this.#userOptions.has(name))
        throw new NotFoundError("User");
    }
    return this.#userOptions.get(name);
  }
  getChannel(name, assert = false) {
    if (assert) {
      if (!this.#channelOptions.has(name))
        throw new NotFoundError("Channel");
    }
    return this.#channelOptions.get(name);
  }
  getRole(name, assert = false) {
    if (assert) {
      if (!this.#roleOptions.has(name))
        throw new NotFoundError("Role");
    }
    return this.#roleOptions.get(name);
  }
  getMentionable(name, assert = false) {
    if (assert) {
      if (!this.#mentionableOptions.has(name))
        throw new NotFoundError("Mentionable");
    }
    return this.#mentionableOptions.get(name);
  }
  getAttachment(name, assert = false) {
    if (assert) {
      if (!this.#attachmentOptions.has(name))
        throw new NotFoundError("Attachment");
    }
    return this.#attachmentOptions.get(name);
  }
}

class NotFoundError extends Error {
  constructor(type) {
    super();
    this.message = `${type} was not found`;
  }
}

class MessageComponentData {
  id;
  type;
  values;
  resolved;
  constructor(data) {
    this.id = data.custom_id;
    this.type = data.component_type;
    this.resolved = data.resolved;
    this.values = data.values;
  }
  isButton() {
    return this.type === 2;
  }
  isSelectMenu() {
    return this.type === 3 || this.type >= 5;
  }
}

class ModalSubmitData {
  id;
  components;
  constructor(data) {
    this.id = data.custom_id;
    this.components = data.components;
  }
}
// node_modules/lilybird/dist/enums/guild-schedule-event.js
var GuildScheduledEventPrivacyLevel;
(function(GuildScheduledEventPrivacyLevel2) {
  GuildScheduledEventPrivacyLevel2[GuildScheduledEventPrivacyLevel2["GUILD_ONLY"] = 2] = "GUILD_ONLY";
})(GuildScheduledEventPrivacyLevel || (GuildScheduledEventPrivacyLevel = {}));
var GuildScheduledEventStatus;
(function(GuildScheduledEventStatus2) {
  GuildScheduledEventStatus2[GuildScheduledEventStatus2["SCHEDULED"] = 1] = "SCHEDULED";
  GuildScheduledEventStatus2[GuildScheduledEventStatus2["ACTIVE"] = 2] = "ACTIVE";
  GuildScheduledEventStatus2[GuildScheduledEventStatus2["COMPLETED"] = 3] = "COMPLETED";
  GuildScheduledEventStatus2[GuildScheduledEventStatus2["CANCELED"] = 4] = "CANCELED";
})(GuildScheduledEventStatus || (GuildScheduledEventStatus = {}));
var GuildScheduledEventEntityTypes;
(function(GuildScheduledEventEntityTypes2) {
  GuildScheduledEventEntityTypes2[GuildScheduledEventEntityTypes2["STAGE_INSTANCE"] = 1] = "STAGE_INSTANCE";
  GuildScheduledEventEntityTypes2[GuildScheduledEventEntityTypes2["VOICE"] = 2] = "VOICE";
  GuildScheduledEventEntityTypes2[GuildScheduledEventEntityTypes2["EXTERNAL"] = 3] = "EXTERNAL";
})(GuildScheduledEventEntityTypes || (GuildScheduledEventEntityTypes = {}));
// node_modules/lilybird/dist/enums/auto-moderation.js
var AutoModerationEventType;
(function(AutoModerationEventType2) {
  AutoModerationEventType2[AutoModerationEventType2["MESSAGE_SEND"] = 1] = "MESSAGE_SEND";
})(AutoModerationEventType || (AutoModerationEventType = {}));
var AutoModerationTriggerType;
(function(AutoModerationTriggerType2) {
  AutoModerationTriggerType2[AutoModerationTriggerType2["KEYWORD"] = 1] = "KEYWORD";
  AutoModerationTriggerType2[AutoModerationTriggerType2["SPAM"] = 3] = "SPAM";
  AutoModerationTriggerType2[AutoModerationTriggerType2["KEYWORD_PRESET"] = 4] = "KEYWORD_PRESET";
  AutoModerationTriggerType2[AutoModerationTriggerType2["MENTION_SPAM"] = 5] = "MENTION_SPAM";
})(AutoModerationTriggerType || (AutoModerationTriggerType = {}));
var AutoModerationKeywordPresetTypes;
(function(AutoModerationKeywordPresetTypes2) {
  AutoModerationKeywordPresetTypes2[AutoModerationKeywordPresetTypes2["PROFANITY"] = 1] = "PROFANITY";
  AutoModerationKeywordPresetTypes2[AutoModerationKeywordPresetTypes2["SEXUAL_CONTENT"] = 2] = "SEXUAL_CONTENT";
  AutoModerationKeywordPresetTypes2[AutoModerationKeywordPresetTypes2["SLURS"] = 3] = "SLURS";
})(AutoModerationKeywordPresetTypes || (AutoModerationKeywordPresetTypes = {}));
var AutoModerationActionType;
(function(AutoModerationActionType2) {
  AutoModerationActionType2[AutoModerationActionType2["BLOCK_MESSAGE"] = 1] = "BLOCK_MESSAGE";
  AutoModerationActionType2[AutoModerationActionType2["SEND_ALERT_MESSAGE"] = 2] = "SEND_ALERT_MESSAGE";
  AutoModerationActionType2[AutoModerationActionType2["TIMEOUT"] = 3] = "TIMEOUT";
})(AutoModerationActionType || (AutoModerationActionType = {}));
// node_modules/lilybird/dist/enums/application.js
var ApplicationFlags;
(function(ApplicationFlags2) {
  ApplicationFlags2[ApplicationFlags2["APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE"] = 64] = "APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE";
  ApplicationFlags2[ApplicationFlags2["GATEWAY_PRESENCE"] = 4096] = "GATEWAY_PRESENCE";
  ApplicationFlags2[ApplicationFlags2["GATEWAY_PRESENCE_LIMITED"] = 8192] = "GATEWAY_PRESENCE_LIMITED";
  ApplicationFlags2[ApplicationFlags2["GATEWAY_GUILD_MEMBERS"] = 16384] = "GATEWAY_GUILD_MEMBERS";
  ApplicationFlags2[ApplicationFlags2["GATEWAY_GUILD_MEMBERS_LIMITED"] = 32768] = "GATEWAY_GUILD_MEMBERS_LIMITED";
  ApplicationFlags2[ApplicationFlags2["VERIFICATION_PENDING_GUILD_LIMIT"] = 65536] = "VERIFICATION_PENDING_GUILD_LIMIT";
  ApplicationFlags2[ApplicationFlags2["EMBEDDED"] = 131072] = "EMBEDDED";
  ApplicationFlags2[ApplicationFlags2["GATEWAY_MESSAGE_CONTENT"] = 262144] = "GATEWAY_MESSAGE_CONTENT";
  ApplicationFlags2[ApplicationFlags2["GATEWAY_MESSAGE_CONTENT_LIMITED"] = 524288] = "GATEWAY_MESSAGE_CONTENT_LIMITED";
  ApplicationFlags2[ApplicationFlags2["APPLICATION_COMMAND_BADGE"] = 8388608] = "APPLICATION_COMMAND_BADGE";
})(ApplicationFlags || (ApplicationFlags = {}));
// node_modules/lilybird/dist/enums/interaction.js
var InteractionType;
(function(InteractionType2) {
  InteractionType2[InteractionType2["PING"] = 1] = "PING";
  InteractionType2[InteractionType2["APPLICATION_COMMAND"] = 2] = "APPLICATION_COMMAND";
  InteractionType2[InteractionType2["MESSAGE_COMPONENT"] = 3] = "MESSAGE_COMPONENT";
  InteractionType2[InteractionType2["APPLICATION_COMMAND_AUTOCOMPLETE"] = 4] = "APPLICATION_COMMAND_AUTOCOMPLETE";
  InteractionType2[InteractionType2["MODAL_SUBMIT"] = 5] = "MODAL_SUBMIT";
})(InteractionType || (InteractionType = {}));
var ApplicationCommandType;
(function(ApplicationCommandType2) {
  ApplicationCommandType2[ApplicationCommandType2["CHAT_INPUT"] = 1] = "CHAT_INPUT";
  ApplicationCommandType2[ApplicationCommandType2["USER"] = 2] = "USER";
  ApplicationCommandType2[ApplicationCommandType2["MESSAGE"] = 3] = "MESSAGE";
})(ApplicationCommandType || (ApplicationCommandType = {}));
var ApplicationCommandOptionType;
(function(ApplicationCommandOptionType2) {
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["SUB_COMMAND"] = 1] = "SUB_COMMAND";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["SUB_COMMAND_GROUP"] = 2] = "SUB_COMMAND_GROUP";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["STRING"] = 3] = "STRING";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["INTEGER"] = 4] = "INTEGER";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["BOOLEAN"] = 5] = "BOOLEAN";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["USER"] = 6] = "USER";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["CHANNEL"] = 7] = "CHANNEL";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["ROLE"] = 8] = "ROLE";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["MENTIONABLE"] = 9] = "MENTIONABLE";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["NUMBER"] = 10] = "NUMBER";
  ApplicationCommandOptionType2[ApplicationCommandOptionType2["ATTACHMENT"] = 11] = "ATTACHMENT";
})(ApplicationCommandOptionType || (ApplicationCommandOptionType = {}));
var ApplicationCommandPermissionType;
(function(ApplicationCommandPermissionType2) {
  ApplicationCommandPermissionType2[ApplicationCommandPermissionType2["ROLE"] = 1] = "ROLE";
  ApplicationCommandPermissionType2[ApplicationCommandPermissionType2["USER"] = 2] = "USER";
  ApplicationCommandPermissionType2[ApplicationCommandPermissionType2["CHANNEL"] = 3] = "CHANNEL";
})(ApplicationCommandPermissionType || (ApplicationCommandPermissionType = {}));
var ComponentType;
(function(ComponentType2) {
  ComponentType2[ComponentType2["ActionRow"] = 1] = "ActionRow";
  ComponentType2[ComponentType2["Button"] = 2] = "Button";
  ComponentType2[ComponentType2["StringSelect"] = 3] = "StringSelect";
  ComponentType2[ComponentType2["TextInput"] = 4] = "TextInput";
  ComponentType2[ComponentType2["UserSelect"] = 5] = "UserSelect";
  ComponentType2[ComponentType2["RoleSelect"] = 6] = "RoleSelect";
  ComponentType2[ComponentType2["MentionableSelect"] = 7] = "MentionableSelect";
  ComponentType2[ComponentType2["ChannelSelect"] = 8] = "ChannelSelect";
})(ComponentType || (ComponentType = {}));
var ButtonStyle;
(function(ButtonStyle2) {
  ButtonStyle2[ButtonStyle2["Primary"] = 1] = "Primary";
  ButtonStyle2[ButtonStyle2["Secondary"] = 2] = "Secondary";
  ButtonStyle2[ButtonStyle2["Success"] = 3] = "Success";
  ButtonStyle2[ButtonStyle2["Danger"] = 4] = "Danger";
  ButtonStyle2[ButtonStyle2["Link"] = 5] = "Link";
})(ButtonStyle || (ButtonStyle = {}));
var TextInputStyle;
(function(TextInputStyle2) {
  TextInputStyle2[TextInputStyle2["Short"] = 1] = "Short";
  TextInputStyle2[TextInputStyle2["Paragraph"] = 2] = "Paragraph";
})(TextInputStyle || (TextInputStyle = {}));
var EntitlementType;
(function(EntitlementType2) {
  EntitlementType2[EntitlementType2["APPLICATION_SUBSCRIPTION"] = 8] = "APPLICATION_SUBSCRIPTION";
})(EntitlementType || (EntitlementType = {}));
var InteractionCallbackType;
(function(InteractionCallbackType2) {
  InteractionCallbackType2[InteractionCallbackType2["PONG"] = 1] = "PONG";
  InteractionCallbackType2[InteractionCallbackType2["CHANNEL_MESSAGE_WITH_SOURCE"] = 4] = "CHANNEL_MESSAGE_WITH_SOURCE";
  InteractionCallbackType2[InteractionCallbackType2["DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE"] = 5] = "DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE";
  InteractionCallbackType2[InteractionCallbackType2["DEFERRED_UPDATE_MESSAGE"] = 6] = "DEFERRED_UPDATE_MESSAGE";
  InteractionCallbackType2[InteractionCallbackType2["UPDATE_MESSAGE"] = 7] = "UPDATE_MESSAGE";
  InteractionCallbackType2[InteractionCallbackType2["APPLICATION_COMMAND_AUTOCOMPLETE_RESULT"] = 8] = "APPLICATION_COMMAND_AUTOCOMPLETE_RESULT";
  InteractionCallbackType2[InteractionCallbackType2["MODAL"] = 9] = "MODAL";
  InteractionCallbackType2[InteractionCallbackType2["PREMIUM_REQUIRED"] = 10] = "PREMIUM_REQUIRED";
})(InteractionCallbackType || (InteractionCallbackType = {}));
// node_modules/lilybird/dist/enums/audit-log.js
var AuditLogEvent;
(function(AuditLogEvent2) {
  AuditLogEvent2[AuditLogEvent2["GUILD_UPDATE"] = 1] = "GUILD_UPDATE";
  AuditLogEvent2[AuditLogEvent2["CHANNEL_CREATE"] = 10] = "CHANNEL_CREATE";
  AuditLogEvent2[AuditLogEvent2["CHANNEL_UPDATE"] = 11] = "CHANNEL_UPDATE";
  AuditLogEvent2[AuditLogEvent2["CHANNEL_DELETE"] = 12] = "CHANNEL_DELETE";
  AuditLogEvent2[AuditLogEvent2["CHANNEL_OVERWRITE_CREATE"] = 13] = "CHANNEL_OVERWRITE_CREATE";
  AuditLogEvent2[AuditLogEvent2["CHANNEL_OVERWRITE_UPDATE"] = 14] = "CHANNEL_OVERWRITE_UPDATE";
  AuditLogEvent2[AuditLogEvent2["CHANNEL_OVERWRITE_DELETE"] = 15] = "CHANNEL_OVERWRITE_DELETE";
  AuditLogEvent2[AuditLogEvent2["MEMBER_KICK"] = 20] = "MEMBER_KICK";
  AuditLogEvent2[AuditLogEvent2["MEMBER_PRUNE"] = 21] = "MEMBER_PRUNE";
  AuditLogEvent2[AuditLogEvent2["MEMBER_BAN_ADD"] = 22] = "MEMBER_BAN_ADD";
  AuditLogEvent2[AuditLogEvent2["MEMBER_BAN_REMOVE"] = 23] = "MEMBER_BAN_REMOVE";
  AuditLogEvent2[AuditLogEvent2["MEMBER_UPDATE"] = 24] = "MEMBER_UPDATE";
  AuditLogEvent2[AuditLogEvent2["MEMBER_ROLE_UPDATE"] = 25] = "MEMBER_ROLE_UPDATE";
  AuditLogEvent2[AuditLogEvent2["MEMBER_MOVE"] = 26] = "MEMBER_MOVE";
  AuditLogEvent2[AuditLogEvent2["MEMBER_DISCONNECT"] = 27] = "MEMBER_DISCONNECT";
  AuditLogEvent2[AuditLogEvent2["BOT_ADD"] = 28] = "BOT_ADD";
  AuditLogEvent2[AuditLogEvent2["ROLE_CREATE"] = 30] = "ROLE_CREATE";
  AuditLogEvent2[AuditLogEvent2["ROLE_UPDATE"] = 31] = "ROLE_UPDATE";
  AuditLogEvent2[AuditLogEvent2["ROLE_DELETE"] = 32] = "ROLE_DELETE";
  AuditLogEvent2[AuditLogEvent2["INVITE_CREATE"] = 40] = "INVITE_CREATE";
  AuditLogEvent2[AuditLogEvent2["INVITE_UPDATE"] = 41] = "INVITE_UPDATE";
  AuditLogEvent2[AuditLogEvent2["INVITE_DELETE"] = 42] = "INVITE_DELETE";
  AuditLogEvent2[AuditLogEvent2["WEBHOOK_CREATE"] = 50] = "WEBHOOK_CREATE";
  AuditLogEvent2[AuditLogEvent2["WEBHOOK_UPDATE"] = 51] = "WEBHOOK_UPDATE";
  AuditLogEvent2[AuditLogEvent2["WEBHOOK_DELETE"] = 52] = "WEBHOOK_DELETE";
  AuditLogEvent2[AuditLogEvent2["EMOJI_CREATE"] = 60] = "EMOJI_CREATE";
  AuditLogEvent2[AuditLogEvent2["EMOJI_UPDATE"] = 61] = "EMOJI_UPDATE";
  AuditLogEvent2[AuditLogEvent2["EMOJI_DELETE"] = 62] = "EMOJI_DELETE";
  AuditLogEvent2[AuditLogEvent2["MESSAGE_DELETE"] = 72] = "MESSAGE_DELETE";
  AuditLogEvent2[AuditLogEvent2["MESSAGE_BULK_DELETE"] = 73] = "MESSAGE_BULK_DELETE";
  AuditLogEvent2[AuditLogEvent2["MESSAGE_PIN"] = 74] = "MESSAGE_PIN";
  AuditLogEvent2[AuditLogEvent2["MESSAGE_UNPIN"] = 75] = "MESSAGE_UNPIN";
  AuditLogEvent2[AuditLogEvent2["INTEGRATION_CREATE"] = 80] = "INTEGRATION_CREATE";
  AuditLogEvent2[AuditLogEvent2["INTEGRATION_UPDATE"] = 81] = "INTEGRATION_UPDATE";
  AuditLogEvent2[AuditLogEvent2["INTEGRATION_DELETE"] = 82] = "INTEGRATION_DELETE";
  AuditLogEvent2[AuditLogEvent2["STAGE_INSTANCE_CREATE"] = 83] = "STAGE_INSTANCE_CREATE";
  AuditLogEvent2[AuditLogEvent2["STAGE_INSTANCE_UPDATE"] = 84] = "STAGE_INSTANCE_UPDATE";
  AuditLogEvent2[AuditLogEvent2["STAGE_INSTANCE_DELETE"] = 85] = "STAGE_INSTANCE_DELETE";
  AuditLogEvent2[AuditLogEvent2["STICKER_CREATE"] = 90] = "STICKER_CREATE";
  AuditLogEvent2[AuditLogEvent2["STICKER_UPDATE"] = 91] = "STICKER_UPDATE";
  AuditLogEvent2[AuditLogEvent2["STICKER_DELETE"] = 92] = "STICKER_DELETE";
  AuditLogEvent2[AuditLogEvent2["GUILD_SCHEDULED_EVENT_CREATE"] = 100] = "GUILD_SCHEDULED_EVENT_CREATE";
  AuditLogEvent2[AuditLogEvent2["GUILD_SCHEDULED_EVENT_UPDATE"] = 101] = "GUILD_SCHEDULED_EVENT_UPDATE";
  AuditLogEvent2[AuditLogEvent2["GUILD_SCHEDULED_EVENT_DELETE"] = 102] = "GUILD_SCHEDULED_EVENT_DELETE";
  AuditLogEvent2[AuditLogEvent2["THREAD_CREATE"] = 110] = "THREAD_CREATE";
  AuditLogEvent2[AuditLogEvent2["THREAD_UPDATE"] = 111] = "THREAD_UPDATE";
  AuditLogEvent2[AuditLogEvent2["THREAD_DELETE"] = 112] = "THREAD_DELETE";
  AuditLogEvent2[AuditLogEvent2["APPLICATION_COMMAND_PERMISSION_UPDATE"] = 121] = "APPLICATION_COMMAND_PERMISSION_UPDATE";
  AuditLogEvent2[AuditLogEvent2["AUTO_MODERATION_RULE_CREATE"] = 140] = "AUTO_MODERATION_RULE_CREATE";
  AuditLogEvent2[AuditLogEvent2["AUTO_MODERATION_RULE_UPDATE"] = 141] = "AUTO_MODERATION_RULE_UPDATE";
  AuditLogEvent2[AuditLogEvent2["AUTO_MODERATION_RULE_DELETE"] = 142] = "AUTO_MODERATION_RULE_DELETE";
  AuditLogEvent2[AuditLogEvent2["AUTO_MODERATION_BLOCK_MESSAGE"] = 143] = "AUTO_MODERATION_BLOCK_MESSAGE";
  AuditLogEvent2[AuditLogEvent2["AUTO_MODERATION_FLAG_TO_CHANNEL"] = 144] = "AUTO_MODERATION_FLAG_TO_CHANNEL";
  AuditLogEvent2[AuditLogEvent2["AUTO_MODERATION_USER_COMMUNICATION_DISABLED"] = 145] = "AUTO_MODERATION_USER_COMMUNICATION_DISABLED";
  AuditLogEvent2[AuditLogEvent2["CREATOR_MONETIZATION_REQUEST_CREATED"] = 150] = "CREATOR_MONETIZATION_REQUEST_CREATED";
  AuditLogEvent2[AuditLogEvent2["CREATOR_MONETIZATION_TERMS_ACCEPTED"] = 151] = "CREATOR_MONETIZATION_TERMS_ACCEPTED";
})(AuditLogEvent || (AuditLogEvent = {}));
// node_modules/lilybird/dist/enums/activity.js
var ActivityType;
(function(ActivityType2) {
  ActivityType2[ActivityType2["Game"] = 0] = "Game";
  ActivityType2[ActivityType2["Streaming"] = 1] = "Streaming";
  ActivityType2[ActivityType2["Listening"] = 2] = "Listening";
  ActivityType2[ActivityType2["Watching"] = 3] = "Watching";
  ActivityType2[ActivityType2["Custom"] = 4] = "Custom";
  ActivityType2[ActivityType2["Competing"] = 5] = "Competing";
})(ActivityType || (ActivityType = {}));
var ActivityFlags;
(function(ActivityFlags2) {
  ActivityFlags2[ActivityFlags2["INSTANCE"] = 1] = "INSTANCE";
  ActivityFlags2[ActivityFlags2["JOIN"] = 2] = "JOIN";
  ActivityFlags2[ActivityFlags2["SPECTATE"] = 4] = "SPECTATE";
  ActivityFlags2[ActivityFlags2["JOIN_REQUEST"] = 8] = "JOIN_REQUEST";
  ActivityFlags2[ActivityFlags2["SYNC"] = 16] = "SYNC";
  ActivityFlags2[ActivityFlags2["PLAY"] = 32] = "PLAY";
  ActivityFlags2[ActivityFlags2["PARTY_PRIVACY_FRIENDS"] = 64] = "PARTY_PRIVACY_FRIENDS";
  ActivityFlags2[ActivityFlags2["PARTY_PRIVACY_VOICE_CHANNEL"] = 128] = "PARTY_PRIVACY_VOICE_CHANNEL";
  ActivityFlags2[ActivityFlags2["EMBEDDED"] = 256] = "EMBEDDED";
})(ActivityFlags || (ActivityFlags = {}));
// node_modules/lilybird/dist/enums/channel.js
var ChannelType;
(function(ChannelType2) {
  ChannelType2[ChannelType2["GUILD_TEXT"] = 0] = "GUILD_TEXT";
  ChannelType2[ChannelType2["DM"] = 1] = "DM";
  ChannelType2[ChannelType2["GUILD_VOICE"] = 2] = "GUILD_VOICE";
  ChannelType2[ChannelType2["GROUP_DM"] = 3] = "GROUP_DM";
  ChannelType2[ChannelType2["GUILD_CATEGORY"] = 4] = "GUILD_CATEGORY";
  ChannelType2[ChannelType2["GUILD_ANNOUNCEMENT"] = 5] = "GUILD_ANNOUNCEMENT";
  ChannelType2[ChannelType2["ANNOUNCEMENT_THREAD"] = 10] = "ANNOUNCEMENT_THREAD";
  ChannelType2[ChannelType2["PUBLIC_THREAD"] = 11] = "PUBLIC_THREAD";
  ChannelType2[ChannelType2["PRIVATE_THREAD"] = 12] = "PRIVATE_THREAD";
  ChannelType2[ChannelType2["GUILD_STAGE_VOICE"] = 13] = "GUILD_STAGE_VOICE";
  ChannelType2[ChannelType2["GUILD_DIRECTORY"] = 14] = "GUILD_DIRECTORY";
  ChannelType2[ChannelType2["GUILD_FORUM"] = 15] = "GUILD_FORUM";
  ChannelType2[ChannelType2["GUILD_MEDIA"] = 16] = "GUILD_MEDIA";
})(ChannelType || (ChannelType = {}));
var OverwriteType;
(function(OverwriteType2) {
  OverwriteType2[OverwriteType2["ROLE"] = 0] = "ROLE";
  OverwriteType2[OverwriteType2["MEMBER"] = 1] = "MEMBER";
})(OverwriteType || (OverwriteType = {}));
var VideoQualityMode;
(function(VideoQualityMode2) {
  VideoQualityMode2[VideoQualityMode2["AUTO"] = 1] = "AUTO";
  VideoQualityMode2[VideoQualityMode2["FULL"] = 2] = "FULL";
})(VideoQualityMode || (VideoQualityMode = {}));
var ChannelFlags;
(function(ChannelFlags2) {
  ChannelFlags2[ChannelFlags2["PINNED"] = 2] = "PINNED";
  ChannelFlags2[ChannelFlags2["REQUIRE_TAG"] = 16] = "REQUIRE_TAG";
  ChannelFlags2[ChannelFlags2["HIDE_MEDIA_DOWNLOAD_OPTIONS"] = 32768] = "HIDE_MEDIA_DOWNLOAD_OPTIONS";
})(ChannelFlags || (ChannelFlags = {}));
var SortOrderType;
(function(SortOrderType2) {
  SortOrderType2[SortOrderType2["LATEST_ACTIVITY"] = 0] = "LATEST_ACTIVITY";
  SortOrderType2[SortOrderType2["CREATION_DATE"] = 1] = "CREATION_DATE";
})(SortOrderType || (SortOrderType = {}));
var ForumLayoutType;
(function(ForumLayoutType2) {
  ForumLayoutType2[ForumLayoutType2["NOT_SET"] = 0] = "NOT_SET";
  ForumLayoutType2[ForumLayoutType2["LIST_VIEW"] = 1] = "LIST_VIEW";
  ForumLayoutType2[ForumLayoutType2["GALLERY_VIEW"] = 2] = "GALLERY_VIEW";
})(ForumLayoutType || (ForumLayoutType = {}));
var AllowedMentionType;
(function(AllowedMentionType2) {
  AllowedMentionType2["RoleMentions"] = "roles";
  AllowedMentionType2["UserMentions"] = "users";
  AllowedMentionType2["EveryoneMentions"] = "everyone";
})(AllowedMentionType || (AllowedMentionType = {}));
// node_modules/lilybird/dist/enums/gateway.js
var GatewayEvent;
(function(GatewayEvent2) {
  GatewayEvent2["Ready"] = "READY";
  GatewayEvent2["Resumed"] = "RESUMED";
  GatewayEvent2["ApplicationCommandPermissionsUpdate"] = "APPLICATION_COMMAND_PERMISSIONS_UPDATE";
  GatewayEvent2["AutoModerationRuleCreate"] = "AUTO_MODERATION_RULE_CREATE";
  GatewayEvent2["AutoModerationRuleUpdate"] = "AUTO_MODERATION_RULE_UPDATE";
  GatewayEvent2["AutoModerationRuleDelete"] = "AUTO_MODERATION_RULE_DELETE";
  GatewayEvent2["AutoModerationActionExecution"] = "AUTO_MODERATION_ACTION_EXECUTION";
  GatewayEvent2["ChannelCreate"] = "CHANNEL_CREATE";
  GatewayEvent2["ChannelUpdate"] = "CHANNEL_UPDATE";
  GatewayEvent2["ChannelDelete"] = "CHANNEL_DELETE";
  GatewayEvent2["ChannelPinsUpdate"] = "CHANNEL_PINS_UPDATE";
  GatewayEvent2["ThreadCreate"] = "THREAD_CREATE";
  GatewayEvent2["ThreadUpdate"] = "THREAD_UPDATE";
  GatewayEvent2["ThreadDelete"] = "THREAD_DELETE";
  GatewayEvent2["ThreadListSync"] = "THREAD_LIST_SYNC";
  GatewayEvent2["ThreadMemberUpdate"] = "THREAD_MEMBER_UPDATE";
  GatewayEvent2["ThreadMembersUpdate"] = "THREAD_MEMBERS_UPDATE";
  GatewayEvent2["GuildCreate"] = "GUILD_CREATE";
  GatewayEvent2["GuildUpdate"] = "GUILD_UPDATE";
  GatewayEvent2["GuildDelete"] = "GUILD_DELETE";
  GatewayEvent2["GuildAuditLogEntryCreate"] = "GUILD_AUDIT_LOG_ENTRY_CREATE";
  GatewayEvent2["GuildBanAdd"] = "GUILD_BAN_ADD";
  GatewayEvent2["GuildBanRemove"] = "GUILD_BAN_REMOVE";
  GatewayEvent2["GuildEmojisUpdate"] = "GUILD_EMOJIS_UPDATE";
  GatewayEvent2["GuildStickersUpdate"] = "GUILD_STICKERS_UPDATE";
  GatewayEvent2["GuildIntegrationsUpdate"] = "GUILD_INTEGRATIONS_UPDATE";
  GatewayEvent2["GuildMemberAdd"] = "GUILD_MEMBER_ADD";
  GatewayEvent2["GuildMemberRemove"] = "GUILD_MEMBER_REMOVE";
  GatewayEvent2["GuildMemberUpdate"] = "GUILD_MEMBER_UPDATE";
  GatewayEvent2["GuildMembersChunk"] = "GUILD_MEMBERS_CHUNK";
  GatewayEvent2["GuildRoleCreate"] = "GUILD_ROLE_CREATE";
  GatewayEvent2["GuildRoleUpdate"] = "GUILD_ROLE_UPDATE";
  GatewayEvent2["GuildRoleDelete"] = "GUILD_ROLE_DELETE";
  GatewayEvent2["GuildScheduledEventCreate"] = "GUILD_SCHEDULED_EVENT_CREATE";
  GatewayEvent2["GuildScheduledEventUpdate"] = "GUILD_SCHEDULED_EVENT_UPDATE";
  GatewayEvent2["GuildScheduledEventDelete"] = "GUILD_SCHEDULED_EVENT_DELETE";
  GatewayEvent2["GuildScheduledEventUserAdd"] = "GUILD_SCHEDULED_EVENT_USER_ADD";
  GatewayEvent2["GuildScheduledEventUserRemove"] = "GUILD_SCHEDULED_EVENT_USER_REMOVE";
  GatewayEvent2["IntegrationCreate"] = "INTEGRATION_CREATE";
  GatewayEvent2["IntegrationUpdate"] = "INTEGRATION_UPDATE";
  GatewayEvent2["IntegrationDelete"] = "INTEGRATION_DELETE";
  GatewayEvent2["InteractionCreate"] = "INTERACTION_CREATE";
  GatewayEvent2["InviteCreate"] = "INVITE_CREATE";
  GatewayEvent2["InviteDelete"] = "INVITE_DELETE";
  GatewayEvent2["MessageCreate"] = "MESSAGE_CREATE";
  GatewayEvent2["MessageUpdate"] = "MESSAGE_UPDATE";
  GatewayEvent2["MessageDelete"] = "MESSAGE_DELETE";
  GatewayEvent2["MessageDeleteBulk"] = "MESSAGE_DELETE_BULK";
  GatewayEvent2["MessageReactionAdd"] = "MESSAGE_REACTION_ADD";
  GatewayEvent2["MessageReactionRemove"] = "MESSAGE_REACTION_REMOVE";
  GatewayEvent2["MessageReactionRemoveAll"] = "MESSAGE_REACTION_REMOVE_ALL";
  GatewayEvent2["MessageReactionRemoveEmoji"] = "MESSAGE_REACTION_REMOVE_EMOJI";
  GatewayEvent2["PresenceUpdate"] = "PRESENCE_UPDATE";
  GatewayEvent2["StageInstanceCreate"] = "STAGE_INSTANCE_CREATE";
  GatewayEvent2["StageInstanceUpdate"] = "STAGE_INSTANCE_UPDATE";
  GatewayEvent2["StageInstanceDelete"] = "STAGE_INSTANCE_DELETE";
  GatewayEvent2["TypingStart"] = "TYPING_START";
  GatewayEvent2["UserUpdate"] = "USER_UPDATE";
  GatewayEvent2["VoiceStateUpdate"] = "VOICE_STATE_UPDATE";
  GatewayEvent2["VoiceServerUpdate"] = "VOICE_SERVER_UPDATE";
  GatewayEvent2["WebhookUpdate"] = "WEBHOOK_UPDATE";
})(GatewayEvent || (GatewayEvent = {}));
var GatewayOpCode;
(function(GatewayOpCode2) {
  GatewayOpCode2[GatewayOpCode2["Dispatch"] = 0] = "Dispatch";
  GatewayOpCode2[GatewayOpCode2["Heartbeat"] = 1] = "Heartbeat";
  GatewayOpCode2[GatewayOpCode2["Identify"] = 2] = "Identify";
  GatewayOpCode2[GatewayOpCode2["PresenceUpdate"] = 3] = "PresenceUpdate";
  GatewayOpCode2[GatewayOpCode2["VoiceStateUpdate"] = 4] = "VoiceStateUpdate";
  GatewayOpCode2[GatewayOpCode2["Resume"] = 6] = "Resume";
  GatewayOpCode2[GatewayOpCode2["Reconnect"] = 7] = "Reconnect";
  GatewayOpCode2[GatewayOpCode2["RequestGuildMembers"] = 8] = "RequestGuildMembers";
  GatewayOpCode2[GatewayOpCode2["InvalidSession"] = 9] = "InvalidSession";
  GatewayOpCode2[GatewayOpCode2["Hello"] = 10] = "Hello";
  GatewayOpCode2[GatewayOpCode2["HeartbeatACK"] = 11] = "HeartbeatACK";
})(GatewayOpCode || (GatewayOpCode = {}));
var Intents;
(function(Intents2) {
  Intents2[Intents2["GUILDS"] = 1] = "GUILDS";
  Intents2[Intents2["GUILD_MEMBERS"] = 2] = "GUILD_MEMBERS";
  Intents2[Intents2["GUILD_MODERATION"] = 4] = "GUILD_MODERATION";
  Intents2[Intents2["GUILD_EMOJI_AND_STICKERS"] = 8] = "GUILD_EMOJI_AND_STICKERS";
  Intents2[Intents2["GUILD_INTEGRATIONS"] = 16] = "GUILD_INTEGRATIONS";
  Intents2[Intents2["GUILD_WEBHOOKS"] = 32] = "GUILD_WEBHOOKS";
  Intents2[Intents2["GUILD_INVITES"] = 64] = "GUILD_INVITES";
  Intents2[Intents2["GUILD_VOICE_STATES"] = 128] = "GUILD_VOICE_STATES";
  Intents2[Intents2["GUILD_PRESENCES"] = 256] = "GUILD_PRESENCES";
  Intents2[Intents2["GUILD_MESSAGES"] = 512] = "GUILD_MESSAGES";
  Intents2[Intents2["GUILD_MESSAGE_REACTIONS"] = 1024] = "GUILD_MESSAGE_REACTIONS";
  Intents2[Intents2["GUILD_MESSAGE_TYPING"] = 2048] = "GUILD_MESSAGE_TYPING";
  Intents2[Intents2["DIRECT_MESSAGES"] = 4096] = "DIRECT_MESSAGES";
  Intents2[Intents2["DIRECT_MESSAGE_REACTIONS"] = 8192] = "DIRECT_MESSAGE_REACTIONS";
  Intents2[Intents2["DIRECT_MESSAGE_TYPING"] = 16384] = "DIRECT_MESSAGE_TYPING";
  Intents2[Intents2["MESSAGE_CONTENT"] = 32768] = "MESSAGE_CONTENT";
  Intents2[Intents2["GUILD_SCHEDULED_EVENTS"] = 65536] = "GUILD_SCHEDULED_EVENTS";
  Intents2[Intents2["AUTO_MODERATION_CONFIGURATION"] = 1048576] = "AUTO_MODERATION_CONFIGURATION";
  Intents2[Intents2["AUTO_MODERATION_EXECUTION"] = 2097152] = "AUTO_MODERATION_EXECUTION";
})(Intents || (Intents = {}));
var GatewayCloseEventCode;
(function(GatewayCloseEventCode2) {
  GatewayCloseEventCode2[GatewayCloseEventCode2["UnknownError"] = 4000] = "UnknownError";
  GatewayCloseEventCode2[GatewayCloseEventCode2["UnknownOpCode"] = 4001] = "UnknownOpCode";
  GatewayCloseEventCode2[GatewayCloseEventCode2["DecodeError"] = 4002] = "DecodeError";
  GatewayCloseEventCode2[GatewayCloseEventCode2["NotAuthenticated"] = 4003] = "NotAuthenticated";
  GatewayCloseEventCode2[GatewayCloseEventCode2["AuthenticationFailed"] = 4004] = "AuthenticationFailed";
  GatewayCloseEventCode2[GatewayCloseEventCode2["AlreadyAuthenticated"] = 4005] = "AlreadyAuthenticated";
  GatewayCloseEventCode2[GatewayCloseEventCode2["InvalidSequenceNumber"] = 4007] = "InvalidSequenceNumber";
  GatewayCloseEventCode2[GatewayCloseEventCode2["RateLimited"] = 4008] = "RateLimited";
  GatewayCloseEventCode2[GatewayCloseEventCode2["SessionTimedOut"] = 4009] = "SessionTimedOut";
  GatewayCloseEventCode2[GatewayCloseEventCode2["InvalidShard"] = 4010] = "InvalidShard";
  GatewayCloseEventCode2[GatewayCloseEventCode2["ShardingRequired"] = 4011] = "ShardingRequired";
  GatewayCloseEventCode2[GatewayCloseEventCode2["InvalidAPIVersion"] = 4012] = "InvalidAPIVersion";
  GatewayCloseEventCode2[GatewayCloseEventCode2["InvalidIntents"] = 4013] = "InvalidIntents";
  GatewayCloseEventCode2[GatewayCloseEventCode2["DisallowedIntents"] = 4014] = "DisallowedIntents";
})(GatewayCloseEventCode || (GatewayCloseEventCode = {}));
// node_modules/lilybird/dist/enums/message.js
var MessageType;
(function(MessageType2) {
  MessageType2[MessageType2["DEFAULT"] = 0] = "DEFAULT";
  MessageType2[MessageType2["RECIPIENT_ADD"] = 1] = "RECIPIENT_ADD";
  MessageType2[MessageType2["RECIPIENT_REMOVE"] = 2] = "RECIPIENT_REMOVE";
  MessageType2[MessageType2["CALL"] = 3] = "CALL";
  MessageType2[MessageType2["CHANNEL_NAME_CHANGE"] = 4] = "CHANNEL_NAME_CHANGE";
  MessageType2[MessageType2["CHANNEL_ICON_CHANGE"] = 5] = "CHANNEL_ICON_CHANGE";
  MessageType2[MessageType2["CHANNEL_PINNED_MESSAGE"] = 6] = "CHANNEL_PINNED_MESSAGE";
  MessageType2[MessageType2["USER_JOIN"] = 7] = "USER_JOIN";
  MessageType2[MessageType2["GUILD_BOOST"] = 8] = "GUILD_BOOST";
  MessageType2[MessageType2["GUILD_BOOST_TIER_1"] = 9] = "GUILD_BOOST_TIER_1";
  MessageType2[MessageType2["GUILD_BOOST_TIER_2"] = 10] = "GUILD_BOOST_TIER_2";
  MessageType2[MessageType2["GUILD_BOOST_TIER_3"] = 11] = "GUILD_BOOST_TIER_3";
  MessageType2[MessageType2["CHANNEL_FOLLOW_ADD"] = 12] = "CHANNEL_FOLLOW_ADD";
  MessageType2[MessageType2["GUILD_DISCOVERY_DISQUALIFIED"] = 14] = "GUILD_DISCOVERY_DISQUALIFIED";
  MessageType2[MessageType2["GUILD_DISCOVERY_REQUALIFIED"] = 15] = "GUILD_DISCOVERY_REQUALIFIED";
  MessageType2[MessageType2["GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING"] = 16] = "GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING";
  MessageType2[MessageType2["GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING"] = 17] = "GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING";
  MessageType2[MessageType2["THREAD_CREATED"] = 18] = "THREAD_CREATED";
  MessageType2[MessageType2["REPLY"] = 19] = "REPLY";
  MessageType2[MessageType2["CHAT_INPUT_COMMAND"] = 20] = "CHAT_INPUT_COMMAND";
  MessageType2[MessageType2["THREAD_STARTER_MESSAGE"] = 21] = "THREAD_STARTER_MESSAGE";
  MessageType2[MessageType2["GUILD_INVITE_REMINDER"] = 22] = "GUILD_INVITE_REMINDER";
  MessageType2[MessageType2["CONTEXT_MENU_COMMAND"] = 23] = "CONTEXT_MENU_COMMAND";
  MessageType2[MessageType2["AUTO_MODERATION_ACTION"] = 24] = "AUTO_MODERATION_ACTION";
  MessageType2[MessageType2["ROLE_SUBSCRIPTION_PURCHASE"] = 25] = "ROLE_SUBSCRIPTION_PURCHASE";
  MessageType2[MessageType2["INTERACTION_PREMIUM_UPSELL"] = 26] = "INTERACTION_PREMIUM_UPSELL";
  MessageType2[MessageType2["STAGE_START"] = 27] = "STAGE_START";
  MessageType2[MessageType2["STAGE_END"] = 28] = "STAGE_END";
  MessageType2[MessageType2["STAGE_SPEAKER"] = 29] = "STAGE_SPEAKER";
  MessageType2[MessageType2["STAGE_TOPIC"] = 31] = "STAGE_TOPIC";
  MessageType2[MessageType2["GUILD_APPLICATION_PREMIUM_SUBSCRIPTION"] = 32] = "GUILD_APPLICATION_PREMIUM_SUBSCRIPTION";
})(MessageType || (MessageType = {}));
var MessageFlags;
(function(MessageFlags2) {
  MessageFlags2[MessageFlags2["CROSSPOSTED"] = 1] = "CROSSPOSTED";
  MessageFlags2[MessageFlags2["IS_CROSSPOST"] = 2] = "IS_CROSSPOST";
  MessageFlags2[MessageFlags2["SUPPRESS_EMBEDS"] = 4] = "SUPPRESS_EMBEDS";
  MessageFlags2[MessageFlags2["SOURCE_MESSAGE_DELETED"] = 8] = "SOURCE_MESSAGE_DELETED";
  MessageFlags2[MessageFlags2["URGENT"] = 16] = "URGENT";
  MessageFlags2[MessageFlags2["HAS_THREAD"] = 32] = "HAS_THREAD";
  MessageFlags2[MessageFlags2["EPHEMERAL"] = 64] = "EPHEMERAL";
  MessageFlags2[MessageFlags2["LOADING"] = 128] = "LOADING";
  MessageFlags2[MessageFlags2["FAILED_TO_MENTION_SOME_ROLES_IN_THREAD"] = 256] = "FAILED_TO_MENTION_SOME_ROLES_IN_THREAD";
  MessageFlags2[MessageFlags2["SUPPRESS_NOTIFICATIONS"] = 4096] = "SUPPRESS_NOTIFICATIONS";
  MessageFlags2[MessageFlags2["IS_VOICE_MESSAGE"] = 8192] = "IS_VOICE_MESSAGE";
})(MessageFlags || (MessageFlags = {}));
var AttachmentFlags;
(function(AttachmentFlags2) {
  AttachmentFlags2[AttachmentFlags2["IS_REMIX"] = 4] = "IS_REMIX";
})(AttachmentFlags || (AttachmentFlags = {}));
var EmbedType;
(function(EmbedType2) {
  EmbedType2["Rich"] = "rich";
  EmbedType2["Image"] = "image";
  EmbedType2["Video"] = "video";
  EmbedType2["Gif"] = "gifv";
  EmbedType2["Article"] = "article";
  EmbedType2["Link"] = "link";
})(EmbedType || (EmbedType = {}));
var MessageActivityType;
(function(MessageActivityType2) {
  MessageActivityType2[MessageActivityType2["JOIN"] = 1] = "JOIN";
  MessageActivityType2[MessageActivityType2["SPECTATE"] = 2] = "SPECTATE";
  MessageActivityType2[MessageActivityType2["LISTEN"] = 3] = "LISTEN";
  MessageActivityType2[MessageActivityType2["JOIN_REQUEST"] = 5] = "JOIN_REQUEST";
})(MessageActivityType || (MessageActivityType = {}));
var StickerType;
(function(StickerType2) {
  StickerType2[StickerType2["STANDARD"] = 1] = "STANDARD";
  StickerType2[StickerType2["GUILD"] = 2] = "GUILD";
})(StickerType || (StickerType = {}));
var StickerFormatType;
(function(StickerFormatType2) {
  StickerFormatType2[StickerFormatType2["PNG"] = 1] = "PNG";
  StickerFormatType2[StickerFormatType2["APNG"] = 2] = "APNG";
  StickerFormatType2[StickerFormatType2["LOTTIE"] = 3] = "LOTTIE";
  StickerFormatType2[StickerFormatType2["GIF"] = 4] = "GIF";
})(StickerFormatType || (StickerFormatType = {}));
// node_modules/lilybird/dist/enums/webhook.js
var WebhookType;
(function(WebhookType2) {
  WebhookType2[WebhookType2["Incoming"] = 1] = "Incoming";
  WebhookType2[WebhookType2["ChannelFollower"] = 2] = "ChannelFollower";
  WebhookType2[WebhookType2["Application"] = 3] = "Application";
})(WebhookType || (WebhookType = {}));
// node_modules/lilybird/dist/enums/others.js
var Locale;
(function(Locale2) {
  Locale2["Indonesian"] = "id";
  Locale2["Danish"] = "da";
  Locale2["German"] = "de";
  Locale2["EnglishUK"] = "en-GB";
  Locale2["EnglishUS"] = "en-US";
  Locale2["Spanish"] = "es-ES";
  Locale2["French"] = "fr";
  Locale2["Croatian"] = "hr";
  Locale2["Italian"] = "it";
  Locale2["Lithuanian"] = "lt";
  Locale2["Hungarian"] = "hu";
  Locale2["Dutch"] = "nl";
  Locale2["Norwegian"] = "no";
  Locale2["Polish"] = "pl";
  Locale2["PortugueseBrazilian"] = "pt-BR";
  Locale2["Romanian"] = "ro";
  Locale2["Finnish"] = "fi";
  Locale2["Swedish"] = "sv-SE";
  Locale2["Vietnamese"] = "vi";
  Locale2["Turkish"] = "tr";
  Locale2["Czech"] = "cs";
  Locale2["Greek"] = "el";
  Locale2["Bulgarian"] = "bg";
  Locale2["Russian"] = "ru";
  Locale2["Ukrainian"] = "uk";
  Locale2["Hindi"] = "hi";
  Locale2["Thai"] = "th";
  Locale2["ChineseChina"] = "zh-CN";
  Locale2["Japanese"] = "ja";
  Locale2["ChineseTaiwan"] = "zh-TW";
  Locale2["Korean"] = "ko";
})(Locale || (Locale = {}));
var MembershipState;
(function(MembershipState2) {
  MembershipState2[MembershipState2["INVITED"] = 1] = "INVITED";
  MembershipState2[MembershipState2["ACCEPTED"] = 2] = "ACCEPTED";
})(MembershipState || (MembershipState = {}));
// node_modules/lilybird/dist/enums/guild.js
var VerificationLevel;
(function(VerificationLevel2) {
  VerificationLevel2[VerificationLevel2["NONE"] = 0] = "NONE";
  VerificationLevel2[VerificationLevel2["LOW"] = 1] = "LOW";
  VerificationLevel2[VerificationLevel2["MEDIUM"] = 2] = "MEDIUM";
  VerificationLevel2[VerificationLevel2["HIGH"] = 3] = "HIGH";
  VerificationLevel2[VerificationLevel2["VERY_HIGH"] = 4] = "VERY_HIGH";
})(VerificationLevel || (VerificationLevel = {}));
var DefaultMessageNotificationLevel;
(function(DefaultMessageNotificationLevel2) {
  DefaultMessageNotificationLevel2[DefaultMessageNotificationLevel2["ALL_MESSAGES"] = 0] = "ALL_MESSAGES";
  DefaultMessageNotificationLevel2[DefaultMessageNotificationLevel2["ONLY_MENTIONS"] = 1] = "ONLY_MENTIONS";
})(DefaultMessageNotificationLevel || (DefaultMessageNotificationLevel = {}));
var ExplicitContentFilterLevel;
(function(ExplicitContentFilterLevel2) {
  ExplicitContentFilterLevel2[ExplicitContentFilterLevel2["DISABLED"] = 0] = "DISABLED";
  ExplicitContentFilterLevel2[ExplicitContentFilterLevel2["MEMBERS_WITHOUT_ROLES"] = 1] = "MEMBERS_WITHOUT_ROLES";
  ExplicitContentFilterLevel2[ExplicitContentFilterLevel2["ALL_MEMBERS"] = 2] = "ALL_MEMBERS";
})(ExplicitContentFilterLevel || (ExplicitContentFilterLevel = {}));
var MFALevel;
(function(MFALevel2) {
  MFALevel2[MFALevel2["NONE"] = 0] = "NONE";
  MFALevel2[MFALevel2["ELEVATED"] = 1] = "ELEVATED";
})(MFALevel || (MFALevel = {}));
var SystemChannelFlags;
(function(SystemChannelFlags2) {
  SystemChannelFlags2[SystemChannelFlags2["SUPPRESS_JOIN_NOTIFICATIONS"] = 1] = "SUPPRESS_JOIN_NOTIFICATIONS";
  SystemChannelFlags2[SystemChannelFlags2["SUPPRESS_PREMIUM_SUBSCRIPTIONS"] = 2] = "SUPPRESS_PREMIUM_SUBSCRIPTIONS";
  SystemChannelFlags2[SystemChannelFlags2["SUPPRESS_GUILD_REMINDER_NOTIFICATIONS"] = 4] = "SUPPRESS_GUILD_REMINDER_NOTIFICATIONS";
  SystemChannelFlags2[SystemChannelFlags2["SUPPRESS_JOIN_NOTIFICATION_REPLIES"] = 8] = "SUPPRESS_JOIN_NOTIFICATION_REPLIES";
  SystemChannelFlags2[SystemChannelFlags2["SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATIONS"] = 16] = "SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATIONS";
  SystemChannelFlags2[SystemChannelFlags2["SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATION_REPLIES"] = 32] = "SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATION_REPLIES";
})(SystemChannelFlags || (SystemChannelFlags = {}));
var PremiumTier;
(function(PremiumTier2) {
  PremiumTier2[PremiumTier2["NONE"] = 0] = "NONE";
  PremiumTier2[PremiumTier2["TIER_1"] = 1] = "TIER_1";
  PremiumTier2[PremiumTier2["TIER_2"] = 2] = "TIER_2";
  PremiumTier2[PremiumTier2["TIER_3"] = 3] = "TIER_3";
})(PremiumTier || (PremiumTier = {}));
var GuildNSFWLevel;
(function(GuildNSFWLevel2) {
  GuildNSFWLevel2[GuildNSFWLevel2["DEFAULT"] = 0] = "DEFAULT";
  GuildNSFWLevel2[GuildNSFWLevel2["EXPLICIT"] = 1] = "EXPLICIT";
  GuildNSFWLevel2[GuildNSFWLevel2["SAFE"] = 2] = "SAFE";
  GuildNSFWLevel2[GuildNSFWLevel2["AGE_RESTRICTED"] = 3] = "AGE_RESTRICTED";
})(GuildNSFWLevel || (GuildNSFWLevel = {}));
var GuildMemberFlags;
(function(GuildMemberFlags2) {
  GuildMemberFlags2[GuildMemberFlags2["DID_REJOIN"] = 1] = "DID_REJOIN";
  GuildMemberFlags2[GuildMemberFlags2["COMPLETED_ONBOARDING"] = 2] = "COMPLETED_ONBOARDING";
  GuildMemberFlags2[GuildMemberFlags2["BYPASSES_VERIFICATION"] = 4] = "BYPASSES_VERIFICATION";
  GuildMemberFlags2[GuildMemberFlags2["STARTED_ONBOARDING"] = 8] = "STARTED_ONBOARDING";
})(GuildMemberFlags || (GuildMemberFlags = {}));
var IntegrationExpireBehavior;
(function(IntegrationExpireBehavior2) {
  IntegrationExpireBehavior2[IntegrationExpireBehavior2["RemoveRole"] = 0] = "RemoveRole";
  IntegrationExpireBehavior2[IntegrationExpireBehavior2["Role"] = 1] = "Role";
})(IntegrationExpireBehavior || (IntegrationExpireBehavior = {}));
var InviteTargetType;
(function(InviteTargetType2) {
  InviteTargetType2[InviteTargetType2["STREAM"] = 1] = "STREAM";
  InviteTargetType2[InviteTargetType2["EMBEDDED_APPLICATION"] = 2] = "EMBEDDED_APPLICATION";
})(InviteTargetType || (InviteTargetType = {}));
var RoleFlags;
(function(RoleFlags2) {
  RoleFlags2[RoleFlags2["IN_PROMPT"] = 1] = "IN_PROMPT";
})(RoleFlags || (RoleFlags = {}));
var PrivacyLevel;
(function(PrivacyLevel2) {
  PrivacyLevel2[PrivacyLevel2["PUBLIC"] = 1] = "PUBLIC";
  PrivacyLevel2[PrivacyLevel2["GUILD_ONLY"] = 2] = "GUILD_ONLY";
})(PrivacyLevel || (PrivacyLevel = {}));
var OnboardingMode;
(function(OnboardingMode2) {
  OnboardingMode2[OnboardingMode2["ONBOARDING_DEFAULT"] = 0] = "ONBOARDING_DEFAULT";
  OnboardingMode2[OnboardingMode2["ONBOARDING_ADVANCED"] = 1] = "ONBOARDING_ADVANCED";
})(OnboardingMode || (OnboardingMode = {}));
var PromptType;
(function(PromptType2) {
  PromptType2[PromptType2["MULTIPLE_CHOICE"] = 0] = "MULTIPLE_CHOICE";
  PromptType2[PromptType2["DROPDOWN"] = 1] = "DROPDOWN";
})(PromptType || (PromptType = {}));
// node_modules/lilybird/dist/enums/image.js
var ImageFormat;
(function(ImageFormat2) {
  ImageFormat2["JPEG"] = ".jpg";
  ImageFormat2["PNG"] = ".png";
  ImageFormat2["WebP"] = ".webp";
  ImageFormat2["GIF"] = ".gif";
  ImageFormat2["Lottie"] = ".json";
})(ImageFormat || (ImageFormat = {}));
var ImageDataType;
(function(ImageDataType2) {
  ImageDataType2["JPEG"] = "image/jpeg";
  ImageDataType2["PNG"] = "image/png";
  ImageDataType2["GIF"] = "image/gif";
})(ImageDataType || (ImageDataType = {}));
// node_modules/lilybird/dist/enums/user.js
var UserFlags;
(function(UserFlags2) {
  UserFlags2[UserFlags2["STAFF"] = 1] = "STAFF";
  UserFlags2[UserFlags2["PARTNER"] = 2] = "PARTNER";
  UserFlags2[UserFlags2["HYPESQUAD"] = 4] = "HYPESQUAD";
  UserFlags2[UserFlags2["BUG_HUNTER_LEVEL_1"] = 8] = "BUG_HUNTER_LEVEL_1";
  UserFlags2[UserFlags2["HYPESQUAD_ONLINE_HOUSE_1"] = 64] = "HYPESQUAD_ONLINE_HOUSE_1";
  UserFlags2[UserFlags2["HYPESQUAD_ONLINE_HOUSE_2"] = 128] = "HYPESQUAD_ONLINE_HOUSE_2";
  UserFlags2[UserFlags2["HYPESQUAD_ONLINE_HOUSE_3"] = 256] = "HYPESQUAD_ONLINE_HOUSE_3";
  UserFlags2[UserFlags2["PREMIUM_EARLY_SUPPORTER"] = 512] = "PREMIUM_EARLY_SUPPORTER";
  UserFlags2[UserFlags2["TEAM_PSEUDO_USER"] = 1024] = "TEAM_PSEUDO_USER";
  UserFlags2[UserFlags2["BUG_HUNTER_LEVEL_2"] = 16384] = "BUG_HUNTER_LEVEL_2";
  UserFlags2[UserFlags2["VERIFIED_BOT"] = 65536] = "VERIFIED_BOT";
  UserFlags2[UserFlags2["VERIFIED_DEVELOPER"] = 131072] = "VERIFIED_DEVELOPER";
  UserFlags2[UserFlags2["CERTIFIED_MODERATOR"] = 262144] = "CERTIFIED_MODERATOR";
  UserFlags2[UserFlags2["BOT_HTTP_INTERACTIONS"] = 524288] = "BOT_HTTP_INTERACTIONS";
  UserFlags2[UserFlags2["ACTIVE_DEVELOPER"] = 4194304] = "ACTIVE_DEVELOPER";
})(UserFlags || (UserFlags = {}));
var PremiumType;
(function(PremiumType2) {
  PremiumType2[PremiumType2["None"] = 0] = "None";
  PremiumType2[PremiumType2["NitroClassic"] = 1] = "NitroClassic";
  PremiumType2[PremiumType2["Nitro"] = 2] = "Nitro";
  PremiumType2[PremiumType2["NitroBasic"] = 3] = "NitroBasic";
})(PremiumType || (PremiumType = {}));
// node_modules/lilybird/package.json
var version = "0.5.2";

// node_modules/lilybird/dist/http/rest.js
class RestError extends Error {
  code;
  errors;
  constructor(error) {
    super(error.message);
    this.code = error.code;
    this.errors = error.errors;
  }
}

class REST {
  static BaseURL = "https://discord.com/api/v10/";
  #token;
  #headers;
  constructor(token) {
    if (typeof token === "undefined")
      return;
    this.#token = token;
    this.#buildHeaders();
  }
  async#makeAPIRequest(method, path, data, filesOrReason) {
    const opts = {
      method,
      headers: { ...this.#headers }
    };
    if (data instanceof FormData) {
      opts.body = data;
      if (typeof filesOrReason !== "undefined") {
        opts.headers["X-Audit-Log-Reason"] = filesOrReason;
      }
    } else if (typeof data !== "undefined") {
      let reason;
      let obj;
      if ("reason" in data) {
        const { reason: rReason, ...oObj } = data;
        reason = rReason;
        obj = oObj;
      } else
        obj = data;
      if (typeof filesOrReason !== "undefined" && typeof filesOrReason !== "string" && filesOrReason.length > 0) {
        const temp = [];
        const form = new FormData;
        for (let i = 0, { length } = filesOrReason;i < length; i++) {
          form.append(`files[${i}]`, filesOrReason[i].file, filesOrReason[i].name);
          temp.push({
            id: i,
            filename: filesOrReason[i].name
          });
        }
        if ("data" in obj)
          obj.data.attachments = [...temp, ...obj.data.attachments ?? []];
        else
          obj.attachments = [...temp, ...obj.attachments ?? []];
        form.append("payload_json", JSON.stringify(obj));
        opts.body = form;
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(data);
      }
      if (typeof reason !== "undefined") {
        opts.headers["X-Audit-Log-Reason"] = reason;
      }
    }
    const response = await fetch(`${REST.BaseURL}${path}`, opts);
    if (!response.ok) {
      const errorMessage = await response.json();
      throw new RestError(errorMessage);
    }
    if (response.status === 204)
      return null;
    return await response.json();
  }
  #buildHeaders() {
    this.#headers = {
      Authorization: `Bot ${this.#token}`,
      "User-Agent": `DiscordBot/LilyBird/${version}`
    };
  }
  setToken(token) {
    this.#token = token;
    this.#buildHeaders();
  }
  async getGateway() {
    return this.#makeAPIRequest("GET", "gateway");
  }
  async getGatewayBot() {
    return this.#makeAPIRequest("GET", "gateway/bot");
  }
  async getGlobalApplicationCommands(clientId, withLocalizations = false) {
    return this.#makeAPIRequest("GET", `applications/${clientId}/commands?with_localizations=${withLocalizations}`);
  }
  async createGlobalApplicationCommand(clientId, body) {
    return this.#makeAPIRequest("POST", `applications/${clientId}/commands`, body);
  }
  async getGlobalApplicationCommand(clientId, commandId) {
    return this.#makeAPIRequest("GET", `applications/${clientId}/commands/${commandId}`);
  }
  async editGlobalApplicationCommand(clientId, commandId, body) {
    return this.#makeAPIRequest("PATCH", `applications/${clientId}/commands/${commandId}`, body);
  }
  async deleteGlobalApplicationCommand(clientId, commandId) {
    return this.#makeAPIRequest("DELETE", `applications/${clientId}/commands/${commandId}`);
  }
  async bulkOverwriteGlobalApplicationCommand(clientId, body) {
    return this.#makeAPIRequest("PUT", `applications/${clientId}/commands`, body);
  }
  async getGuildApplicationCommands(clientId, withLocalizations = false) {
    return this.#makeAPIRequest("GET", `applications/${clientId}/commands?with_localizations=${withLocalizations}`);
  }
  async createGuildApplicationCommand(clientId, guildId, body) {
    return this.#makeAPIRequest("POST", `applications/${clientId}/guilds/${guildId}/commands`, body);
  }
  async getGuildApplicationCommand(clientId, guildId, commandId) {
    return this.#makeAPIRequest("POST", `applications/${clientId}/guilds/${guildId}/commands/${commandId}`);
  }
  async editGuildApplicationCommand(clientId, guildId, commandId, body) {
    return this.#makeAPIRequest("PATCH", `applications/${clientId}/guilds/${guildId}/commands/${commandId}`, body);
  }
  async deleteGuildApplicationCommand(clientId, guildId, commandId) {
    return this.#makeAPIRequest("DELETE", `applications/${clientId}/guilds/${guildId}/commands/${commandId}`);
  }
  async bulkOverwriteGuildApplicationCommand(clientId, guildId, body) {
    return this.#makeAPIRequest("PATCH", `applications/${clientId}/guilds/${guildId}/commands`, body);
  }
  async getGuildApplicationCommandPermissions(clientId, guildId) {
    return this.#makeAPIRequest("GET", `applications/${clientId}/guilds/${guildId}/commands/permissions`);
  }
  async getApplicationCommandPermissions(clientId, guildId, commandId) {
    return this.#makeAPIRequest("GET", `applications/${clientId}/guilds/${guildId}/commands/${commandId}/permissions`);
  }
  async editApplicationCommandPermissions(clientId, guildId, commandId, body) {
    return this.#makeAPIRequest("PATCH", `applications/${clientId}/guilds/${guildId}/commands/${commandId}/permissions`, body);
  }
  async createInteractionResponse(interactionId, interactionToken, body, files) {
    return this.#makeAPIRequest("POST", `interactions/${interactionId}/${interactionToken}/callback`, body, files);
  }
  async getOriginalInteractionResponse(clientId, interactionToken) {
    return this.#makeAPIRequest("GET", `webhooks/${clientId}/${interactionToken}/messages/@original`);
  }
  async editOriginalInteractionResponse(clientId, interactionToken, body, files) {
    return this.#makeAPIRequest("PATCH", `webhooks/${clientId}/${interactionToken}/messages/@original`, body, files);
  }
  async deleteOriginalInteractionResponse(clientId, interactionToken) {
    return this.#makeAPIRequest("DELETE", `webhooks/${clientId}/${interactionToken}/messages/@original`);
  }
  async createFollowupMessage(clientId, interactionToken, body, files) {
    return this.#makeAPIRequest("POST", `webhooks/${clientId}/${interactionToken}`, body, files);
  }
  async getFollowupMessage(clientId, interactionToken, messageId) {
    return this.#makeAPIRequest("GET", `webhooks/${clientId}/${interactionToken}/messages/${messageId}`);
  }
  async editFollowupMessage(clientId, interactionToken, messageId, body, files) {
    return this.#makeAPIRequest("PATCH", `webhooks/${clientId}/${interactionToken}/messages/${messageId}`, body, files);
  }
  async deleteFollowupMessage(clientId, interactionToken, messageId) {
    return this.#makeAPIRequest("DELETE", `webhooks/${clientId}/${interactionToken}/messages/${messageId}`);
  }
  async getCurrentApplication() {
    return this.#makeAPIRequest("GET", "applications/@me");
  }
  async editCurrentApplication(app) {
    return this.#makeAPIRequest("PATCH", "applications/@me", app);
  }
  async getGuildAuditLog(guildId, params) {
    let url = `guilds/${guildId}/audit-logs?`;
    if (typeof params.user_id !== "undefined")
      url += `user_id=${params.user_id}&`;
    if (typeof params.action_type !== "undefined")
      url += `action_type=${params.action_type}&`;
    if (typeof params.before !== "undefined")
      url += `before=${params.before}&`;
    if (typeof params.after !== "undefined")
      url += `after=${params.after}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async getChannel(channelId) {
    return this.#makeAPIRequest("GET", `channels/${channelId}`);
  }
  async modifyChannel(channelId, body) {
    return this.#makeAPIRequest("PATCH", `channels/${channelId}`, body);
  }
  async deleteChannel(channelId, reason) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}`, { reason });
  }
  async getChannelMessages(channelId, params) {
    let url = `channels/${channelId}/messages?`;
    if (typeof params.around !== "undefined")
      url += `around=${params.around}&`;
    if (typeof params.before !== "undefined")
      url += `before=${params.before}&`;
    if (typeof params.after !== "undefined")
      url += `after=${params.after}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async getChannelMessage(channelId, messageId) {
    return this.#makeAPIRequest("GET", `channels/${channelId}/messages/${messageId}`);
  }
  async createMessage(channelId, body, files) {
    return this.#makeAPIRequest("POST", `channels/${channelId}/messages`, body, files);
  }
  async crosspostMessage(channelId, messageId) {
    return this.#makeAPIRequest("POST", `channels/${channelId}/messages/${messageId}/crosspost`);
  }
  async createReaction(channelId, messageId, emoji, isCustom = false) {
    if (!isCustom)
      emoji = encodeURIComponent(emoji);
    return this.#makeAPIRequest("PUT", `channels/${channelId}/messages/${messageId}/reactions/${emoji}/@me`);
  }
  async deleteOwnReaction(channelId, messageId, emoji, isCustom = false) {
    if (!isCustom)
      emoji = encodeURIComponent(emoji);
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/messages/${messageId}/reactions/${emoji}/@me`);
  }
  async deleteUserReaction(channelId, messageId, userId, emoji, isCustom = false) {
    if (!isCustom)
      emoji = encodeURIComponent(emoji);
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/messages/${messageId}/reactions/${emoji}/${userId}`);
  }
  async getReactions(channelId, messageId, emoji, isCustom = false, params = {}) {
    if (!isCustom)
      emoji = encodeURIComponent(emoji);
    let url = `channels/${channelId}/messages/${messageId}/reactions/${emoji}?`;
    if (typeof params.after !== "undefined")
      url += `after=${params.after}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async deleteAllReactions(channelId, messageId) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/messages/${messageId}/reactions`);
  }
  async deleteAllReactionsForEmoji(channelId, messageId, emoji, isCustom = false) {
    if (!isCustom)
      emoji = encodeURIComponent(emoji);
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/messages/${messageId}/reactions/${emoji}`);
  }
  async editMessage(channelId, messageId, body, files) {
    return this.#makeAPIRequest("PATCH", `channels/${channelId}/messages/${messageId}`, body, files);
  }
  async deleteMessage(channelId, messageId, reason) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/messages/${messageId}`, { reason });
  }
  async bulkDeleteMessages(channelId, messageIds, reason) {
    return this.#makeAPIRequest("POST", `channels/${channelId}/messages/bulk-delete`, { messages: messageIds, reason });
  }
  async editChannelPermissions(channelId, overwriteId, params) {
    return this.#makeAPIRequest("PUT", `channels/${channelId}/permissions/${overwriteId}`, params);
  }
  async getChannelInvites(channelId) {
    return this.#makeAPIRequest("GET", `channels/${channelId}/invites`);
  }
  async createChannelInvite(channelId, body) {
    return this.#makeAPIRequest("POST", `channels/${channelId}/invites`, body);
  }
  async deleteChannelPermission(channelId, overwriteId, reason) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/permissions/${overwriteId}`, { reason });
  }
  async followAnnouncementChannel(channelId, body) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/followers`, body);
  }
  async triggerTypingIndicator(channelId) {
    return this.#makeAPIRequest("POST", `channels/${channelId}/typing`);
  }
  async getPinnedMessages(channelId) {
    return this.#makeAPIRequest("GET", `channels/${channelId}/pins`);
  }
  async pinMessage(channelId, messageId, reason) {
    return this.#makeAPIRequest("PUT", `channels/${channelId}/pins/${messageId}`, { reason });
  }
  async unpinMessage(channelId, messageId, reason) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/pins/${messageId}`, { reason });
  }
  async groupDMAddRecipient(channelId, userId, body) {
    return this.#makeAPIRequest("PUT", `channels/${channelId}/recipients/${userId}`, body);
  }
  async groupDMRemoveRecipient(channelId, userId) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/recipients/${userId}`);
  }
  async startThreadFromMessage(channelId, messageId, body) {
    return this.#makeAPIRequest("POST", `channels/${channelId}/messages/${messageId}/threads`, body);
  }
  async startThreadWithoutMessage(channelId, body) {
    return this.#makeAPIRequest("POST", `channels/${channelId}/threads`, body);
  }
  async startThreadInForumOrMediaChannel(channelId, body, files) {
    return this.#makeAPIRequest("POST", `channels/${channelId}/threads`, body, files);
  }
  async joinThread(channelId) {
    return this.#makeAPIRequest("PUT", `channels/${channelId}/thread-members/@me`);
  }
  async addThreadMember(channelId, userId) {
    return this.#makeAPIRequest("PUT", `channels/${channelId}/thread-members/${userId}`);
  }
  async leaveThread(channelId) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/thread-members/@me`);
  }
  async removeThreadMember(channelId, userId) {
    return this.#makeAPIRequest("DELETE", `channels/${channelId}/thread-members/${userId}`);
  }
  async getThreadMember(channelId, userId, withMember = false) {
    return this.#makeAPIRequest("GET", `channels/${channelId}/thread-members/${userId}?with_member=${withMember}`);
  }
  async listThreadMembers(channelId, params = {}) {
    let url = `channels/${channelId}/thread-members`;
    if (typeof params.after !== "undefined")
      url += `after=${params.after}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async listPublicArchivedThreads(channelId, params = {}) {
    let url = `channels/${channelId}/threads/archived/public`;
    if (typeof params.before !== "undefined")
      url += `before=${params.before}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async listPrivateArchivedThreads(channelId, params = {}) {
    let url = `channels/${channelId}/threads/archived/private`;
    if (typeof params.before !== "undefined")
      url += `before=${params.before}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async listJoinedPrivateArchivedThreads(channelId, params = {}) {
    let url = `channels/${channelId}/users/@me/threads/archived/private`;
    if (typeof params.before !== "undefined")
      url += `before=${params.before}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async listGuildEmojis(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/emojis`);
  }
  async getGuildEmoji(guildId, emojiId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/emojis/${emojiId}`);
  }
  async createGuildEmoji(guildId, params) {
    return this.#makeAPIRequest("POST", `guilds/${guildId}/emojis`, params);
  }
  async modifyGuildEmoji(guildId, emojiId, params) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/emojis/${emojiId}`, params);
  }
  async deleteGuildEmoji(guildId, emojiId, reason) {
    return this.#makeAPIRequest("DELETE", `guilds/${guildId}/emojis/${emojiId}`, { reason });
  }
  async createGuild(body) {
    return this.#makeAPIRequest("POST", "guilds", body);
  }
  async getGuild(guildId, withCounts = false) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}?with_counts=${withCounts}`);
  }
  async getGuildPreview(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/preview`);
  }
  async modifyGuild(guildId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}`, body);
  }
  async deleteGuild(guildId) {
    return this.#makeAPIRequest("DELETE", `guilds/${guildId}`);
  }
  async getGuildChannels(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/channels`);
  }
  async createGuildChannel(guildId, body) {
    return this.#makeAPIRequest("POST", `guilds/${guildId}/channels`, body);
  }
  async modifyGuildChannelPositions(guildId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/channels`, body);
  }
  async listActiveGuildThreads(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/threads/active`);
  }
  async getGuildMember(guildId, userId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/members/${userId}`);
  }
  async listGuildMembers(guildId, params) {
    let url = `guilds/${guildId}/members`;
    if (typeof params.after !== "undefined")
      url += `after=${params.after}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async searchGuildMembers(guildId, params) {
    let url = `guilds/${guildId}/members/search`;
    if (typeof params.query !== "undefined")
      url += `query=${params.query}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async addGuildMember(guildId, userId, body) {
    return this.#makeAPIRequest("PUT", `guilds/${guildId}/members/${userId}`, body);
  }
  async modifyGuildMember(guildId, userId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/members/${userId}`, body);
  }
  async modifyCurrentMember(guildId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/members/@me`, body);
  }
  async addGuildMemberRole(guildId, userId, roleId, reason) {
    return this.#makeAPIRequest("PUT", `guilds/${guildId}/members/${userId}/roles/${roleId}`, { reason });
  }
  async removeGuildMemberRole(guildId, userId, roleId, reason) {
    return this.#makeAPIRequest("DELETE", `guilds/${guildId}/members/${userId}/roles/${roleId}`, { reason });
  }
  async removeGuildMember(guildId, userId, reason) {
    return this.#makeAPIRequest("DELETE", `guilds/${guildId}/members/${userId}`, { reason });
  }
  async getGuildBans(guildId, params) {
    let url = `guilds/${guildId}/bans`;
    if (typeof params.before !== "undefined")
      url += `before=${params.before}&`;
    if (typeof params.after !== "undefined")
      url += `after=${params.after}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async getGuildBan(guildId, userId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/bans/${userId}`);
  }
  async createGuildBan(guildId, userId, body) {
    return this.#makeAPIRequest("PUT", `guilds/${guildId}/bans/${userId}`, body);
  }
  async removeGuildBan(guildId, userId, reason) {
    return this.#makeAPIRequest("PUT", `guilds/${guildId}/bans/${userId}`, { reason });
  }
  async getGuildRoles(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/roles`);
  }
  async createGuildRole(guildId, body) {
    return this.#makeAPIRequest("POST", `guilds/${guildId}/roles`, body);
  }
  async modifyGuildRolePosition(guildId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/roles`, body);
  }
  async modifyGuildRole(guildId, roleId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/roles/${roleId}`, body);
  }
  async modifyGuildMFALevel(guildId, level) {
    return this.#makeAPIRequest("POST", `guilds/${guildId}/mfa`, { level });
  }
  async deleteGuildRole(guildId, roleId, reason) {
    return this.#makeAPIRequest("DELETE", `guilds/${guildId}/roles/${roleId}`, { reason });
  }
  async getGuildPruneCount(guildId, params) {
    let url = `guilds/${guildId}/prune`;
    if (typeof params.days !== "undefined")
      url += `days=${params.days}&`;
    if (typeof params.include_roles !== "undefined")
      url += `include_roles=${params.include_roles}`;
    return this.#makeAPIRequest("GET", url);
  }
  async beginGuildPrune(guildId, body) {
    return this.#makeAPIRequest("POST", `guilds/${guildId}/prune`, body);
  }
  async getGuildVoiceRegions(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/regions`);
  }
  async getGuildInvites(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/invites`);
  }
  async getGuildIntegrations(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/integrations`);
  }
  async deleteGuildIntegration(guildId, integrationId, reason) {
    return this.#makeAPIRequest("DELETE", `guilds/${guildId}/integrations/${integrationId}`, { reason });
  }
  async getGuildWidgetSettings(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/widget`);
  }
  async modifyGuildWidget(guildId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/widget`, body);
  }
  async getGuildWidget(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/widget.json`);
  }
  async getGuildVanityUrl(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/vanity-url`);
  }
  async getGuildWidgetImage(guildId, style = "shield") {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/widget.png?style=${style}`);
  }
  async getGuildWelcomeScreen(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/welcome-screen`);
  }
  async modifyGuildWelcomeScreen(guildId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/welcome-screen`, body);
  }
  async getGuildOnboarding(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/onboarding`);
  }
  async modifyGuildOnboarding(guildId, body) {
    return this.#makeAPIRequest("PUT", `guilds/${guildId}/onboarding`, body);
  }
  async modifyCurrentUserVoiceState(guildId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/voice-states/@me`, body);
  }
  async modifyUserVoiceState(guildId, userId, body) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/voice-states/${userId}`, body);
  }
  async getInvite(inviteCode) {
    return this.#makeAPIRequest("GET", `invites/${inviteCode}`);
  }
  async deleteInvite(inviteCode, reason) {
    return this.#makeAPIRequest("DELETE", `invites/${inviteCode}`, { reason });
  }
  async getSticker(stickerId) {
    return this.#makeAPIRequest("GET", `stickers/${stickerId}`);
  }
  async listStickerPacks() {
    return this.#makeAPIRequest("GET", "sticker-packs");
  }
  async listGuildStickers(guildId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/stickers`);
  }
  async getGuildSticker(guildId, stickerId) {
    return this.#makeAPIRequest("GET", `guilds/${guildId}/stickers/${stickerId}`);
  }
  async createGuildSticker(guildId, stickerId, params) {
    const form = new FormData;
    const { reason, ...obj } = params;
    for (const key in obj)
      form.append(key, obj[key]);
    return this.#makeAPIRequest("POST", `guilds/${guildId}/stickers/${stickerId}`, form, reason);
  }
  async modifyGuildSticker(guildId, stickerId, params) {
    return this.#makeAPIRequest("PATCH", `guilds/${guildId}/stickers/${stickerId}`, params);
  }
  async deleteGuildSticker(guildId, stickerId, reason) {
    return this.#makeAPIRequest("DELETE", `guilds/${guildId}/stickers/${stickerId}`, { reason });
  }
  async getCurrentUser() {
    return this.#makeAPIRequest("GET", "users/@me");
  }
  async getUser(userId) {
    return this.#makeAPIRequest("GET", `users/${userId}`);
  }
  async modifyCurrentUser(body) {
    return this.#makeAPIRequest("PATCH", "users/@me", body);
  }
  async getCurrentUserGuilds(params) {
    let url = "users/@me/guilds?";
    if (typeof params.withCounts !== "undefined")
      url += `with_counts=${params.withCounts}&`;
    if (typeof params.before !== "undefined")
      url += `before=${params.before}&`;
    if (typeof params.after !== "undefined")
      url += `after=${params.after}&`;
    if (typeof params.limit !== "undefined")
      url += `limit=${params.limit}`;
    return this.#makeAPIRequest("GET", url);
  }
  async getCurrentUserGuildMember(guildId) {
    return this.#makeAPIRequest("GET", `users/@me/guilds/${guildId}/member`);
  }
  async leaveGuild(guildId) {
    return this.#makeAPIRequest("DELETE", `users/@me/guilds/${guildId}`);
  }
  async createDM(userId) {
    return this.#makeAPIRequest("POST", "users/@me/channels", { recipient_id: userId });
  }
  async createGroupDM(tokens, nicks) {
    return this.#makeAPIRequest("POST", "users/@me/channels", { access_tokens: tokens, nicks });
  }
}

// node_modules/lilybird/dist/ws/manager.js
import {setTimeout} from "timers/promises";
var closeCodeAllowsReconnection = function(code) {
  return code >= 4000 && code !== 4004 && code < 4010;
};

class WebSocketManager {
  #dispatch;
  #debug;
  #sequenceNumber = null;
  #isResuming = false;
  #ws;
  #gatewayInfo;
  #options;
  #timer;
  #gotACK = true;
  resumeInfo = {};
  constructor(options, dispatch, debug) {
    if (!options.intents)
      throw new Error("No intents were passed");
    this.#dispatch = dispatch;
    this.#debug = debug;
    this.#options = options;
  }
  close() {
    this.#ws.close(1000);
  }
  async connect(url) {
    if (typeof this.#gatewayInfo === "undefined") {
      const response = await fetch("https://discord.com/api/v10/gateway/bot", {
        headers: {
          Authorization: `Bot ${this.#options.token}`
        }
      });
      if (!response.ok)
        throw new Error("An invalid Token was provided");
      const data = await response.json();
      data.url = `${data.url}/?v=10&encoding=json`;
      this.#gatewayInfo = data;
    }
    this.#ws = new WebSocket(url ?? this.#gatewayInfo.url);
    this.#ws.addEventListener("error", (err) => {
      this.#debug?.("ERROR", err);
    });
    this.#ws.addEventListener("close", async ({ code }) => {
      this.#clearTimer();
      if (typeof code === "undefined" || code === 1001 || closeCodeAllowsReconnection(code)) {
        await this.#attemptResume();
        return;
      }
      this.#debug?.("UNKNOWN_CODE", code);
      this.#isResuming = false;
      await this.connect();
    });
    this.#ws.addEventListener("message", (event) => {
      this.#debug?.("WS_MESSAGE", event.data);
      const payload = JSON.parse(event.data.toString());
      if (typeof payload.s === "number")
        this.#sequenceNumber = payload.s;
      switch (payload.op) {
        case 0: {
          this.#dispatch(payload);
          break;
        }
        case 10: {
          const interval = Math.round(payload.d.heartbeat_interval * Math.random());
          this.#startTimer(interval);
          if (!this.#isResuming)
            this.#identify();
          else
            this.#resume();
          break;
        }
        case 1: {
          this.#debug?.("NEED_HEARTBEAT");
          this.#sendHeartbeatPayload();
          break;
        }
        case 7: {
          this.#debug?.("RECONNECT");
          this.#ws.close(1001);
          break;
        }
        case 9: {
          this.#debug?.("INVALID_SESSION");
          if (payload.d)
            this.#ws.close(1001);
          else
            this.#ws.close(1000);
          break;
        }
        case 11: {
          this.#gotACK = true;
          this.#debug?.("ACK");
          break;
        }
        default:
          break;
      }
      return;
    });
  }
  #sendHeartbeatPayload() {
    this.#gotACK = false;
    this.#ws.send(`{ "op": 1, "d": ${this.#sequenceNumber}, "s": null, "t": null }`);
  }
  #identify() {
    if (typeof this.#options.token === "undefined")
      throw new Error("No token was found");
    const payload = {
      op: 2,
      d: {
        token: this.#options.token,
        intents: this.#options.intents,
        properties: {
          os: process.platform,
          browser: "LilyBird",
          device: "LilyBird"
        },
        presence: this.#options.presence
      },
      s: null,
      t: null
    };
    this.#debug?.("IDENTIFY");
    this.#ws.send(JSON.stringify(payload));
  }
  #resume() {
    const payload = {
      op: 6,
      d: {
        token: this.#options.token,
        session_id: this.resumeInfo.id,
        seq: this.#sequenceNumber ?? 0
      },
      s: null,
      t: null
    };
    this.#debug?.("RESUME");
    this.#ws.send(JSON.stringify(payload));
  }
  #startTimer(interval) {
    this.#gotACK = true;
    this.#timer = setInterval(async () => {
      if (!this.#gotACK) {
        this.#debug?.("MISSING_ACK");
        await setTimeout(500);
        if (!this.#gotACK) {
          this.#debug?.("ZOMBIE");
          this.#ws.close(1001);
          return;
        }
      }
      this.#debug?.("HEARTBEAT");
      this.#sendHeartbeatPayload();
    }, interval);
  }
  #clearTimer() {
    if (typeof this.#timer === "undefined")
      return;
    clearInterval(this.#timer);
  }
  async#attemptResume() {
    this.#debug?.("ATTEMPTING_RESUME");
    this.#isResuming = true;
    await this.connect(`${this.resumeInfo.url}/?v=10&encoding=json`);
  }
  async ping() {
    return new Promise((res) => {
      this.#ws.addEventListener("pong", () => {
        res(Math.round(performance.now() - start));
      }, { once: true });
      const start = performance.now();
      this.#ws.ping();
    });
  }
  updatePresence(presence) {
    const options = {
      op: 3,
      d: presence,
      s: null,
      t: null
    };
    this.#ws.send(JSON.stringify(options));
  }
  set options(options) {
    this.#options = { ...this.#options, ...options };
  }
  get options() {
    return this.#options;
  }
}

// node_modules/lilybird/dist/client.js
async function createClient(options) {
  return new Promise((res) => {
    new Client(res, { intents: options.intents, listeners: options.listeners, setup: options.setup }, options.attachDebugListener ? options.debugListener ?? ((identifier, payload) => {
      console.log(identifier, payload ?? "");
    }) : undefined).login(options.token);
  });
}

class Client {
  rest = new REST;
  #ws;
  constructor(res, options, debug) {
    if (Array.isArray(options.intents))
      options.intents = options.intents.reduce((prev, curr) => prev | curr, 0);
    this.#ws = new WebSocketManager({
      intents: options.intents,
      presence: options.presence
    }, async (data) => {
      await options.listeners.raw?.(data.d);
      switch (data.t) {
        case "READY": {
          Object.assign(this, {
            user: new User(this, data.d.user),
            guilds: data.d.guilds,
            sessionId: data.d.session_id,
            application: data.d.application
          });
          Object.assign(this.#ws.resumeInfo, {
            url: data.d.resume_gateway_url,
            id: data.d.session_id
          });
          await options.setup?.(this);
          res(this);
          await options.listeners.ready?.(this, data.d);
          break;
        }
        case "RESUMED": {
          await options.listeners.resumed?.(this);
          break;
        }
        case "CHANNEL_CREATE": {
          await options.listeners.channelCreate?.(channelFactory(this, data.d));
          break;
        }
        case "CHANNEL_UPDATE": {
          await options.listeners.channelUpdate?.(channelFactory(this, data.d));
          break;
        }
        case "CHANNEL_DELETE": {
          await options.listeners.channelDelete?.(channelFactory(this, data.d));
          break;
        }
        case "CHANNEL_PINS_UPDATE": {
          await options.listeners.channelPinsUpdate?.(data.d.guild_id, data.d.channel_id, typeof data.d.last_pin_timestamp === "string" ? new Date(data.d.last_pin_timestamp) : null);
          break;
        }
        case "THREAD_CREATE": {
          await options.listeners.threadCreate?.(channelFactory(this, data.d));
          break;
        }
        case "THREAD_UPDATE": {
          await options.listeners.threadUpdate?.(channelFactory(this, data.d));
          break;
        }
        case "THREAD_DELETE": {
          await options.listeners.threadDelete?.(new ThreadChannel(this, data.d, false));
          break;
        }
        case "GUILD_CREATE": {
          await options.listeners.guildCreate?.(guildFactory(this, data.d));
          break;
        }
        case "GUILD_UPDATE": {
          await options.listeners.guildUpdate?.(guildFactory(this, data.d));
          break;
        }
        case "GUILD_DELETE": {
          await options.listeners.guildDelete?.(data.d);
          break;
        }
        case "GUILD_MEMBER_ADD": {
          await options.listeners.guildMemberAdd?.(new GuildMember(this, data.d));
          break;
        }
        case "GUILD_MEMBER_REMOVE": {
          await options.listeners.guildMemberRemove?.(data.d.guild_id, new User(this, data.d.user));
          break;
        }
        case "GUILD_MEMBER_UPDATE": {
          await options.listeners.guildMemberUpdate?.(new GuildMember(this, data.d));
          break;
        }
        case "INTERACTION_CREATE": {
          await options.listeners.interactionCreate?.(interactionFactory(this, data.d));
          break;
        }
        case "INVITE_CREATE": {
          await options.listeners.inviteCreate?.(data.d);
          break;
        }
        case "INVITE_DELETE": {
          await options.listeners.inviteDelete?.(data.d);
          break;
        }
        case "MESSAGE_CREATE": {
          await options.listeners.messageCreate?.(new Message(this, data.d));
          break;
        }
        case "MESSAGE_UPDATE": {
          await options.listeners.messageUpdate?.(new Message(this, data.d));
          break;
        }
        case "MESSAGE_DELETE": {
          await options.listeners.messageDelete?.(new Message(this, data.d));
          break;
        }
        case "MESSAGE_DELETE_BULK": {
          await options.listeners.messageDeleteBulk?.(data.d);
          break;
        }
        case "PRESENCE_UPDATE": {
          await options.listeners.presenceUpdate?.(data.d);
          break;
        }
        case "USER_UPDATE": {
          await options.listeners.userUpdate?.(new User(this, data.d));
          break;
        }
        default:
      }
    }, debug);
  }
  async login(token) {
    this.#ws.options = { token };
    this.rest.setToken(token);
    await this.#ws.connect();
    return token;
  }
  close() {
    this.rest.setToken(undefined);
    this.#ws.close();
  }
  setPresence(presence) {
    this.#ws.updatePresence(presence);
  }
  async ping() {
    const start = performance.now();
    await this.rest.getGateway();
    const final = Math.floor(performance.now() - start);
    return {
      ws: await this.#ws.ping(),
      rest: final
    };
  }
}
// src/main.ts
var listeners = await createHandler({
  dirs: {
    slashCommands: `${import.meta.dirname}/commands`
  }
});
var token = env.TOKEN;
if (typeof token !== "string")
  throw new TypeError("token is not defined");
createClient({
  intents: [Intents.GUILDS, Intents.GUILD_MESSAGES, Intents.MESSAGE_CONTENT],
  token,
  ...listeners
});
