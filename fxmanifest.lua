fx_version 'cerulean'
game 'gta5'

name 'spz-speedometer'
description 'Premium Racing Speedometer with spz-physics integration'
version '1.5.0'
author 'SPiceZ-Core'

ui_page 'ui/dist/index.html'

client_scripts {
    'client/main.lua'
}

files {
    'ui/dist/**/*',
}

dependencies {
    'ox_lib',
    'spz-core',
}
