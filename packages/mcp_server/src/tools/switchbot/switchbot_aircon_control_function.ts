import { z } from "zod";
import { CommonExceptionResponse, errorHandler } from "@yk-takemoto/error-handler";
import { SwitchbotControlFunction } from "./switchbot_control_function.js";

export const airconControlArgsSchemaObject = {
  commandTarget: z
    .string()
    .describe(
      "The Command target to control air conditioner. e.g. if target is 'living room' then commandTarget='main', else if target is 'work room' then commandTarget='work', else if target is 'bed room' then commandTarget='bed', else commandTarget='other'",
    ),
  commandType: z.string().describe("The Command type to control air conditioner. e.g. 'power', 'mode', 'tempset', 'tempchange'"),
  commandOfPowerturning: z.string().describe("The Command to send power On/Off. e.g. 'turnOn', 'turnOff'").optional(),
  commandOfModechange: z.string().describe("The Command to change mode. e.g. '2:cool', '3:dry', '3:dehumidification', '5:heat'").optional(),
  commandOfTempset: z.number().int().describe("The Command to set the temperature from 22 to 28.").optional(),
  commandOfTempchange: z.number().int().describe("The Command to change the temperature from -3 to 3.").optional(),
};
export const airconControlArgsSchema = z.object(airconControlArgsSchemaObject);

export class SwitchBotAirconControlFunction extends SwitchbotControlFunction {
  constructor(functionId: string) {
    super(functionId);
  }

  async execute(args: Record<string, unknown>): Promise<Record<string, string> | CommonExceptionResponse> {
    // debug
    console.error(`[SwitchBotAirconControlFunction] args: ${args ? JSON.stringify(args) : "undefined"}`);
    try {
      const { commandType, commandTarget, command } = this.convertedArgsSchema.parse(args);

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
