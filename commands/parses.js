const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('parses')
		.setDescription('retrieves wcl parse data')
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
        )       
        .addStringOption(option =>
            option.setName('reporttype')
                .setDescription('Choose the report type you would like')
                .addChoices(
                    {name: 'best', value: 'Best'},
                    {name: 'top3', value: 'Top3'},
                    {name: 'highest', value: 'Highest'}
                )
                .setRequired(false)
        )
        .addIntegerOption(option=>
            option.setName('level')
                .setDescription('Minimum key level')
                .setRequired(false)
        ),



	async execute(interaction) {
        console.log('Received wcl');
		//await interaction.reply('Not right now!');
	},
};