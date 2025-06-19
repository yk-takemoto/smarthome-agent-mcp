import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { createAuthToken } from "./key_util";

const transportTypeSchema = z
  .enum(["stdio", "streamableHttp", "streamableHttpStateless"])
  .default("stdio");
type TransportType = z.infer<typeof transportTypeSchema>;

const mcpClientStdioConfigSchema = z.object({
  nodeHome: z.string().min(1),
  mcpServerRootPath: z.string().min(1),
  switchbotToken: z.string().min(1),
  switchbotSecretKey: z.string().min(1),
  switchbotEndpoint: z.string().min(1),
  switchbotFunctionDeviceidsMap: z.string().min(1),
  nodeExtraCaCerts: z.string().optional(),
});

const mcpClientStreamableHttpConfigSchema = z.object({
  mcpServerUrl: z.string().url().default("http://localhost:3000/mcp"),
});

export class ClientSession {
  readonly client: Client;
  readonly transport: StdioClientTransport | StreamableHTTPClientTransport;
  readonly userId: string | undefined;
  readonly sessionId: string | undefined;
  lastUsed: number;

  constructor(
    client: Client,
    transport: StdioClientTransport | StreamableHTTPClientTransport,
    sessionInfo?: { userId: string; sessionId?: string },
  ) {
    this.client = client;
    this.transport = transport;
    this.userId = sessionInfo?.userId;
    this.sessionId = sessionInfo?.sessionId;
    this.lastUsed = Date.now();
  }

  async close(): Promise<void> {
    try {
      await this.transport.close();
      await this.client.close();
    } catch (error) {
      console.error("[SessionManager] Error closing session:", error);
    }
  }

  touch(): void {
    this.lastUsed = Date.now();
  }
}

class McpClientManager {
  private readonly transportType: TransportType;
  private session: ClientSession | null = null;
  private statefullSessions: Map<string, ClientSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.transportType = transportTypeSchema.parse(
      process.env.MCP_CLIENT_TRANSPORT_TYPE || "stdio",
    );
    if (this.isStatefull()) {
      this.cleanupInterval = setInterval(
        () => this.cleanupSessions(),
        60 * 60 * 1000,
      );
    }
  }

  isStatefull(): boolean {
    return this.transportType === "streamableHttp";
  }

  private getStdioClientTransport(): StdioClientTransport {
    const mcpClientStdioConfig = mcpClientStdioConfigSchema.parse({
      nodeHome: process.env.NODE_HOME || "",
      mcpServerRootPath: process.env.MCPSERVER_ROOTPATH || process.cwd(),
      switchbotToken:
        JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_TOKEN ||
        process.env.SWITCHBOT_TOKEN ||
        "",
      switchbotSecretKey:
        JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_SECRET_KEY ||
        process.env.SWITCHBOT_SECRET_KEY ||
        "",
      switchbotEndpoint: process.env.SWITCHBOT_ENDPOINT || "",
      switchbotFunctionDeviceidsMap:
        JSON.parse(process.env.APP_SECRETS || "{}")
          .SWITCHBOT_FUNCTION_DEVICEIDS_MAP ||
        process.env.SWITCHBOT_FUNCTION_DEVICEIDS_MAP ||
        "",
      nodeExtraCaCerts: process.env.NODE_EXTRA_CA_CERTS,
    });

    return new StdioClientTransport({
      command: `${mcpClientStdioConfig.nodeHome}/bin/node`,
      args: [`${mcpClientStdioConfig.mcpServerRootPath}/build/index.js`],
      env: {
        MCPSERVER_ROOTPATH: mcpClientStdioConfig.mcpServerRootPath,
        SWITCHBOT_TOKEN: mcpClientStdioConfig.switchbotToken,
        SWITCHBOT_SECRET_KEY: mcpClientStdioConfig.switchbotSecretKey,
        SWITCHBOT_ENDPOINT: mcpClientStdioConfig.switchbotEndpoint,
        SWITCHBOT_FUNCTION_DEVICEIDS_MAP:
          mcpClientStdioConfig.switchbotFunctionDeviceidsMap,
        ...(mcpClientStdioConfig.nodeExtraCaCerts
          ? { NODE_EXTRA_CA_CERTS: mcpClientStdioConfig.nodeExtraCaCerts }
          : {}),
      },
    });
  }

  private getStreamableHTTPServerTransport(
    userId: string,
    sessionId?: string,
  ): StreamableHTTPClientTransport {
    const mcpClientStreamableHttpConfig =
      mcpClientStreamableHttpConfigSchema.parse({
        mcpServerUrl: process.env.MCPSERVER_URL,
      });
    const token = createAuthToken(userId);

    return new StreamableHTTPClientTransport(
      new URL(mcpClientStreamableHttpConfig.mcpServerUrl),
      {
        sessionId,
        requestInit: {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          mode: "cors",
        },
      },
    );
  }

  private async createSession(userId: string = ""): Promise<ClientSession> {
    if (this.isStatefull() && !userId) {
      throw new Error(
        "[McpClientManager#createSession] UserId is required for streamableHttp transport type.",
      );
    }

    const client = new Client({
      name: "smarthome-agent_client",
      version: "0.1.0",
    });
    client.onerror = (error) => {
      console.error(
        `[McpClientManager#createSession] Client error for user ${userId}:`,
        error,
      );
    };

    const transport =
      this.transportType === "streamableHttp" ||
      this.transportType === "streamableHttpStateless"
        ? this.getStreamableHTTPServerTransport(userId)
        : this.getStdioClientTransport();

    await client.connect(transport);

    const sessionId =
      transport instanceof StreamableHTTPClientTransport
        ? transport.sessionId
        : undefined;

    let resSession: ClientSession;
    if (this.isStatefull()) {
      resSession = new ClientSession(client, transport, { userId, sessionId });
      this.statefullSessions.set(userId, resSession);
      // debug
      console.log(
        `[McpClientManager#createSession] Created new session for user: ${userId}`,
      );
    } else {
      resSession = new ClientSession(client, transport);
      this.session = resSession;
    }

    return resSession;
  }

  async getSession(userId: string = ""): Promise<ClientSession> {
    if (this.isStatefull() && !userId) {
      throw new Error(
        "[McpClientManager#getSession] UserId is required for streamableHttp transport type.",
      );
    }

    let session = this.isStatefull()
      ? this.statefullSessions.get(userId)
      : this.session;
    if (!session) {
      session = await this.createSession(userId);
    }
    session.touch();
    return session;
  }

  async terminateSession(userId: string): Promise<void> {
    if (!this.isStatefull()) {
      return;
    }
    const session = this.statefullSessions.get(userId);
    if (!session) {
      return;
    }
    if (session.transport instanceof StreamableHTTPClientTransport) {
      try {
        await session.transport.terminateSession();
        // debug
        console.log(
          `[McpClientManager#terminateSession] Session terminated for user: ${userId}`,
        );
      } catch (error) {
        // debug
        console.error(
          `[McpClientManager#terminateSession] Error terminating session for user: ${userId}`,
          error,
        );
      }
      await session.close();
      this.statefullSessions.delete(userId);
    }
  }

  private async cleanupSessions(): Promise<void> {
    const now = Date.now();
    const maxAge = 2 * 60 * 60 * 1000; // 2h

    for (const [userId, session] of this.statefullSessions.entries()) {
      if (now - session.lastUsed > maxAge) {
        // debug
        console.log(
          `[McpClientManager#cleanupSessions] Cleaning up inactive session for user: ${userId}`,
        );
        await this.terminateSession(userId);
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const userId of this.statefullSessions.keys()) {
      await this.terminateSession(userId);
    }
  }
}

const mcpClientManager = new McpClientManager();

process.on("SIGTERM", async () => {
  console.log("[mcpClientManager] SIGTERM received, cleaning up sessions");
  await mcpClientManager.shutdown();
});

process.on("SIGINT", async () => {
  console.log("[mcpClientManager] SIGINT received, cleaning up sessions");
  await mcpClientManager.shutdown();
});

export default mcpClientManager;
