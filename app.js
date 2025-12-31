/* Versio 1.1.0 */
let audioCtx, analyser, dataArray, bufferLength;
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');

// Elementit
const startBtn = document.getElementById('startBtn');
const themeSelect = document.getElementById('themeSelect');
const colorSelect = document.getElementById('colorSelect');
const visualMode = document.getElementById('visualMode');
const sensitivity = document.getElementById('sensitivity');

// Ladataan asetukset muistista käynnistyksessä
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

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    if(pageId === 'scope-page') resize();
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.5;
}

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
        draw();
    } catch (err) {
        alert("Mikrofoni tarvitaan: " + err);
    }
};

// Tallennetaan asetukset kun niitä muutetaan
themeSelect.onchange = (e) => {
    const val = e.target.value;
    document.body.setAttribute('data-theme', val);
    localStorage.setItem('scope_theme', val);
};

colorSelect.onchange = (e) => {
    const val = e.target.value;
    document.documentElement.style.setProperty('--accent-color', val);
    localStorage.setItem('scope_color', val);
};

visualMode.onchange = (e) => {
    localStorage.setItem('scope_mode', e.target.value);
};

function draw() {
    if (!analyser) return;
    requestAnimationFrame(draw);
    
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accentColor;
    ctx.fillStyle = accentColor;

    if (visualMode.value === 'wave') {
        analyser.getByteTimeDomainData(dataArray);
        ctx.beginPath();
        let x = 0;
        let sliceWidth = canvas.width / bufferLength;
        let amp = sensitivity.value / 5;

        for (let i = 0; i < bufferLength; i++) {
            let v = dataArray[i] / 128.0;
            let y = (canvas.height / 2) + ((v - 1) * (canvas.height / 2) * amp);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();
    } else {
        analyser.getByteFrequencyData(dataArray);
        let barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            let barHeight = dataArray[i] * (sensitivity.value / 5);
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
            x += barWidth;
        }
    }
}

window.onresize = resize;
resize();
loadSettings(); // Suoritetaan lataus heti
