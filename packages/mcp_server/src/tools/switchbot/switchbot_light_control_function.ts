import { z } from "zod";
import { CommonExceptionResponse, errorHandler } from "@yk-takemoto/error-handler";
import { SwitchbotControlFunction } from "./switchbot_control_function.js";

export const lightControlArgsSchemaObject = {
  commandTarget: z
    .string()
    .describe(
      "The Command target to control light. e.g. if target is 'living room' then commandTarget='main', else if target is 'next to the living room' then commandTarget='next', else commandTarget='other'",
    ),
  commandTurning: z.string().describe("The Command to send power On/Off. e.g. 'turnOn', 'turnOff'").optional(),
};
export const lightControlArgsSchema = z.object(lightControlArgsSchemaObject);

export class SwitchBotLightControlFunction extends SwitchbotControlFunction {
  // ON/OFF命令に対して変更コマンドを送る回数(ON/OFFが明示的に分かれていないDevice仕様向け)
  private countOfTurnOn = 3;
  private countOfTurnOff = 2;

  constructor(functionId: string) {
    super(functionId);
  }

  async execute(args: Record<string, unknown>): Promise<Record<string, string> | CommonExceptionResponse> {
    // debug
    console.error(`[SwitchBotLightControlFunction] args: ${args ? JSON.stringify(args) : "undefined"}`);
    try {
      const { commandTarget, command } = this.convertedArgsSchema.parse(args);

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
