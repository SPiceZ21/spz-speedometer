fx_version 'cerulean'
game 'gta5'

name 'spz-speedometer'
description 'Premium Racing Speedometer with spz-physics integration'
version '1.0.0'
author 'SPiceZ-Core'

ui_page 'ui/index.html'

client_scripts {
    'client/main.lua'
}

files {
    'ui/index.html',
    'ui/public/fonts/Panchang-Variable.ttf',
}

dependencies {
    'spz-lib',
    'spz-physics'
}
