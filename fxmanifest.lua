fx_version 'cerulean'
game 'gta5'

name 'spz-speedometer'
description 'Premium Racing Speedometer with spz-physics integration'
version '1.11.1'
author 'SPiceZ-Core'

-- ui_page 'ui/dist/index.html'  -- drawn by spz-hud now (web/public/apps/spz-speedometer); uncomment + drop the shim to roll back

client_scripts {
    '@spz-hud/shim.lua',   -- NUI goes through spz-hud
    'client/main.lua'
}

-- UI files are not shipped from here: spz-hud serves this resource's page
-- (synced from ui/ by spz-hud/tools/sync-apps.mjs).

dependencies {
    'spz-hud',
    'ox_lib',
    'spz-core',
}
