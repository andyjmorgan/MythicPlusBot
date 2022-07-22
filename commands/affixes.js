const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('affixes')
		.setDescription('Retrieves this weeks affixes').addStringOption(option=>
            option.setName('region')
                .setDescription('WoW Region')
                .setRequired(true)
                .addChoices(
                    {name: 'eu', value: 'EU'},
                    {name: 'us', value: 'US'}
                )
        ),
	async execute(interaction) {
        console.log('Received wcl');
		//await interaction.reply('Not right now!');
	},
};