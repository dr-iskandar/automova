import fs from "node:fs";
import path from "node:path";

const targetFile = path.resolve("node_modules/vinext/dist/server/static-file-cache.js");

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, "utf-8");
  const searchStr = `relativePath: path.relative(base, batch[j]),`;
  const replaceStr = `relativePath: path.relative(base, batch[j]).replaceAll("\\\\", "/"),`;

  if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(targetFile, content, "utf-8");
    console.log("[patch-vinext] Successfully patched vinext static-file-cache.js for Windows!");
  } else if (content.includes("replaceAll")) {
    console.log("[patch-vinext] vinext static-file-cache.js is already patched.");
  } else {
    console.warn("[patch-vinext] Could not find target pattern in vinext static-file-cache.js");
  }
} else {
  console.warn("[patch-vinext] vinext package not found at expected path.");
}
