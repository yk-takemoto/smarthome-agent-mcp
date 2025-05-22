import * as crypto from "crypto";
import * as uuid from "uuid";
import { z } from "zod";

const deviceIdsSchema = z
  .object({
    main: z.string(),
  })
  .and(z.record(z.string()));

type DeviceIds = z.infer<typeof deviceIdsSchema>;

const devCtlConfigSchema = z.object({
  devCtlToken: z.string().min(1),
  devCtlSecret: z.string().min(1),
  devCtlEndpoint: z.string().min(1),
  devIds: deviceIdsSchema,
});

type DevCtlConfig = z.infer<typeof devCtlConfigSchema>;

type FunctionsDeviceIds = {
  [functionId: string]: DeviceIds;
};

export const convertedArgsSchema = z
  .object({
    commandType: z.string().optional(),
    commandTarget: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.number()]))
  .transform((data) => {
    const { commandType, commandTarget, ...commandProps } = data;
    const commandEntries = Object.entries(commandProps);
    const command = commandEntries.length > 0 ? commandEntries[0][1] : undefined;
    return {
      commandType,
      commandTarget,
      command: command as string | number,
    };
  });

export abstract class SwitchbotControlFunction {
  protected switchbotConfig: DevCtlConfig;
  protected convertedArgsSchema = z
    .object({
      commandType: z.string().optional(),
      commandTarget: z.string().optional(),
    })
    .catchall(z.union([z.string(), z.number()]))
    .transform((data) => {
      const { commandType, commandTarget, ...commandProps } = data;
      const commandEntries = Object.entries(commandProps);
      const command = commandEntries.length > 0 ? commandEntries[0][1] : undefined;
      return {
        commandType,
        commandTarget,
        command: command as string | number,
      };
    });

  constructor(functionId: string) {
    this.switchbotConfig = devCtlConfigSchema.parse({
      devCtlToken: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_TOKEN || process.env.SWITCHBOT_TOKEN || "",
      devCtlSecret: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_SECRET_KEY || process.env.SWITCHBOT_SECRET_KEY || "",
      devCtlEndpoint: process.env.SWITCHBOT_ENDPOINT!,
      devIds: this.getDevIds(functionId),
    });
  }

  private getDevIds(functionId: string) {
    const devIdsMap = JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_FUNCTION_DEVICEIDS_MAP || process.env.SWITCHBOT_FUNCTION_DEVICEIDS_MAP || "";
    const devIds = (JSON.parse(devIdsMap) as FunctionsDeviceIds)[functionId];
    if (!devIds) {
      throw new Error(`DeviceIds for functionId ${functionId} is not defined.`);
    }
    return devIds;
  }

  protected getSwitchbotApiHeader(method: "GET" | "POST" = "POST"): Record<string, string> {
    const token = this.switchbotConfig.devCtlToken;
    const secret = this.switchbotConfig.devCtlSecret;
    const nonce = uuid.v4();
    const t = Date.now();
    const stringToSign = `${token}${t}${nonce}`;
    const sign = crypto.createHmac("sha256", secret).update(stringToSign).digest("base64");

    return method === "POST"
      ? {
          Authorization: token,
          "Content-Type": "application/json",
          charset: "utf8",
          t: t.toString(),
          sign: sign,
          nonce: nonce,
        }
      : {
          Authorization: token,
          t: t.toString(),
          sign: sign,
          nonce: nonce,
        };
  }

  abstract execute(args: Record<string, unknown>): Promise<Record<string, unknown> | Record<string, unknown>[]>;
}
