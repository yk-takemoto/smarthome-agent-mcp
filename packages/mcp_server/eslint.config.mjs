import eslintBase from "./eslint.config.base.mjs";

export default [
  {
    files: ["{src,test}/**/*.{js,ts,yaml,yml,json}"],
  },
  {
    ignores: ["build/**/*", "*.ts", "apiDoc/**/*", "apiDoc/*", "dist/*"],
  },
  ...eslintBase,
];