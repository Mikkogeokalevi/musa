/* Versio 1.2.0 */
let audioCtx, analyser, dataArray, bufferLength;
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');

// Elementit
const startBtn = document.getElementById('startBtn');
const themeSelect = document.getElementById('themeSelect');
const colorSelect = document.getElementById('colorSelect');
const visualMode = document.getElementById('visualMode');
const sensitivity = document.getElementById('sensitivity');

let wakeLock = null;

// Ladataan asetukset
function loadSettings() {
    const savedTheme = localStorage.getItem('scope_theme') || 'dark';
    const savedColor = localStorage.getItem('scope_color') || '#0f0';
    const savedMode = localStorage.getItem('scope_mode') || 'wave';

    themeSelect.value = savedTheme;
    colorSelect.value = savedColor;
    visualMode.value = savedMode;

    document.body.setAttribute('data-theme', savedTheme);
    document.documentElement.style.setProperty('--accent-color', savedColor);
}

// Näytön pito päällä (Wake Lock)
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log("Wake Lock ei onnistunut:", err);
    }
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    if(pageId === 'scope-page') resize();
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.55;
}

// Klikkaamalla canvasia vaihdetaan tilaa
canvas.onclick = () => {
    const modes = ['wave', 'bars', 'spectrogram'];
    let currentIdx = modes.indexOf(visualMode.value);
    let nextIdx = (currentIdx + 1) % modes.length;
    visualMode.value = modes[nextIdx];
    localStorage.setItem('scope_mode', visualMode.value);
};

startBtn.onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);
        
        startBtn.style.display = 'none';
        requestWakeLock();
        draw();
    } catch (err) {
        alert("Mikrofoni tarvitaan: " + err);
    }
};

themeSelect.onchange = (e) => {
    document.body.setAttribute('data-theme', e.target.value);
    localStorage.setItem('scope_theme', e.target.value);
};

colorSelect.onchange = (e) => {
    document.documentElement.style.setProperty('--accent-color', e.target.value);
    localStorage.setItem('scope_color', e.target.value);
};

visualMode.onchange = (e) => {
    localStorage.setItem('scope_mode', e.target.value);
};

// Spectrogram-apu (siirretään kuvaa ylöspäin)
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');

function draw() {
    if (!analyser) return;
    requestAnimationFrame(draw);
    
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
    const mode = visualMode.value;
    const amp = sensitivity.value / 5;

    if (mode === 'spectrogram') {
        // Vesiputous-näkymä vaatii hieman eri logiikan
        analyser.getByteFrequencyData(dataArray);
        
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.drawImage(canvas, 0, 0);

        ctx.drawImage(tempCanvas, 0, -1); // Siirretään vanhaa kuvaa ylös

        let barWidth = canvas.width / bufferLength;
        for (let i = 0; i < bufferLength; i++) {
            let val = dataArray[i] * amp;
            ctx.fillStyle = `rgba(${parseInt(accentColor.slice(1,3), 16)}, ${parseInt(accentColor.slice(3,5), 16)}, ${parseInt(accentColor.slice(5,7), 16)}, ${val/255})`;
            ctx.fillRect(i * barWidth, canvas.height - 1, barWidth + 1, 1);
        }
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = accentColor;
        ctx.fillStyle = accentColor;
        ctx.lineWidth = 2;

        if (mode === 'wave') {
            analyser.getByteTimeDomainData(dataArray);
            ctx.beginPath();
            let x = 0;
            let sliceWidth = canvas.width / bufferLength;
            for (let i = 0; i < bufferLength; i++) {
                let v = dataArray[i] / 128.0;
                let y = (canvas.height / 2) + ((v - 1) * (canvas.height / 2) * amp);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();
        } else if (mode === 'bars') {
            analyser.getByteFrequencyData(dataArray);
            let barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                let barHeight = dataArray[i] * amp;
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
                x += barWidth;
            }
        }
    }
}

window.onresize = resize;
resize();
loadSettings();
