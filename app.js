let audioCtx, analyser, dataArray, bufferLength;
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');

// Elementit
const startBtn = document.getElementById('startBtn');
const visualMode = document.getElementById('visualMode');
const themeSelect = document.getElementById('themeSelect');
const colorSelect = document.getElementById('colorSelect');
const sensitivity = document.getElementById('sensitivity');

function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.55;
}

startBtn.onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    source.connect(analyser);
    startBtn.style.display = 'none';
    draw();
};

// Teeman ja värin vaihto
themeSelect.onchange = (e) => document.body.setAttribute('data-theme', e.target.value);
colorSelect.onchange = (e) => document.documentElement.style.setProperty('--accent-color', e.target.value);

function draw() {
    requestAnimationFrame(draw);
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accentColor;
    ctx.fillStyle = accentColor;
    ctx.lineWidth = 2;

    if (visualMode.value === 'wave') {
        analyser.getByteTimeDomainData(dataArray);
        ctx.beginPath();
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            let v = dataArray[i] / 128.0;
            let y = (v * canvas.height / 2) + ((dataArray[i]/128.0 - 1) * sensitivity.value * 20);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            x += canvas.width / bufferLength;
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

window.onresize = init;
init();
