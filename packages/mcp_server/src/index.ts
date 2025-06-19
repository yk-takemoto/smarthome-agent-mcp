#!/usr/bin/env node

import dotenv from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import getServer from "./server.js";
import getHttpApp from "./http_app.js";
import getOAuthApp from "./oauth_app.js";

dotenv.config();

// Start the server
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0 && (args[0] === "--http" || args[0] === "--http-stateless")) {
    const isHttpStatefull = args[0] === "--http";
    const port = parseInt(args[1], 10) || 3000;
    const app = process.env.MCP_AUTH_MODE === "oauth" ? getOAuthApp(isHttpStatefull) : getHttpApp(isHttpStatefull);
    app.listen(port, () => {
      console.log(`Smart home agent MCP Streamable HTTP Server (${isHttpStatefull ? "statefull" : "stateless"}) listening on port ${port}`);
    });
  } else {
    console.error("No transport specified, falling back to stdio");
    const transport = new StdioServerTransport();
    const stdioServer = getServer();
    await stdioServer.connect(transport);
    console.error("Smart home agent MCP Server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
