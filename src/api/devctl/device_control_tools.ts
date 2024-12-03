import * as fs from "fs";
import path from "path";

const deviceControlTools = (): any[] => {
  const tools: any[] = [];
  const funcdefDir = path.resolve("funcdef");
  const files = fs.readdirSync(funcdefDir);
  files.forEach(file => {
    if (path.extname(file) === ".json") {
      const filePath = path.join(funcdefDir, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const jsonData = JSON.parse(fileContent);
      tools.push(jsonData);
    }
  });

  return tools;
};

export default deviceControlTools;