// @ts-expect-error -- https://github.com/egoist/parse-package-name/issues/30
import { parse as parsePackageName } from "parse-package-name";
import sortKeys from "sort-keys";
import { z } from "zod";

import { base } from "../base.js";
import { getPackageDependencies } from "../data/packageData.js";
import { blockDevelopmentDocs } from "./blockDevelopmentDocs.js";
import { blockGitHubActionsCI } from "./blockGitHubActionsCI.js";
import { blockPackageJson } from "./blockPackageJson.js";
import { blockRemoveDependencies } from "./blockRemoveDependencies.js";
import { blockRemoveFiles } from "./blockRemoveFiles.js";
import { blockRemoveWorkflows } from "./blockRemoveWorkflows.js";
import { blockVSCode } from "./blockVSCode.js";
import { CommandPhase } from "./phases.js";

const zRuleOptions = z.union([
	z.literal("error"),
	z.literal("off"),
	z.literal("warn"),
	z.union([
		z.tuple([z.union([z.literal("error"), z.literal("warn")]), z.unknown()]),
		z.tuple([
			z.union([z.literal("error"), z.literal("warn")]),
			z.unknown(),
			z.unknown(),
		]),
	]),
]);

const zExtensionRules = z.union([
	z.record(z.string(), zRuleOptions),
	z.array(
		z.object({
			comment: z.string().optional(),
			entries: z.record(z.string(), zRuleOptions),
		}),
	),
]);

const zExtension = z.object({
	extends: z.array(z.string()).optional(),
	files: z.array(z.string()).optional(),
	languageOptions: z.unknown().optional(),
	linterOptions: z.unknown().optional(),
	plugins: z.record(z.string(), z.string()).optional(),
	rules: zExtensionRules.optional(),
	settings: z.record(z.string(), z.unknown()).optional(),
});

const zPackageImport = z.object({
	source: z.string(),
	specifier: z.string(),
	types: z.boolean().optional(),
});

export const blockESLint = base.createBlock({
	about: {
		name: "ESLint",
	},
	addons: {
		beforeLint: z.string().optional(),
		explanations: z.array(z.string()).default([]),
		extensions: z.array(z.union([z.string(), zExtension])).default([]),
		ignores: z.array(z.string()).default([]),
		imports: z.array(zPackageImport).default([]),
		rules: zExtensionRules.optional(),
		settings: z.record(z.string(), z.unknown()).optional(),
	},
	produce({ addons, options }) {
		const { explanations, extensions, ignores, imports, rules, settings } =
			addons;

		const [configFileName, fileExtensions] =
			options.type === "commonjs"
				? ["eslint.config.mjs", "js,mjs,ts"]
				: ["eslint.config.js", "js,ts"];

		const explanation =
			explanations.length > 0
				? `${explanations
						.map((explanation) => `/*\n${explanation}\n*/\n`)
						.join("")}\n`
				: "";

		const importLines = [
			'import eslint from "@eslint/js";',
			'import tseslint from "typescript-eslint";',
			...imports.map(
				(packageImport) =>
					`import ${packageImport.specifier} from "${packageImport.source}"`,
			),
		].sort((a, b) =>
			a.replace(/.+from/, "").localeCompare(b.replace(/.+from/, "")),
		);

		const ignoreLines = ["lib", "node_modules", "pnpm-lock.yaml", ...ignores]
			.map((ignore) => JSON.stringify(ignore))
			.sort();

		const extensionLines = [
			printExtension({
				extends: [
					"tseslint.configs.strictTypeChecked",
					"tseslint.configs.stylisticTypeChecked",
				],
				files: [`**/*.{${fileExtensions}}`],
				languageOptions: {
					parserOptions: {
						projectService: {
							allowDefaultProject: Array.from(
								new Set(
									[
										"*.config.*s",
										...(typeof options.bin === "object"
											? Object.values(options.bin)
											: [options.bin]),
									]
										.filter(Boolean)
										.sort(),
								),
							),
						},
						tsconfigRootDir: "import.meta.dirname",
					},
				},
				...(rules && { rules }),
				...(settings && { settings }),
			}),
			...(options.type === "commonjs"
				? [
						printExtension({
							files: ["*.mjs"],
							languageOptions: { sourceType: "module" },
						}),
					]
				: []),
			...extensions.map((extension) =>
				typeof extension === "string" ? extension : printExtension(extension),
			),
		]
			.sort((a, b) => processForSort(a).localeCompare(processForSort(b)))
			.map((t) => t);

		return {
			addons: [
				blockDevelopmentDocs({
					sections: {
						Linting: {
							contents: {
								after: [
									`
For example, ESLint can be run with \`--fix\` to auto-fix some lint rule complaints:

\`\`\`shell
pnpm run lint --fix
\`\`\`
`,
									...(addons.beforeLint ? [addons.beforeLint] : []),
								],
								before: `
This package includes several forms of linting to enforce consistent code quality and styling.
Each should be shown in VS Code, and can be run manually on the command-line:
`,
								items: [
									`- \`pnpm lint\` ([ESLint](https://eslint.org) with [typescript-eslint](https://typescript-eslint.io)): Lints JavaScript and TypeScript source files`,
								],
								plural: `Read the individual documentation for each linter to understand how it can be configured and used best.`,
							},
						},
					},
				}),
				blockGitHubActionsCI({
					jobs: [
						{
							name: "Lint",
							steps: [
								...(options.bin ? [{ run: "pnpm build" }] : []),
								{ run: "pnpm lint" },
							],
						},
					],
				}),
				blockPackageJson({
					properties: {
						devDependencies: getPackageDependencies(
							"@eslint/js",
							"@types/node",
							"eslint",
							"typescript-eslint",
							...imports.flatMap(({ source, types }) => {
								// eslint-disable-next-line @typescript-eslint/no-unsafe-call -- https://github.com/egoist/parse-package-name/issues/30
								const { name } = parsePackageName(source) as { name: string };
								return types ? [name, `@types/${name}`] : [name];
							}),
						),
						scripts: {
							lint: "eslint . --max-warnings 0",
						},
					},
				}),
				blockVSCode({
					extensions: ["dbaeumer.vscode-eslint"],
					settings: {
						"editor.codeActionsOnSave": {
							"source.fixAll.eslint": "explicit",
						},
						"eslint.probe": [
							"javascript",
							"javascriptreact",
							"json",
							"jsonc",
							"markdown",
							"typescript",
							"typescriptreact",
							"yaml",
						],
						"eslint.rules.customizations": [{ rule: "*", severity: "warn" }],
					},
				}),
			],
			files: {
				[configFileName]: `${explanation}${importLines.join("\n")}

export default tseslint.config(
	{ ignores: [${ignoreLines.join(", ")}] },
	${printExtension({
		linterOptions: { reportUnusedDisableDirectives: "error" },
	})},
	eslint.configs.recommended,
	${extensionLines.join(",")}
);`,
			},
			scripts: [
				{
					commands: ["pnpm lint --fix"],
					phase: CommandPhase.Process,
				},
			],
		};
	},
	transition({ options }) {
		return {
			addons: [
				blockRemoveDependencies({
					dependencies: [
						"@types/eslint",
						"@typescript-eslint/eslint-plugin",
						"@typescript-eslint/parser",
						"eslint-plugin-deprecation",
						"eslint-plugin-eslint-comments",
						"eslint-plugin-no-only-tests",
						"jsonc-eslint-parser",
						"yaml-eslint-parser",
					],
				}),
				blockRemoveFiles({
					files: [
						".eslintrc*",
						".eslintignore",
						options.type === "commonjs"
							? "eslint.config.{cjs,js}"
							: "eslint.config.{cjs,mjs}",
					],
				}),
				blockRemoveWorkflows({
					workflows: ["eslint", "lint"],
				}),
			],
		};
	},
});

function printExtension(extension: z.infer<typeof zExtension>) {
	return [
		"{",
		extension.extends && `extends: [${extension.extends.join(", ")}],`,
		extension.files &&
			`files: [${extension.files.map((glob) => JSON.stringify(glob)).join(", ")}],`,
		extension.languageOptions &&
			`languageOptions: ${JSON.stringify(extension.languageOptions).replace('"import.meta.dirname"', "import.meta.dirname")},`,
		extension.linterOptions &&
			`linterOptions: ${JSON.stringify(extension.linterOptions)}`,
		extension.rules && `rules: ${printExtensionRules(extension.rules)},`,
		extension.settings &&
			`settings: ${JSON.stringify(sortKeys(extension.settings))},`,
		"}",
	]
		.filter(Boolean)
		.join(" ");
}

function printExtensionRules(rules: z.infer<typeof zExtensionRules>) {
	if (!Array.isArray(rules)) {
		return JSON.stringify(rules);
	}

	return [
		"{",
		...rules.flatMap((group) => [
			printGroupComment(group.comment),
			...Object.entries(group.entries).map(
				([ruleName, options]) => `"${ruleName}": ${JSON.stringify(options)},`,
			),
		]),
		"}",
	].join("");
}

function printGroupComment(comment: string | undefined) {
	return comment ? `\n\n// ${comment.replaceAll("\n", "\n// ")}\n` : "";
}

function processForSort(line: string) {
	if (line.startsWith("...") || /\w+/.test(line[0])) {
		return `A\n${line.replaceAll(/\W+/g, "")}`;
	}

	return `B\n${(/files: (.+)/.exec(line)?.[1] ?? line).replaceAll(/\W+/g, "")}`;
}
