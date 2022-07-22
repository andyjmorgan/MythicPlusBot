require('dotenv').config(); //initialize dotenv
const { Client, Collection, Intents, MessageEmbed, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const axios = require('axios');
const { ADDRCONFIG } = require('node:dns');
const date = require('date-and-time');
const { GetHighestThisWeek, LookupAffixes } = require('./lib/RaiderIO');
const { threadId } = require('node:worker_threads');
const { waitForDebugger } = require('node:inspector');
const wait = require('node:timers/promises').setTimeout;

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const client = new Client({
   intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages]
});

// Intents., Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.
//   Intents.FLAGS.DIRECT_MESSAGE_TYPING

let RawFile = fs.readFileSync('APICredentials.json');
let PasswordManager = JSON.parse(RawFile);
// These tokens will be used for the lifecycle of the bot:
let WCLToken = "";
let BNETToken = "";

// These Dates will be used to trak token expiries:
let battlenetTokenExpiry = date.addSeconds(new Date(), -30);
let warcraftLogsTokenExpiry = date.addSeconds(new Date(), -30);



//https://develop.battle.net/documentation/world-of-warcraft/profile-apis


// Track bot usage here
let CharQueries = 0;
let QueryFailures = 0;

// Token Validation Section

//updates the runtime token for warcraft logs if required.
async function UpdateWarcraftLogsToken() {
  await axios.post('https://www.warcraftlogs.com/oauth/token',
    'grant_type=client_credentials',
    {
      auth: {
        username: PasswordManager.WCLUsername,
        password: PasswordManager.WCLPassword
      }
    })
    .then(async res => {
      WCLToken = `Bearer ${res.data.access_token}`
      warcraftLogsTokenExpiry = date.addSeconds(new Date(), res.data.expires_in);
      console.log(`WCL Token expires in ${warcraftLogsTokenExpiry.toString()}`);
    })
    .catch(error => {
      console.error(`Exception caught in UpdateWarcraftLogsToken: ${error}`);
    });
}
//updates the runtime token if required for battlenet.
async function UpdateBattlenetToken() {
  await axios.post('https://oauth.battle.net/token',
    'grant_type=client_credentials',
    {
      auth: {
        username: PasswordManager.BattleNetUsername,
        password: PasswordManager.BattleNetPassword
      }
    })
    .then(async res => {
      BNETToken = `${res.data.access_token}`;
      battlenetTokenExpiry = date.addSeconds(new Date(), res.data.expires_in);
      console.log(`Battlenet Token expires in ${battlenetTokenExpiry.toString()}`);
    })
    .catch(error => {
      console.error(`Exception caught in UpdateBattlenetToken: ${error}`);
    });
}
function CheckWarcraftLogsTokenValid() {
  if (date.addSeconds(new Date(), 60).getTime() >= warcraftLogsTokenExpiry.getTime()) {
    console.log(`Warcraft Logs Token has expired`);
    return false;
  }
  return true;
}
function CheckBattleNetTokenValid() {
  if (date.addSeconds(new Date(), 60).getTime() >= battlenetTokenExpiry.getTime()) {
    console.log(`BattleNet Token has expired`);
    return false;
  }
  return true;
}
// sorts the dungeon by best performance, takes the top 3 and the best
function SortDungeon(encounterRanking, name, dungeoncode, level) {
  var filtered = encounterRanking.ranks.filter(function (value, undex, arr) {
    return value.bracketData >= level;
  });
  let best = filtered.sort((firstItem, secondItem) => firstItem.rankPercent - secondItem.rankPercent).reverse()[0];
  let top5 = filtered.sort((firstItem, secondItem) => firstItem.rankPercent - secondItem.rankPercent).reverse().slice(0, 3);

  const rankarr = [];

  top5.forEach(run => {
    rankarr.push({
      startTime: new Date(run.startTime),
      keyLevel: run.bracketData,
      spec: run.spec,
      rank: Math.round(run.rankPercent),
      today: Math.round(run.todayPercent),
      report: run.report,
      amount: Math.round(run.amount)
    });
  });

  return Dungeon = {
    Name: `${name}`,
    TotalKills: encounterRanking.totalKills,
    Icon: `https://assets.rpglogs.com/img/warcraft/bosses/${dungeoncode}-icon.jpg`,
    Best: {
      Level: Math.round(best.bracketData),
      Rank: Math.round(best.rankPercent),
      Code: best.report.code,
      FightID: best.report.fightID,
      amount: Math.round(best.amount)
    },
    HighestRuns: rankarr
  };
}
//formats the character data in the response
function FormatCharData(defaultDescription, charSummary, realm, region, ioscore, top3) {

  if (charSummary) {

    let name = "";
    if (charSummary.active_title) {
      name = charSummary.active_title.display_string.replace('{name}', charSummary.name);
    }
    else {
      name = charSummary.name;
    }
    let nameLine = `\nName: **[${name}](https://warcraftlogs.com/character/${region}/${realm}/${charSummary.name}?zone=25#bybracket=1&private=1&metric=dps)**`;
    let ioLine = `\nM+ Score: **${ioscore}**`
    let bodyLine = `\nFaction/Race/Gender: **${charSummary.faction.name}/${charSummary.race.name}/${charSummary.gender.name}**`;
    let classLine = `\nClass/Active Spec: **${charSummary.character_class.name}/${charSummary.active_spec.name}**`;
    let header = "**__Top Parse:__**";
    if (top3) {
      header = "**__Top 3 Parses:__**";
    }
    return `${defaultDescription}\n\n**__Character Data:__**\n\n${nameLine}${ioLine}${bodyLine}${classLine}\n\n${header}\n\n\n`;
  }
  else {
    return `${defaultDescription}\n\n**Character data is out of date or unavailable, update it!**\n\n**__Top Parse:__**\n\n\n`;
  }
}

function FormatRaiderIOData(defaultDescription, faction, race, gender, cclass, spec, name, curl) {
  let nameLine = `\nName: **[${name}](${curl})**`;
  let bodyLine = `\nFaction/Race/Gender: **${faction}/${race}/${gender}**`;
  let classLine = `\nClass/Active Spec: **${cclass}/${spec}**`;
  let header = "**__Top 10 Keys:__**";
  return `${defaultDescription}\n\n**__Character Data:__**\n\n${nameLine}${bodyLine}${classLine}\n\n${header}\n\n\n`;
}
//Retrives raw dungeon details, sorts it, prints it to the summary
async function AddDungeon(charName, realm, region, axios, embedMessage, longName, displayName, dungeonCode, level, top5 = false) {
  try {
    var rawDungeon = await LookupDungeon(charName, realm, region, axios, dungeonCode);
    var dungeonDetails = SortDungeon(rawDungeon, longName, dungeonCode, level);
    if (!top5) {
      embedMessage.addFields([{name:`${longName}:`, 
      value: `[${dungeonDetails.Best.Level}](https://www.warcraftlogs.com/reports/${dungeonDetails.Best.Code}#fight=${dungeonDetails.Best.FightID}&type=damage-done) | ${PrintDps(dungeonDetails.Best.amount)} | ${RankScore(dungeonDetails.Best.Rank)} ${dungeonDetails.Best.Rank} %`, 
      inline: true
    }]);
    }
    else {
      let DungeonString = "";
      dungeonDetails.HighestRuns.forEach(run => {
        DungeonString = `${DungeonString}[${run.keyLevel}](https://www.warcraftlogs.com/reports/${run.report.code}#fight=${run.report.fightID}&type=damage-done) | ${PrintDps(run.amount)} | ${RankScore(run.rank)} ${run.rank} %\n`
      });
      embedMessage.addFields([{
        name:`${longName}:`,
        value: DungeonString,
        inline: true}]);
    }
  }
  catch (e) {
    embedMessage.addField(`${longName}:`, `:poop: No Data`, true);
    console.log(`Exception in add dungeon: ${e}`);
  }
  return embedMessage;
}
//retrieves a color emoji name to rank the parse score
function RankScore(score) {
  if (score >= 99) {
    return ":red_circle:";
  }
  else if (score >= 95) {
    return ":orange_circle:";
  }
  else if (score >= 75) {
    return ":purple_circle:";
  }
  else if (score >= 50) {
    return ":blue_circle:";
  }
  else if (score >= 25) {
    return ":green_circle:";
  }
  else {
    return ":white_circle:";
  }
}
//the constant dungeon ID returned by warcraft logs
const Dungeons = {
  sd: 12284,
  soa: 12285,
  nw: 12286,
  hoa: 12287,
  pf: 12289,
  mist: 12290,
  dos: 12291,
  top: 12293,
  strt: 12441,
  gmbt: 12442
}
//looks up dungeon scores for the querying user§
async function LookupDungeon(charName, realm, region, axios, dungeon) {
  let charQuery = {
    query: `{characterData{character(name: \"${charName}\", serverRegion:\"${region}\", serverSlug:\"${realm}\"){encounterRankings(byBracket: true, encounterID: ${dungeon}, metric: dps, compare: Rankings, includePrivateLogs:true, timeframe: Historical)}}}`
  };
  let config = {
    data: JSON.stringify(charQuery),
    headers: {
      'Authorization': WCLToken,
      'Content-Type': 'application/json'
    }
  };


  async function LookupRecent(charName, realm, region, axios) {
    let charQuery = {
      query: `{
        characterData{
          character(name: \"${charName}\", serverRegion:\"${region}\", serverSlug:\"${realm}\"){
            recentReports(limit: 20){
              data{
                startTime,
                fights(difficulty: 10,killType: Kills){
                  keystoneLevel,
                  kill,
                  name,
                  startTime,
                  keystoneBonus,
                  endTime,
                  keystoneAffixes,
                  
                },
              }			
            }
            }
          }
        }`
    };
    let config = {
      data: JSON.stringify(charQuery),
      headers: {
        'Authorization': WCLToken,
        'Content-Type': 'application/json'
      }
    };
  }

  return await axios.post('https://www.warcraftlogs.com/api/v2/client',
    charQuery, config
  ).then(res => {
    let details = res.data
    return details.data.characterData.character.encounterRankings;

  })
    .catch(error => {
      console.error(error);
    });
}
//looks up the user on warcraft logs
async function LookupCharacter(charName, realm, region, axios) {
  let charQuery = {
    query: `{characterData{character(name: \"${charName}\", serverRegion:\"${region}\", serverSlug:\"${realm}\"){gameData}}}`
  };
  let config = {
    data: JSON.stringify(charQuery),
    headers: {
      'Authorization': WCLToken,
      'Content-Type': 'application/json'
    }
  };


  return await axios.post('https://www.warcraftlogs.com/api/v2/client',
    charQuery, config
  ).then(res => {
    let details = res.data
    return details.data.characterData.character.gameData.global;

  })
    .catch(error => {
      console.error(error);
    });
}
//retrieves the character details from battlenet
async function LookupBattlenetCharacter(charName, realm, region, axios) {

  let url = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${charName}?namespace=profile-${region}&locale=en_US&access_token=${BNETToken}`

  return await axios.get(encodeURI(url)).then(res => {
    return res.data;
  })
    .catch(error => {
      console.error(error);
    });
}
function GetStars(upgrades) {
  let StarString = ``;
  let cur = 1;
  while (cur <= upgrades) {
    StarString = `${StarString}:star:`
    cur++;
  }
  return StarString;
}
//converts the color code from battlenet to a color code usable by discord
function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
async function LookupBattlenetCharAvatar(url) {
  url = `${url}&access_token=${BNETToken}`
  return await axios.get(url).then(res => {
    return res.data.assets;

  })
    .catch(error => {
      console.error(error);
    });
}

async function LookupBattlenetCharMythicPlus(url) {
  url = `${url}&access_token=${BNETToken}`
  return await axios.get(url).then(res => {
    return res.data;
  })
    .catch(error => {
      console.error(error);
    });
}

function PrintDps(dpsNum) {
  return `${Number.parseFloat(dpsNum / 1000).toFixed(1)}k`;
}
function GetInitialResponseToQuery(level) {
  //Set the default description of the response
  let defaultDescription = `Displays your top DPS parses above keystone level ${level} per dungeon, by bracket. In order for this to work, you must have valid warcraft logs for your Mythic + dungeon runs.`;

  // Setting default response colour.
  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Warcraft Logs Rankings')
    .setDescription(defaultDescription);
}
async function CheckTokens() {
  //Check Validity of Warcraft Logs token
  if (!CheckWarcraftLogsTokenValid()) {
    console.log("updating warcraftlogs Token");
    await UpdateWarcraftLogsToken();
  }

  //Check Validity of Battlenet Token
  if (!CheckBattleNetTokenValid()) {
    console.log("updating battleNet Token");
    await UpdateBattlenetToken();
  }
}
function GetAffixesInitialResponse(region) {
  let defaultDescription = `Displays the weekly Affixes provided by Raider.IO for region: ${region}`;

  // Setting default response colour.
  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Mythic Plus Affixes')
    .setDescription(defaultDescription)
    .setThumbnail("https://cdnassets.raider.io/images/brand/Icon_FullColor.png")
}
function GetWeeklyKeysInitialResponse(defaultDescription) {


  // Setting default response colour.
  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Highest Weekly Mythic+ runs')
    .setDescription(defaultDescription)
}
async function GetBattleNetResponse(region, realm, charName, embedMessage, level, showTop3) {

  try {

    let defaultDescription = `Displays your top DPS parses above keystone level ${level} per dungeon, by bracket. In order for this to work, you must have valid warcraft logs for your Mythic + dungeon runs.`;
    console.log("Requesting BattleNet char data");
    var bnetCharData = await LookupBattlenetCharacter(charName, realm, region, axios);

    console.log("Requesting BattleNet m+ data");
    var mplusData = await LookupBattlenetCharMythicPlus(bnetCharData.mythic_keystone_profile.href);

    //setting response color to m+ io score colour;

    embedMessage.setColor(rgbToHex(mplusData.current_mythic_rating.color.r, mplusData.current_mythic_rating.color.g, mplusData.current_mythic_rating.color.b));

    console.log("Requesting BattleNet Char Image");
    var media = await LookupBattlenetCharAvatar(bnetCharData.media.href);;
    embedMessage.setDescription(FormatCharData(defaultDescription, bnetCharData, realm, region, Math.round(mplusData.current_mythic_rating.rating), showTop3));
    let avatar = media.find(({ key }) => key === 'avatar');

    embedMessage.setThumbnail(avatar.value);
  }
  catch (e) {
    console.log(`Exception pulling battlenet Data: ${e}`);
    embedMessage.setDescription("error while communicating with BattleNet :face_with_symbols_over_mouth:");
  }

  return embedMessage;
}
function SetFooter(embedMessage) {
  embedMessage.setFooter({
    text: 'Made by Andy#0761',
    iconURL: 'https://i.ibb.co/qx7zzzQ/squiggs.jpg',
  });
  return embedMessage;
}

function TimeSpanFromMS(ms) {
  let seconds = ms / 1000;
  let minutes = Math.floor(seconds / 60);
  let remainingSeconds = Math.floor(seconds - (minutes * 60));
  remainingSeconds = remainingSeconds.toString().padStart(2, 0);
  return `${minutes}:${remainingSeconds}`;
}

// Begin Startup Routine
UpdateBattlenetToken();
UpdateWarcraftLogsToken();


//todo: fix client commands implementation:

client.commands = new Collection();
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  console.log(`Setting command name ${command.data.name} to : ${command}`);
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// client.on('message', async msg => {

//   // only answer to queries starting with !wcl
//   if (msg.content.toLowerCase().startsWith('!wcl')) {
//     console.log(`received: ${msg.content}`);

//     CharQueries += 1;

//     await CheckTokens();



//     // if the message is received via DM, respond via DM
//     let isDM = false;
//     if (msg.channel.type == 'DM') {
//       isDM = true;
//     }

//     // split and digest request
//     var stringArray = msg.content.split(' ');
//     if (stringArray.length >= 4) {
//       const region = stringArray[1].toLowerCase();
//       const realm = stringArray[2].toLowerCase();
//       const charName = stringArray[3].toLowerCase();
//       let level = stringArray[4];
//       if (!level) {
//         level = 15;
//       }
//       let showTop3 = false;
//       let top3 = stringArray[5];
//       if (top3) {
//         if (top3 == 'top3') {
//           showTop3 = true;
//         }
//       }

//       console.log(`Parsed Message understood as: Char: ${charName} on: ${realm} in: ${region} for Level: ${level} Top3?: ${top3}`);

//       //Set the default description of the response
//       let embedMessage = GetInitialResponseToQuery(level);

//       // initial message built, do we respond in channel or DM?
//       var msg;
//       if (isDM) {
//         msg = await msg.author.send({ embeds: [embedMessage] });
//       }
//       else {
//         msg = await msg.reply({ embeds: [embedMessage] });
//       }
//       embedMessage = await GetBattleNetResponse(region, realm, charName, embedMessage, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       console.log("Requesting Warcraft Logs Data");
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "De Other Side", "DoS", Dungeons.dos, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Mists of Tirna Scithe", "Mists", Dungeons.mist, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Halls of Atonement", "HoA", Dungeons.hoa, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Sanguine Depths", "SD", Dungeons.sd, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Plaguefall", "PF", Dungeons.pf, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Theater of Pain", "ToP", Dungeons.top, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Necrotic Wake", "NW", Dungeons.nw, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Spires of Ascension", "SoA", Dungeons.soa, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Streets of Wonder", "Streets", Dungeons.strt, level, showTop3);
//       msg.edit({ embeds: [embedMessage] });
//       embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "So'Leah's Gambit", "Gambit", Dungeons.gmbt, level, showTop3);
//       embedMessage.setFooter({
//         text: 'Made by Andy#0761',
//         iconURL: 'https://i.ibb.co/qx7zzzQ/squiggs.jpg',
//       });
//       msg.edit({ embeds: [embedMessage] });
//       console.log("Awaiting Next");
//     }
//   }
// });





client.on('interactionCreate', async interaction => {
  console.log("interaction received");
  if (!interaction.isChatInputCommand()) {
    console.log("not command");
    return;
  }

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log("not command");

    return;
  }


  try {
    console.log("Attempting to execute command");
    await CheckTokens();
    if (interaction.commandName === 'parses') {

      let region = interaction.options.getString("region").toLocaleLowerCase();
      let realm = interaction.options.getString("realm").toLocaleLowerCase();
      let charName = interaction.options.getString("charactername").toLocaleLowerCase();
      let reportType = interaction.options.getString("reporttype");
      let level = interaction.options.getInteger("level");

      let showTop3 = false;

      if (level == null) {
        level = 15;
      }

      if (reportType == null) {
        reportType = "Best";
      }

      if (reportType === "Top3") {
        showTop3 = true;
      }

      console.log(`Parsed Message understood as: Parses for Char: ${charName} on: ${realm} in: ${region} for Level: ${level} Report?: ${reportType}`);
      await interaction.deferReply();
      let embedMessage = GetInitialResponseToQuery(level);
      
      embedMessage = await GetBattleNetResponse(region, realm, charName, embedMessage, level, showTop3);
      await interaction.editReply({ embeds: [embedMessage] });
      
      console.log("Requesting Warcraft Logs Data");
      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "De Other Side", "DoS", Dungeons.dos, level, showTop3);  
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Mists of Tirna Scithe", "Mists", Dungeons.mist, level, showTop3);   
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Halls of Atonement", "HoA", Dungeons.hoa, level, showTop3);  
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Sanguine Depths", "SD", Dungeons.sd, level, showTop3);      
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Plaguefall", "PF", Dungeons.pf, level, showTop3);    
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Theater of Pain", "ToP", Dungeons.top, level, showTop3);     
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Necrotic Wake", "NW", Dungeons.nw, level, showTop3);     
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Spires of Ascension", "SoA", Dungeons.soa, level, showTop3);    
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Streets of Wonder", "Streets", Dungeons.strt, level, showTop3); 
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "So'Leah's Gambit", "Gambit", Dungeons.gmbt, level, showTop3);
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = SetFooter(embedMessage);
      await interaction.editReply({ embeds: [embedMessage] });
      console.log("Awaiting Next");
    }
    else if (interaction.commandName === 'affixes') {
      let region = interaction.options.getString("region").toLocaleLowerCase();
      let embedMessage = GetAffixesInitialResponse(region);
      //await interaction.reply({ embeds: [embedMessage] });
      console.log("Requesting Weekly Affixes");

     await interaction.deferReply();
      var Affixes = await LookupAffixes(region);
      
      Affixes.affix_details.forEach(affix => {
        embedMessage.addFields(
          [
            {name: affix.name, 
              value:`${affix.description}... [Details](${affix.wowhead_url})`, 
              inline: true
            }
        ]
        );
      });
      embedMessage = SetFooter(embedMessage);
      await interaction.editReply({ embeds: [embedMessage] });



    }
    else if (interaction.commandName === 'weeklykeys') {
      let region = interaction.options.getString("region").toLocaleLowerCase();
      let realm = interaction.options.getString("realm").toLocaleLowerCase();
      let charName = interaction.options.getString("charactername").toLocaleLowerCase();
      let defaultDescription = `Displays your highest 10 keys you finished this week, provided by Raider.IO.`;
      console.log(`Parsed Message understood as: WeeklyKeys for Char: ${charName} on: ${realm} in: ${region}.`);
      await interaction.deferReply();
      console.log("Requesting Weekly keys");
      let embedMessage = GetWeeklyKeysInitialResponse(region, defaultDescription);
      await interaction.editReply({ embeds: [embedMessage] });
      var weeklies = await GetHighestThisWeek(region, realm, charName);
      let message = FormatRaiderIOData(defaultDescription, weeklies.faction, weeklies.race, weeklies.gender, weeklies.class, weeklies.active_spec_name, weeklies.name, weeklies.profile_url);
      embedMessage.setDescription(message);
      embedMessage.setThumbnail(weeklies.thumbnail_url);

      weeklies.mythic_plus_weekly_highest_level_runs.forEach(weekly => {
        let completed = Date.parse(weekly.completed_at);
        let date = new Date(completed);
        let niceDate = date.toLocaleDateString([], { hour: '2-digit', minute: '2-digit' });
        let starString = GetStars(weekly.num_keystone_upgrades);

        let message = `Level: [${weekly.mythic_level}](${weekly.url})${starString}\nCompleted: ${niceDate} \nTime Taken: ${TimeSpanFromMS(weekly.clear_time_ms)}`;

        embedMessage.addFields(
          [{ 
          name: `${weekly.dungeon.replace('Tazavesh: ','')}:`, 
        value: `${message}`,
        inline: true
        }]
      );
      });

      embedMessage = SetFooter(embedMessage);
      await interaction.editReply({ embeds: [embedMessage] });
    }

    else {
      await command.execute(interaction);
    }
  } catch (error) {
    console.error("Exception in interaction callback: " + error);

    let embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('Mythic Plus Bot');

    embed.setDescription("Failed to perform task: " + error);
    embed.setDescription("Failed to perform task: " + error);

    if(interaction.deferred || interaction.replied){
      await interaction.editReply({embeds:[embed]});
    }
    else{

      await interaction.reply({embeds: [embed] });
    }
    
  }
});



client.login(PasswordManager.DiscordToken); //login bot using token
