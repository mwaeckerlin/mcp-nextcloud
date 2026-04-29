#!/usr/bin/env node
import { startServer } from "./server.js";

startServer().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
