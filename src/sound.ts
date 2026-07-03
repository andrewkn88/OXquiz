type SoundType = "join" | "question" | "correct" | "wrong" | "answer" | "finish" | "reset" | "click";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function tone(frequency: number, duration: number, delay = 0, volume = 0.08) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = "sine";

  const start = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playSound(type: SoundType) {
  try {
    if (type === "join") {
      tone(523, 0.12);
      tone(659, 0.12, 0.12);
      return;
    }
    if (type === "question") {
      tone(440, 0.12);
      tone(660, 0.12, 0.13);
      return;
    }
    if (type === "correct") {
      tone(523, 0.1);
      tone(784, 0.16, 0.11);
      tone(1046, 0.18, 0.25);
      return;
    }
    if (type === "wrong") {
      tone(220, 0.18);
      tone(165, 0.22, 0.18);
      return;
    }
    if (type === "answer") {
      tone(700, 0.12);
      tone(500, 0.12, 0.13);
      return;
    }
    if (type === "finish") {
      tone(523, 0.12);
      tone(659, 0.12, 0.13);
      tone(784, 0.12, 0.26);
      tone(1046, 0.25, 0.39);
      return;
    }
    if (type === "reset") {
      tone(300, 0.12);
      return;
    }
    tone(500, 0.06);
  } catch (error) {
    console.warn("Sound play failed:", error);
  }
}
