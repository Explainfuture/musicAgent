const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const projectDir = context.packager.projectDir;
  const productFilename = context.packager.appInfo.productFilename;
  const executable = path.join(context.appOutDir, `${productFilename}.exe`);
  const icon = path.join(projectDir, "build", "icon.ico");
  const rcedit = path.join(projectDir, "node_modules", "electron-winstaller", "vendor", "rcedit.exe");

  for (const file of [executable, icon, rcedit]) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing required file for Windows icon patch: ${file}`);
    }
  }

  execFileSync(rcedit, [executable, "--set-icon", icon], { stdio: "inherit" });
};
