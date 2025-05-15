import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createInterface } from "readline/promises";

dotenv.config();
let client: Client;
let transport: StdioClientTransport | StreamableHTTPClientTransport;

const testToolDataList: { [k: string]: { name: string; argPattern: any[] } } = {
  tv: {
    name: "tv",
    argPattern: [
      {
        commandType: "power",
        commandOfPowerchange: "turnOn",
      },
      {
        commandType: "channel",
        commandOfChannelsetting: "1",
      },
      {
        commandType: "volume",
        commandOfVolumechange: "1",
      },
    ],
  },
  light: {
    name: "light",
    argPattern: [
      {
        commandTarget: "main",
        commandTurning: "turnOn",
      },
      {
        commandTarget: "next",
        commandTurning: "turnOff",
      },
    ],
  },
  aircon: {
    name: "aircon",
    argPattern: [
      {
        commandTarget: "main",
        commandType: "power",
        commandOfPowerturning: "turnOn",
      },
      {
        commandTarget: "work",
        commandType: "mode",
        commandOfModechange: "2:cool",
      },
      {
        commandTarget: "bed",
        commandType: "tempchange",
        commandOfTempchange: 1,
      },
    ],
  },
};

const getStdioClientTransport = () => {
  return new StdioClientTransport({
    command: `${process.env.NODE_HOME || ""}/bin/node`,
    args: [`${process.env.MCPSERVER_ROOTPATH || ""}/build/index.js`],
    env: {
      MCPSERVER_ROOTPATH: process.env.MCPSERVER_ROOTPATH || "",
      SWITCHBOT_TOKEN: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_TOKEN || process.env.SWITCHBOT_TOKEN || "",
      SWITCHBOT_SECRET_KEY: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_SECRET_KEY || process.env.SWITCHBOT_SECRET_KEY || "",
      SWITCHBOT_ENDPOINT: process.env.SWITCHBOT_ENDPOINT || "",
      SWITCHBOT_FUNCTION_DEVICEIDS_MAP:
        JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_FUNCTION_DEVICEIDS_MAP || process.env.SWITCHBOT_FUNCTION_DEVICEIDS_MAP || "",
      ...(process.env.NODE_EXTRA_CA_CERTS ? { NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS } : {}),
    },
  });
};

const getStreamableHTTPServerTransport = () => {
  return new StreamableHTTPClientTransport(new URL("http://localhost:3100/mcp"), {
    sessionId: undefined,
  });
};

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function listTools() {
  const res = await client.request({ method: "tools/list" }, ListToolsResultSchema);
  return res.tools;
}

const callTool = async (tool: { name: string; arguments: Record<string, any> }) => {
  try {
    const res = await client.request(
      {
        method: "tools/call",
        params: tool,
      },
      CallToolResultSchema,
    );
    console.log("Tool response:");

    res.content.forEach((item) => {
      if (item.type === "text") {
        console.log(item.text);
      } else {
        console.log(item.type + "content", item);
      }
    });
    console.log("------------------------------");
  } catch (error) {
    console.error("Error calling tool:", error);
  }
};

async function main() {
  client = new Client({
    name: "smarthome-agent_client",
    version: "0.1.0",
  });
  client.onerror = (error) => {
    console.error("Client error:", error);
  };

  console.log("Select transport:");
  console.log("streamable-http");
  console.log("else. stdio");
  console.log("------------------------------");

  const answer = await readline.question("Enter your input: ");

  transport = answer === "streamable-http" ? getStreamableHTTPServerTransport() : getStdioClientTransport();
  await client.connect(transport);

  while (true) {
    console.log("Avaible commands:");
    console.log("list-tools");
    console.log("call-tool");
    console.log("exit");
    console.log("------------------------------");

    const answer = await readline.question("Enter your input: ");

    switch (answer) {
      case "list-tools": {
        const tools = await listTools();
        if (tools.length === 0) {
          console.log("No tools available.");
        } else {
          for (const tool of tools) {
            console.log(`Tool Name: ${tool.name}`);
            console.log(`Tool Description: ${tool.description}`);
            console.log("------------------------------");
          }
        }
        break;
      }
      case "call-tool": {
        const tools = await listTools();
        if (tools.length === 0) {
          console.log("No tools available.");
          break;
        }
        console.log("Select tool name:");
        tools.forEach((tool) => {
          console.log(`${tool.name}`);
        });
        console.log("------------------------------");

        const answer = await readline.question("Enter your input: ");

        const testData = testToolDataList[answer];

        console.log("Select tool argPattern:");
        testData.argPattern.forEach((arg, index) => {
          console.log(`${index + 1}. ${JSON.stringify(arg)}`);
        });
        console.log("------------------------------");

        const answer2 = await readline.question("Enter your input: ");

        const argPattern = testData.argPattern[Number(answer2) - 1];
        if (!argPattern) {
          console.log("Invalid argPattern selected.");
          break;
        }
        const tool = {
          name: testData.name,
          arguments: argPattern,
        };
        console.log("Tool selected:", tool);
        console.log("Calling tool...");
        console.log("------------------------------");

        await callTool(tool);
        break;
      }
      case "exit":
        await disconnect();
        return;
      default:
        console.log("You entered:", answer);
        break;
    }
  }
}

async function disconnect() {
  await transport.close();
  await client.close();
  readline.close();
  console.log("Disconnected from server.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  disconnect();
});
