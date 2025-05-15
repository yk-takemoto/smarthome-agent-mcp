#!/usr/bin/env node

import "reflect-metadata";
import * as fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { container } from "tsyringe";
import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createContexts, serverConfigSchema } from "@yk-takemoto/mcp-handler";
import { SwitchBotTVControlFunction, SwitchBotLightControlFunction, SwitchBotAirconControlFunction } from "./functions/index.js";
import { devctlTools } from "./tools/index.js";

container.register("SwitchBotTVControlFunction", {
  useClass: SwitchBotTVControlFunction,
});
container.register("SwitchBotLightControlFunction", {
  useClass: SwitchBotLightControlFunction,
});
container.register("SwitchBotAirconControlFunction", {
  useClass: SwitchBotAirconControlFunction,
});

const getConfig = (serverRootPath: string = process.env.MCPSERVER_ROOTPATH!) => {
  const config = yaml.load(fs.readFileSync(path.resolve(serverRootPath, "config.yaml"), "utf-8"));
  return serverConfigSchema.parse(config);
};
const serverContexts = createContexts(getConfig());
const functions = serverContexts.devctl.function;

// Create server instance
const server = new Server(
  {
    name: "smarthome-agent_server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [...devctlTools],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const functionToCall = functions[name];
    const toolResult = functionToCall ? await functionToCall(args) : { error: `${name} is not available` };
    // debug
    console.error(`[mcpServer#CallToolRequestSchema] name: ${name}, args: ${args}, "toolResult: ${toolResult}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ args, toolResult }),
        },
      ],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid arguments: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`);
    }
    throw error;
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Smart home agent MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
