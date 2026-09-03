const test = require("node:test");
const assert = require("node:assert/strict");
const utils = require("../worldclockmap-utils.js");

test("validates clocks and coordinates", () => {
  assert.deepEqual(utils.validateConfig({ clocks: [{ timeZone: "America/New_York", latitude: 40.7, longitude: -74 }] }), []);
  assert.equal(utils.validateConfig({ clocks: [{ timeZone: "Not/AZone" }] }).length, 1);
  assert.equal(utils.validateConfig({ clocks: [{ timeZone: "UTC", latitude: 100, longitude: 0 }] }).length, 1);
});

test("gets DST-aware timezone offsets", () => {
  assert.equal(utils.getOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/New_York"), -300);
  assert.equal(utils.getOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "America/New_York"), -240);
  assert.equal(utils.getOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Asia/Kolkata"), 330);
  assert.equal(utils.getOffsetMinutes(new Date("2026-07-15T12:00:00.123Z"), "America/Los_Angeles"), -420);
});

test("formats fractional time differences", () => {
  const translate = (key, values) => key === "SAME_TIME" ? "same" : `${key} ${values.offset}`;
  assert.equal(utils.formatDifference(330, translate), "AHEAD +5:30");
  assert.equal(utils.formatDifference(-210, translate), "BEHIND −3:30");
  assert.equal(utils.formatDifference(0, translate), "same");
});

test("calculates analog hand angles", () => {
  assert.deepEqual(utils.getHandAngles({ hour: 3, minute: 30, second: 0 }), { hour: 105, minute: 180, second: 0 });
});

test("solar position follows solstices", () => {
  const june = utils.solarPosition(new Date("2026-06-21T12:00:00Z"));
  const december = utils.solarPosition(new Date("2026-12-21T12:00:00Z"));
  assert.ok(june.declination > 23 && june.declination < 24);
  assert.ok(december.declination < -23 && december.declination > -24);
  assert.ok(Math.abs(june.longitude) < 5);
});

test("draws only the open solar terminator as a visible stroke", () => {
  const date = new Date("2026-06-21T12:00:00Z");
  assert.ok(!utils.terminatorPath(date).endsWith("Z"));
  const svg = utils.createMapSvg(date, [], () => "", "worldOutlineLow.svg");
  assert.ok(svg.includes('class="wcm-night-fill"'));
  assert.ok(svg.includes('class="wcm-terminator"'));
});

test("identifies local daylight as a boolean state", () => {
  assert.equal(utils.isDaytime(new Date("2026-03-20T12:00:00Z"), 0, 0), true);
  assert.equal(utils.isDaytime(new Date("2026-03-20T00:00:00Z"), 0, 0), false);
});

test("projects cities into the supplied amCharts map bounds", () => {
  const cupertino = utils.project(-122.0322, 37.323);
  const stockholm = utils.project(18.0686, 59.3293);
  const london = utils.project(-0.1276, 51.5072);
  const tokyo = utils.project(139.6503, 35.6762);
  assert.ok(cupertino[0] < stockholm[0] && stockholm[0] < tokyo[0]);
  assert.ok(stockholm[1] < cupertino[1]);
  assert.ok(Math.abs(cupertino[1] - tokyo[1]) < 20);
  assert.ok(Math.abs(london[0] - 479.66) < 0.1);
  assert.ok(Math.abs(tokyo[0] - 852.4) < 0.1);
});

test("sunrise precedes sunset at the equator", () => {
  const times = utils.getSunTimes(new Date("2026-03-20T12:00:00Z"), 0, 0);
  assert.ok(times.sunrise instanceof Date);
  assert.ok(times.sunset instanceof Date);
  assert.ok(times.sunrise < times.sunset);
  assert.ok((times.sunset - times.sunrise) / 3600000 > 11.5);
});

test("sun times use the correct east-west longitude", () => {
  const date = new Date("2026-09-01T01:39:00Z");
  const newYork = utils.getSunTimes(date, 40.7128, -74.006);
  const tokyo = utils.getSunTimes(date, 35.6762, 139.6503);
  assert.ok(newYork.sunrise.getUTCHours() >= 10 && newYork.sunrise.getUTCHours() <= 11);
  assert.ok(tokyo.sunrise.getUTCHours() >= 20 && tokyo.sunrise.getUTCHours() <= 21);
});

test("map output escapes user labels", () => {
  const svg = utils.createMapSvg(new Date("2026-03-20T12:00:00Z"), [{ label: "<script>", timeZone: "UTC", latitude: 0, longitude: 0 }], () => "12:00", "worldOutlineLow.svg");
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes('href="worldOutlineLow.svg"'));
});

test("translation files keep English keys", () => {
  require("../scripts/check-translations.js");
  assert.equal(process.exitCode, undefined);
});

test("declares English as the module translation fallback", () => {
  let definition;
  global.Module = { register: (_name, moduleDefinition) => { definition = moduleDefinition; } };
  require("../MMM-WorldClockMap.js");
  delete global.Module;
  assert.equal(Object.keys(definition.getTranslations())[0], "en");
});
