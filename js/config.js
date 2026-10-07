/* ============================================================
   DENDOR — bio page configuration
   Меняй только этот файл, чтобы обновить данные страницы.
   ============================================================ */

const CONFIG = {
  profile: {
    name: "DENDOR",
    prompt: "dendor@deworld",
    role: "DeWorld dev // Java // Minecraft plugins",
    bio:
      "DENDOR — разработчик и основатель DeWorld. Делаю Minecraft-плагины, " +
      "развиваю серверы и YouTube-канал. Пишу код, музыку и иногда видосы.",
    site: "https://deworld.su",
  },

  github: {
    user: "DENDORoff",
    graphWeeks: 12,
  },

  discord: {
    tag: "dendoroff",
    user: "1470170052274815171",
    guild: "867681876231979028",
    serverUrl: "https://discord.deworld.su",
  },

  steam: {
    url: "https://steamcommunity.com/id/DENDOR_YT",
    name: "ᴅᴇɴᴅᴏʀ",
    avatar:
      "https://avatars.fastly.steamstatic.com/f66810876e9f494a073bcc92e568975f6882c1df_full.jpg",
    memberSince: "October 2, 2023",
  },

  twitch: {
    login: "DENDORoff",
    url: "https://www.twitch.tv/DENDORoff",
    clientId: "kimne78kx3ncx6brgo4mv6wki5h1ko",
  },

  youtube: {
    channelId: "UCnPHpCrXyRREynAUPcYnqqA",
    handle: "@deworld_ru",
    url: "https://youtube.deworld.su",
  },

  minecraft: {
    host: "mc.deworld.su",
    refreshMs: 60000,
  },

  counter: {
    name: "dendoroff-github-io",
    theme: "minecraft",
    length: 8,
  },

  socials: [
    { name: "Telegram", sub: "@tg_dendor", url: "https://t.me/tg_dendor", icon: "telegram" },
    { name: "Telegram канал", sub: "@deworld_ru", url: "https://t.me/deworld_ru", icon: "telegram" },
    { name: "ВКонтакте", sub: "vk_dendor", url: "https://vk.com/vk_dendor", icon: "vk" },
    { name: "ВКонтакте паблик", sub: "@deworld_ru", url: "https://vk.com/deworld_ru", icon: "vk" },
    { name: "Discord", sub: "dendoroff", url: "https://discord.deworld.su", icon: "discord" },
    { name: "YouTube", sub: "@deworld_ru", url: "https://youtube.deworld.su", icon: "youtube" },
    { name: "Twitch", sub: "DENDORoff", url: "https://www.twitch.tv/DENDORoff", icon: "twitch" },
    { name: "Steam", sub: "DENDOR_YT", url: "https://steamcommunity.com/id/DENDOR_YT", icon: "steam" },
    { name: "GitHub", sub: "DENDORoff", url: "https://github.com/DENDORoff", icon: "github" },
    { name: "Сайт", sub: "deworld.su", url: "https://deworld.su", icon: "website" },
  ],

  skills: [
    { label: "Java", level: 90 },
    { label: "Spigot / Paper / Bukkit", level: 95 },
    { label: "JavaScript / HTML / CSS", level: 80 },
    { label: "Администрирование серверов", level: 85 },
    { label: "Видео / стриминг", level: 75 },
    { label: "Музыка для игр", level: 70 },
  ],

  projects: [
    {
      title: "DeWorld",
      desc:
        "Сеть Minecraft серверов с собственной экосистемой: прокси, " +
        "плагины, монетизация. Заходи — серверы онлайн.",
      link: "https://deworld.su",
      btn: "deworld.su",
      chips: ["mc.deworld.su", "Velocity", "custom plugins"],
      icon: "website",
    },
    {
      title: "Dw-плагины",
      desc:
        "Серия плагинов для Spigot/Paper: чат, broadcast, цвета, " +
        "библиотеки. Открытый код на GitHub.",
      link: "https://github.com/DENDORoff?tab=repositories",
      btn: "github.com/DENDORoff",
      chips: ["DwChat", "DwBroadcast", "DwChatColor", "CMILib"],
      icon: "github",
    },
    {
      title: "YouTube-канал",
      desc:
        "Геймплей, шорты и highlight'ы: DOOM Eternal, Forza Horizon " +
        "и другие игры. Подписывайся.",
      link: "https://youtube.deworld.su",
      btn: "@deworld_ru",
      chips: ["shorts", "геймплей", "highlight'ы"],
      icon: "youtube",
    },
  ],

  openProject: {
    title: "И это ещё не всё…",
    desc:
      "Открыт для новых проектов и коллабораций. Есть идея — " +
      "пиши, обсудим.",
    link: "https://t.me/tg_dendor",
    btn: "написать в Telegram",
  },

  heroLines: [
    "делаю Minecraft-плагины и серверы",
    "пишу код на Java и JavaScript",
    "стримлю, снимаю видосы, делаю музыку",
    "основатель проекта DeWorld",
    "открыт для новых проектов",
  ],

  bootLines: [
    "[    0.001] BIOS check ......................... OK",
    "[    0.014] mounting /dev/deworld ............... OK",
    "[    0.037] loading dendor.core ................. OK",
    "[    0.061] syncing github / discord / steam .... OK",
    "[    0.088] ping mc.deworld.su ............... 21ms",
    "[    0.113] ACCESS GRANTED — welcome, guest_",
  ],
};
