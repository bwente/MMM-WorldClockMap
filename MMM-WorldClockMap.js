/* global Log, Module, WorldClockMapUtils */

Module.register("MMM-WorldClockMap", {
  defaults: {
    layout: "compact",
    clocks: [
      { label: "New York", timeZone: "America/New_York", latitude: 40.7128, longitude: -74.006 },
      { label: "London", timeZone: "Europe/London", latitude: 51.5072, longitude: -0.1276 },
      { label: "Tokyo", timeZone: "Asia/Tokyo", latitude: 35.6762, longitude: 139.6503 }
    ],
    showMap: true,
    showAnalog: false,
    showSeconds: false,
    showDate: true,
    showTimeDifference: true,
    showSunTimes: false,
    showDayNightTint: true,
    referenceTimeZone: null,
    timeFormat: "auto",
    mapHeight: 260,
    mapFit: "auto",
    mapLabelSize: 18,
    updateInterval: null,
    animationSpeed: 0,
    accentColor: "#ffb229"
  },

  getScripts() {
    return [this.file("worldclockmap-utils.js")];
  },

  getStyles() {
    return ["MMM-WorldClockMap.css"];
  },

  getTranslations() {
    const locales = ["en", "af", "ar", "bg", "ca", "cs", "cv", "cy", "da", "de", "el", "eo", "es", "et", "fi", "fr", "fy", "gl", "gu", "he", "hi", "hr", "hu", "id", "is", "it", "ja", "ko", "lt", "ms-my", "nb", "nl", "nn", "pl", "ps", "pt", "pt-br", "ro", "ru", "sk", "sv", "th", "tlh", "tr", "uk", "zh-cn", "zh-tw"];
    return Object.fromEntries(locales.map((locale) => [locale, `translations/${locale}.json`]));
  },

  start() {
    this.now = new Date();
    this.validationErrors = WorldClockMapUtils.validateConfig(this.config);
    if (this.validationErrors.length) {
      Log.error(`${this.name}: ${this.validationErrors.join("; ")}`);
    }
    const configuredInterval = Number(this.config.updateInterval);
    const updateInterval = Number.isFinite(configuredInterval) && configuredInterval > 0
      ? configuredInterval
      : this.config.showSeconds ? 1000 : 30000;
    this.timer = setInterval(() => {
      this.now = new Date();
      this.updateDom(this.config.animationSpeed);
    }, Math.max(1000, updateInterval));
  },

  suspend() {
    clearInterval(this.timer);
    this.mapResizeObserver?.disconnect();
    this.mapResizeObserver = null;
  },

  resume() {
    clearInterval(this.timer);
    this.start();
  },

  notificationReceived(notification) {
    if (notification === "WORLD_CLOCK_MAP_REFRESH") {
      this.now = new Date();
      this.updateDom(this.config.animationSpeed);
    }
  },

  getDom() {
    const root = document.createElement("section");
    const layout = ["large", "compact", "line"].includes(this.config.layout) ? this.config.layout : "compact";
    root.className = `mmm-worldclockmap mmm-worldclockmap--${layout}`;
    root.style.setProperty("--wcm-accent", this.config.accentColor);
    root.setAttribute("aria-label", this.translate("WORLD_CLOCKS"));

    if (this.validationErrors.length) {
      const error = document.createElement("p");
      error.className = "mmm-worldclockmap__error";
      error.textContent = this.translate("CONFIG_ERROR");
      root.appendChild(error);
      return root;
    }

    if (this.config.showMap && layout !== "line") root.appendChild(this.buildMap(layout));
    const clocks = document.createElement("div");
    clocks.className = "mmm-worldclockmap__clocks";
    for (const clock of this.config.clocks) clocks.appendChild(this.buildClock(clock));
    root.appendChild(clocks);
    return root;
  },

  buildMap(layout) {
    this.mapResizeObserver?.disconnect();
    const map = document.createElement("div");
    map.className = "mmm-worldclockmap__map";
    const mapHeight = Math.max(120, Number(this.config.mapHeight) || 260);
    const mapFit = ["auto", "contain", "stretch"].includes(this.config.mapFit) ? this.config.mapFit : "auto";
    map.classList.add(`mmm-worldclockmap__map--${mapFit}`);
    map.style.setProperty("--wcm-map-height", `${mapHeight}px`);
    map.setAttribute("role", "img");
    map.setAttribute("aria-label", this.translate("DAY_NIGHT_MAP"));
    map.innerHTML = WorldClockMapUtils.createMapSvg(this.now, this.config.clocks, (clock) => this.clockParts(clock).time, this.file("worldOutlineLow.svg"), mapFit);
    requestAnimationFrame(() => this.sizeMapMarkers(map));
    if (typeof ResizeObserver === "function") {
      this.mapResizeObserver = new ResizeObserver(() => this.sizeMapMarkers(map));
      this.mapResizeObserver.observe(map);
    }
    return map;
  },

  sizeMapMarkers(map) {
    if (!map.isConnected) return;
    const svg = map.querySelector("svg");
    const matrix = svg?.getScreenCTM();
    if (!matrix) return;
    const scaleX = Math.hypot(matrix.a, matrix.b) || 1;
    const scaleY = Math.hypot(matrix.c, matrix.d) || 1;
    const labelPixels = Math.max(12, Math.min(48, Number(this.config.mapLabelSize) || 18));
    const radiusPixels = Math.max(4, labelPixels * 0.22);
    const placed = [];
    for (const marker of svg.querySelectorAll(".wcm-marker")) {
      let side = marker.dataset.side === "end" ? -1 : 1;
      const labels = marker.querySelectorAll("text");
      const content = marker.querySelector(".wcm-marker-content");
      const point = marker.querySelector("ellipse");
      content.setAttribute("transform", `scale(${1 / scaleX} ${1 / scaleY})`);
      point.setAttribute("rx", radiusPixels);
      point.setAttribute("ry", radiusPixels);
      labels[0].style.fontSize = `${labelPixels}px`;
      labels[0].setAttribute("y", -3);
      labels[1].style.fontSize = `${labelPixels * 0.78}px`;
      labels[1].setAttribute("y", labelPixels * 0.82);
      const position = () => {
        for (const label of labels) {
          label.setAttribute("x", side * (radiusPixels + 5));
          label.setAttribute("text-anchor", side < 0 ? "end" : "start");
        }
      };
      const bounds = () => {
        const boxes = Array.from(labels, (label) => label.getBoundingClientRect());
        return {
          left: Math.min(...boxes.map((box) => box.left)),
          right: Math.max(...boxes.map((box) => box.right)),
          top: Math.min(...boxes.map((box) => box.top)),
          bottom: Math.max(...boxes.map((box) => box.bottom))
        };
      };
      const overlaps = (box) => placed.some((other) => box.left < other.right + 4 && box.right + 4 > other.left && box.top < other.bottom + 4 && box.bottom + 4 > other.top);
      position();
      let box = bounds();
      if (overlaps(box)) {
        side *= -1;
        position();
        box = bounds();
      }
      placed.push(box);
    }
  },

  buildClock(clock) {
    const parts = this.clockParts(clock);
    const article = document.createElement("article");
    const daylight = Number.isFinite(clock.latitude) && Number.isFinite(clock.longitude)
      ? WorldClockMapUtils.isDaytime(this.now, clock.latitude, clock.longitude)
      : null;
    article.className = "mmm-worldclockmap__clock";
    if (this.config.showDayNightTint && daylight !== null) {
      article.classList.add(daylight ? "mmm-worldclockmap__clock--day" : "mmm-worldclockmap__clock--night");
    }
    article.setAttribute("aria-label", `${clock.label || clock.timeZone}: ${parts.time}`);

    if (this.config.showAnalog) {
      article.classList.add("mmm-worldclockmap__clock--analog");
      const analog = document.createElement("div");
      analog.className = "mmm-worldclockmap__analog";
      analog.setAttribute("aria-hidden", "true");
      analog.innerHTML = `<span class="hour" style="--rotation:${parts.angles.hour}deg"></span><span class="minute" style="--rotation:${parts.angles.minute}deg"></span><span class="second" style="--rotation:${parts.angles.second}deg"></span><i></i>`;
      article.appendChild(analog);
    }

    const text = document.createElement("div");
    text.className = "mmm-worldclockmap__details";
    const heading = document.createElement("h3");
    heading.textContent = clock.label || clock.timeZone;
    const time = document.createElement("time");
    time.className = "mmm-worldclockmap__time";
    time.dateTime = this.now.toISOString();
    time.textContent = parts.time;
    text.append(heading, time);

    if (this.config.showDate) text.appendChild(this.detail(parts.date, "date"));
    if (this.config.showTimeDifference) text.appendChild(this.detail(parts.difference, "difference"));
    if (this.config.showSunTimes && Number.isFinite(clock.latitude) && Number.isFinite(clock.longitude)) {
      const sun = WorldClockMapUtils.getSunTimes(this.now, clock.latitude, clock.longitude);
      text.appendChild(this.detail(this.translate("SUNRISE_TIME", { time: this.formatInstant(sun.sunrise, clock.timeZone) }), "sunrise"));
      text.appendChild(this.detail(this.translate("SUNSET_TIME", { time: this.formatInstant(sun.sunset, clock.timeZone) }), "sunset"));
    }
    article.appendChild(text);
    return article;
  },

  detail(value, type) {
    const line = document.createElement("div");
    line.className = `mmm-worldclockmap__meta mmm-worldclockmap__meta--${type}`;
    line.textContent = value;
    return line;
  },

  clockParts(clock) {
    const locale = config.language || "en";
    const hour12 = this.config.timeFormat === "12" ? true : this.config.timeFormat === "24" ? false : undefined;
    const values = WorldClockMapUtils.getZonedParts(this.now, clock.timeZone, locale, hour12, this.config.showSeconds);
    const reference = this.config.referenceTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = WorldClockMapUtils.getOffsetMinutes(this.now, clock.timeZone) - WorldClockMapUtils.getOffsetMinutes(this.now, reference);
    return {
      ...values,
      difference: WorldClockMapUtils.formatDifference(offset, this.translate.bind(this)),
      angles: WorldClockMapUtils.getHandAngles(values.numeric)
    };
  },

  formatInstant(value, timeZone) {
    if (!value) return this.translate("NOT_AVAILABLE");
    const locale = config.language || "en";
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      hour12: this.config.timeFormat === "12" ? true : this.config.timeFormat === "24" ? false : undefined
    }).format(value);
  }
});
