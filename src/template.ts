import { base } from "./base.js";
import { blockAreTheTypesWrong } from "./blocks/blockAreTheTypesWrong.js";
import { blockCTATransitions } from "./blocks/blockCTATransitions.js";
import { blockNcc } from "./blocks/blockNcc.js";
import { blockRemoveDependencies } from "./blocks/blockRemoveDependencies.js";
import { blockRemoveFiles } from "./blocks/blockRemoveFiles.js";
import { presetCommon } from "./presets/common.js";
import { presetEverything } from "./presets/everything.js";
import { presetMinimal } from "./presets/minimal.js";

export const template = base.createStratumTemplate({
	about: {
		name: "Create TypeScript App",
		repository: {
			owner: "JoshuaKGoldberg",
			repository: "create-typescript-app",
		},
	},
	blocks: [
		blockAreTheTypesWrong,
		blockCTATransitions,
		blockNcc,
		blockRemoveDependencies,
		blockRemoveFiles,
	],
	presets: [presetMinimal, presetCommon, presetEverything],
	suggested: presetCommon,
});
