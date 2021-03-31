"use strict";

import screeps from "rollup-plugin-screeps";

let cfg;
const dest = process.env.DEST;
if (!dest) {
  throw new Error("No destination specified");
} else if ((cfg = require("./screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default {
  input: "dummy.js",
  output: {
    file: "dist/dummy.js",
    format: "cjs"
  },

  plugins: [screeps({ config: cfg, dryRun: cfg == null })]
};
