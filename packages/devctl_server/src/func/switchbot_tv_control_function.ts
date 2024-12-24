import { SwitchbotControlFunction } from "./switchbot_control_function.js"

export class SwitchBotTVControlFunction extends SwitchbotControlFunction {
  constructor(functionId: string) {
    super(functionId);
  }

  async controlDevice(args: Record<string, any>): Promise<Record<string, string>> {
    console.error(`[TVControlFunction] args: ${JSON.stringify(args)}`);
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

      const data = {
        command: subCommand,
        parameter: "default",
        commandType: "command",
      };

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
  }
}