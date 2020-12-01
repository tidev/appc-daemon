const agent = process.env.npm_config_user_agent;
if (agent && !agent.includes('yarn/')) {
	console.log('npm is not supported, please use Yarn');
	process.exit(1);
}
