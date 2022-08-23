const axios = require('axios');
https://raider.io/api#/
module.exports = {
   


LookupRecentPlayerReports: async function (charName, realm, region, WCLToken) {
    let charQuery = {
      query: `{
        characterData{
          character(name: \"${charName}\", serverRegion:\"${region}\", serverSlug:\"${realm}\"){
            recentReports(limit: 10){
              data{
                masterData{
                  actors(type: "player"){
                    gameID,
                    id,
                    name
                  }
                },
                code,
                startTime,
                fights(difficulty: 10,killType: Kills){
                  keystoneLevel,
                  kill,
                  name,
                  startTime,
                  keystoneBonus,
                  endTime,
                  keystoneAffixes,
                  id,
                  friendlyPlayers,
                  enemyNPCs{
                    id,
                    gameID
                  }
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
    return await axios.post('https://www.warcraftlogs.com/api/v2/client',
    charQuery, config
  ).then(res => {
    //console.log(`statusCode: ${res.status}`);
    let details = res.data
    return details.data.characterData.character.recentReports.data;

  })
    .catch(error => {
      console.error(error);
    });
},

GetExplosiveCount: async function (report,fightID,explosiveID, startTime, WCLToken) {
    let charQuery = {
      query: `{
        reportData {
            report(code: "${report}") {
                graph(fightIDs: ${fightID}, dataType: Casts, startTime: ${startTime}, endTime: 1000000000, targetID: ${explosiveID})
            }
        }
    }`
    };
    //console.log(JSON.stringify(charQuery,null,4));

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
    //console.log(`statusCode: ${res.status}`);
    let details = res.data
    //console.log(JSON.stringify( details.data.reportData.report.graph.data.series));
    return details.data.reportData.report.graph.data.series;
  })
    .catch(error => {
      console.error(error);
    });
}

};


