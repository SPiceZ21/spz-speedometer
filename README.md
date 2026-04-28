<div align="center">

<img src="https://github.com/SPiceZ21/spz-core-media-kit/raw/main/Banner/Banner%232.png" alt="SPiceZ-Core Banner" width="100%"/>

<br/>

# spz-speedometer
> Premium Racing Speedometer with spz-physics integration · `v1.1.1`

## Scripts

| Side   | File              | Purpose                                             |
| ------ | ----------------- | --------------------------------------------------- |
| Client | `client/main.lua` | Physics data polling, NUI bridge, display updates   |

## NUI

**Stack:** Vite · Preact · TypeScript · spz-ui

```
ui/
├── src/
│   ├── app.tsx
│   ├── components/       # spz-ui components
│   └── styles/
└── dist/                 # built output (served by FiveM)
    └── index.html
```

Build: `cd ui && npm run build`

## Dependencies
- spz-lib
- spz-physics

## CI
Built and released via `.github/workflows/release.yml` on push to `main`.
