import { mkdir, writeAtomic } from "@yijuchengpian/file";
import { resolve, join } from "node:path";
import { doctor, workspace } from "../src/maker";

const root = resolve(import.meta.dir, "..");
await mkdir(workspace, { recursive: true });
await mkdir(join(root, "local"), { recursive: true });
const configuration = { mcpServers: { yijuchengpian: {
  type: "stdio",
  command: process.execPath,
  args: [join(root, "src", "mcp.ts")],
  env: { YIJUCHENGPIAN_WORKSPACE: workspace },
  timeout: 300000,
} } };
await doctor();
await writeAtomic(join(root, "local", "mcp.json"), JSON.stringify(configuration, null, 2));
console.log(`一句成片安装完成。\n工作目录：${workspace}\nWorkBuddy MCP 配置：${join(root, "local", "mcp.json")}\n技能目录：${join(root, "skills", "yijuchengpian")}\n请按 docs/start.md 完成导入。`);
