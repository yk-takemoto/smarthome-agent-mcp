import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

export class DeviceControlClient {
  private client: Client;

  constructor(
    private devCtlConfig = {
      nodeHome: process.env.NODE_HOME!,
      devCtlServerRootPath: process.env.DEVCTL_SERVER_ROOTPATH!,
    },
  ) {
    this.initCheck(devCtlConfig);

    const transport = new StdioClientTransport({
      command: `${this.devCtlConfig.nodeHome}/bin/node`,
      args: [
        `${this.devCtlConfig.devCtlServerRootPath}/build/index.js`
      ],
      env: {
        DEVCTL_SERVER_ROOTPATH: this.devCtlConfig.devCtlServerRootPath,
        SWITCHBOT_TOKEN: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_TOKEN || process.env.SWITCHBOT_TOKEN || "",
        SWITCHBOT_SECRET_KEY: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_SECRET_KEY || process.env.SWITCHBOT_SECRET_KEY || "",
        SWITCHBOT_ENDPOINT: process.env.SWITCHBOT_ENDPOINT!,
        SWITCHBOT_FUNCTION_DEVICEIDS_MAP: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_FUNCTION_DEVICEIDS_MAP || process.env.SWITCHBOT_FUNCTION_DEVICEIDS_MAP || ""
      }
    });

    this.client = new Client({
      name: "devctl-client",
      version: "1.0.0",
    }, {
      capabilities: {}
    });

    this.connect(transport);
  }

  private initCheck(devCtlConfig: Record<string, string>) {
    for (const key of Object.keys(this.devCtlConfig)) {
      if (!devCtlConfig[key]) {
        throw new Error(`llmConfig.${key} is required but not set.`);
      }
    }
  }

  private async connect(transport: StdioClientTransport) {
    await this.client.connect(transport);
  }

  async listToolResultSchema() {
    const result = await this.client.request(
      { method: "tools/list" },
      ListToolsResultSchema
    );
    return result.tools;
  }

  async callToolResultSchema(tool: {name: string, arguments: Record<string, any>}) {
    const result = await this.client.request(
      {
        method: "tools/call",
        params: tool,
      },
      CallToolResultSchema
    );
    return result.content;
  }
}