import { mkdir, writeAtomic } from "@yingya/file";
import { resolve, join } from "node:path";
import { doctor, workspace } from "../src/maker";

const root = resolve(import.meta.dir, "..");
await mkdir(workspace, { recursive: true });
await mkdir(join(root, "local"), { recursive: true });
const configuration = { mcpServers: { yingya: {
  type: "stdio",
  command: process.execPath,
  args: [join(root, "src", "mcp.ts")],
  env: { YINGYA_WORKSPACE: workspace },
  timeout: 300000,
} } };
await doctor();
await writeAtomic(join(root, "local", "mcp.json"), JSON.stringify(configuration, null, 2));
console.log(`映芽安装完成。\n工作目录：${workspace}\nWorkBuddy MCP 配置：${join(root, "local", "mcp.json")}\n技能目录：${join(root, "skills", "yingya")}\n请按 docs/start.md 完成导入。`);
