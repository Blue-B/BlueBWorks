const assert = require('assert');
const core = require('./audio-core.js');

function signal(sampleRate, parts) {
  const duration = parts[parts.length - 1][1];
  const out = new Float32Array(Math.round(duration * sampleRate));
  for (const [start, end, amp] of parts) for (let i=Math.round(start*sampleRate); i<Math.round(end*sampleRate); i++) out[i]=amp*Math.sin(i*.13);
  return out;
}

(function testDetectsLongSilenceButNotShortPause(){
  const sr=1000;
  const s=signal(sr,[[0,1,.5],[1,1.2,0],[1.2,2,.5],[2,3,0],[3,4,.5]]);
  const cuts=core.detectSilences(s,sr,{thresholdDb:-35,minSilenceSec:.5,paddingSec:.1});
  assert.strictEqual(cuts.length,1);
  assert(Math.abs(cuts[0].start-2.1)<.05);
  assert(Math.abs(cuts[0].end-2.9)<.05);
})();

(function testCutChannelsKeepsAudioAroundCut(){
  const sr=10; const ch=Float32Array.from({length:100},(_,i)=>i/100);
  const [out]=core.cutChannels([ch],sr,[{start:2,end:5}]);
  assert.strictEqual(out.length,70);
  assert.strictEqual(out[19],ch[19]);
  assert(Math.abs(out[20]-ch[50])<1e-6);
})();

(function testInvertCutsHandlesEdges(){
  assert.deepStrictEqual(core.invertCuts(10,[{start:0,end:2},{start:8,end:10}]),[{start:2,end:8}]);
})();

(function testWavHeaderAndStereoLength(){
  const left=new Float32Array(100), right=new Float32Array(100);
  const wav=core.encodeWav([left,right],8000);
  assert.strictEqual(Buffer.from(wav.slice(0,4)).toString(),'RIFF');
  assert.strictEqual(Buffer.from(wav.slice(8,12)).toString(),'WAVE');
  assert.strictEqual(wav.length,44+100*2*2);
})();

(function testSummary(){
  const s=core.summarize(10,[{start:1,end:2.5},{start:5,end:6}]);
  assert.strictEqual(s.count,2); assert(Math.abs(s.removed-2.5)<1e-9); assert(Math.abs(s.result-7.5)<1e-9);
})();

console.log('SilenceSketch core tests: 5 passed');
