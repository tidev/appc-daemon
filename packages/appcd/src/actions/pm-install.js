export default async ({ console }) => {
	const { action } = await import('../commands/pm/install');
	await action({
		argv: {
			plugins: [ 'default' ]
		},
		console
	});
};
