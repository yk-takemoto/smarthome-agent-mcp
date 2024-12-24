import * as crypto from "crypto";
import * as uuid from "uuid";
import { z } from "zod";
import { DeviceControlFunction } from "./device_control_function.js";

type DeviceIds = {
  main: string;
  [id: string]: string;
}

type FunctionsDeviceIds = {
  [functionId: string]: DeviceIds;
}

export abstract class SwitchbotControlFunction implements DeviceControlFunction {
  constructor(
    functionId: string,
    protected switchbotConfig = {
      devCtlToken: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_TOKEN || process.env.SWITCHBOT_TOKEN || "",
      devCtlSecret: JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_SECRET_KEY || process.env.SWITCHBOT_SECRET_KEY || "",
      devCtlEndpoint: process.env.SWITCHBOT_ENDPOINT!,
      devIds: undefined as unknown as DeviceIds
    }
  ) {
    this.initCheck(functionId, switchbotConfig);
  };

  private initCheck(functionId: string, switchbotConfig: Record<string, string | DeviceIds>) {
    if (!switchbotConfig.devIds) {
      const devIdsMap = JSON.parse(process.env.APP_SECRETS || "{}").SWITCHBOT_FUNCTION_DEVICEIDS_MAP || process.env.SWITCHBOT_FUNCTION_DEVICEIDS_MAP || ""
      const devIds = (JSON.parse(devIdsMap) as FunctionsDeviceIds)[functionId];
      if (!devIds) {
        throw new Error(`DeviceIds for functionId ${functionId} is not defined.`);
      }
      switchbotConfig.devIds = devIds;
    }

    for (const key of Object.keys(this.switchbotConfig)) {
      if (!switchbotConfig[key]) {
        throw new Error(`switchbotConfig.${key} is required but not set.`);
      }
    }
  }

  protected getSwitchbotApiHeader(method: "GET" | "POST" = "POST"): Record<string, string> {
    const token = this.switchbotConfig.devCtlToken;
    const secret = this.switchbotConfig.devCtlSecret;
    const nonce = uuid.v4();
    const t = Date.now();
    const stringToSign = `${token}${t}${nonce}`;
    const sign = crypto.createHmac("sha256", secret).update(stringToSign).digest("base64");

    return method === "POST" ? {
      Authorization: token,
      "Content-Type": "application/json",
      charset: "utf8",
      t: t.toString(),
      sign: sign,
      nonce: nonce,
    } : {
      Authorization: token,
      t: t.toString(),
      sign: sign,
      nonce: nonce,
    };
  }

  protected checkArgs(args: Record<string, any>): {
    commandType?: string;
    commandTarget?: string;
    command: string | number;
  } {
    const devCtlArgumentsSchema = z.object({
      commandType: z.string().optional(),
      commandTarget: z.string().optional(),
      command: z.union([z.string(), z.number()]),
    });

    const convertedArgs = args ? Object.keys(args).reduce((acc, key) => {
      acc[key === "commandType" || key === "commandTarget" ? key : "command"] = args[key];
      return acc;
    }, {} as Record<string, unknown>) : args;
    return devCtlArgumentsSchema.parse(convertedArgs);
  }

  abstract controlDevice(args: Record<string, any>): Promise<Record<string, string>>;
}