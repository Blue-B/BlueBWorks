function detectSilences(samples, sampleRate, options = {}) {
  const thresholdDb = options.thresholdDb ?? -42;
  const minSilenceSec = options.minSilenceSec ?? 0.55;
  const paddingSec = options.paddingSec ?? 0.12;
  const size = Math.max(1, Math.round(sampleRate * 0.02));
  const quiet = [];
  for (let start = 0; start < samples.length; start += size) {
    const end = Math.min(samples.length, start + size);
    let power = 0;
    for (let i = start; i < end; i++) power += samples[i] * samples[i];
    const rms = Math.sqrt(power / Math.max(1, end - start));
    const db = rms > 1e-8 ? 20 * Math.log10(rms) : -120;
    quiet.push({ start: start / sampleRate, end: end / sampleRate, quiet: db <= thresholdDb });
  }
  const cuts = [];
  let begin = null;
  for (let i = 0; i < quiet.length; i++) {
    if (quiet[i].quiet && begin === null) begin = i;
    if ((!quiet[i].quiet || i === quiet.length - 1) && begin !== null) {
      const last = quiet[i].quiet && i === quiet.length - 1 ? i : i - 1;
      const rawStart = quiet[begin].start;
      const rawEnd = quiet[last].end;
      if (rawEnd - rawStart >= minSilenceSec) {
        const start = Math.max(0, rawStart + paddingSec);
        const end = Math.min(samples.length / sampleRate, rawEnd - paddingSec);
        if (end > start) cuts.push({ start, end });
      }
      begin = null;
    }
  }
  return cuts;
}

function keptRanges(duration, cuts) {
  const sorted = [...cuts].sort((a,b) => a.start - b.start);
  const keep = [];
  let cursor = 0;
  for (const cut of sorted) {
    const start = Math.max(0, Math.min(duration, cut.start));
    const end = Math.max(start, Math.min(duration, cut.end));
    if (start > cursor) keep.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < duration) keep.push({ start: cursor, end: duration });
  return keep;
}

function cutChannels(channels, sampleRate, cuts) {
  if (!channels.length) throw new Error('channels required');
  const length = channels[0].length;
  if (!channels.every(c => c.length === length)) throw new Error('channel length mismatch');
  const keep = keptRanges(length / sampleRate, cuts);
  const total = keep.reduce((n, p) => n + Math.round((p.end - p.start) * sampleRate), 0);
  return channels.map(channel => {
    const out = new Float32Array(total);
    let cursor = 0;
    for (const part of keep) {
      const a = Math.round(part.start * sampleRate);
      const b = Math.round(part.end * sampleRate);
      const slice = channel.subarray(a, b);
      out.set(slice, cursor);
      cursor += slice.length;
    }
    return out;
  });
}

function encodeWav(channels, sampleRate) {
  const frames = channels[0].length;
  const count = channels.length;
  const view = new DataView(new ArrayBuffer(44 + frames * count * 2));
  const ascii = (at, text) => { for (let i=0;i<text.length;i++) view.setUint8(at+i,text.charCodeAt(i)); };
  ascii(0,'RIFF'); view.setUint32(4,36+frames*count*2,true); ascii(8,'WAVE'); ascii(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,count,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*count*2,true);
  view.setUint16(32,count*2,true); view.setUint16(34,16,true); ascii(36,'data');
  view.setUint32(40,frames*count*2,true);
  let offset=44;
  for(let i=0;i<frames;i++) for(let c=0;c<count;c++) {
    const s=Math.max(-1,Math.min(1,channels[c][i]));
    view.setInt16(offset,s<0?s*32768:s*32767,true); offset+=2;
  }
  return new Uint8Array(view.buffer);
}

function summarize(duration, cuts) {
  const removed = cuts.reduce((n,c)=>n+Math.max(0,c.end-c.start),0);
  return { duration, removed, result: Math.max(0,duration-removed), count: cuts.length };
}

const api={detectSilences,keptRanges,cutChannels,encodeWav,summarize};
if(typeof module!=='undefined') module.exports=api;
if(typeof window!=='undefined') window.SilenceSketchCore=api;
