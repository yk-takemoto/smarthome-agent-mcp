import * as fs from "fs";
import path from "path";

const deviceControlTools = (
  devCtlServerRootPath: string = process.env.DEVCTL_SERVER_ROOTPATH!
): any[] => {
  const funcdefDir = path.resolve(devCtlServerRootPath, "tooldef");
  const entries = fs.readdirSync(funcdefDir, { withFileTypes: true });

  const tools: any[] = [];
  entries.forEach(entry => {
    const entryPath = path.join(funcdefDir, entry.name);
    if (entry.isFile() && path.extname(entry.name) === ".json") {
      const fileContent = fs.readFileSync(entryPath, "utf-8");
      const jsonData = JSON.parse(fileContent);
      tools.push(jsonData);
    }
  });
  return tools;
};

export default deviceControlTools;