import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { doctor, renderProject, validateProject } from "./maker";

const server = new McpServer({ name: "yingya", version: "0.3.0" });
async function result(operation: () => Promise<unknown>) {
  try { return { content: [{ type: "text" as const, text: JSON.stringify(await operation()) }] }; }
  catch (error) { return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] }; }
}
server.tool("yingya_status", "检查映芽本地工具、工作目录和 FFmpeg，不联网、不收费", {}, () => result(doctor));
server.tool("yingya_validate", "校验故事时长、角色描述、字幕字数及本地素材；不渲染", { storyPath: z.string().min(1) }, ({ storyPath }) => result(() => validateProject(storyPath)));
server.tool("yingya_render", "使用本地素材合成 MP4；可使用系统中文配音、合成配乐或自带音乐，自动混音。联网配音需用户同意后启用；不调用付费 API。最长 120 秒，可能需要数分钟", { storyPath: z.string().min(1) }, ({ storyPath }) => result(() => renderProject(storyPath)));
await server.connect(new StdioServerTransport());
