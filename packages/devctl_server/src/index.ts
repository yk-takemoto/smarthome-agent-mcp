#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import deviceControlTools from "./device_control_tools.js";
import deviceControlFunctions from "./device_control_functions.js";

const devCtlTools = deviceControlTools();
const devCtlFunctions = deviceControlFunctions();

// Create server instance
const server = new Server(
  {
    name: "devctl_server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: devCtlTools,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const functionToCall = devCtlFunctions[name];
    const functionOutput = functionToCall ? await functionToCall(args) : { error: `${name} is not available` };
    // debug
    console.error("[mpcServer#CallToolRequestSchema] ", name, args, "function_output: ", functionOutput);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...args, function_output: functionOutput }),
        },
      ],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Devctl MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});