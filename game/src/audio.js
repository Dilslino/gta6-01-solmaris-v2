// Solmaris — all sound is synthesized live with WebAudio. No audio files,
// no network. A tiny engine hum, a two-tone siren, gunshots, punches,
// pickups and a mission jingle, all from oscillators and filtered noise.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  let musicTimer = null, musicStep = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator(); sirenLfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
    } catch { ctx = null; }
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = ctx.createGain(); g.gain.value = vol || 0.4;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  // A lazy, sunny bassline that loops quietly under play.
  const BASS = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = setInterval(() => {
      const n = BASS[musicStep % BASS.length]; musicStep++;
      if (n) blip(n, 0.5, 'triangle', 0.10);
      if (musicStep % 16 === 14) blip(660, 0.12, 'sine', 0.05);
      if (musicStep % 16 === 15) blip(880, 0.18, 'sine', 0.05);
    }, 300);
  }
  return {
    ensure, startMusic,
    engine(speed01, on) {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    shot() { noise(0.14, 0.5, 2600); blip(180, 0.1, 'square', 0.2, 60); },
    punch() { noise(0.08, 0.3, 700); },
    pickup() { blip(740, 0.09, 'sine', 0.22); setTimeout(() => blip(1108, 0.14, 'sine', 0.22), 70); },
    cash() { blip(988, 0.1, 'sine', 0.22); setTimeout(() => blip(1319, 0.18, 'sine', 0.22), 90); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
    denied() { blip(160, 0.18, 'square', 0.18, 110); },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.25), i * 160)); },
    wasted() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => blip(f, 0.35, 'sawtooth', 0.18), i * 180)); },
    crash() { noise(0.25, 0.5, 900); },
  };
}
