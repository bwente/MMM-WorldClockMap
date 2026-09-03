(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WorldClockMapUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RAD = Math.PI / 180;
  const DAY = 86400000;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function validateConfig(config) {
    const errors = [];
    if (!Array.isArray(config.clocks) || !config.clocks.length) return ["clocks must contain at least one clock"];
    for (const [index, clock] of config.clocks.entries()) {
      if (!clock || typeof clock.timeZone !== "string") errors.push(`clocks[${index}].timeZone is required`);
      else {
        try { new Intl.DateTimeFormat("en", { timeZone: clock.timeZone }).format(); }
        catch { errors.push(`clocks[${index}].timeZone is invalid`); }
      }
      const hasLat = clock.latitude !== undefined;
      const hasLon = clock.longitude !== undefined;
      if (hasLat !== hasLon) errors.push(`clocks[${index}] needs both latitude and longitude`);
      if (hasLat && (!Number.isFinite(clock.latitude) || Math.abs(clock.latitude) > 90)) errors.push(`clocks[${index}].latitude is invalid`);
      if (hasLon && (!Number.isFinite(clock.longitude) || Math.abs(clock.longitude) > 180)) errors.push(`clocks[${index}].longitude is invalid`);
    }
    return errors;
  }

  function getZonedParts(date, timeZone, locale, hour12, showSeconds) {
    const timeOptions = { timeZone, hour: "numeric", minute: "2-digit", hour12 };
    if (showSeconds) timeOptions.second = "2-digit";
    const numericParts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(date);
    const numeric = Object.fromEntries(numericParts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    return {
      time: new Intl.DateTimeFormat(locale, timeOptions).format(date),
      date: new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", month: "short", day: "numeric" }).format(date),
      numeric
    };
  }

  function getOffsetMinutes(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    return Math.round((Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - date.getTime()) / 60000);
  }

  function formatDifference(minutes, translate) {
    minutes = Math.round(minutes);
    if (minutes === 0) return translate("SAME_TIME");
    const sign = minutes > 0 ? "+" : "−";
    const absolute = Math.abs(minutes);
    const hours = Math.floor(absolute / 60);
    const remainder = absolute % 60;
    const offset = `${sign}${hours}${remainder ? `:${String(remainder).padStart(2, "0")}` : ""}`;
    return translate(minutes > 0 ? "AHEAD" : "BEHIND", { offset });
  }

  function getHandAngles(numeric) {
    const seconds = numeric.second || 0;
    const minutes = numeric.minute + seconds / 60;
    return { hour: (numeric.hour % 12) * 30 + minutes / 2, minute: minutes * 6, second: seconds * 6 };
  }

  function solarPosition(date) {
    const days = date.getTime() / DAY - 10957.5;
    const meanLongitude = (280.46 + 0.9856474 * days) % 360;
    const anomaly = (357.528 + 0.9856003 * days) * RAD;
    const ecliptic = (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
    const declination = Math.asin(Math.sin(23.439 * RAD) * Math.sin(ecliptic)) / RAD;
    const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const equation = -7.655 * Math.sin(anomaly) + 9.873 * Math.sin(2 * ecliptic + 3.588 * RAD);
    const longitude = 180 - 15 * utcHours - equation / 4;
    return { declination, longitude: ((longitude + 540) % 360) - 180 };
  }

  const MAP_WIDTH = 960;
  const MAP_TOP = 168.36;
  const MAP_BOTTOM = 791.65;
  const MAP_LEFT_LONGITUDE = -180;
  const MAP_RIGHT_LONGITUDE = 180;
  const MAP_TOP_LATITUDE = 83.68;
  const MAP_BOTTOM_LATITUDE = -55.55;

  function mercator(latitude) {
    const limited = Math.max(-89.5, Math.min(89.5, latitude));
    return Math.log(Math.tan(Math.PI / 4 + limited * RAD / 2));
  }

  function project(longitude, latitude) {
    let wrappedLongitude = longitude;
    while (wrappedLongitude < MAP_LEFT_LONGITUDE) wrappedLongitude += 360;
    while (wrappedLongitude > MAP_RIGHT_LONGITUDE) wrappedLongitude -= 360;
    const x = ((wrappedLongitude - MAP_LEFT_LONGITUDE) / (MAP_RIGHT_LONGITUDE - MAP_LEFT_LONGITUDE)) * MAP_WIDTH;
    const top = mercator(MAP_TOP_LATITUDE);
    const bottom = mercator(MAP_BOTTOM_LATITUDE);
    const y = MAP_TOP + ((top - mercator(latitude)) / (top - bottom)) * (MAP_BOTTOM - MAP_TOP);
    return [x, y];
  }

  function terminatorPoints(date) {
    const sun = solarPosition(date);
    const points = [];
    for (let longitude = MAP_LEFT_LONGITUDE; longitude <= MAP_RIGHT_LONGITUDE; longitude += 2) {
      const hourAngle = (longitude - sun.longitude) * RAD;
      const latitude = Math.atan(-Math.cos(hourAngle) / Math.tan(sun.declination * RAD || 0.000001)) / RAD;
      points.push(project(longitude, latitude));
    }
    return { points, sun };
  }

  function terminatorPath(date) {
    const { points } = terminatorPoints(date);
    return `M${points.map((point) => point.join(",")).join(" L")}`;
  }

  function nightPath(date) {
    const { points, sun } = terminatorPoints(date);
    const nightPoleY = sun.declination >= 0 ? MAP_BOTTOM : MAP_TOP;
    return `M${points.map((point) => point.join(",")).join(" L")} L${MAP_WIDTH},${nightPoleY} L0,${nightPoleY} Z`;
  }

  function createMapSvg(date, clocks, getTime, mapUrl = "worldOutlineLow.svg", mapFit = "contain") {
    const grid = Array.from({ length: 13 }, (_, index) => `<line x1="${index * 80}" y1="${MAP_TOP}" x2="${index * 80}" y2="${MAP_BOTTOM}"/>`).join("");
    const markers = clocks.filter((clock) => Number.isFinite(clock.latitude) && Number.isFinite(clock.longitude)).map((clock) => {
      const [x, y] = project(clock.longitude, clock.latitude);
      const anchor = x > 820 ? "end" : "start";
      const dx = anchor === "end" ? -9 : 9;
      return `<g class="wcm-marker" data-side="${anchor}" transform="translate(${x} ${y})"><ellipse rx="4.5" ry="4.5"/><text x="${dx}" y="-4" text-anchor="${anchor}">${escapeHtml(clock.label || clock.timeZone)}</text><text class="wcm-marker-time" x="${dx}" y="12" text-anchor="${anchor}">${escapeHtml(getTime(clock))}</text></g>`;
    }).join("");
    const preserveAspectRatio = mapFit === "stretch" ? "none" : "xMidYMid meet";
    return `<svg viewBox="-2 ${MAP_TOP} 964 ${MAP_BOTTOM - MAP_TOP}" preserveAspectRatio="${preserveAspectRatio}" xmlns="http://www.w3.org/2000/svg"><image class="wcm-land" href="${escapeHtml(mapUrl)}" x="-2" y="${MAP_TOP}" width="964" height="${MAP_BOTTOM - MAP_TOP}"/><g class="wcm-grid">${grid}</g><path class="wcm-night-fill" d="${nightPath(date)}"/><path class="wcm-terminator" d="${terminatorPath(date)}"/><g class="wcm-markers">${markers}</g></svg>`;
  }

  function isDaytime(date, latitude, longitude) {
    const sun = solarPosition(date);
    const hourAngle = (longitude - sun.longitude) * RAD;
    const elevation = Math.asin(
      Math.sin(latitude * RAD) * Math.sin(sun.declination * RAD)
      + Math.cos(latitude * RAD) * Math.cos(sun.declination * RAD) * Math.cos(hourAngle)
    );
    return elevation >= -0.833 * RAD;
  }

  function getSunTimes(date, latitude, longitude) {
    const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const lw = -longitude * RAD;
    const phi = latitude * RAD;
    const d = (start - Date.UTC(2000, 0, 1, 12)) / DAY;
    const n = Math.round(d - 0.0009 + longitude / 360);
    const ds = 0.0009 - longitude / 360 + n;
    const m = (357.5291 + 0.98560028 * ds) * RAD;
    const c = (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)) * RAD;
    const lambda = m + c + 102.9372 * RAD + Math.PI;
    const transit = 2451545 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * lambda);
    const declination = Math.asin(Math.sin(lambda) * Math.sin(23.4397 * RAD));
    const cosHour = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(declination)) / (Math.cos(phi) * Math.cos(declination));
    if (cosHour < -1 || cosHour > 1) return { sunrise: null, sunset: null };
    const hour = Math.acos(cosHour);
    const setJulian = transit + hour / (2 * Math.PI);
    const riseJulian = transit - hour / (2 * Math.PI);
    const fromJulian = (julian) => new Date((julian - 2440587.5) * DAY);
    return { sunrise: fromJulian(riseJulian), sunset: fromJulian(setJulian) };
  }

  return { createMapSvg, formatDifference, getHandAngles, getOffsetMinutes, getSunTimes, getZonedParts, isDaytime, nightPath, project, solarPosition, terminatorPath, validateConfig };
});
