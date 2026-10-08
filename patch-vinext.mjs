import fs from "node:fs";
import path from "node:path";

// 1. Patch static-file-cache.js for Windows backslash paths
const staticCacheFile = path.resolve("node_modules/vinext/dist/server/static-file-cache.js");

if (fs.existsSync(staticCacheFile)) {
  let content = fs.readFileSync(staticCacheFile, "utf-8");
  const searchStr = `relativePath: path.relative(base, batch[j]),`;
  const replaceStr = `relativePath: path.relative(base, batch[j]).replaceAll("\\\\", "/"),`;

  if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(staticCacheFile, content, "utf-8");
    console.log("[patch-vinext] Successfully patched vinext static-file-cache.js for Windows!");
  } else if (content.includes("replaceAll")) {
    console.log("[patch-vinext] vinext static-file-cache.js is already patched.");
  } else {
    console.warn("[patch-vinext] Could not find target pattern in vinext static-file-cache.js");
  }
} else {
  console.warn("[patch-vinext] static-file-cache.js not found at expected path.");
}

// 2. Patch prod-server.js to proxy /api requests to port 3100
const prodServerFile = path.resolve("node_modules/vinext/dist/server/prod-server.js");

if (fs.existsSync(prodServerFile)) {
  let content = fs.readFileSync(prodServerFile, "utf-8");

  // Check if httpRequest import is needed
  if (content.includes(`import { createServer } from "node:http";`)) {
    content = content.replace(
      `import { createServer } from "node:http";`,
      `import { createServer, request as httpRequest } from "node:http";`
    );
  }

  const handleStartStr = `const handleRequest = async (req, res) => {\n\t\tconst rawUrl = req.url ?? "/";\n\t\tconst rawPathname = rawUrl.split("?")[0];`;
  
  const proxyCodeStr = `const handleRequest = async (req, res) => {\n\t\tconst rawUrl = req.url ?? "/";\n\t\tconst rawPathname = rawUrl.split("?")[0];\n\t\tif (rawPathname.startsWith("/api/") || rawPathname === "/api") {\n\t\t\tconst pReq = httpRequest({\n\t\t\t\thostname: "127.0.0.1",\n\t\t\t\tport: 3100,\n\t\t\t\tpath: rawUrl,\n\t\t\t\tmethod: req.method,\n\t\t\t\theaders: { ...req.headers, host: "127.0.0.1:3100" }\n\t\t\t}, (pRes) => {\n\t\t\t\tres.writeHead(pRes.statusCode, pRes.headers);\n\t\t\t\tpRes.pipe(res, { end: true });\n\t\t\t});\n\t\t\tpReq.setTimeout(10000, () => { pReq.destroy(); });\n\t\t\tpReq.on("error", (err) => {\n\t\t\t\tconsole.error("[vinext api proxy error]", err);\n\t\t\t\tif (!res.headersSent) {\n\t\t\t\t\tres.writeHead(502);\n\t\t\t\t\tres.end("Bad Gateway: API server (port 3100) not responding");\n\t\t\t\t}\n\t\t\t});\n\t\t\treq.pipe(pReq, { end: true });\n\t\t\treturn;\n\t\t}`;

  if (content.includes(handleStartStr) && !content.includes("vinext api proxy error")) {
    content = content.replace(handleStartStr, proxyCodeStr);
    fs.writeFileSync(prodServerFile, content, "utf-8");
    console.log("[patch-vinext] Successfully patched vinext prod-server.js for /api proxy!");
  } else if (content.includes("vinext api proxy error")) {
    console.log("[patch-vinext] vinext prod-server.js is already patched for /api proxy.");
  } else {
    console.warn("[patch-vinext] Could not find target pattern in vinext prod-server.js");
  }
  // 3. Silence harmless 'Premature close' warnings when clients disconnect mid-download
  const streamWarnStr1 = `console.warn(\`[vinext] Static file stream error for \${resolved.path}:\`, err.message);`;
  const streamWarnFix1 = `if (err && err.message !== "Premature close" && err.code !== "ERR_STREAM_PREMATURE_CLOSE") console.warn(\`[vinext] Static file stream error for \${resolved.path}:\`, err.message);`;
  const streamWarnStr2 = `console.warn(\`[vinext] Static file stream error for \${variant.path}:\`, err.message);`;
  const streamWarnFix2 = `if (err && err.message !== "Premature close" && err.code !== "ERR_STREAM_PREMATURE_CLOSE") console.warn(\`[vinext] Static file stream error for \${variant.path}:\`, err.message);`;

  if (content.includes(streamWarnStr1) || content.includes(streamWarnStr2)) {
    content = content.replaceAll(streamWarnStr1, streamWarnFix1).replaceAll(streamWarnStr2, streamWarnFix2);
    fs.writeFileSync(prodServerFile, content, "utf-8");
    console.log("[patch-vinext] Patched static stream error warnings for Premature close.");
  }
} else {
  console.warn("[patch-vinext] prod-server.js not found at expected path.");
}

