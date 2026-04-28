fx_version 'cerulean'
game 'gta5'

name 'spz-speedometer'
description 'Premium Racing Speedometer with spz-physics integration'
version '1.1.2'
author 'SPiceZ-Core'

ui_page 'ui/dist/index.html'

client_scripts {
    'client/main.lua'
}

files {
    'ui/dist/**/*',
}

dependencies {
    'spz-lib',
    'spz-physics'
}

