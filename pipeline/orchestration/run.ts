import { spawn } from "node:child_process";

const stages = [
  "pipeline/exec/parse-whatsapp.ts",
  "pipeline/orchestration/analyze.ts",
  "pipeline/orchestration/consolidate.ts",
  "pipeline/orchestration/curate.ts",
  "pipeline/exec/publish.ts",
];

async function runStage(entrypoint: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", entrypoint], {
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${entrypoint} failed with exit code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  for (const stage of stages) {
    await runStage(stage);
  }
}

void main();
