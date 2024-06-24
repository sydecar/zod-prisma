#!/usr/bin/env node

// src/cli.ts
async function main() {
  try {
    await import("zod");
  } catch (e) {
    const RED = "\x1B[31m%s\x1B[0m";
    console.error(RED, "Please makes sure to install zod first.");
    process.exit(1);
  } finally {
    import("./src-5DZMUUJ7.mjs");
  }
}
main();
