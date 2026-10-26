import { doctor, renderProject, validateProject } from "./maker";
const [command, path] = process.argv.slice(2);
try {
  if (command === "doctor") console.log(JSON.stringify(await doctor(), null, 2));
  else if (command === "validate" && path) console.log(JSON.stringify(await validateProject(path), null, 2));
  else if (command === "render" && path) console.log(JSON.stringify(await renderProject(path), null, 2));
  else throw new Error("用法：bun start doctor | validate <工作目录内故事.json> | render <工作目录内故事.json>");
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
