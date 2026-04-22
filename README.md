<div align="center">

<img src="https://github.com/SPiceZ21/spz-core-media-kit/raw/main/Banner/Banner%232.png" alt="SPiceZ-Core Banner" width="100%"/>

<br/>

# spz-speedometer

### High-Fidelity Racing Dashboard & Telemetry

*Precision performance monitoring. Synchronized with spz-physics for the ultimate racing experience.*

<br/>

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-orange.svg?style=flat-square)](https://www.gnu.org/licenses/gpl-3.0)
[![FiveM](https://img.shields.io/badge/FiveM-Compatible-orange?style=flat-square)](https://fivem.net)
[![Lua](https://img.shields.io/badge/Lua-5.4-blue?style=flat-square&logo=lua)](https://lua.org)
[![Status](https://img.shields.io/badge/Status-In%20Development-green?style=flat-square)]()

</div>

---

## Overview

`spz-speedometer` is a premium NUI-based dashboard designed for high-performance racing. Unlike standard speedometers, it integrates directly with `spz-physics` to provide accurate RPM, gear, and driver assistance data (TSC, ABS, ESC) in a clean, modern racing interface.

---

## Features

- **Physics Synchronization** — Real-time telemetry fetched directly from the `spz-physics` engine.
- **Segmented RPM Bar** — A dynamic 15-segment RPM bar with peak indicators.
- **Assist Indicators** — Real-time status icons for Traction Control (TSC), Anti-lock Braking (ABS), and Electronic Stability Control (ESC).
- **Minimalist Aesthetic** — High-contrast design using the SPiceZ brand identity for maximum readability during high-speed maneuvers.
- **Optimized Performance** — Intelligent tick loop that only updates while the player is in the driver's seat.

---

## Dependencies

| Resource | Version | Role |
|---|---|---|
| `spz-lib` | 1.0.0+ | Shared utilities |
| `spz-physics` | 1.0.0+ | RPM, Gear, and Assist telemetry |

---

## Installation

1. Ensure the resource folder is named `spz-speedometer`.
2. Add to `server.cfg`:

```cfg
ensure spz-lib
ensure spz-physics
ensure spz-speedometer
```

---

## Visual Layout

- **Top Bar**: Segmented RPM Gauge.
- **Left Box**: Current Gear indicator.
- **Center**: Large Digital Speedometer (KM/H).
- **Bottom**: Assist System Indicators (TSC/ABS/ESC).

---

<div align="center">

*Part of the [SPiceZ-Core](https://github.com/SPiceZ-Core) ecosystem*

**[Docs](https://github.com/SPiceZ-Core/spz-docs) · [Discord](https://discord.gg/) · [Issues](https://github.com/SPiceZ-Core/spz-speedometer/issues)**

</div>
