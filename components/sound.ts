let audio: AudioContext | null = null;

function context(): AudioContext | null {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

/** Call from a click so browsers allow sound later. */
export function primeCelebrationSound() {
  context();
}

export function playCelebrationSound() {
  const ctx = context();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1318.5];
  const start = ctx.currentTime + 0.02;
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index % 2 === 0 ? "triangle" : "sine";
    osc.frequency.value = freq;
    const at = start + index * 0.1;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.09, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.36);
    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + 0.4);
  });
}
