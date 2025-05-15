import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

//============ args schema
export const tvControlSchema = z.object({
  commandType: z.string().describe("The Command type to control TV. e.g. 'power', 'channel', 'volume'"),
  commandOfPowerchange: z.string().describe("The Command to change power status. e.g. 'change', 'turnOn', 'turnOff'").optional(),
  commandOfChannelsetting: z.number().int().describe("The Command to set channel from 1 to 12.").optional(),
  commandOfVolumechange: z.number().int().describe("The Command to change volume from -3 to 3.").optional(),
});
export const lightControlSchema = z.object({
  commandTarget: z
    .string()
    .describe(
      "The Command target to control light. e.g. if target is 'living room' then commandTarget='main', else if target is 'next to the living room' then commandTarget='next', else commandTarget='other'",
    ),
  commandTurning: z.string().describe("The Command to send power On/Off. e.g. 'turnOn', 'turnOff'").optional(),
});
export const airconControlSchema = z.object({
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
});
//============
//============ LLM tools schema
export const devctlTools = [
  {
    name: "tv",
    description: "The Tool to control TV",
    inputSchema: zodToJsonSchema(tvControlSchema, { $refStrategy: "none" }),
  },
  {
    name: "light",
    description: "The Tool to control light",
    inputSchema: zodToJsonSchema(lightControlSchema, { $refStrategy: "none" }),
  },
  {
    name: "aircon",
    description: "The Tool to control air conditioner",
    inputSchema: zodToJsonSchema(airconControlSchema, { $refStrategy: "none" }),
  },
];
//============
