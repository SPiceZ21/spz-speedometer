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

        // Update NOS Consolidated HUD
        const nosUI = document.getElementById('nos-ui');
        if (data.nos && data.nos.hasNitro) {
            nosUI.style.display = 'flex';
            
            const fill = document.getElementById('nos-bar-fill');
            const modeText = document.getElementById('nos-mode-text');
            const flowText = document.getElementById('nos-flow-text');
            
            // Update percentage
            fill.style.width = data.nos.level + '%';
            flowText.innerText = 'x' + data.nos.flowRate.toFixed(1);
            
            // Toggle classes based on mode
            if (data.nos.mode === 'nitro') {
                modeText.innerText = 'NITRO';
                modeText.classList.remove('purge');
                fill.classList.remove('purge');
            } else {
                modeText.innerText = 'PURGE';
                modeText.classList.add('purge');
                fill.classList.add('purge');
            }
        } else {
            nosUI.style.display = 'none';
        }
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
