"use strict";

import clear from "rollup-plugin-clear";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import screeps from "rollup-plugin-screeps";

const Global = `var process = {
  env: {
    npm_package_name: "${process.env.npm_package_name}",
    npm_package_version: "${process.env.npm_package_version}"
  }
}
global.__PROFILER_ENABLED__ = ${process.env.DEST === "sim" ? false : true};`;

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = require("./screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default {
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    format: "cjs",
    sourcemap: true,
    banner: Global
  },

  plugins: [
    clear({ targets: ["dist"] }),
    resolve(),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    screeps({ config: cfg, dryRun: cfg == null })
  ]
};
