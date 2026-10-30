# spz-speedometer

> Racing speedometer.

![version](https://img.shields.io/badge/version-1.10.0-ff6200) ![SPiceZ-Core](https://img.shields.io/badge/SPiceZ--Core-beta-18181b)

## Overview

A themed racing speedometer: speed, gear, RPM and rewind / boost meters during races.

## Features

- Speed, gear and RPM
- Rewind credit and boost meters

## Requirements

| Resource | Type |
|---|---|
| `ox_lib` | third-party |
| `spz-core` | SPiceZ module |

## Installation

Included in the [txAdmin recipe](https://github.com/SPiceZ21/spz-txrecipe). Manual install:

1. Download `spz-speedometer` from GitHub (latest release, or the repository) into your `resources` folder.
2. Add to `server.cfg`, after its requirements:

```cfg
ensure spz-speedometer
```

## Exports

| Export | Side |
|---|---|
| `Demo` | client |
| `SetHidden` | client |
| `SetRewindCredit` | client |
| `SetSideBoost` | client |

```lua
exports["spz-speedometer"]:Demo(...)
```

---

Part of **SPiceZ-Core** — [documentation](https://github.com/SPiceZ21/Docs) · [all modules](https://github.com/SPiceZ21/Docs/blob/main/modules/README.md)
