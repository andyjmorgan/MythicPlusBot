const axios = require('axios');
https://raider.io/api#/
module.exports = {
   

LookupAffixes: async function (region) {

    let url = `https://raider.io/api/v1/mythic-plus/affixes?region=${region}&locale=en`
    
    return await axios.get(encodeURI(url)).then(res => {
    return res.data;
    })
    .catch(error => {
        console.error(error);
    });
},


GetHighestThisWeek: async function (region,realm,char) {

    let url = `https://raider.io/api/v1/characters/profile?region=${region}&realm=${realm}&name=${char}&fields=mythic_plus_weekly_highest_level_runs`
    return await axios.get(encodeURI(url)).then(res => {
      return res.data;
    })
      .catch(error => {
        console.error(error);
    });
},


GetGuildLeaderBoard: async function (region, realm, guild) {
    let url = `https://raider.io/api/guilds/roster?region=${region}&realm=${realm}&guild=${guild}`
    return await axios.get(encodeURI(url)).then(res => {
        return res.data.guildRoster.roster;
      })
        .catch(error => {
          console.error(error);
      });
}

};


