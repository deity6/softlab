import { SFX, REVERB_EFFECTS, UNLOCK_EVENTS, STORAGE_KEYS } from './constants.js';

/**
 * 原 `class eA` —— WebAudio 实时合成音效，不使用任何音频文件。
 * 噪声源 + 卷积混响 + 振荡器包络，全部按原参数还原。
 */
export class Sfx {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.reverbInput = null;
    this.unlockAttached = false;
    this.muted = readMuted();
    this.unlock = () => this.ensureContext();
    this.attachUnlockListeners();
  }

  isMuted() {
    return this.muted;
  }

  setMuted(value) {
    this.muted = value;
    try {
      window.localStorage.setItem(STORAGE_KEYS.muted, value ? '1' : '0');
    } catch {
      /* localStorage 可能被禁用，忽略 */
    }
    if (this.masterGain) this.masterGain.gain.value = Number(!value);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  attachUnlockListeners() {
    if (this.unlockAttached) return;
    this.unlockAttached = true;
    for (const evt of UNLOCK_EVENTS) {
      window.addEventListener(evt, this.unlock, { passive: true });
    }
  }

  /** 浏览器要求用户手势后才能创建/恢复 AudioContext */
  ensureContext() {
    if (!this.context) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.context = new Ctor();
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = Number(!this.muted);
        this.masterGain.connect(this.context.destination);
      } catch {
        this.context = null;
        this.masterGain = null;
        return null;
      }
    }
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
    return this.context;
  }

  /** 0.3 秒白噪声缓冲，复用于所有噪声音 */
  getNoiseBuffer(ctx) {
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const buffer = ctx.createBuffer(1, Math.max(1, 0.3 * ctx.sampleRate), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = 2 * Math.random() - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /** 0.45 秒指数衰减噪声做卷积脉冲响应（原 getReverbInput） */
  getReverbInput(ctx) {
    if (!this.masterGain) return null;
    if (this.reverbInput) return this.reverbInput;
    const length = Math.max(1, Math.round(0.45 * ctx.sampleRate));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < impulse.numberOfChannels; ch += 1) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        const decay = (1 - i / length) ** 3;
        data[i] = (2 * Math.random() - 1) * decay;
      }
    }
    const convolver = ctx.createConvolver();
    const gain = ctx.createGain();
    convolver.buffer = impulse;
    gain.gain.value = 1;
    convolver.connect(gain);
    gain.connect(this.masterGain);
    this.reverbInput = convolver;
    return convolver;
  }

  connectEffectOutput(ctx, node, reverb) {
    if (!this.masterGain) return;
    node.connect(this.masterGain);
    const send = reverb ? this.getReverbInput(ctx) : null;
    if (send) node.connect(send);
  }

  playTone(ctx, { frequency, endFrequency, type = 'sine', duration = 0.15, delay = 0, gain = 0.2 }, pitch = 1, reverb = false, durMul = 1) {
    if (!this.masterGain) return;
    const dur = duration * durMul;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency * pitch, start);
    if (endFrequency !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency * pitch), start + dur);
    }
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + Math.min(0.015, dur / 4));
    env.gain.exponentialRampToValueAtTime(1e-4, start + dur);
    osc.connect(env);
    this.connectEffectOutput(ctx, env, reverb);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  playNoise(ctx, { duration, gain = 0.2, delay = 0, filterFrequency, filterType = 'lowpass' }, pitch = 1, reverb = false) {
    if (!this.masterGain) return;
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer(ctx);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(1e-4, start + duration);
    let tail = source;
    if (filterFrequency !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFrequency * pitch;
      source.connect(filter);
      tail = filter;
    }
    tail.connect(env);
    this.connectEffectOutput(ctx, env, reverb);
    source.start(start);
    source.stop(start + duration + 0.02);
    source.onended = () => {
      source.disconnect();
      env.disconnect();
    };
  }

  /** 原 playGameEffect：Super 态下除 jump 外整体升调 1.5，并对部分音效开混响 */
  playGameEffect(name, isSuper, pitchMul = 1, durMul = 1) {
    this.play(name, {
      pitchMultiplier: (isSuper && name !== 'jump' ? 1.5 : 1) * pitchMul,
      reverb: isSuper && REVERB_EFFECTS.has(name),
      durationMultiplier: durMul,
    });
  }

  play(name, { pitchMultiplier = 1, durationMultiplier = 1, reverb = false } = {}) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const sane = (v) => (Number.isFinite(v) && v > 0 ? v : 1);
    const pitch = sane(pitchMultiplier);
    const durMul = sane(durationMultiplier);
    try {
      switch (name) {
        case 'jump':
          this.playTone(ctx, SFX.jump, pitch, reverb, durMul);
          break;
        case 'collect':
          for (const t of SFX.collect) this.playTone(ctx, t, pitch, reverb);
          break;
        case 'collectMega':
          for (const t of SFX.collectMega) this.playTone(ctx, t, pitch, reverb);
          break;
        case 'catchDucky':
          for (const t of SFX.catchDucky) this.playTone(ctx, t, pitch, reverb);
          break;
        case 'duckyLeave':
          for (const t of SFX.duckyLeave) this.playTone(ctx, t, pitch, reverb);
          break;
        case 'megaEnd':
          for (const t of SFX.megaEnd) this.playTone(ctx, t, pitch, reverb);
          break;
        case 'breakBlock':
          for (const t of SFX.breakBlock) this.playTone(ctx, t, pitch, reverb);
          break;
        case 'squashBug':
          for (const t of SFX.squashBug) this.playTone(ctx, t, pitch, reverb);
          this.playNoise(ctx, SFX.squashBugNoise, pitch, reverb);
          break;
        case 'gameOver':
          for (const t of SFX.gameOver) this.playTone(ctx, t, pitch, reverb);
          break;
        case 'damage':
          // 原站这一支没有传 durationMultiplier
          this.playTone(ctx, SFX.damage.tone, pitch, reverb);
          this.playNoise(ctx, SFX.damage.noise, pitch, reverb);
          break;
        default:
          return name;
      }
    } catch {
      /* 音频失败不应影响游戏 */
    }
    return undefined;
  }
}

function readMuted() {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.muted) === '1';
  } catch {
    return false;
  }
}

/** 全局单例（原 `eR`） */
export const sfx = new Sfx();
