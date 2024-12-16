import * as yaml from "js-yaml";
import * as fs from "fs";
import path from "path";
import functionBuilder from "./func/function_builder.js";

const deviceControlFunctions = (
  devCtlServerRootPath: string = process.env.DEVCTL_SERVER_ROOTPATH!
) => {
  const deviceControlMap = yaml.load(
    fs.readFileSync(path.resolve(devCtlServerRootPath, "devctl.yaml"), "utf-8")
  ) as Record<string, string>;
  const functions: { [functionId: string]: Function } = {};
  for (const [functionId, className] of Object.entries(deviceControlMap)) {
    const deviceClient = functionBuilder(functionId, className);
    functions[functionId] = deviceClient.controlDevice.bind(deviceClient);
  }
  return functions;
};

export default deviceControlFunctions;