/* Versio 1.3.0 */
let audioCtx, analyser, dataArray, bufferLength;
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');

// Elementit
const startBtn = document.getElementById('startBtn');
const themeSelect = document.getElementById('themeSelect');
const colorSelect = document.getElementById('colorSelect');
const visualMode = document.getElementById('visualMode');
const sensitivity = document.getElementById('sensitivity');
const hzDisplay = document.getElementById('hzDisplay');
const dbDisplay = document.getElementById('dbDisplay');

let wakeLock = null;

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

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) { console.log("Wake Lock fail"); }
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

canvas.onclick = () => {
    const modes = ['wave', 'bars', 'spectrogram'];
    let nextIdx = (modes.indexOf(visualMode.value) + 1) % modes.length;
    visualMode.value = modes[nextIdx];
    localStorage.setItem('scope_mode', visualMode.value);
};

// Taajuuden tunnistus (Pitch detection)
function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i=0; i<SIZE; i++) {
        let val = buf[i]/128 - 1;
        rms += val*val;
    }
    rms = Math.sqrt(rms/SIZE);
    if (rms < 0.01) return -1; // Liian hiljaista

    let r1=0, r2=SIZE-1, thres=0.2;
    for (let i=0; i<SIZE/2; i++) if (Math.abs(buf[i]/128 - 1) < thres) { r1=i; break; }
    for (let i=1; i<SIZE/2; i++) if (Math.abs(buf[SIZE-i]/128 - 1) < thres) { r2=SIZE-i; break; }
    
    let buf2 = buf.slice(r1,r2);
    let L = buf2.length;
    let sum = new Float32Array(L);
    for (let i=0; i<L; i++)
        for (let j=0; j<L-i; j++)
            sum[i] += (buf2[j]/128-1)*(buf2[j+i]/128-1);

    let d=0; while (sum[d]>sum[d+1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i=d; i<L; i++) {
        if (sum[i] > maxval) {
            maxval = sum[i];
            maxpos = i;
        }
    }
    return sampleRate / maxpos;
}

startBtn.onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(2048); // Pitch detection tarvitsee koko aaltomuodon
        source.connect(analyser);
        startBtn.style.display = 'none';
        requestWakeLock();
        draw();
    } catch (err) { alert("Virhe: " + err); }
};

themeSelect.onchange = (e) => {
    document.body.setAttribute('data-theme', e.target.value);
    localStorage.setItem('scope_theme', e.target.value);
};

colorSelect.onchange = (e) => {
    document.documentElement.style.setProperty('--accent-color', e.target.value);
    localStorage.setItem('scope_color', e.target.value);
};

const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');

function draw() {
    if (!analyser) return;
    requestAnimationFrame(draw);
    
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
    const mode = visualMode.value;
    const amp = sensitivity.value / 5;

    // Haetaan aikatason data analyysia varten
    analyser.getByteTimeDomainData(dataArray);

    // 1. Taajuusmittaus (Hz)
    let freq = autoCorrelate(dataArray, audioCtx.sampleRate);
    hzDisplay.innerText = freq === -1 ? "--- Hz" : Math.round(freq) + " Hz";

    // 2. Äänenvoimakkuus (dB)
    let sum = 0;
    for(let i=0; i<dataArray.length; i++) {
        let x = (dataArray[i] / 128.0) - 1.0;
        sum += x * x;
    }
    let rms = Math.sqrt(sum / dataArray.length);
    let db = 20 * Math.log10(rms);
    if (db < -100) db = -100;
    dbDisplay.innerText = Math.round(db + 100) + " dB"; // Normalisoitu näyttö 0-100

    // Visualisointi
    if (mode === 'spectrogram') {
        analyser.getByteFrequencyData(new Uint8Array(bufferLength)); // Täytetään spektri
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.drawImage(canvas, 0, 0);
        ctx.drawImage(tempCanvas, 0, -1);
        let barWidth = canvas.width / bufferLength;
        let freqData = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(freqData);
        for (let i = 0; i < bufferLength; i++) {
            let val = freqData[i] * amp;
            ctx.fillStyle = `rgba(${parseInt(accentColor.slice(1,3), 16)}, ${parseInt(accentColor.slice(3,5), 16)}, ${parseInt(accentColor.slice(5,7), 16)}, ${val/255})`;
            ctx.fillRect(i * barWidth, canvas.height - 1, barWidth + 1, 1);
        }
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = accentColor;
        ctx.fillStyle = accentColor;
        ctx.lineWidth = 2;

        if (mode === 'wave') {
            ctx.beginPath();
            let x = 0;
            let sliceWidth = canvas.width / 2048;
            for (let i = 0; i < 2048; i++) {
                let v = dataArray[i] / 128.0;
                let y = (canvas.height / 2) + ((v - 1) * (canvas.height / 2) * amp);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.stroke();
        } else if (mode === 'bars') {
            let freqData = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(freqData);
            let barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                let barHeight = freqData[i] * amp;
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
                x += barWidth;
            }
        }
    }
}

window.onresize = resize;
resize();
loadSettings();
