const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('addguild')
		.setDescription('Sets the guild information for leaderboard purposes')
        .addStringOption(option=>
            option.setName('region')
                .setDescription('WoW Region')
                .setRequired(true)
                .addChoices(
                    {name: 'eu', value: 'EU'},
                    {name: 'us', value: 'US'}
                )
        )
        .addStringOption(option=> 
            option.setName('guild')
            .setDescription('guild name')
            .setRequired(true)
        ),
	async execute(interaction) {
        console.log('Received add guild');
		//await interaction.reply('Not right now!');
	},
};