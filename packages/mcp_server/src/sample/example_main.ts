import dotenv from "dotenv";
import { tvControlArgsSchema, SwitchBotTVControlFunction } from "../tools/switchbot/switchbot_tv_control_function.js";
import { lightControlArgsSchema, SwitchBotLightControlFunction } from "../tools/switchbot/switchbot_light_control_function.js";
import { airconControlArgsSchema, SwitchBotAirconControlFunction } from "../tools/switchbot/switchbot_aircon_control_function.js";

dotenv.config();
async function main() {
  // TV Function
  const functionArgs1 = tvControlArgsSchema.parse({
    commandType: "power",
    commandOfPowerchange: "turnOn",
  });
  let toolResult = await new SwitchBotTVControlFunction("tv").execute(functionArgs1);
  console.log(`[TV Function] toolResult: ${JSON.stringify(toolResult, null, 2)}`);

  // Light Function
  const functionArgs2 = lightControlArgsSchema.parse({
    commandTarget: "main",
    commandTurning: "turnOn",
  });
  toolResult = await new SwitchBotLightControlFunction("light").execute(functionArgs2);
  console.log(`[Light Function] toolResult: ${JSON.stringify(toolResult, null, 2)}`);

  // Aircon Function
  const functionArgs3 = airconControlArgsSchema.parse({
    commandTarget: "main",
    commandType: "power",
    commandOfPowerturning: "turnOn",
  });
  toolResult = await new SwitchBotAirconControlFunction("aircon").execute(functionArgs3);
  console.log(`[Aircon Function] toolResult: ${JSON.stringify(toolResult, null, 2)}`);
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
