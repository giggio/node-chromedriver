const globals = require("globals");
const js = require("@eslint/js");

const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [...compat.extends("eslint:recommended"), {
    languageOptions: {
        globals: {
            ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, "off"])),
            ...globals.commonjs,
            ...globals.node,
        },

        ecmaVersion: 2020,
        sourceType: "commonjs",

        parserOptions: {
            ecmaFeatures: {
                jsx: false,
            },
        },
    },

    rules: {
        "no-const-assign": "warn",
        "no-this-before-super": "warn",
        "no-undef": "warn",
        "no-unreachable": "warn",
        "no-unused-vars": "warn",
        "constructor-super": "warn",
        "valid-typeof": "warn",
        semi: "error",
        "no-console": "off",
        "no-var": "error",
        "prefer-const": "error",
    },
}, {
    files: ["tests/**/*"],

    languageOptions: {
        globals: {
            ...globals.jest,
        },
    },
}];
