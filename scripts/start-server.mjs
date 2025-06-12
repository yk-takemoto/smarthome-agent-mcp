#!/usr/bin/env node

import { spawn } from "child_process";

const args = process.argv.slice(2);
const environment = args[0] || "start";
const transportMode = args[1] || "default";
const execMode = args[2] || "all";
const mcpServerUrl = args[3] || "http://localhost:3100/mcp";

const portMatch = mcpServerUrl.match(/:(\d+)/);
const port = portMatch ? portMatch[1] : "80";
if (isNaN(port) || port < 1 || port > 65535) {
  console.error("Invalid port number. Please provide a valid port between 1 and 65535.");
  process.exit(1);
}

let transportType;
let serverArg = "";

if (transportMode === "http") {
  transportType = "streamableHttp";
  serverArg = `--http ${port}`;
} else if (transportMode === "http-stateless") {
  transportType = "streamableHttpStateless";
  serverArg = `--http-stateless ${port}`;
}

const env = {
  ...process.env
};

if (transportType) {
  env.MCP_CLIENT_TRANSPORT_TYPE = transportType;
  env.MCPSERVER_URL = mcpServerUrl;
}

let serverCmd;
let webuiCmd;
if (transportMode !== "default" && (execMode === "mcp_server" || execMode === "all")) {
  serverCmd = `yarn workspace @smarthome-agent-mcp/mcp_server ${environment} ${serverArg}`.trim();
}
if (execMode === "webui" || execMode === "all") {
  webuiCmd = `yarn workspace @smarthome-agent-mcp/webui ${environment}`;
}

console.log(`Starting in ${environment} mode`);
if (transportMode !== "default") {
  console.log(`Environment variables set:
- MCP_CLIENT_TRANSPORT_TYPE: ${env.MCP_CLIENT_TRANSPORT_TYPE}
- MCPSERVER_URL: ${env.MCPSERVER_URL}`);
}

let command;
if (serverCmd && webuiCmd) {
  command = `concurrently "${serverCmd}" "${webuiCmd}"`;
} else if (serverCmd) {
  command = serverCmd;
} else if (webuiCmd) {
  command = webuiCmd;
}
if (!command) {
  console.error("No commands to execute. Please check your arguments.");
  process.exit(1);
}

console.log(`\nExecuting commands: ${command}\n`);
const concurrently = spawn(command, [], {
  shell: true,
  env,
  stdio: "inherit"
});

process.on("SIGINT", () => {
  concurrently.kill("SIGINT");
  process.exit(0);
});

concurrently.on("error", (err) => {
  console.error("Failed to start processes:", err);
  process.exit(1);
});

concurrently.on("close", (code) => {
  if (code !== 0) {
    console.log(`Process exited with code ${code}`);
  }
  process.exit(code);
});