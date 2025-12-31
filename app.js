/* Versio 1.9.0 */
let audioCtx, analyser, dataArray, bufferLength;
const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');

// Elementit
const themeSelect = document.getElementById('themeSelect');
const colorSelect = document.getElementById('colorSelect');
const visualMode = document.getElementById('visualMode');
const sensitivity = document.getElementById('sensitivity');
const hzDisplay = document.getElementById('hzDisplay');
const dbDisplay = document.getElementById('dbDisplay');

let isPaused = false;

// Pakotetaan nappi näkyviin heti
startBtn.style.setProperty('display', 'block', 'important');

window.showPage = function(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
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
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.55;
}

canvas.onclick = () => {
    if (isPaused) { isPaused = false; draw(); return; }
    if (!analyser) return;
    const modes = ['wave', 'bars', 'spectrogram', 'circular'];
    let nextIdx = (modes.indexOf(visualMode.value) + 1) % modes.length;
    visualMode.value = modes[nextIdx];
    localStorage.setItem('scope_mode', visualMode.value);
};

// Pitch detection logiikka
function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length, rms = 0;
    for (let i=0; i<SIZE; i++) { let val = buf[i]/128 - 1; rms += val*val; }
    if (Math.sqrt(rms/SIZE) < 0.01) return -1;
    let r1=0, r2=SIZE-1, thres=0.2;
    for (let i=0; i<SIZE/2; i++) if (Math.abs(buf[i]/128 - 1) < thres) { r1=i; break; }
    for (let i=1; i<SIZE/2; i++) if (Math.abs(buf[SIZE-i]/128 - 1) < thres) { r2=SIZE-i; break; }
    let buf2 = buf.slice(r1,r2), L = buf2.length, sum = new Float32Array(L);
    for (let i=0; i<L; i++) for (let j=0; j<L-i; j++) sum[i] += (buf2[j]/128-1)*(buf2[j+i]/128-1);
    let d=0; while (sum[d]>sum[d+1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i=d; i<L; i++) if (sum[i] > maxval) { maxval = sum[i]; maxpos = i; }
    return sampleRate / maxpos;
}

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
        if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(()=>{});
        draw();
    } catch (err) { alert("Virhe: " + err); }
};

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

    // Mittarit
    let freq = autoCorrelate(timeData, audioCtx.sampleRate);
    hzDisplay.innerText = freq === -1 ? "--- Hz" : Math.round(freq) + " Hz";
    let sum = 0;
    for(let i=0; i<timeData.length; i++) { let x = (timeData[i]/128.0)-1; sum += x*x; }
    let db = 20 * Math.log10(Math.sqrt(sum/timeData.length) || 0.00001);
    dbDisplay.innerText = Math.round(Math.max(0, db + 100)) + " dB";

    if (mode === 'spectrogram') {
        tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
        tempCtx.drawImage(canvas, 0, 0); ctx.drawImage(tempCanvas, 0, -1);
        let barWidth = canvas.width / (bufferLength / 2);
        for (let i = 0; i < bufferLength / 2; i++) {
            let val = freqData[i] * amp;
            if (val < 70) { ctx.fillStyle = bgColor; }
            else {
                let lightness = (theme === 'light') ? "35%" : "50%";
                ctx.fillStyle = (colorSelect.value === 'rainbow') ? `hsl(${(i/(bufferLength/2))*360}, 100%, ${lightness})` : accentColor;
            }
            ctx.fillRect(i * barWidth, canvas.height - 1, barWidth + 1, 1);
        }
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.strokeStyle = accentColor; ctx.fillStyle = accentColor;

        if (mode === 'wave') {
            ctx.beginPath(); let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                if (colorSelect.value === 'rainbow') ctx.strokeStyle = `hsl(${(i/bufferLength)*360}, 100%, ${(theme==='light'?'40%':'50%')})`;
                let v = timeData[i] / 128.0, y = (canvas.height/2) + ((v-1)*(canvas.height/2)*amp);
                if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                x += canvas.width / bufferLength;
                if (colorSelect.value === 'rainbow') { ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); }
            }
            ctx.stroke();
        } else if (mode === 'bars') {
            let barWidth = (canvas.width / (bufferLength / 2)) * 1.5;
            for (let i = 0; i < bufferLength / 2; i++) {
                let barHeight = freqData[i] * amp;
                let lightness = (theme === 'light') ? "40%" : "50%";
                ctx.fillStyle = (colorSelect.value === 'rainbow') ? `hsl(${(i/(bufferLength/2))*360}, 100%, ${lightness})` : accentColor;
                ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
            }
        } else if (mode === 'circular') {
            const centerX = canvas.width / 2, centerY = canvas.height / 2, radius = Math.min(centerX, centerY) * 0.4;
            ctx.beginPath();
            for (let i = 0; i < bufferLength; i++) {
                if (colorSelect.value === 'rainbow') ctx.strokeStyle = `hsl(${(i/bufferLength)*360}, 100%, ${(theme==='light'?'40%':'50%')})`;
                let v = timeData[i]/128, r = radius + ((v-1)*radius*amp), angle = (i/bufferLength)*Math.PI*2;
                let x = centerX + Math.cos(angle)*r, y = centerY + Math.sin(angle)*r;
                if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                if (colorSelect.value === 'rainbow') { ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); }
            }
            ctx.closePath(); ctx.stroke();
        }
    }
}

themeSelect.onchange = (e) => { document.body.setAttribute('data-theme', e.target.value); localStorage.setItem('scope_theme', e.target.value); };
colorSelect.onchange = (e) => { document.documentElement.style.setProperty('--accent-color', e.target.value); localStorage.setItem('scope_color', e.target.value); };
window.onresize = resize;
resize();
loadSettings();
