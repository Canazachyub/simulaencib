/**
 * Música y efectos del banqueo, 100 % sintetizados con Web Audio (sin archivos ni samples).
 *
 * Música: 118 BPM con swing leve, progresión vi–IV–I–V (Am–F–C–G, 2 compases por acorde,
 * loop de 8 compases) y un gancho melódico de 2 compases. Por fases, con crossfade de stems:
 *  - 'pregunta'   → tensión: ostinato de marimba "tic-tac", bajo suave, hats ligeros, pad bajo.
 *                   `tension(x)` abre el filtro del pad, añade semicorcheas y un riser al final.
 *  - 'intermedio' → groove: bombo a negras, clap en 2 y 4, bajo en octavas, stabs, lead + sidechain.
 *  - final        → `fanfarria(bueno)`: jingle de victoria o "buen intento" y outro del pad.
 * Cadena: stems → (sidechain) → bus de música → compresor master; envíos a reverb (convolución
 * con impulso generado) y a un delay ping-pong.
 * El AudioContext se crea en el primer gesto del usuario (requisito de los navegadores).
 */

type Mood = 'pregunta' | 'intermedio' | 'lectura';
type StemName = 'kick' | 'clap' | 'hats' | 'shaker' | 'bass' | 'groove' | 'marimba' | 'pad' | 'stabs' | 'lead';

// ---------- Estado ----------
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let duckNode: GainNode | null = null; // baja la música mientras suenan acierto/error
let sfxBus: GainNode | null = null;
let duck: GainNode | null = null; // sidechain (pads + bajo)
let reverbSend: GainNode | null = null;
let delaySend: GainNode | null = null;
let padFilter: BiquadFilterNode | null = null;
const stems: Partial<Record<StemName, GainNode>> = {};
const stemTarget: Partial<Record<StemName, number>> = {};
let lastMoodChange = 0;

let musicOn = false;
let sfxOn = true;
let mood: Mood = 'pregunta';
let tensionX = 0;
let timer: number | null = null;
let nextTime = 0;
let step = 0;
let running = false;

// Lead persistente (vibrato + portamento)
let leadOsc: OscillatorNode | null = null;
let leadEnv: GainNode | null = null;
let leadLfo: OscillatorNode | null = null;

// Riser de tensión
let riser: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let lastBlip = 0;
let noiseBuf: AudioBuffer | null = null;

const BPM = 118;
const S16 = 60 / BPM / 4; // semicorchea
const SWING = 0.16; // ~8 % de swing en las semicorcheas impares
const LOOP = 128; // 8 compases × 16

const MUSIC_LEVEL = 0.34;
const SFX_LEVEL = 0.62;

const MIX: Record<Mood, Record<StemName, number>> = {
  pregunta: { kick: 0, clap: 0, hats: 0.45, shaker: 0, bass: 0.6, groove: 0, marimba: 0.9, pad: 0.38, stabs: 0, lead: 0 },
  // lectura (justificación): fondo muy suave, sin percusión ni melodía, para no distraer al leer
  lectura: { kick: 0, clap: 0, hats: 0, shaker: 0, bass: 0.25, groove: 0, marimba: 0.22, pad: 0.42, stabs: 0, lead: 0 },
  intermedio: { kick: 1, clap: 0.85, hats: 0.8, shaker: 0.6, bass: 0, groove: 0.9, marimba: 0.25, pad: 0.55, stabs: 0.75, lead: 0.8 },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// ---------- Armonía y gancho ----------
// Am – F – C – G (voicings cercanos para el pad) y raíces del bajo
const CHORDS = [
  { pad: [57, 60, 64], root: 45 }, // Am
  { pad: [57, 60, 65], root: 41 }, // F
  { pad: [55, 60, 64], root: 48 }, // C
  { pad: [55, 59, 62], root: 43 }, // G
];

type Note = [number, number, number]; // [semicorchea, midi, duración en semicorcheas]
const CALL: Note[] = [[0, 76, 2], [3, 79, 1], [4, 81, 3], [8, 79, 2], [10, 76, 2], [12, 74, 3]];
const RESP_A: Note[] = [[16, 72, 2], [19, 74, 1], [20, 76, 2], [22, 72, 2], [24, 69, 6]];
const RESP_B: Note[] = [[16, 72, 2], [19, 74, 1], [20, 76, 2], [22, 79, 2], [24, 76, 6]];
const RESP_C: Note[] = [[16, 74, 2], [19, 71, 1], [20, 74, 2], [22, 79, 2], [24, 74, 4], [29, 71, 2]];
const HOOK: Note[][] = [
  [...CALL, ...RESP_A],
  [...CALL, ...RESP_A.map(([s, n, d]) => [s, s === 24 ? 72 : n, d] as Note)],
  [...CALL.map(([s, n, d]) => [s, n + (s === 4 ? 3 : 0), d] as Note), ...RESP_B],
  [...CALL, ...RESP_C],
];

// ---------- Infraestructura ----------
function makeImpulse(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const c = new AC();
    ctx = c;

    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    master = c.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(c.destination);

    duckNode = c.createGain(); duckNode.gain.value = 1; duckNode.connect(master);
    musicBus = c.createGain(); musicBus.gain.value = 0; musicBus.connect(duckNode);
    sfxBus = c.createGain(); sfxBus.gain.value = SFX_LEVEL; sfxBus.connect(master);

    // Reverb
    const conv = c.createConvolver(); conv.buffer = makeImpulse(c, 1.8);
    const revOut = c.createGain(); revOut.gain.value = 0.22;
    reverbSend = c.createGain(); reverbSend.gain.value = 1;
    reverbSend.connect(conv); conv.connect(revOut); revOut.connect(master);

    // Delay ping-pong (corchea con puntillo)
    const dt = S16 * 3;
    const dl = c.createDelay(1); dl.delayTime.value = dt;
    const dr = c.createDelay(1); dr.delayTime.value = dt;
    const fb = c.createGain(); fb.gain.value = 0.3;
    const pl = c.createStereoPanner(); pl.pan.value = -0.7;
    const pr = c.createStereoPanner(); pr.pan.value = 0.7;
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3500;
    const dOut = c.createGain(); dOut.gain.value = 0.35;
    delaySend = c.createGain(); delaySend.gain.value = 1;
    delaySend.connect(tone); tone.connect(dl);
    dl.connect(pl); dl.connect(dr); dr.connect(pr); dr.connect(fb); fb.connect(dl);
    pl.connect(dOut); pr.connect(dOut); dOut.connect(master);

    // Sidechain para pad y bajos
    duck = c.createGain(); duck.gain.value = 1; duck.connect(musicBus);

    padFilter = c.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 900; padFilter.Q.value = 0.6;

    const names: StemName[] = ['kick', 'clap', 'hats', 'shaker', 'bass', 'groove', 'marimba', 'pad', 'stabs', 'lead'];
    names.forEach(n => {
      const g = c.createGain(); g.gain.value = 0;
      stems[n] = g;
      stemTarget[n] = 0;
      if (n === 'pad') { padFilter!.connect(g); g.connect(duck!); }
      else if (n === 'bass' || n === 'groove') g.connect(duck!);
      else g.connect(musicBus!);
      if (n === 'pad' || n === 'marimba' || n === 'stabs' || n === 'lead') g.connect(reverbSend!);
      if (n === 'marimba' || n === 'stabs' || n === 'lead') {
        const s = c.createGain(); s.gain.value = n === 'marimba' ? 0.25 : 0.4; g.connect(s); s.connect(delaySend!);
      }
    });

    // Ruido blanco reutilizable
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // Pausar al ocultar la pestaña
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) void ctx.suspend();
      else if (running || sfxOn) void ctx.resume();
    });
  }
  if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
  return ctx;
}

interface ToneOpts {
  type?: OscillatorType; vol?: number; attack?: number; release?: number; slideTo?: number; detune?: number; pan?: number;
}

function tone(dest: AudioNode, freq: number, start: number, dur: number, o: ToneOpts = {}) {
  if (!ctx) return;
  const { type = 'triangle', vol = 0.2, attack = 0.005, release = 0.08, slideTo = 0, detune = 0, pan = 0 } = o;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.01, dur) + release);
  osc.connect(g);
  if (pan) {
    const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(dest);
  } else g.connect(dest);
  osc.start(start);
  osc.stop(start + dur + release + 0.05);
}

function noise(dest: AudioNode, start: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 0.8) {
  if (!ctx || !noiseBuf) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.02);
}

// ---------- Instrumentos ----------
function kick(t: number) {
  const d = stems.kick!;
  if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.35);
  // sidechain "pumping"
  if (duck && (stemTarget.kick ?? 0) > 0) {
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(1, t);
    duck.gain.linearRampToValueAtTime(0.4, t + 0.012);
    duck.gain.setTargetAtTime(1, t + 0.03, 0.05);
  }
}

function clap(t: number) {
  const d = stems.clap!;
  noise(d, t, 0.03, 0.5, 'bandpass', 1500, 1.2);
  noise(d, t + 0.012, 0.16, 0.45, 'bandpass', 1500, 1.2);
}

function hat(t: number, open = false, vol = 0.18) {
  noise(stems.hats!, t, open ? 0.18 : 0.035, vol, 'highpass', open ? 7000 : 8500);
}

function shaker(t: number, vol: number) {
  noise(stems.shaker!, t, 0.05, vol, 'bandpass', 6000, 1.5);
}

function bassNote(dest: GainNode, note: number, t: number, dur: number, vol: number) {
  if (!ctx) return;
  // seno sub
  tone(dest, midi(note - 12), t, dur, { type: 'sine', vol, attack: 0.008, release: 0.06 });
  // cuadrada filtrada con envolvente de filtro
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = midi(note);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.1);
}

function marimba(dest: GainNode, note: number, t: number, vol: number, pan = 0) {
  const f = midi(note);
  tone(dest, f, t, 0.02, { type: 'sine', vol, attack: 0.002, release: 0.32, pan });
  tone(dest, f * 4, t, 0.01, { type: 'triangle', vol: vol * 0.18, attack: 0.001, release: 0.06, pan });
}

function padChord(notes: number[], t: number, dur: number) {
  if (!ctx || !padFilter) return;
  notes.forEach(n => {
    [-7, 0, 7].forEach(cents => {
      const o = ctx!.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = cents;
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.8);
      g.gain.setValueAtTime(0.035, t + dur - 0.2);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.8);
      o.connect(g); g.connect(padFilter!); o.start(t); o.stop(t + dur + 0.9);
    });
  });
}

function stab(notes: number[], t: number) {
  notes.forEach((n, i) => tone(stems.stabs!, midi(n + 12), t, 0.06, { type: 'square', vol: 0.05, release: 0.12, pan: i === 0 ? -0.3 : i === 2 ? 0.3 : 0 }));
}

function ensureLead() {
  if (!ctx || leadOsc) return;
  leadOsc = ctx.createOscillator(); leadOsc.type = 'square';
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
  leadEnv = ctx.createGain(); leadEnv.gain.value = 0;
  leadLfo = ctx.createOscillator(); leadLfo.frequency.value = 5.5;
  const depth = ctx.createGain(); depth.gain.value = 6; // cents
  leadLfo.connect(depth); depth.connect(leadOsc.detune);
  leadOsc.connect(f); f.connect(leadEnv); leadEnv.connect(stems.lead!);
  leadOsc.frequency.value = midi(76);
  leadOsc.start(); leadLfo.start();
}

function leadNote(note: number, t: number, dur: number) {
  if (!leadOsc || !leadEnv) return;
  leadOsc.frequency.setTargetAtTime(midi(note), t, 0.018); // portamento
  leadEnv.gain.setTargetAtTime(0.09, t, 0.008);
  leadEnv.gain.setTargetAtTime(0, t + Math.max(0.05, dur - 0.03), 0.03);
}

function killLead(at: number) {
  if (leadOsc) { try { leadOsc.stop(at); leadLfo?.stop(at); } catch { /* ya detenido */ } }
  leadOsc = null; leadEnv = null; leadLfo = null;
}

// ---------- Secuenciador ----------
function active(n: StemName): boolean {
  if (!ctx) return false;
  return (stemTarget[n] ?? 0) > 0 || ctx.currentTime - lastMoodChange < 0.8;
}

function scheduleStep(i: number, t: number) {
  const bar = Math.floor(i / 16);
  const s = i % 16;
  const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
  const q = mood === 'pregunta';

  // Pad: al cambiar de acorde (cada 2 compases)
  if (i % 32 === 0 && active('pad')) padChord(chord.pad, t, S16 * 32);

  // Marimba "tic-tac" en corcheas (2 notas del acorde)
  if ((mood === 'lectura' ? s % 8 === 0 : s % 2 === 0) && active('marimba')) {
    const n = (s / 2) % 2 === 0 ? chord.pad[0] + 12 : chord.pad[2] + 12;
    marimba(stems.marimba!, n, t, (s % 4 === 0 ? 0.16 : 0.11) * (q ? 1 : 0.7), (s / 2) % 2 === 0 ? -0.25 : 0.25);
  }

  // Bajo suave en negras
  if (s % 4 === 0 && active('bass')) bassNote(stems.bass!, chord.root, t, S16 * 3, 0.16);

  // Groove: bajo en octavas
  if (s % 2 === 0 && active('groove')) {
    const up = (s / 2) % 2 === 1;
    bassNote(stems.groove!, chord.root + (up ? 12 : 0), t, S16 * 1.6, up ? 0.12 : 0.18);
  }

  // Batería
  if (s % 4 === 0 && active('kick')) kick(t);
  if ((s === 4 || s === 12) && active('clap')) clap(t);
  if (active('hats')) {
    if (q) {
      const dense = tensionX >= 0.6;
      if (s % 4 === 2) hat(t, false, 0.12);
      else if (dense && s % 2 === 1) hat(t, false, 0.05 + 0.05 * tensionX);
    } else {
      if (s % 4 === 2) hat(t, s === 14, 0.16);
      else if (s % 2 === 1) hat(t, false, 0.06);
    }
  }
  if (active('shaker')) shaker(t, s % 2 === 0 ? 0.05 : 0.08);

  // Stabs a contratiempo
  if ((s === 2 || s === 10) && active('stabs')) stab(chord.pad, t);

  // Gancho (2 compases por frase)
  if (active('lead')) {
    const phrase = HOOK[Math.floor(bar / 2) % HOOK.length];
    const pos = i % 32;
    phrase.forEach(([st, n, d]) => { if (st === pos) leadNote(n, t, d * S16); });
  }
}

function tick() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.12) {
    const swing = step % 2 === 1 ? SWING * S16 : 0;
    scheduleStep(step, nextTime + swing);
    nextTime += S16;
    step = (step + 1) % LOOP;
  }
}

function applyMix(fade = 0.15) {
  if (!ctx) return;
  const now = ctx.currentTime;
  (Object.keys(MIX[mood]) as StemName[]).forEach(n => {
    const v = MIX[mood][n];
    stemTarget[n] = v;
    stems[n]?.gain.setTargetAtTime(v, now, fade);
  });
  lastMoodChange = now;
}

function applyTension() {
  if (!ctx || !padFilter) return;
  padFilter.frequency.setTargetAtTime(mood === 'pregunta' ? 700 + tensionX * 2400 : 1200, ctx.currentTime, 0.3);
  if (mood === 'pregunta' && running && tensionX >= 0.85 && !riser) startRiser(Math.max(2, (1 - tensionX) * 90 + 1));
  if ((mood !== 'pregunta' || tensionX < 0.85) && riser) stopRiser();
}

function startRiser(seconds: number) {
  if (!ctx || !noiseBuf || !musicBus) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + seconds);
  src.connect(f); f.connect(g); g.connect(musicBus); g.connect(reverbSend!);
  src.start(t);
  riser = { src, gain: g };
}

function stopRiser() {
  if (!ctx || !riser) return;
  const t = ctx.currentTime;
  riser.gain.gain.cancelScheduledValues(t);
  riser.gain.gain.setTargetAtTime(0.0001, t, 0.08);
  try { riser.src.stop(t + 0.5); } catch { /* ya detenido */ }
  riser = null;
}

function startLoop() {
  const c = ensure();
  if (!c || !musicBus || timer !== null) return;
  running = true;
  ensureLead();
  nextTime = c.currentTime + 0.08;
  step = 0;
  applyMix(0.05);
  applyTension();
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(musicBus.gain.value, c.currentTime);
  musicBus.gain.setTargetAtTime(MUSIC_LEVEL, c.currentTime, 0.12); // fade in ~400 ms
  timer = window.setInterval(tick, 25);
}

function stopLoop(fade = 0.12) {
  running = false;
  if (timer !== null) { window.clearInterval(timer); timer = null; }
  stopRiser();
  if (ctx && musicBus) {
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, fade); // fade out ~400 ms
    killLead(ctx.currentTime + fade * 5);
  }
}

function sfx(): { c: AudioContext; bus: GainNode } | null {
  const c = ensure();
  if (!c || !sfxOn || !sfxBus) return null;
  return { c, bus: sfxBus };
}

function sparkle(bus: GainNode, note: number, t: number, vol = 0.08) {
  tone(bus, midi(note), t, 0.05, { type: 'sine', vol, release: 0.25 });
  if (delaySend) tone(delaySend, midi(note), t, 0.05, { type: 'sine', vol: vol * 0.6, release: 0.2 });
}

/** Baja la música ~85 % durante `sec` segundos para que el efecto se escuche claro. */
function bajarMusica(sec: number) {
  if (!ctx || !duckNode) return;
  const t = ctx.currentTime;
  duckNode.gain.cancelScheduledValues(t);
  duckNode.gain.setValueAtTime(duckNode.gain.value, t);
  duckNode.gain.linearRampToValueAtTime(0.15, t + 0.03);
  duckNode.gain.setValueAtTime(0.15, t + sec);
  duckNode.gain.linearRampToValueAtTime(1, t + sec + 0.4);
}

/** Campana FM (portadora seno + moduladora inarmónica) = timbre de "clin" de concurso. */
function bell(dest: AudioNode, freq: number, t: number, dur: number, vol: number) {
  if (!ctx) return;
  const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
  const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * 3.5;
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(freq * 2.2, t);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur * 0.5);
  mod.connect(modGain); modGain.connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  car.connect(g); g.connect(dest);
  // brillo del golpe (overtone corto)
  tone(dest, freq * 2, t, 0.03, { type: 'sine', vol: vol * 0.25, release: 0.12 });
  car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
}

/** Zumbador "ennn": dos ondas cuadradas graves desafinadas, filtradas para que no chille. */
function buzz(dest: AudioNode, t: number, dur: number) {
  if (!ctx) return;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.008);
  g.gain.setValueAtTime(0.22, t + dur - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  [110, 116.5].forEach(fr => {
    const o = ctx!.createOscillator(); o.type = 'square'; o.frequency.value = fr;
    o.connect(f); o.start(t); o.stop(t + dur + 0.02);
  });
  f.connect(g); g.connect(dest);
}

// ---------- API pública ----------
export const sonido = {
  configurar(opts: { musica: boolean; efectos: boolean }) {
    musicOn = opts.musica;
    sfxOn = opts.efectos;
    if (!musicOn) stopLoop();
  },
  /** Llamar tras un clic del usuario (p. ej. "Empezar"). */
  iniciar() {
    ensure();
    if (musicOn) startLoop();
  },
  ambiente(m: Mood) {
    if (m === mood && running) return;
    mood = m;
    if (m === 'pregunta') tensionX = 0;
    if (running) { applyMix(0.15); applyTension(); }
  },
  /** Fracción de tiempo transcurrido de la pregunta (0 → 1). */
  tension(x: number) {
    tensionX = Math.max(0, Math.min(1, x));
    if (running) applyTension();
  },
  pausar() { stopLoop(); },
  reanudar() { if (musicOn) startLoop(); },
  detener() { stopLoop(); },

  /**
   * ACIERTO = "clin-clin" clásico de concurso: dos campanadas FM brillantes que suben (Mi6 → La6).
   * Siempre idéntico (refuerzo consistente = mejor asociación en memoria).
   * La racha solo añade un brillo aparte, sin cambiar el sonido base.
   */
  correcto(racha = 1) {
    const s = sfx(); if (!s) return;
    const t = s.c.currentTime + 0.01;
    bajarMusica(1.1);
    bell(s.bus, 1318.5, t, 1.0, 0.55);          // Mi6  "clin"
    bell(s.bus, 1760, t + 0.12, 1.3, 0.6);      // La6  "clin"
    // cuerpo: senos puros que sostienen la campana (se oye aun con parlantes pequeños)
    tone(s.bus, 1318.5, t, 0.25, { type: 'sine', vol: 0.18, release: 0.4 });
    tone(s.bus, 1760, t + 0.12, 0.35, { type: 'sine', vol: 0.2, release: 0.6 });
    if (reverbSend) bell(reverbSend, 1760, t + 0.12, 1.3, 0.15);
    if (racha >= 2) sparkle(s.bus, 100 + Math.min(racha, 6), t + 0.3, 0.05);
  },
  /**
   * ERROR = "ennn" clásico: zumbador grave, seco y corto (doble pulso).
   * Siempre idéntico; claramente distinto del acierto para que el cerebro lo marque como error.
   */
  incorrecto() {
    const s = sfx(); if (!s) return;
    const t = s.c.currentTime + 0.01;
    bajarMusica(1.0);
    buzz(s.bus, t, 0.17);
    buzz(s.bus, t + 0.22, 0.32);
  },
  /** Hitos de racha (3, 5, 10). Sin argumento: pequeño adorno genérico. */
  racha(n?: number) {
    const s = sfx(); if (!s) return;
    const t = s.c.currentTime + 0.34;
    if (n === undefined) {
      [79, 83, 86, 91].forEach((x, i) => tone(s.bus, midi(x), t + i * 0.05, 0.06, { type: 'square', vol: 0.04 }));
      return;
    }
    const seq: Record<number, number[]> = {
      3: [79, 84, 88],
      5: [76, 79, 84, 88, 91],
      10: [72, 76, 79, 84, 88, 91, 96],
    };
    const notes = seq[n];
    if (!notes) return;
    notes.forEach((x, i) => {
      tone(s.bus, midi(x), t + i * 0.07, 0.08, { type: 'square', vol: 0.045, release: 0.08 });
      tone(s.bus, midi(x), t + i * 0.07, 0.08, { type: 'sine', vol: 0.09, release: 0.12 });
    });
    const end = t + notes.length * 0.07;
    // acorde final con brillo
    [0, 4, 7].forEach(iv => tone(s.bus, midi(notes[notes.length - 1] - 12 + iv), end, 0.3, { type: 'triangle', vol: 0.06, release: 0.5 }));
    if (n >= 5) noise(s.bus, end, 0.5, 0.05, 'highpass', 6000);
    if (n >= 10) sparkle(s.bus, 103, end + 0.1, 0.07);
  },
  potenciador() {
    const s = sfx(); if (!s) return;
    const t = s.c.currentTime;
    tone(s.bus, 300, t, 0.25, { type: 'sine', vol: 0.16, slideTo: 1200 });
    noise(s.bus, t, 0.25, 0.05, 'bandpass', 3000, 1);
    sparkle(s.bus, 96, t + 0.22, 0.06);
  },
  /** Tic del reloj (más fuerte en los últimos segundos). */
  tic(fuerza = 1) {
    const s = sfx(); if (!s) return;
    const t = s.c.currentTime;
    tone(s.bus, 1250, t, 0.02, { type: 'sine', vol: 0.14 * fuerza, release: 0.04 });
    tone(s.bus, 2500, t, 0.008, { type: 'square', vol: 0.03 * fuerza, release: 0.01 });
  },
  /** Gong suave al llegar el tiempo a cero. */
  tiempoAgotado() {
    stopRiser();
    const s = sfx(); if (!s) return;
    const t = s.c.currentTime + 0.01;
    [[1, 0.2], [2.76, 0.08], [5.4, 0.04], [8.93, 0.02]].forEach(([r, v]) =>
      tone(s.bus, 98 * r, t, 0.05, { type: 'sine', vol: v, attack: 0.004, release: 2.4 })
    );
    if (reverbSend) tone(reverbSend, 98, t, 0.05, { type: 'sine', vol: 0.1, release: 2 });
  },
  /** Blip muy corto para contadores (limitado a ~15 por segundo). */
  blip() {
    const s = sfx(); if (!s) return;
    const now = performance.now();
    if (now - lastBlip < 66) return;
    lastBlip = now;
    tone(s.bus, 1700 + Math.random() * 300, s.c.currentTime, 0.015, { type: 'sine', vol: 0.05, release: 0.02 });
  },
  /** Pantalla final: jingle de victoria o "buen intento", luego un outro tranquilo del pad. */
  fanfarria(bueno: boolean) {
    stopLoop(0.1);
    const c = ensure(); if (!c) return;
    const t = c.currentTime + 0.25;
    const bus = sfxOn ? sfxBus : null;
    if (bus) {
      if (bueno) {
        const run = [60, 64, 67, 72, 76, 79];
        run.forEach((n, i) => {
          tone(bus, midi(n + 12), t + i * 0.08, 0.07, { type: 'square', vol: 0.05, release: 0.06 });
          marimba(bus as GainNode, n + 12, t + i * 0.08, 0.14);
        });
        const hit = t + run.length * 0.08 + 0.05;
        [60, 64, 67, 72].forEach(n => tone(bus, midi(n), hit, 0.5, { type: 'triangle', vol: 0.09, release: 0.9 }));
        [84, 88, 91].forEach((n, i) => sparkle(bus, n, hit + 0.1 + i * 0.09, 0.06));
        noise(bus, hit, 0.9, 0.05, 'highpass', 5000);
      } else {
        // "buen intento": cadencia amable F → C
        [[65, 69, 72], [64, 67, 72]].forEach((ch, k) =>
          ch.forEach((n, i) => marimba(bus as GainNode, n, t + k * 0.42 + i * 0.05, 0.13))
        );
        tone(bus, midi(72), t + 0.9, 0.4, { type: 'sine', vol: 0.08, release: 0.8 });
      }
    }
    // Outro del pad (solo si la música está activa)
    if (musicOn && padFilter && stems.pad && musicBus) {
      const start = t + (bueno ? 1.1 : 1.0);
      padFilter.frequency.setTargetAtTime(1100, c.currentTime, 0.2);
      stems.pad.gain.cancelScheduledValues(c.currentTime);
      stems.pad.gain.setTargetAtTime(0.5, c.currentTime, 0.1);
      musicBus.gain.cancelScheduledValues(start - 0.1);
      musicBus.gain.setTargetAtTime(MUSIC_LEVEL * 0.8, start - 0.1, 0.2);
      padChord(bueno ? [60, 64, 67] : [57, 60, 64], start, 3);
      musicBus.gain.setTargetAtTime(0, start + 3, 0.6);
    }
  },
};
