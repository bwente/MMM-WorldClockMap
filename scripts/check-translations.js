const fs = require("node:fs");
const path = require("node:path");

const directory = path.join(__dirname, "..", "translations");
const files = fs.readdirSync(directory).filter((file) => file.endsWith(".json"));
const english = JSON.parse(fs.readFileSync(path.join(directory, "en.json"), "utf8"));
const englishKeys = Object.keys(english).sort();
const sources = ["MMM-WorldClockMap.js", "worldclockmap-utils.js"]
  .map((file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8"))
  .join("\n");
const usedKeys = new Set(Array.from(sources.matchAll(/translate\(\s*["']([A-Z_]+)["']/g), (match) => match[1]));
for (const key of ["AHEAD", "BEHIND"]) usedKeys.add(key);
let failed = false;

for (const file of files) {
  const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))).sort();
  if (keys.join("\n") !== englishKeys.join("\n")) {
    console.error(`${file}: translation keys do not match en.json`);
    failed = true;
  }
}

for (const key of englishKeys) {
  if (!usedKeys.has(key)) {
    console.error(`${key}: translation key is not used`);
    failed = true;
  }
}

for (const key of ["SUNRISE_TIME", "SUNSET_TIME"]) {
  if (!english[key].includes("{time}")) {
    console.error(`${key}: translation must include the {time} interpolation variable`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
else console.log(`Validated ${files.length} translation files.`);
