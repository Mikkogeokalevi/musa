/* Versio 1.0.0 */
let audioCtx, analyser, dataArray, bufferLength;
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    if(pageId === 'scope-page') resize();
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.5;
}

const startBtn = document.getElementById('startBtn');
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

document.getElementById('themeSelect').onchange = (e) => {
    document.body.setAttribute('data-theme', e.target.value);
};

document.getElementById('colorSelect').onchange = (e) => {
    document.documentElement.style.setProperty('--accent-color', e.target.value);
};

function draw() {
    if (!analyser) return;
    requestAnimationFrame(draw);
    
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accentColor;
    ctx.fillStyle = accentColor;

    if (document.getElementById('visualMode').value === 'wave') {
        analyser.getByteTimeDomainData(dataArray);
        ctx.beginPath();
        let x = 0;
        let sliceWidth = canvas.width / bufferLength;
        let amp = document.getElementById('sensitivity').value / 5;

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
            let barHeight = dataArray[i] * (document.getElementById('sensitivity').value / 5);
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
            x += barWidth;
        }
    }
}

window.onresize = resize;
resize();
