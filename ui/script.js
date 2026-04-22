const SEGMENT_COUNT = 40;
const rpmContainer = document.getElementById('rpm-bar');
const segments = [];

// Initialize RPM segments
for (let i = 0; i < SEGMENT_COUNT; i++) {
    const seg = document.createElement('div');
    seg.className = 'rpm-segment';
    rpmContainer.appendChild(seg);
    segments.push(seg);
}

window.addEventListener('message', function(event) {
    const data = event.data;

    if (data.type === 'update') {
        // Update Speed
        document.getElementById('speed-val').innerText = data.speed;

        // Update Gear
        let gearDisplay = data.gear;
        if (gearDisplay === 0) {
            gearDisplay = 'R';
        }
        document.getElementById('gear-val').innerText = gearDisplay;

        // Update RPM Bar
        const rpmPct = data.rpm / data.maxRpm;
        const activeSegments = Math.floor(rpmPct * SEGMENT_COUNT);
        
        segments.forEach((seg, i) => {
            seg.classList.remove('active', 'current');
            if (i < activeSegments) {
                seg.classList.add('active');
            } else if (i === activeSegments && activeSegments < SEGMENT_COUNT) {
                seg.classList.add('current');
            }
        });

        // Update Indicators
        toggleIndicator('ind-tcs', data.assists.tcs);
        toggleIndicator('ind-abs', data.assists.abs);
        toggleIndicator('ind-esc', data.assists.esc);
    } else if (data.type === 'show') {
        document.getElementById('app').style.display = 'flex';
    } else if (data.type === 'hide') {
        document.getElementById('app').style.display = 'none';
    }
});

function toggleIndicator(id, active) {
    const el = document.getElementById(id);
    if (active) {
        el.classList.add('active');
    } else {
        el.classList.remove('active');
    }
}
