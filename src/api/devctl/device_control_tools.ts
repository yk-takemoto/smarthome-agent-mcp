import * as fs from "fs";
import path from "path";

const deviceControlTools = (): (id?: string) => any[] => {
  const toolEntries: { [id: string]: any[] } = {};
  const funcdefDir = path.resolve("funcdef");
  const entries = fs.readdirSync(funcdefDir, { withFileTypes: true });

  const commonTools: any[] = [];
  entries.forEach(entry => {
    const entryPath = path.join(funcdefDir, entry.name);
    if (entry.isFile() && path.extname(entry.name) === ".json") {
      const fileContent = fs.readFileSync(entryPath, "utf-8");
      const jsonData = JSON.parse(fileContent);
      commonTools.push(jsonData);
    } else if (entry.isDirectory()) {
      const nestedJsonFiles = fs.readdirSync(entryPath).filter(file => path.extname(file) === ".json");
      const nestedJsonData: any[] = [];
      nestedJsonFiles.forEach(file => {
        const fileContent = fs.readFileSync(path.join(entryPath, file), "utf-8");
        const jsonData = JSON.parse(fileContent);
        nestedJsonData.push(jsonData);
      });
      toolEntries[entry.name] = nestedJsonData;
    }
  });
  toolEntries["Common"] = commonTools;

  return (id?: string) => {
    return (id && id in toolEntries) ? toolEntries[id] : toolEntries["Common"];
  };
};

export default deviceControlTools;