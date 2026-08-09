# spz-speedometer

> Speedometer HUD · `v1.1.2`

## Overview

`spz-speedometer` renders speed, gear, RPM and nitrous state. It pulls simulated
powertrain data from [spz-physics](../spz-physics/README.md) when that resource is running
and falls back to native vehicle values otherwise; nitrous state comes from
[spz-nos](../spz-nos/README.md).

## Structure

| Side | File | Purpose |
|---|---|---|
| Client | `client/main.lua` | Data polling, NUI bridge, display updates |

## NUI

Vite · Preact · TypeScript on the [spz-ui](../spz-ui/README.md) component set.

```bash
cd ui && npm install && npm run build   # → ui/dist/index.html
```

## Dependencies

`ox_lib` · `spz-nos`. Optional: `spz-physics` for simulated gear and RPM.

---

Part of [SPiceZ-Core](../README.md) · GPL-3.0
