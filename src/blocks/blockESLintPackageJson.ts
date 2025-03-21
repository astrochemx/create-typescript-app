import { base } from "../base.js";
import { blockESLint } from "./blockESLint.js";

export const blockESLintPackageJson = base.createBlock({
	about: {
		name: "ESLint package.json Plugin",
	},
	produce() {
		return {
			addons: [
				blockESLint({
					extensions: ["packageJson.configs.recommended"],
					imports: [
						{
							source: "eslint-plugin-package-json",
							specifier: "packageJson",
						},
					],
				}),
			],
		};
	},
});
