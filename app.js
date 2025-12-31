/* Versio 1.8.1 */
let audioCtx, analyser, dataArray, bufferLength;
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const themeSelect = document.getElementById('themeSelect');
const colorSelect = document.getElementById('colorSelect');
const visualMode = document.getElementById('visualMode');
const sensitivity = document.getElementById('sensitivity');
const hzDisplay = document.getElementById('hzDisplay');
const dbDisplay = document.getElementById('dbDisplay');

let isPaused = false;

// Navigointi
window.showPage = function(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.add('hidden'));
    const activePage = document.getElementById(pageId);
    if (activePage) activePage.classList.remove('hidden');
    if(pageId === 'scope-page') resize();
};

function loadSettings() {
    const savedTheme = localStorage.getItem('scope_theme') || 'dark';
    const savedColor = localStorage.getItem('scope_color') || '#0f0';
    const savedMode = localStorage.getItem('scope_mode') || 'wave';
    
    themeSelect.value = savedTheme;
    colorSelect.value = savedColor;
    visualMode.value = savedMode;
    
    document.body.setAttribute('data-theme', savedTheme);
    document.documentElement.style.setProperty('--accent-color', savedColor);
    
    // Pakotetaan nappi näkyviin latauksessa
    startBtn.style.display = 'block';
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.55;
}

canvas.onclick = () => {
    if (isPaused) { isPaused = false; draw(); return; }
    const modes = ['wave', 'bars', 'spectrogram', 'circular'];
    let nextIdx = (modes.indexOf(visualMode.value) + 1) % modes.length;
    visualMode.value = modes[nextIdx];
    localStorage.setItem('scope_mode', visualMode.value);
};

// Start-nappi on KAIKEN A JA O
startBtn.addEventListener('click', async function() {
    try {
        // Luodaan ja herätetään AudioContext välittömästi tässä funktiossa
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioCtx.createMediaStreamSource(stream);
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        source.connect(analyser);
        
        // Piilotetaan nappi vasta kun kaikki on varmasti käynnissä
        startBtn.style.display = 'none';
        isPaused = false;
        draw();
        
        // Wake Lock
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').catch(() => {});
        }
    } catch (err) {
        alert("Virhe käynnistyksessä: " + err);
    }
});

const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');

function draw() {
    if (!analyser || isPaused) return;
    requestAnimationFrame(draw);
    
    const theme = document.body.getAttribute('data-theme');
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
    const mode = visualMode.value;
    const amp = sensitivity.value / 5;
    const bgColor = getComputedStyle(document.body).backgroundColor;

    let timeData = new Uint8Array(bufferLength);
    let freqData = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    // Päivitetään mittarit
    let sum = 0;
    for(let i=0; i<timeData.length; i++) { let x = (timeData[i]/128.0)-1; sum += x*x; }
    let db = 20 * Math.log10(Math.sqrt(sum/timeData.length) || 0.00001);
    dbDisplay.innerText = Math.round(Math.max(0, db + 100)) + " dB";

    if (mode === 'spectrogram') {
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.drawImage(canvas, 0, 0);
        ctx.drawImage(tempCanvas, 0, -1);
        let barWidth = canvas.width / (bufferLength / 2);
        for (let i = 0; i < bufferLength / 2; i++) {
            let val = freqData[i] * amp;
            if (val < 70) { 
                ctx.fillStyle = bgColor; 
            } else {
                let lightness = (theme === 'light') ? "35%" : "50%";
                ctx.fillStyle = (colorSelect.value === 'rainbow') ? `hsl(${(i/(bufferLength/2))*360}, 100%, ${lightness})` : accentColor;
            }
            ctx.fillRect(i * barWidth, canvas.height - 1, barWidth + 1, 1);
        }
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = accentColor;
        ctx.fillStyle = accentColor;

        if (mode === 'wave') {
            ctx.beginPath();
            let x = 0;
            let sliceWidth = canvas.width / bufferLength;
            for (let i = 0; i < bufferLength; i++) {
                if (colorSelect.value === 'rainbow') {
                    ctx.strokeStyle = `hsl(${(i/bufferLength)*360}, 100%, ${(theme === 'light' ? '40%' : '50%')})`;
                }
                let v = timeData[i] / 128.0;
                let y = (canvas.height/2) + ((v-1)*(canvas.height/2)*amp);
                if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                x += sliceWidth;
                if (colorSelect.value === 'rainbow') { ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); }
            }
            ctx.stroke();
        } else if (mode === 'bars') {
            let barWidth = (canvas.width / (bufferLength / 2)) * 1.5;
            for (let i = 0; i < bufferLength / 2; i++) {
                let barHeight = freqData[i] * amp;
                let lightness = (theme === 'light') ? "35%" : "50%";
                ctx.fillStyle = (colorSelect.value === 'rainbow') ? `hsl(${(i/(bufferLength/2))*360}, 100%, ${lightness})` : accentColor;
                ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
            }
        } else if (mode === 'circular') {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.min(centerX, centerY) * 0.4;
            ctx.beginPath();
            for (let i = 0; i < bufferLength; i++) {
                if (colorSelect.value === 'rainbow') {
                    ctx.strokeStyle = `hsl(${(i/bufferLength)*360}, 100%, ${(theme === 'light' ? '40%' : '50%')})`;
                }
                let v = timeData[i] / 128.0;
                let r = radius + ((v-1) * radius * amp);
                let angle = (i / bufferLength) * Math.PI * 2;
                let x = centerX + Math.cos(angle) * r;
                let y = centerY + Math.sin(angle) * r;
                if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                if (colorSelect.value === 'rainbow') { ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); }
            }
            ctx.closePath();
            ctx.stroke();
        }
    }
}

// Tapahtumakuuntelijat asetuksille
themeSelect.addEventListener('change', (e) => {
    document.body.setAttribute('data-theme', e.target.value);
    localStorage.setItem('scope_theme', e.target.value);
});

colorSelect.addEventListener('change', (e) => {
    document.documentElement.style.setProperty('--accent-color', e.target.value);
    localStorage.setItem('scope_color', e.target.value);
});

visualMode.addEventListener('change', (e) => {
    localStorage.setItem('scope_mode', e.target.value);
});

window.onresize = resize;
resize();
loadSettings();
