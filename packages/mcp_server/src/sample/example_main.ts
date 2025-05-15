import "reflect-metadata";
import dotenv from "dotenv";
import * as fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { container } from "tsyringe";
import { createContexts, serverConfigSchema } from "@yk-takemoto/mcp-handler";
import { SwitchBotTVControlFunction, SwitchBotLightControlFunction, SwitchBotAirconControlFunction } from "../functions/index.js";
import { tvControlSchema, lightControlSchema, airconControlSchema } from "../tools/index.js";

dotenv.config();
async function main() {
  container.register("SwitchBotTVControlFunction", {
    useClass: SwitchBotTVControlFunction,
  });
  container.register("SwitchBotLightControlFunction", {
    useClass: SwitchBotLightControlFunction,
  });
  container.register("SwitchBotAirconControlFunction", {
    useClass: SwitchBotAirconControlFunction,
  });
  const getConfig = (serverRootPath: string = process.env.MCPSERVER_ROOTPATH!) => {
    const config = yaml.load(fs.readFileSync(path.resolve(serverRootPath, "config.yaml"), "utf-8"));
    return serverConfigSchema.parse(config);
  };
  const serverContexts = createContexts(getConfig());
  const functions = serverContexts.devctl.function;

  // TV Function
  let functionToCall = functions["tv"];
  const functionArgs1 = tvControlSchema.parse({
    commandType: "power",
    commandOfPowerchange: "turnOn",
  });
  let toolResult = functionToCall ? await functionToCall(functionArgs1) : { error: `tv is not available` };
  console.log(`[TV Function] toolResult: ${JSON.stringify(toolResult, null, 2)}`);

  // Light Function
  functionToCall = functions["light"];
  const functionArgs2 = lightControlSchema.parse({
    commandTarget: "main",
    commandTurning: "turnOn",
  });
  toolResult = functionToCall ? await functionToCall(functionArgs2) : { error: `light is not available` };
  console.log(`[Light Function] toolResult: ${JSON.stringify(toolResult, null, 2)}`);

  // Aircon Function
  functionToCall = functions["aircon"];
  const functionArgs3 = airconControlSchema.parse({
    commandTarget: "main",
    commandType: "power",
    commandOfPowerturning: "turnOn",
  });
  toolResult = functionToCall ? await functionToCall(functionArgs3) : { error: `aircon is not available` };
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
