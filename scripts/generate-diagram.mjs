import { execSync } from "child_process";
import { writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir, homedir } from "os";

function findChromePath() {
  execSync("npx puppeteer browsers install chrome", {
    encoding: "utf8",
    stdio: "ignore",
  });

  const puppeteerCache = join(homedir(), ".cache", "puppeteer", "chrome");
  if (!existsSync(puppeteerCache)) {
    throw new Error("Puppeteer chrome cache not found");
  }

  for (const version of readdirSync(puppeteerCache).reverse()) {
    for (const [dir, bin] of [
      ["chrome-mac-arm64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"],
      ["chrome-mac-x64", "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"],
      ["chrome-linux", "chrome"],
    ]) {
      const candidate = join(puppeteerCache, version, dir, bin);
      if (existsSync(candidate)) return candidate;
    }
  }

  throw new Error("Could not find Chrome executable in puppeteer cache");
}

const chromePath = findChromePath();
console.log(`Using Chrome at: ${chromePath}`);

const configPath = join(tmpdir(), "puppeteer-config.json");
writeFileSync(
  configPath,
  JSON.stringify({
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
    ],
  })
);

function render(theme, output, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      execSync(
        `npx @mermaid-js/mermaid-cli -i workflow.mmd -o ${output} --theme ${theme} --backgroundColor transparent --puppeteerConfigFile ${configPath}`,
        { stdio: "inherit" }
      );
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`  Attempt ${i} failed, retrying...`);
    }
  }
}

render("dark", "workflow-dark.png");
render("default", "workflow-light.png");
