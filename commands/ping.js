const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('piing')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
        console.log("Received ping");
		await interaction.reply('Pong!');
	},
};