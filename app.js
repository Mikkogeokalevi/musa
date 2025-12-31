/* Versio 2.2.1 - KORJATTU VESIPUTOUS */
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
let peaks = new Float32Array(1024);

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
    if (!analyser) return;
    const modes = ['wave', 'mirror', 'bars', 'spectrogram', 'circular', 'star'];
    let nextIdx = (modes.indexOf(visualMode.value) + 1) % modes.length;
    visualMode.value = modes[nextIdx];
    localStorage.setItem('scope_mode', visualMode.value);
};

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

// Spectrogramin tarvitsema välikangas (puskuri)
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

    let freq = autoCorrelate(timeData, audioCtx.sampleRate);
    hzDisplay.innerText = freq === -1 ? "--- Hz" : Math.round(freq) + " Hz";
    let sum = 0;
    for(let i=0; i<timeData.length; i++) { let x = (timeData[i]/128.0)-1; sum += x*x; }
    let dbValue = Math.round(Math.max(0, (20 * Math.log10(Math.sqrt(sum/timeData.length) || 0.00001)) + 100));
    dbDisplay.innerText = dbValue + " dB";
    dbDisplay.style.color = (dbValue > 85) ? "#ff0000" : "var(--accent-color)";

    // Spectrogram tarvitsee oman piirtologiikkansa (siirtää kuvaa)
    if (mode === 'spectrogram') {
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        tempCtx.drawImage(canvas, 0, 0); // Kopioidaan nykyinen kuva puskuriin
        
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Tyhjennetään
        ctx.drawImage(tempCanvas, 0, -1); // Piirretään vanha kuva 1px ylemmäs
        
        let barWidth = canvas.width / (bufferLength / 2);
        for (let i = 0; i < bufferLength / 2; i++) {
            let val = freqData[i] * amp;
            if (val > 70) {
                let lightness = (theme === 'light') ? "35%" : "50%";
                ctx.fillStyle = (colorSelect.value === 'rainbow') ? `hsl(${(i/(bufferLength/2))*360}, 100%, ${lightness})` : accentColor;
                ctx.fillRect(i * barWidth, canvas.height - 1, barWidth + 1, 1); // Uusi rivi pohjalle
            } else {
                ctx.fillStyle = bgColor;
                ctx.fillRect(i * barWidth, canvas.height - 1, barWidth + 1, 1);
            }
        }
    } else {
        // Muiden näkymien perusasetukset
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
        } else if (mode === 'mirror') {
            ctx.beginPath(); let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                if (colorSelect.value === 'rainbow') ctx.strokeStyle = `hsl(${(i/bufferLength)*360}, 100%, ${(theme==='light'?'40%':'50%')})`;
                let v = (timeData[i] / 128.0) - 1;
                let yOffset = v * (canvas.height/4) * amp;
                ctx.moveTo(x, (canvas.height/2) - yOffset);
                ctx.lineTo(x, (canvas.height/2) + yOffset);
                x += canvas.width / bufferLength;
                if (colorSelect.value === 'rainbow') { ctx.stroke(); ctx.beginPath(); }
            }
            ctx.stroke();
        } else if (mode === 'bars') {
            let visualBars = Math.min(bufferLength / 2, Math.floor(canvas.width / 5)); 
            let barWidth = (canvas.width / visualBars);
            let step = Math.floor((bufferLength / 2) / visualBars);
            for (let i = 0; i < visualBars; i++) {
                let valSum = 0; for(let j=0; j<step; j++) valSum += freqData[i * step + j];
                let barHeight = (valSum / step) * amp;
                ctx.fillStyle = (colorSelect.value === 'rainbow') ? `hsl(${(i/visualBars)*360}, 100%, ${(theme==='light'?'35%':'50%')})` : accentColor;
                ctx.fillRect(Math.floor(i * barWidth), canvas.height - barHeight, Math.ceil(barWidth) - 1, barHeight);
                if (barHeight > peaks[i]) peaks[i] = barHeight; else peaks[i] *= 0.98;
                ctx.fillStyle = (theme === 'light') ? "#000" : "#fff";
                ctx.fillRect(Math.floor(i * barWidth), canvas.height - peaks[i] - 2, Math.ceil(barWidth) - 1, 2);
            }
            ctx.fillStyle = (theme === 'light') ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
            ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("BASSO", canvas.width * 0.15, canvas.height - 10);
            ctx.fillText("KESKIÄÄNET", canvas.width * 0.5, canvas.height - 10);
            ctx.fillText("DISKANTTI", canvas.width * 0.85, canvas.height - 10);
        } else if (mode === 'circular') {
            const cX = canvas.width / 2, cY = canvas.height / 2, r = Math.min(cX, cY) * 0.4;
            ctx.beginPath();
            for (let i = 0; i < bufferLength; i++) {
                if (colorSelect.value === 'rainbow') ctx.strokeStyle = `hsl(${(i/bufferLength)*360}, 100%, ${(theme==='light'?'40%':'50%')})`;
                let v = timeData[i]/128, rad = r + ((v-1)*r*amp), ang = (i/bufferLength)*Math.PI*2;
                let x = cX + Math.cos(ang)*rad, y = cY + Math.sin(ang)*rad;
                if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                if (colorSelect.value === 'rainbow') { ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,y); }
            }
            ctx.closePath(); ctx.stroke();
        } else if (mode === 'star') {
            const cX = canvas.width / 2, cY = canvas.height / 2;
            for (let i = 0; i < bufferLength / 2; i++) {
                let val = freqData[i] * amp * 0.5;
                if (val > 10) {
                    ctx.strokeStyle = `hsl(${(i/(bufferLength/2))*360}, 100%, ${(theme==='light'?'40%':'50%')})`;
                    let ang = (i / (bufferLength / 2)) * Math.PI * 2;
                    ctx.beginPath(); ctx.moveTo(cX, cY);
                    ctx.lineTo(cX + Math.cos(ang) * val, cY + Math.sin(ang) * val);
                    ctx.stroke();
                }
            }
        }
    }
}

themeSelect.onchange = (e) => { document.body.setAttribute('data-theme', e.target.value); localStorage.setItem('scope_theme', e.target.value); };
colorSelect.onchange = (e) => { document.documentElement.style.setProperty('--accent-color', e.target.value); localStorage.setItem('scope_color', e.target.value); };
window.onresize = resize;
resize();
loadSettings();
