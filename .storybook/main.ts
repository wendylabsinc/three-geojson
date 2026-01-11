import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
	stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx)'],
	addons: [
		'@storybook/addon-essentials',
		'@storybook/addon-controls',
	],
	framework: {
		name: '@storybook/html-vite',
		options: {},
	},
	viteFinal: async (config) => {
		return config;
	},
};

export default config;
