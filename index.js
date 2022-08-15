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
var mysql = require('mysql');
const RaiderIO = require('./lib/RaiderIO');

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const client = new Client({
   intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages]
});

let DBConnection = null;
let RawFile = fs.readFileSync('APICredentials.json');
let PasswordManager = JSON.parse(RawFile);

let DBFile = fs.readFileSync('mysql.json');
let DBConnectionManager = JSON.parse(DBFile);
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

function GetCovenantIcon(Covenant){
  Covenant = Covenant.toLocaleLowerCase();
  switch(Covenant){
    case "kyrian":
      return Covenants.kyrian;
      case "necrolord":
        return Covenant.necrolord;
      case "venthyr":
        return Covenants.venthyr;
      case "nightfae":
        return Covenants.nightfae;
  }
};

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

    let factionIcon="";
    if(charSummary.faction.type === 'HORDE'){
      factionIcon = Factions.horde;
    } 
    else{
      factionIcon = Factions.alliance;
    }

    let CovenantIcon = GetCovenantIcon(charSummary.covenant_progress.chosen_covenant.name);

    let nameLine = `\n${factionIcon} **[${name}](https://warcraftlogs.com/character/${region}/${realm}/${charSummary.name}?zone=25#bybracket=1&private=1&metric=dps)**${CovenantIcon}`;
    //let guildLine =`\n<${charSummary.guild.name}>`
    let detailsLine = `\n ${charSummary.race.name} ${charSummary.active_spec.name} ${charSummary.character_class.name}`
    let ioLine = `\nM+ Score: **${ioscore}**`
    // let bodyLine = `\nFaction/Race/Gender: **${charSummary.faction.name}/${charSummary.race.name}/${charSummary.gender.name}**`;
    // let classLine = `\nClass/Active Spec: **${charSummary.character_class.name}/${charSummary.active_spec.name}**`;
    let LinkLine = `\n [${ExternalEmoji.wow}](https://worldofwarcraft.com/character/${region}/${realm}/${charSummary.name})  [${ExternalEmoji.rio}](https://raider.io/characters/${region}/${realm}/${charSummary.name})  [${ExternalEmoji.wcl}](https://warcraftlogs.com/character/${region}/${realm}/${charSummary.name}?zone=25#bybracket=1&private=1&metric=dps)`
    let header = "**__Top Parse:__**";
    if (top3) {
      header = "**__Top 3 Parses:__**";
    }
    //return `${defaultDescription}\n\n**__Character Data:__**\n\n${nameLine}${ioLine}${bodyLine}${classLine}\n\n${header}\n\n\n`;
    return `${defaultDescription}\n\n**__Character Data:__**\n\n${nameLine}${detailsLine}${ioLine}${LinkLine}\n\n${header}\n\n\n`;

  }
  else {
    return `${defaultDescription}\n\n**Character data is out of date or unavailable, update it!**\n\n**__Top Parse:__**\n\n\n`;
  }
}

function FormatRaiderIOData(defaultDescription, faction, race, gender, cclass, spec, name, curl) {
  let nameLine = `\nName: **[${name}](${curl})**`;
  let bodyLine = `\nFaction/Race/Gender: **${faction}/${race}/${gender}**`;
  let classLine = `\nClass/Active Spec: **${cclass}/${spec}**`;
  
  return `${defaultDescription}\n\n**__Character Data:__**\n\n${nameLine}${bodyLine}${classLine}\n\n`;
}
//https://www.icy-veins.com/wow/great-vault-the-shadowlands-weekly-chest

function ParseKeyReward(key){
  let base = 278;
  switch(key){
    case 1,2,3,4:
      return base;
    case 5,6:
      //255
      return base + 3;
    case 7:
      //259
      return base + 7;
     case 8,9:
       //262
       return base + 10;
    case 10:
      //265
      return base + 13;
    case 11:
      //268
      return base + 16;
    case 12,13:
      //272
      return base +20;
    case 14:
      //275
      return base + 23;  
    default: 
      //278
      return base + 26
  }
  
}
function AddWeeklyKeysSummary(keys){
  let keyString = "";
  if(keys.length >= 8){
    keyString = `Rewards: **3** - Option 1: **${ParseKeyReward(keys[0])}** | Option 2: **${ParseKeyReward(keys[3])}** | Option 3: **${ParseKeyReward(keys[7])}**`
  }
  else if(keys.length >= 4){
    keyString = `Rewards: **2** - Option 1: **${ParseKeyReward(keys[0])}** | Option 2: **${ParseKeyReward(keys[3])}** \n *time ${ 8 - keys.length} more key(s) for more choices.*`
  }
  else if(keys.length >= 1){
    keyString = `Rewards: **1** - Option 1: **${ParseKeyReward(keys)}**\n*time ${ 4 - keys.length} more key(s) for more choices.*`
  }
  else{
    keystring = 'No Keys completed this week :frowning:';
  }
  //console.log(keyString);
  return `**__Vault Choices:__**\n\n${keyString}`;
}
//Retrives raw dungeon details, sorts it, prints it to the summary
async function AddDungeon(charName, realm, region, axios, embedMessage, longName, displayName, dungeonCode, level, metric, top5 = false) {
  try {
    var rawDungeon = await LookupDungeon(charName, realm, region, axios, dungeonCode, metric);
    var dungeonDetails = SortDungeon(rawDungeon, longName, dungeonCode, level);

    var reportType = "damage-done";
    if(metric.toLocaleLowerCase() === "hps"){
      reportType = "healing";
    }
    if (!top5) {
      embedMessage.addFields([{name:`${TrimDungeonName(longName)}:`, 
      value: `[${dungeonDetails.Best.Level}](https://www.warcraftlogs.com/reports/${dungeonDetails.Best.Code}#fight=${dungeonDetails.Best.FightID}&type=${reportType}) | ${PrintDps(dungeonDetails.Best.amount)} | ${RankScore(dungeonDetails.Best.Rank)} ${dungeonDetails.Best.Rank} %`, 
      inline: true
    }]);
    }
    else {
      let DungeonString = "";
      dungeonDetails.HighestRuns.forEach(run => {
        DungeonString = `${DungeonString}[${run.keyLevel}](https://www.warcraftlogs.com/reports/${run.report.code}#fight=${run.report.fightID}&type=${reportType}) | ${PrintDps(run.amount)} | ${RankScore(run.rank)} ${run.rank} %\n`
      });
      embedMessage.addFields([{
        name:`${longName}:`,
        value: DungeonString,
        inline: true}]);
    }
  }
  catch (e) {
    embedMessage.addFields(
      [
        {
          name:`${longName}:`,
     value: `:poop: No Data`, 
     inline: true
        }
      ]
    );
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

const S4Dungeons = {
  id: 61195,
  gd: 61208,
  lwkz: 61651,
  upkz: 61652,
  omj: 62097,
  omw: 62098,
  strt: 62441,
  gmbt: 62442
}

const Factions={
  horde:'<:h_:988491122915565668>',
  alliance: '<:a_:988491121397211208>'
}

const Covenants={
  necrolord: '<:nec:1008707018938392687>',
  kyrian: '<:kyr:1008707017495547925>',
  venthyr: '<:ven:1008707020267991140>',
  nightfae: '<:fae:1008707016371474442>'
}
const ExternalEmoji={
  wcl: '<:wcl:1008706173773557822>',
  rio:'<:rio:1008706009231015967>',
  wow: '<:wow:1008706175296098375>'

}

const Classes={
  demonHunter:'<:dh:988493956318892032>',
  deathKnight:'<:dk:988493957715603516>',
  druid:'<:dr:988493958634176583>',
  hunter:'<:hu:988493960051826749>',
  warlock:'<:l_:988493967832260658>',
  mage:'<:ma:988493961108783194>',
  monk:'<:mo:988493962161565756>',
  paladin:'<:p_:988493963445039194>',
  rogue:'<:r_:988493965038870598>',
  shaman:'<:s_:988493966687215646>',
  warrior:'<:w_:988493968977330267>',
  priest:'<:pr:1006581199252234290>'
}

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

//looks up dungeon scores for the querying user§
async function LookupDungeon(charName, realm, region, axios, dungeon, metric) {
  
  let charQuery = {
    query: `{characterData{character(name: \"${charName}\", serverRegion:\"${region}\", serverSlug:\"${realm}\"){encounterRankings(byBracket: true, encounterID: ${dungeon}, metric: ${metric.toLocaleLowerCase()}, compare: Rankings, includePrivateLogs:true, timeframe: Historical)}}}`
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
    //console.log(details.data.characterData.character.encounterRankings);
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

  charName = charName.toLocaleLowerCase();
  let url = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${charName}?namespace=profile-${region}&locale=en_US&access_token=${BNETToken}`
  let encodedURL = encodeURI(url);
  return await axios.get(encodedURL).then(res => {
    console.log(res.data);
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
function GetInitialResponseToQuery(level, metric) {
  //Set the default description of the response
  let defaultDescription = `Displays your top ${metric} parses above keystone level ${level} per dungeon, by bracket. In order for this to work, you must have valid warcraft logs for your Mythic + dungeon runs.`;

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
function GetGuildLeaderBoardInitialResponse(guild,region,realm,role){
  // Setting default response colour.
  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`M+ Leader board from Raider.IO:`)
    .setDescription(`This is a snapshot of the M+ score leader Board for [<${guild}>](https://raider.io/guilds/${region}/${realm}/${encodeURI(guild)}) on ${region} - ${realm}.\n\nThis Leader board is filtered by spec: (${role}):`)
    .setThumbnail("https://cdnassets.raider.io/images/brand/Icon_FullColor.png")
}
async function GetBattleNetResponse(region, realm, charName, embedMessage, level, showTop3, metric) {

  try {

    let defaultDescription = `Displays your historical top ranking ${metric.toUpperCase()} parses above keystone level ${level} per dungeon, by bracket. In order for this to work, you must have valid warcraft logs for your Mythic + dungeon runs.`;
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
function SetErrorFooter(embedMessage,errorText) {
  embedMessage.setFooter({
    text: errorText,
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



function AddActivity(Activity){
  try{

  
  let QueryString = `INSERT INTO ServerActivity (DateTime, ActivityType) VALUES ('${GetSafeSQLDate()}', '${Activity}')`;
  DBConnection.query(QueryString, function (err, result) {
    if (err) throw err;
    console.log("1 record inserted");
  });
}
  catch(ex){
    console.log("Could not write to database " + ex);
  }
}


function AddRequest(command,server,user){
  try{

  
  let QueryString = `INSERT INTO requests (command, datetime, server,user) VALUES ('${command}','${GetSafeSQLDate()}', '${server}', '${user}')`;
  DBConnection.query(QueryString, function (err, result) {
    if (err) throw err;
    console.log("1 record inserted");
  });
}
catch(ex){
  console.log("Could not write to database " + ex);
}
}




function GetSafeSQLDate(){
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}


function TrimDungeonName(dungeon){
  return dungeon.replace('Tazavesh: ','').replace('Mechagon ','');
}

function GetClassIcon(className){
  let classEmoji ="";
  switch(className){
    case "Priest":
      classEmoji = Classes.priest;
        break;
      case "Demon Hunter":
        classEmoji = Classes.demonHunter;
        break;
      case "Death Knight":
        classEmoji = Classes.deathKnight;
        break;
      case "Druid":
        classEmoji = Classes.druid;
        break;
      case "Hunter":
        classEmoji = Classes.hunter;
        break;
      case "Warlock":
        classEmoji = Classes.warlock;
        break;
      case "Mage":
        classEmoji = Classes.mage;
        break;
      case "Monk":
        classEmoji = Classes.monk;
        break;
      case "Paladin":
        classEmoji = Classes.paladin;
        break;
      case "Rogue":
        classEmoji = Classes.rogue;
        break;
      case "Shaman":
        classEmoji = Classes.shaman;
        break;
      case "Warrior":
        classEmoji = Classes.warrior;
        break;
    default:
      break;
  };

  return classEmoji;
}


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
    AddRequest(interaction.commandName, interaction.guildId, interaction.user);
    console.log("Attempting to execute command");
    await CheckTokens();

    if (interaction.commandName === 'parses') {

      let region = interaction.options.getString("region").toLocaleLowerCase();
      let realm = interaction.options.getString("realm").toLocaleLowerCase();
      let charName = interaction.options.getString("charactername");
      let reportType = interaction.options.getString("reporttype");
      let level = interaction.options.getInteger("level");
      let metric = interaction.options.getString("metric");
      let showTop3 = false;

      if(metric == null){
        metric = "dps";
      }
      if (level == null) {
        level = 15;
      }

      if (reportType == null) {
        reportType = "Best";
      }

      if (reportType === "Top3") {
        showTop3 = true;
      }

      console.log(`Parsed Message understood as: Parses for Char: ${charName} on: ${realm} in: ${region} for Level: ${level} Report?: ${reportType} with Metric?: ${metric}`);
      await interaction.deferReply();
      let embedMessage = GetInitialResponseToQuery(level, metric);
      
      embedMessage = await GetBattleNetResponse(region, realm, charName, embedMessage, level, showTop3, metric);
      await interaction.editReply({ embeds: [embedMessage] });
      
      console.log("Requesting Warcraft Logs Data");
     
     //s3 data:
      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "De Other Side", "DoS", Dungeons.dos, level, showTop3);  
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Mists of Tirna Scithe", "Mists", Dungeons.mist, level, showTop3);   
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Halls of Atonement", "HoA", Dungeons.hoa, level, showTop3);  
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Sanguine Depths", "SD", Dungeons.sd, level, showTop3);      
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Plaguefall", "PF", Dungeons.pf, level, showTop3);    
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Theater of Pain", "ToP", Dungeons.top, level, showTop3);     
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Necrotic Wake", "NW", Dungeons.nw, level, showTop3);     
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Spires of Ascension", "SoA", Dungeons.soa, level, showTop3);    
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Streets of Wonder", "Streets", Dungeons.strt, level, showTop3); 
      // await interaction.editReply({ embeds: [embedMessage] });

      // embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "So'Leah's Gambit", "Gambit", Dungeons.gmbt, level, showTop3);
      // await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Iron Docks", "ID", S4Dungeons.id, level, metric, showTop3);  
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Grimrail Depot", "GD", S4Dungeons.gd, level,metric, showTop3);   
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Lower Karazhan", "LK", S4Dungeons.lwkz, level, metric, showTop3);  
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Upper Karazhan", "UK", S4Dungeons.upkz, level, metric, showTop3);      
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Mechagon JunkYard", "MJ", S4Dungeons.omj, level, metric, showTop3);    
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Mechagon Workshop", "MW", S4Dungeons.omw, level, metric, showTop3);     
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "Streets of Wonder", "Streets", S4Dungeons.strt, level, metric, showTop3); 
      await interaction.editReply({ embeds: [embedMessage] });

      embedMessage = await AddDungeon(charName, realm, region, axios, embedMessage, "So'Leah's Gambit", "Gambit", S4Dungeons.gmbt, level, metric, showTop3);
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
            {name: `${affix.name}:`, 
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
      let charName = interaction.options.getString("charactername");
      let show = interaction.options.getBoolean('show');
      let defaultDescription = `Displays your highest 10 keys you finished this week, provided by Raider.IO.`;
      console.log(`Parsed Message understood as: WeeklyKeys for Char: ${charName} on: ${realm} in: ${region}.`);
      await interaction.deferReply({ephemeral: !show});
      console.log("Requesting Weekly keys");
      let embedMessage = GetWeeklyKeysInitialResponse(region, defaultDescription);
      await interaction.editReply({ embeds: [embedMessage] });
      var weeklies = await GetHighestThisWeek(region, realm, charName);
      let message = FormatRaiderIOData(defaultDescription, weeklies.faction, weeklies.race, weeklies.gender, weeklies.class, weeklies.active_spec_name, weeklies.name, weeklies.profile_url);
      embedMessage.setDescription(message);
      embedMessage.setThumbnail(weeklies.thumbnail_url);
      let keyArr = weeklies.mythic_plus_weekly_highest_level_runs.map(a => a.mythic_level);
      //console.log(keyArr);
      message = (`${message}${AddWeeklyKeysSummary(keyArr)}`);
      if(weeklies.mythic_plus_weekly_highest_level_runs.length >=1){
        let header = "**__Top 10 Keys:__**";
        message = `${message}\n\n\n${header}\n\n`;
        embedMessage.setDescription(message);
        weeklies.mythic_plus_weekly_highest_level_runs.forEach(weekly => {
          let completed = Date.parse(weekly.completed_at);
          let date = new Date(completed);
          let niceDate = date.toLocaleDateString([], { hour: '2-digit', minute: '2-digit' });
          let starString = GetStars(weekly.num_keystone_upgrades);
  
          let message = `Level: [${weekly.mythic_level}](${weekly.url})${starString}\nCompleted: ${niceDate} \nTime Taken: ${TimeSpanFromMS(weekly.clear_time_ms)}`;
  
          embedMessage.addFields(
            [{ 
            name: `${TrimDungeonName(weekly.dungeon)}:`, 
          value: `${message}`,
          inline: true
          }]
        );
        });
      }
      else{
        message = `${message}\n\n\n *No Keys completed this week*`
        embedMessage.setDescription(message);
      }

      embedMessage = SetFooter(embedMessage);
      await interaction.editReply({ embeds: [embedMessage] });
    }

    else if(interaction.commandName === 'guildleaderboard'){
      await interaction.deferReply({ephemeral: true});

      let region = interaction.options.getString("region").toLocaleLowerCase();
      let realm = interaction.options.getString("realm").toLocaleLowerCase();
      let guildname = interaction.options.getString("guildname");
      let role = interaction.options.getString("role");

      if(role == null){
        role = "all";
      }
      console.log(`Parsed Message understood as: guild leaderboard for guild: ${guildname} on: ${realm} in: ${region} with role: ${role}`);
      let FormattedRoster =[];
      let Roster = await RaiderIO.GetGuildLeaderBoard(region,realm,guildname);

      let embedMessage = GetGuildLeaderBoardInitialResponse(guildname, region, realm, role);
      await interaction.editReply({ embeds: [embedMessage] });

      Roster.forEach(member=>{
        if(member.character != null){
          if(member.keystoneScores != null){
            if(member.character.items != null){
              if(member.keystoneScores.allScore > 0){
                let char = {
                  name: member.character.name,
                  class: `${member.character.spec.name}`,
                  role: member.character.spec.role,
                  isMelee: member.character.spec.is_melee,
                  iLVL: member.character.items.item_level_equipped,
                  score: member.keystoneScores.allScore,
                  emojii: ""
                };
                // switch(member.character.class.name){
                //   case "Priest":
                //       char.emojii = Classes.priest;
                //       break;
                //     case "Demon Hunter":
                //       char.emojii = Classes.demonHunter;
                //       break;
                //     case "Death Knight":
                //       char.emojii = Classes.deathKnight;
                //       break;
                //     case "Druid":
                //       char.emojii = Classes.druid;
                //       break;
                //     case "Hunter":
                //       char.emojii = Classes.hunter;
                //       break;
                //     case "Warlock":
                //       char.emojii = Classes.warlock;
                //       break;
                //     case "Mage":
                //       char.emojii = Classes.mage;
                //       break;
                //     case "Monk":
                //       char.emojii = Classes.monk;
                //       break;
                //     case "Paladin":
                //       char.emojii = Classes.paladin;
                //       break;
                //     case "Rogue":
                //       char.emojii = Classes.rogue;
                //       break;
                //     case "Shaman":
                //       char.emojii = Classes.shaman;
                //       break;
                //     case "Warrior":
                //       char.emojii = Classes.warrior;
                //       break;
                //   default:
                //     break;
                // };
                     
                char.emojii = GetClassIcon(member.character.class.name);
               
                FormattedRoster.push(char);
              }           
            }
            else{
              console.log("items empty");
            }
          }
          else{
            console.log("Keystone scores empty, ignoring");
          }
        }
        else{
          console.log("Char data empty, ignoring");
        }
      });

      switch(role){
        case "rdps":
        FormattedRoster = FormattedRoster.filter(obj=>{
          return obj.role === "dps" && 
            obj.isMelee == false});
            break;
        case "mdps":
          FormattedRoster = FormattedRoster.filter(obj=>{
            return obj.role === "dps" && 
            obj.isMelee == true});
            break;
        case "healer":
          FormattedRoster = FormattedRoster.filter(obj=>{
            return obj.role === "healer"});
            break;
        case "tank":
          FormattedRoster = FormattedRoster.filter(obj=>{
            return obj.role === "tank"});
            break;
          
        default:
           break;
          };
      
      let results = FormattedRoster.sort((firstItem, secondItem) => firstItem.score - secondItem.score).reverse().slice(0,15);
      
      let count =1;
      results.forEach(result=>{

        embedMessage.addFields({
          name: `#${count} - ${result.emojii} ${result.name}`,
          value: 
`IO Score: [**${result.score}**](https://raider.io/characters/${region}/${realm}/${encodeURI(result.name)})
ilvl: **${result.iLVL}**
Role: **${result.role}**`,
                  inline: true
        }
        );
        count++;
      });

      //let message = JSON.stringify(results);
      //embedMessage.setDescription(Classes.druid);
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

    if(interaction.deferred || interaction.replied){
      await interaction.followUp({embeds:[embed],ephemeral: true});
    }
    else{

      await interaction.followUp({embeds: [embed],ephemeral: true });
    }
    
  }
});


DBConnection = mysql.createConnection({
  host: DBConnectionManager.Host,
  database: DBConnectionManager.DBName,
  user: DBConnectionManager.DBUser,
  password: DBConnectionManager.DBPassword
});

DBConnection.connect(function(err) {
  if (err){
    console.log("Database Connection error: " + err);
  }
  else{
    console.log("Database Connected!");
    AddActivity("Server Startup");
  }
 
});


client.login(PasswordManager.DiscordToken); //login bot using token
