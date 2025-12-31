/* Versio 1.4.0 */
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
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } 
    catch (err) { console.log("WakeLock error"); }
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

// Pitch detection
function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i=0; i<SIZE; i++) { let val = buf[i]/128 - 1; rms += val*val; }
    rms = Math.sqrt(rms/SIZE);
    if (rms < 0.01) return -1;
    let r1=0, r2=SIZE-1, thres=0.2;
    for (let i=0; i<SIZE/2; i++) if (Math.abs(buf[i]/128 - 1) < thres) { r1=i; break; }
    for (let i=1; i<SIZE/2; i++) if (Math.abs(buf[SIZE-i]/128 - 1) < thres) { r2=SIZE-i; break; }
    let buf2 = buf.slice(r1,r2);
    let L = buf2.length;
    let sum = new Float32Array(L);
    for (let i=0; i<L; i++) for (let j=0; j<L-i; j++) sum[i] += (buf2[j]/128-1)*(buf2[j+i]/128-1);
    let d=0; while (sum[d]>sum[d+1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i=d; i<L; i++) if (sum[i] > maxval) { maxval = sum[i]; maxpos = i; }
    return sampleRate / maxpos;
}

startBtn.onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(2048);
        source.connect(analyser);
        startBtn.style.display = 'none';
        requestWakeLock();
        draw();
    } catch (err) { alert("Virhe: " + err); }
};

const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');

function draw() {
    if (!analyser) return;
    requestAnimationFrame(draw);
    
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color');
    const mode = visualMode.value;
    const amp = sensitivity.value / 5;

    analyser.getByteTimeDomainData(dataArray);
    let freq = autoCorrelate(dataArray, audioCtx.sampleRate);
    hzDisplay.innerText = freq === -1 ? "--- Hz" : Math.round(freq) + " Hz";

    let sum = 0;
    for(let i=0; i<dataArray.length; i++) {
        let x = (dataArray[i] / 128.0) - 1.0;
        sum += x * x;
    }
    let rms = Math.sqrt(sum / dataArray.length);
    let db = 20 * Math.log10(rms);
    dbDisplay.innerText = Math.round(Math.max(0, db + 100)) + " dB";

    if (mode === 'spectrogram') {
        let freqData = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(freqData);
        
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.drawImage(canvas, 0, 0);
        ctx.drawImage(tempCanvas, 0, -1);

        let barWidth = canvas.width / (bufferLength / 2); // Keskitytään kuultaviin taajuuksiin
        for (let i = 0; i < bufferLength / 2; i++) {
            let val = freqData[i] * amp;
            // Noise gate: jos arvo on pieni, piirretään taustaväriä (puhdistaa näkymän)
            if (val < 40) {
                ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
            } else {
                if (colorSelect.value === 'rainbow') {
                    ctx.fillStyle = `hsl(${(i / (bufferLength/2)) * 360}, 100%, 50%)`;
                } else {
                    ctx.fillStyle = `rgba(${parseInt(accentColor.slice(1,3), 16)}, ${parseInt(accentColor.slice(3,5), 16)}, ${parseInt(accentColor.slice(5,7), 16)}, ${val/255})`;
                }
            }
            ctx.fillRect(i * barWidth, canvas.height - 1, barWidth + 1, 1);
        }
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;

        if (mode === 'wave') {
            ctx.strokeStyle = accentColor;
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
            let barWidth = (canvas.width / (bufferLength / 2)) * 1.5;
            for (let i = 0; i < bufferLength / 2; i++) {
                let barHeight = freqData[i] * amp;
                if (colorSelect.value === 'rainbow') {
                    ctx.fillStyle = `hsl(${(i / (bufferLength/2)) * 360}, 80%, 50%)`;
                } else {
                    ctx.fillStyle = accentColor;
                }
                ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
            }
        }
    }
}

window.onresize = resize;
resize();
loadSettings();
