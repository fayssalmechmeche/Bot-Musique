import {
  ChannelType,
  Client,
  GatewayIntentBits,
  IntentsBitField,
  PermissionFlagsBits,
  REST,
  Routes,
} from "discord.js";

import OpenAI from "openai";
import "dotenv/config";
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

const commands = [
  {
    name: "play",
    description: "Replies with Play!",
  },
];
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

try {
  console.log("Started refreshing application (/) commands.");

  await rest.put(Routes.applicationCommands(process.env.APPID), {
    body: commands,
  });

  console.log("Successfully reloaded application (/) commands.");
} catch (error) {
  console.error(error);
}

let conversationLog = [];
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);

  client.user.setPresence({
    activities: [{ name: "GPT Aventure !" }],
    status: "online",
  });
  conversationLog.push({
    role: "system",
    content:
      "tu es un maître de jeu de rôle. Tu vas guider un personnage à travers un monde fantastique rempli de monstres et de héros. À chaque étape, tu lui proposeras 3 choix possibles. Chaque choix a des conséquences et le joueur doit tout faire pour que son personnage survive. Le jeu se termine lorsque le personnage du joueur meurt. Dans ta première réponse, demande-lui son nom. Dans la deuxième réponse, demande-lui sa classe (chevalier, mage, archer, etc.). Dans la troisième réponse, demande-lui sa race (humain, elfe, nain, etc.). L'histoire se déroule dans un monde fantastique où un dragon terrifiant règne au sommet d'un volcan. Le but ultime du héros est de vaincre ce dragon. Prépare-toi à improviser de nombreux défis pour guider le joueur jusqu'au dragon. Une fois que le joueur a choisi sa classe et sa race, tu pourras commencer l'aventure en fonction de ses choix. Lorsque tu présenteras les choix. Tu dois prendre en compte ses réponses pour créer une expérience immersive et captivante. Les choix doivent devenir de plus en plus compliqué jusqu'à pousser le joueur à choisir le mauvais choix et mourir. Donc un de tes choix doit etre un mauvais choix pour l'utilisateur. Si le joueur décide de mettre fin à l'aventure, tu dois absulument répondre `Fin de l'aventure !`.",
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("Pong!");
  }
  if (interaction.commandName === "play") {
    await interaction.guild.channels.create({
      name: "GPT Aventure",
      type: ChannelType.GUILD_TEXT,
      id: process.env.SERVEUR,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
      ],
    });
    await interaction.channel.send(
      "Pour jouer, écrivez `Jouer` dans le channel `gpt-aventure`"
    );
  }
});

const openai = new OpenAI(process.env.OPENAI_API_KEY);

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.channel.id !== process.env.SERVEUR) return;
  if (msg.content.startsWith("!")) return;

  await msg.channel.sendTyping();

  let previousMessage = await msg.channel.messages.fetch({ limit: 15 });
  await previousMessage.reverse();

  if (msg.content.startsWith("Jouer")) {
    // supprimer tout les messages sauf celui envoyé par l'utilisateur

    await msg.channel.messages.cache.forEach((message) => {
      if (message.id == msg.id) return;
      message.delete();
    });

    await msg.channel.send("Nouvelle Aventure !");
  }
  await previousMessage.forEach((message) => {
    if (message.author.bot && message.author.id !== client.user.id) return;
    if (message.content.startsWith("!")) return;
    if (message.author.id !== msg.author.id) return;
    conversationLog.push({
      role: "user",
      content: `${message.content}.`,
    });
  });

  const result = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: conversationLog,
  });

  await conversationLog.push({
    role: "system",
    content: result.choices[0].message.content,
  });

  console.log("MESSAGE");
  console.log(conversationLog);

  await msg.reply(result.choices[0].message);

  if (
    result.choices[0].message.content.includes("Fin de l'aventure") ||
    result.choices[0].message.content.includes("fin de l'aventure") ||
    result.choices[0].message.content.includes("fin à l'aventure") ||
    result.choices[0].message.content.includes("Fin à l'aventure") ||
    result.choices[0].message.content.includes("Fin de ton aventure") ||
    result.choices[0].message.content.includes("l'aventure prend fin")
  ) {
    await msg.channel.messages.cache.forEach((message) => {
      message.delete();
    });
    await msg.channel.send("Pour relancer une partie, écrivez `Jouer");
  }
});

client.login(process.env.TOKEN);
