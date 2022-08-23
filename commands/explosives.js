const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('explosives')
		.setDescription('retrieves wcl explosive data')
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
        console.log('Received explosives');
		//await interaction.reply('Not right now!');
	},
};