const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('weeklykeys')
		.setDescription('retrieves your 10 highest key this week data from Raider.IO')
        .addStringOption(option=>
            option.setName('region')
                .setDescription('Characters Region')
                .setRequired(true)
                .addChoices(
                    {name: 'eu', value: 'EU'},
                    {name: 'us', value: 'US'}
                )
        )
        .addStringOption(option=>
            option.setName('realm')
                .setDescription('Characters Realm')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('charactername')
                .setDescription('Warcraft CharacterName')
                .setRequired(true)
        ),    

	async execute(interaction) {
        console.log('Received wcl');
		//await interaction.reply('Not right now!');
	},
};