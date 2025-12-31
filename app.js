/* Versio 1.8.3 */
let audioCtx, analyser, dataArray, bufferLength;
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');

// Pakotetaan nappi näkyviin heti kun skripti latautuu
startBtn.style.display = 'block';
startBtn.style.visibility = 'visible';
startBtn.style.zIndex = '9999';

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.55;
}

window.showPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    if(pageId === 'scope-page') resize();
};

startBtn.onclick = async () => {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);

        startBtn.style.display = 'none';
        draw();
    } catch (err) {
        alert("Mikrofoni ei toimi. Varmista HTTPS-yhteys ja käyttöoikeudet: " + err);
    }
};

function draw() {
    if (!analyser) return;
    requestAnimationFrame(draw);
    
    const theme = document.body.getAttribute('data-theme') || 'dark';
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color') || '#0f0';
    const amp = document.getElementById('sensitivity').value / 5;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    analyser.getByteTimeDomainData(dataArray);

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = accentColor;
    ctx.beginPath();

    let x = 0;
    let sliceWidth = canvas.width / bufferLength;
    for (let i = 0; i < bufferLength; i++) {
        let v = dataArray[i] / 128.0;
        let y = (canvas.height/2) + ((v-1)*(canvas.height/2)*amp);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
    }
    ctx.stroke();
}

window.onresize = resize;
resize();
