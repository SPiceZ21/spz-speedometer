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

files {
    'ui/dist/**/*',
}

dependencies {
    'spz-hud',
    'ox_lib',
    'spz-core',
}
