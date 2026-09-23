#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const distDir = path.join(appDir, ".next");
const stampFile = path.join(distDir, "cache", "trae-source-version.json");
const nextBin = path.join(
  appDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

const passthroughArgs = process.argv.slice(2);
const helpFlags = new Set(["-h", "--help"]);
const watchedDirs = ["app", "src", "public"];
const watchedFiles = [
  "package.json",
  "next.config.ts",
  "tsconfig.json",
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local"
];
const structuralFiles = new Set(watchedFiles);
const ignoredSegments = [".git", ".next", "node_modules"];
const corruptionPatterns = [
  /Cannot find module '\.\/.+\.js'/i,
  /ENOENT: no such file or directory.+\.next/i,
  /routes-manifest\.json/i,
  /app-paths-manifest/i,
  /pages-manifest/i,
  /middleware-manifest/i,
  /ChunkLoadError/i,
  /Cannot find module '\.\/webpack-runtime\.js'/i
];

let child = null;
let killTimer = null;
let restartPlan = null;
let restartDebounceTimer = null;
let shuttingDown = false;
const watchers = [];

function printHelp() {
  console.log("Usage: npm run dev");
  console.log("");
  console.log("Starts Next.js dev server with a .next cache guard:");
  console.log("- updates a .next source version stamp on every workspace change");
  console.log("- clears and restarts on chunk/manifest corruption");
  console.log("- fully restarts when config/env files change");
}

if (passthroughArgs.some((arg) => helpFlags.has(arg))) {
  printHelp();
  process.exit(0);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanNextDir() {
  fs.rmSync(distDir, { recursive: true, force: true });
}

function writeStamp(reason, filePath = null) {
  ensureDirectory(path.dirname(stampFile));
  fs.writeFileSync(
    stampFile,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        reason,
        filePath
      },
      null,
      2
    ),
    "utf-8"
  );
}

function normalizeRelativePath(rawPath) {
  const relPath = rawPath.replaceAll(path.sep, "/");
  return relPath.startsWith("./") ? relPath.slice(2) : relPath;
}

function shouldIgnore(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    return true;
  }
  return ignoredSegments.some((segment) => normalized === segment || normalized.startsWith(`${segment}/`));
}

function requestRestart(reason, clean = false) {
  if (shuttingDown) {
    return;
  }

  if (restartDebounceTimer) {
    clearTimeout(restartDebounceTimer);
  }

  restartDebounceTimer = setTimeout(() => {
    restartPlan = {
      reason,
      clean: clean || restartPlan?.clean || false
    };

    if (!child) {
      performRestart();
      return;
    }

    console.log(`[cache-guard] restarting Next dev: ${reason}`);
    child.kill("SIGTERM");
    killTimer = setTimeout(() => {
      if (child) {
        child.kill("SIGKILL");
      }
    }, 5000);
  }, 120);
}

function performRestart() {
  const plan = restartPlan;
  restartPlan = null;
  if (plan?.clean) {
    cleanNextDir();
  }
  startNext(plan?.reason ?? "startup");
}

function handleChildOutput(chunk, stream) {
  const text = chunk.toString();
  stream.write(text);

  if (restartPlan || shuttingDown) {
    return;
  }

  if (corruptionPatterns.some((pattern) => pattern.test(text))) {
    console.warn("[cache-guard] detected .next cache corruption, cleaning and restarting...");
    requestRestart("detected-next-corruption", true);
  }
}

function startNext(reason) {
  writeStamp(reason, null);
  const childEnv = {
    ...process.env,
    TRAE_NEXT_CACHE_GUARD: "1"
  };

  child = spawn(nextBin, ["dev", "--port", "3001", ...passthroughArgs], {
    cwd: appDir,
    env: childEnv,
    stdio: ["inherit", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => handleChildOutput(chunk, process.stdout));
  child.stderr.on("data", (chunk) => handleChildOutput(chunk, process.stderr));
  child.on("exit", (code, signal) => {
    if (killTimer) {
      clearTimeout(killTimer);
      killTimer = null;
    }

    child = null;

    if (shuttingDown) {
      process.exit(code ?? (signal ? 1 : 0));
    }

    if (restartPlan) {
      performRestart();
      return;
    }

    if (code === 0) {
      process.exit(0);
      return;
    }

    console.warn(`[cache-guard] Next dev exited unexpectedly (${code ?? signal ?? "unknown"}), attempting clean restart...`);
    restartPlan = {
      reason: "unexpected-exit",
      clean: true
    };
    performRestart();
  });
}

function onWorkspaceChange(relativePath) {
  if (!relativePath || shouldIgnore(relativePath)) {
    return;
  }

  writeStamp("source-change", relativePath);
  const baseName = path.basename(relativePath);
  if (structuralFiles.has(baseName)) {
    requestRestart(`structural-change:${baseName}`, true);
  }
}

function watchDirectory(relativeDir) {
  const absoluteDir = path.join(appDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return;
  }

  const watcher = fs.watch(
    absoluteDir,
    { recursive: true },
    (_eventType, filename) => {
      if (!filename) {
        onWorkspaceChange(relativeDir);
        return;
      }
      onWorkspaceChange(path.join(relativeDir, filename.toString()));
    }
  );
  watchers.push(watcher);
}

function watchFile(relativeFile) {
  const absoluteFile = path.join(appDir, relativeFile);
  if (!fs.existsSync(absoluteFile)) {
    return;
  }

  const watcher = fs.watch(absoluteFile, () => {
    onWorkspaceChange(relativeFile);
  });
  watchers.push(watcher);
}

function closeWatchers() {
  for (const watcher of watchers) {
    watcher.close();
  }
}

function handleShutdown(signal) {
  shuttingDown = true;
  closeWatchers();
  if (restartDebounceTimer) {
    clearTimeout(restartDebounceTimer);
  }
  if (killTimer) {
    clearTimeout(killTimer);
  }

  if (child) {
    child.kill(signal);
    return;
  }

  process.exit(0);
}

for (const watchedDir of watchedDirs) {
  watchDirectory(watchedDir);
}

for (const watchedFile of watchedFiles) {
  watchFile(watchedFile);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

startNext("startup");
