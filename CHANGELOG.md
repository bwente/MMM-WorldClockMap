# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Fixed

- Kept large-layout digital times on one line and scaled them to the available card width.
- Wrapped large-layout cards before narrow MagicMirror regions could squeeze them beyond readability.
- Added responsive map fitting: proportional full-width maps in portrait, contained maps in landscape, and an explicit stretch option for specialized displays.
- Made `mapLabelSize` an exact rendered-pixel target through inverse-scaled marker content.
- Restored a single-row large clock grid and reduced its tile height and typography.
- Refreshed the clocks immediately when MagicMirror shows a suspended module again.
- Added a verified line-layout screenshot to the README.

## [0.1.0] - 2026-09-02

### Added

- Initial MagicMirror² module with large, compact, and line layouts.
- Optional offline realtime day/night map and location markers.
- Analog and digital clocks, timezone differences, and sunrise/sunset calculations.
- Translation coverage for all 47 current MagicMirror locales with validation tests.
- Accessible semantic markup, configuration validation, documentation, and CI.

### Changed

- Adopted the bundled detailed `worldOutlineLow.svg` map.
- Reduced default card size and disabled analog clocks and exact sun times by default.
- Added ambient warm-day and cool-night card tints for contact availability at a glance.
- Rounded timezone offsets to eliminate floating-point precision text.
- Increased map marker and label sizes and added configurable `mapLabelSize` scaling.
- Made label sizing use rendered CSS pixels and corrected marker projection to the supplied amCharts map bounds.
- Added automatic left/right label placement to reduce collisions between nearby cities.
- Removed the closing baseline from the visible solar terminator.
- Prevented `ResizeObserver` accumulation and reduced automatic refreshes to every 30 seconds when seconds are hidden.
- Gave each layout a distinct composition: full-width large, split-view compact, and map-free stacked line.
- Added light daylight analog faces and enabled optional left-side faces in line tiles.
- Aligned line-layout clock faces and details into consistent columns.
- Kept line-layout faces and details together as a centered content group inside full-width tiles.
- Corrected map longitude projection to the SVG's full −180° to +180° horizontal extent while retaining its cropped Mercator latitude transform.
- Documented the bundled amCharts-derived map attribution, modifications, and CC BY-NC 4.0 terms.
