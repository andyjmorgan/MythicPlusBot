const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('guildleaderboard')
		.setDescription('retrieves the guild leaderboard')
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
            option.setName('guildname')
                .setDescription('Warcraft guild name')
                .setRequired(true)
        ).addStringOption(option=>
            option.setName('role')
                .setDescription('Report type')
                .setRequired(true)
                .addChoices(
                    {name: 'All', value: 'all'},
                    {name: 'Healer', value: "healer"},
                    {name: 'Ranged DPS', value: 'rdps'},
                    {name: 'Melee DPS', value: 'mdps'},
                    {name: 'Tank', value: 'tank'}
                )
        ).addBooleanOption(option =>
            option.setName('show')
                .setDescription('Show this report publically')
                .setRequired(false)
        ),

	async execute(interaction) {
        console.log('Received leaderboard');
		//await interaction.reply('Not right now!');
	},
};