import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { CommonExceptionResponse, errorHandler } from "@yk-takemoto/error-handler";
import { GeneralFunction } from "@yk-takemoto/mcp-handler";

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

export abstract class SwitchbotControlFunction extends GeneralFunction {
  protected switchbotConfig: DevCtlConfig;

  constructor(functionId: string) {
    super(functionId);
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

    const convertedArgs = args
      ? Object.keys(args).reduce(
          (acc, key) => {
            acc[key === "commandType" || key === "commandTarget" ? key : "command"] = args[key];
            return acc;
          },
          {} as Record<string, unknown>,
        )
      : args;
    return devCtlArgumentsSchema.parse(convertedArgs);
  }
}

@injectable()
export class SwitchBotTVControlFunction extends SwitchbotControlFunction {
  constructor(@inject("SwitchBotTVControlFunction:functionId") functionId: string) {
    super(functionId);
  }

  async execute(args: Record<string, unknown>): Promise<Record<string, string> | CommonExceptionResponse> {
    // debug
    console.error(`[SwitchBotTVControlFunction] args: ${args ? JSON.stringify(args) : "undefined"}`);
    try {
      const { commandType, command } = this.checkArgs(args);
      const url = `${this.switchbotConfig.devCtlEndpoint}/v1.1/devices/${this.switchbotConfig.devIds.main}/commands`;
      const headers = this.getSwitchbotApiHeader();

      if (commandType === "power") {
        // command(turnOn/turnOff/change)に関わらず、今の状態から変更することしかできないためturnOnを固定指定
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "turnOn",
            parameter: "default",
            commandType: "command",
          }),
        });
        if (response.status === 200) {
          return { success: "TVの電源を変更しました" };
        } else {
          return { error: "TVの電源の変更に失敗しました" };
        }
      } else if (commandType === "channel") {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "SetChannel",
            parameter: command as string,
            commandType: "command",
          }),
        });
        if (response.status === 200) {
          return { success: `TVのチャンネルを${command}に設定しました` };
        } else {
          return { error: `TVのチャンネル${command}への設定に失敗しました` };
        }
      } else if (commandType === "volume") {
        let subCommand: string;
        if (typeof command === "number") {
          if (command < 0 && command >= -3) {
            subCommand = "volumeSub";
          } else if (command > 0 && command <= 3) {
            subCommand = "volumeAdd";
          } else {
            return { error: `TVの音量調整は最大3までです command=${command}` };
          }
        } else {
          return { error: `不正なコマンドです. command=${command}` };
        }

        // const data = {
        //   command: subCommand,
        //   parameter: "default",
        //   commandType: "command",
        // };

        for (let i = 0; i < Math.abs(command); i++) {
          const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              command: subCommand,
              parameter: "default",
              commandType: "command",
            }),
          });
          if (response.status !== 200) {
            return { error: `TVの音量${command}の調整に失敗しました` };
          }
        }

        return { success: `TVの音量を${command}調整しました` };
      } else {
        return { error: `command_typeが不正です. command_type=${commandType}` };
      }
    } catch (error) {
      return errorHandler("[TVControlFunction] exception occured", error);
    }
  }
}

@injectable()
export class SwitchBotLightControlFunction extends SwitchbotControlFunction {
  // ON/OFF命令に対して変更コマンドを送る回数(ON/OFFが明示的に分かれていないDevice仕様向け)
  private countOfTurnOn = 3;
  private countOfTurnOff = 2;

  constructor(@inject("SwitchBotLightControlFunction:functionId") functionId: string) {
    super(functionId);
  }

  async execute(args: Record<string, unknown>): Promise<Record<string, string> | CommonExceptionResponse> {
    // debug
    console.error(`[SwitchBotLightControlFunction] args: ${args ? JSON.stringify(args) : "undefined"}`);
    try {
      const { commandTarget, command } = this.checkArgs(args);

      let deviceId: string;
      let roomName: string;
      if (commandTarget === "main") {
        deviceId = this.switchbotConfig.devIds.main;
        roomName = "リビング";
      } else if (commandTarget === "next") {
        deviceId = this.switchbotConfig.devIds[commandTarget];
        roomName = "リビングの隣の部屋";
      } else {
        return { error: `commandTypeが不正です. commandType=${commandTarget}` };
      }

      const sendCount = command === "turnOn" ? this.countOfTurnOn : command === "turnOff" ? this.countOfTurnOff : 0;
      if (sendCount === 0) {
        return { error: `commandが不正です. command=${command}` };
      }

      for (let i = 0; i < sendCount; i++) {
        const response = await fetch(`${this.switchbotConfig.devCtlEndpoint}/v1.1/devices/${deviceId}/commands`, {
          method: "POST",
          headers: this.getSwitchbotApiHeader(),
          body: JSON.stringify({
            command: "MODE",
            parameter: "default",
            commandType: "customize",
          }),
        });
        if (response.status !== 200) {
          return { error: `${roomName}のライトを付けるのに失敗しました` };
        }
      }

      return { success: `${roomName}のライトを付けました` };
    } catch (error) {
      return errorHandler("[CorrectReceiptByImageFunction] exception occured", error);
    }
  }
}

@injectable()
export class SwitchBotAirconControlFunction extends SwitchbotControlFunction {
  constructor(@inject("SwitchBotAirconControlFunction:functionId") functionId: string) {
    super(functionId);
  }

  async execute(args: Record<string, unknown>): Promise<Record<string, string> | CommonExceptionResponse> {
    // debug
    console.error(`[SwitchBotAirconControlFunction] args: ${args ? JSON.stringify(args) : "undefined"}`);
    try {
      const { commandType, commandTarget, command } = this.checkArgs(args);

      let deviceId: string;
      let roomName: string;
      if (commandTarget === "main") {
        deviceId = this.switchbotConfig.devIds.main;
        roomName = "リビング";
      } else if (commandTarget === "work") {
        deviceId = this.switchbotConfig.devIds[commandTarget];
        roomName = "仕事部屋";
      } else if (commandTarget === "bed") {
        deviceId = this.switchbotConfig.devIds[commandTarget];
        roomName = "寝室";
      } else {
        return { error: `commandTypeが不正です. commandType=${commandType}` };
      }

      const url = `${this.switchbotConfig.devCtlEndpoint}/v1.1/devices/${deviceId}/commands`;
      const headers = this.getSwitchbotApiHeader();

      if (commandType === "power") {
        if (command === "turnOn" || command === "turnOff") {
          const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              command: command,
              parameter: "default",
              commandType: "command",
            }),
          });
          if (response.status !== 200) {
            return { error: `${roomName}のエアコンの電源${command}の変更に失敗しました` };
          }
          const resData = await response.json();
          if (resData.statusCode !== 100) {
            return { error: `${roomName}のエアコンの電源${command}の変更に失敗しました` };
          }

          // 電源ONの場合は、モードと温度を応答
          if (command === "turnOn") {
            let successMessage = `${roomName}のエアコンの電源をONにしました。`;
            if (resData.body.items[0].status) {
              const nowStatus = resData.body.items[0].status;
              const nowModeId = nowStatus.mode;
              const nowTemp = nowStatus.temperature;
              successMessage += `モード${nowModeId}、設定温度は${nowTemp}℃です。`;
            }
            return { success: successMessage };
          } else {
            return { success: `${roomName}のエアコンの電源をOFFにしました` };
          }
        } else {
          return { error: `不正なコマンドです. command=${command}` };
        }
      } else if (commandType === "mode") {
        const [modeId, modeName] = (command as string).split(":");
        let response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "turnOn",
            parameter: "default",
            commandType: "command",
          }),
        });
        if (response.status !== 200) {
          return { error: `${roomName}のエアコンのモード変更に失敗しました` };
        }
        const resData = await response.json();
        if (resData.statusCode !== 100) {
          return { error: `${roomName}のエアコンのモード変更に失敗しました` };
        }
        if (!resData.body.items[0].status) {
          return { error: `${roomName}のエアコンはモード変更に対応していないため、電源ONのみ行いました` };
        }

        // 現在のモード取得
        const nowStatus = resData.body.items[0].status;
        const nowModeId = nowStatus.mode;
        // 同じモードへの変更の場合は何もしない
        if (modeId === nowModeId) {
          return { success: `${roomName}のエアコンのモードがすでに${modeName}のため変更しませんでした` };
        }

        // 暖房へ変更の場合のみ22℃、以外は27℃をモード変更後のデフォルト温度にする
        const temperature = modeName === "heat" ? "22" : "27";
        // モード変更(風量は1:auto固定)
        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "setAll",
            parameter: `${temperature},${modeId},1,on`,
            commandType: "command",
          }),
        });
        if (response.status === 200) {
          return { success: `${roomName}のエアコンのモードを${modeName}に変更しました。温度は${temperature}℃です。` };
        } else {
          return { error: `${roomName}のエアコンのモード${modeName}への変更に失敗しました` };
        }
      } else if (commandType === "tempset") {
        const temp = command as number;
        if (temp < 22 || temp > 28) {
          return { error: `不正なコマンドです. command=${temp}` };
        }

        // まずはそのまま電源ON
        let response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "turnOn",
            parameter: "default",
            commandType: "command",
          }),
        });
        if (response.status !== 200) {
          return { error: `${roomName}のエアコンの温度設定に失敗しました` };
        }
        const resData = await response.json();
        if (resData.statusCode !== 100) {
          return { error: `${roomName}のエアコンの温度設定に失敗しました` };
        }
        if (!resData.body.items[0].status) {
          return { error: `${roomName}のエアコンは温度設定に対応していないため、電源ONのみ行いました` };
        }

        // 現在のモードと温度取得
        const nowStatus = resData.body.items[0].status;
        const nowModeId = nowStatus.mode;
        // 温度設定(風量は1:auto固定)
        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "setAll",
            parameter: `${temp},${nowModeId},1,on`,
            commandType: "command",
          }),
        });
        if (response.status === 200) {
          return { success: `${roomName}のエアコンの温度を${temp}℃に設定しました。モード${nowModeId}、調整後温度は${temp}℃です。` };
        } else {
          return { error: `${roomName}のエアコンの温度${temp}℃への設定に失敗しました` };
        }
      } else if (commandType === "tempchange") {
        const tempChange = command as number;
        if (tempChange < -3 || tempChange > 3) {
          return { error: `不正なコマンドです. command=${tempChange}` };
        }

        // まずはそのまま電源ON
        let response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "turnOn",
            parameter: "default",
            commandType: "command",
          }),
        });
        if (response.status !== 200) {
          return { error: `${roomName}のエアコンの温度調整に失敗しました` };
        }
        const resData = await response.json();
        if (resData.statusCode !== 100) {
          return { error: `${roomName}のエアコンの温度調整に失敗しました` };
        }
        if (!resData.body.items[0].status) {
          return { error: `${roomName}のエアコンは温度調整に対応していないため、電源ONのみ行いました` };
        }

        // 現在のモードと温度取得
        const nowStatus = resData.body.items[0].status;
        const nowModeId = nowStatus.mode;
        const newTemp = nowStatus.temperature + tempChange;
        // 温度調整(風量は1:auto固定)
        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "setAll",
            parameter: `${newTemp},${nowModeId},1,on`,
            commandType: "command",
          }),
        });
        if (response.status === 200) {
          return { success: `${roomName}のエアコンの温度を${tempChange}調整しました。モード${nowModeId}、調整後温度は${newTemp}℃です。` };
        } else {
          return { error: `${roomName}のエアコンの温度${tempChange}の調整に失敗しました` };
        }
      } else {
        return { error: `command_typeが不正です. command_type=${commandType}` };
      }
    } catch (error) {
      return errorHandler("[CorrectReceiptByImageFunction] exception occured", error);
    }
  }
}
