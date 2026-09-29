const core = window.SilenceSketchCore;
const state = { buffer: null, channels: [], cuts: [], enabled: [], fileName: 'recording.wav' };

const $ = (id) => document.getElementById(id);
const waveform = $('waveform');
const ctx = waveform.getContext('2d');
const fileInput = $('file-input');
const threshold = $('threshold');
const minSilence = $('min-silence');
const padding = $('padding');

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

function monoFromBuffer(buffer) {
  const mono = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}

function analyze() {
  if (!state.buffer) return;
  const mono = monoFromBuffer(state.buffer);
  state.cuts = core.detectSilences(mono, state.buffer.sampleRate, {
    thresholdDb: Number(threshold.value),
    minSilenceSec: Number(minSilence.value),
    paddingSec: Number(padding.value)
  });
  state.enabled = state.cuts.map(() => true);
  render();
}

function activeCuts() { return state.cuts.filter((_, i) => state.enabled[i]); }

function render() {
  $('threshold-value').textContent = `${threshold.value} dB`;
  $('min-silence-value').textContent = `${Number(minSilence.value).toFixed(2)}s`;
  $('padding-value').textContent = `${Number(padding.value).toFixed(2)}s`;
  if (!state.buffer) return;

  const summary = core.summarize(state.buffer.duration, activeCuts());
  $('duration').textContent = formatTime(summary.duration);
  $('removed').textContent = formatTime(summary.removed);
  $('result').textContent = formatTime(summary.result);
  $('count').textContent = summary.count;
  $('workspace').hidden = false;
  drawWaveform(monoFromBuffer(state.buffer), state.buffer.sampleRate);
  renderCuts();
}

function drawWaveform(samples, sampleRate) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = waveform.getBoundingClientRect();
  const width = Math.max(640, Math.round(rect.width * dpr));
  const height = Math.round(250 * dpr);
  waveform.width = width; waveform.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0c1220'; ctx.fillRect(0, 0, width, height);
  const duration = samples.length / sampleRate;
  for (const [i, cut] of activeCuts().entries()) {
    const x = cut.start / duration * width;
    const w = (cut.end - cut.start) / duration * width;
    ctx.fillStyle = i % 2 ? 'rgba(255,123,114,.20)' : 'rgba(255,123,114,.28)';
    ctx.fillRect(x, 0, Math.max(2, w), height);
  }
  ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2 * dpr; ctx.beginPath();
  const buckets = Math.min(width, 1400);
  const step = Math.max(1, Math.floor(samples.length / buckets));
  for (let x = 0; x < buckets; x++) {
    let peak = 0;
    const start = x * step;
    for (let i = start; i < Math.min(samples.length, start + step); i++) peak = Math.max(peak, Math.abs(samples[i]));
    const px = x / buckets * width;
    const half = peak * height * .42;
    ctx.moveTo(px, height / 2 - half); ctx.lineTo(px, height / 2 + half);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(0, height/2); ctx.lineTo(width, height/2); ctx.stroke();
}

function renderCuts() {
  const list = $('cut-list'); list.innerHTML = '';
  state.cuts.forEach((cut, i) => {
    const row = document.createElement('label'); row.className = `cut-row ${state.enabled[i] ? '' : 'kept'}`;
    row.innerHTML = `<input type="checkbox" ${state.enabled[i] ? 'checked' : ''}><span class="cut-time">${formatTime(cut.start)} → ${formatTime(cut.end)}</span><span>${formatTime(cut.end-cut.start)} 삭제</span>`;
    row.querySelector('input').addEventListener('change', e => { state.enabled[i] = e.target.checked; render(); });
    list.appendChild(row);
  });
  if (!state.cuts.length) list.innerHTML = '<p class="empty">현재 설정에서는 긴 무음이 없네. 임계값을 올리거나 최소 길이를 줄여봐.</p>';
}

async function loadFile(file) {
  const bytes = await file.arrayBuffer();
  const audioContext = new AudioContext();
  state.buffer = await audioContext.decodeAudioData(bytes.slice(0));
  state.channels = Array.from({length: state.buffer.numberOfChannels}, (_, i) => state.buffer.getChannelData(i).slice());
  state.fileName = file.name.replace(/\.[^.]+$/, '') || 'recording';
  $('file-name').textContent = `${file.name} · ${state.buffer.numberOfChannels}ch · ${state.buffer.sampleRate.toLocaleString()}Hz`;
  analyze();
}

function makeDemoBuffer() {
  const sampleRate = 24000, duration = 9.5, length = Math.floor(sampleRate * duration);
  const channel = new Float32Array(length);
  const speech = [[0.2,1.65],[2.55,4.05],[5.65,6.85],[7.95,9.25]];
  for (const [start,end] of speech) {
    for (let i=Math.floor(start*sampleRate); i<Math.floor(end*sampleRate); i++) {
      const t=i/sampleRate; const env=Math.min(1,(t-start)*10,(end-t)*10);
      channel[i]=(Math.sin(2*Math.PI*180*t)*.23+Math.sin(2*Math.PI*310*t)*.11)*Math.max(0,env);
    }
  }
  return { sampleRate, duration, length, numberOfChannels:1, getChannelData:()=>channel };
}

function loadDemo() {
  state.buffer = makeDemoBuffer();
  state.channels = [state.buffer.getChannelData(0).slice()];
  state.fileName = 'silencesketch-demo';
  $('file-name').textContent = '가상 음성 데모 · 1ch · 24,000Hz';
  analyze();
}

function downloadResult() {
  if (!state.buffer) return;
  const channels = core.cutChannels(state.channels, state.buffer.sampleRate, activeCuts());
  const wav = core.encodeWav(channels, state.buffer.sampleRate);
  const blob = new Blob([wav], {type:'audio/wav'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${state.fileName}.silencesketch.wav`; link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

fileInput.addEventListener('change', () => fileInput.files[0] && loadFile(fileInput.files[0]).catch(err => alert(`오디오를 열지 못했어: ${err.message}`)));
['dragenter','dragover'].forEach(type => $('dropzone').addEventListener(type, e => { e.preventDefault(); $('dropzone').classList.add('drag'); }));
['dragleave','drop'].forEach(type => $('dropzone').addEventListener(type, e => { e.preventDefault(); $('dropzone').classList.remove('drag'); }));
$('dropzone').addEventListener('drop', e => e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]).catch(err => alert(`오디오를 열지 못했어: ${err.message}`)));
$('demo-button').addEventListener('click', loadDemo);
$('download-button').addEventListener('click', downloadResult);
[threshold,minSilence,padding].forEach(el => el.addEventListener('input', analyze));
window.addEventListener('resize', () => state.buffer && render());

const params = new URLSearchParams(location.search);
if (params.get('demo') === '1') {
  loadDemo();
  const frame = Number(params.get('frame') || 1);
  if (frame >= 2) { threshold.value = '-36'; minSilence.value = '.45'; analyze(); }
  if (frame >= 3 && state.enabled.length > 1) { state.enabled[1] = false; render(); }
}
