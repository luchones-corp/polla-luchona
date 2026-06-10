import { useCallback, useState } from 'react'

type SoundKey = 'whistle' | 'crowd' | 'ding'

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playWhistle() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15)
  osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(0.18, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
  osc.connect(gain).connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.4)
}

function playCrowd() {
  const ctx = getCtx()
  const duration = 0.6
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 1000
  bandpass.Q.value = 0.5
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1)
  gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.3)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  source.connect(bandpass).connect(gain).connect(ctx.destination)
  source.start(ctx.currentTime)
  source.stop(ctx.currentTime + duration)
}

function playDing() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1047, ctx.currentTime) // C6
  gain.gain.setValueAtTime(0.2, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  osc.connect(gain).connect(ctx.destination)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.5)
}

const players: Record<SoundKey, () => void> = {
  whistle: playWhistle,
  crowd: playCrowd,
  ding: playDing,
}

export function useSound() {
  const [muted, setMuted] = useState(() => localStorage.getItem('polla-muted') === '1')

  const play = useCallback((key: SoundKey) => {
    if (muted) return
    try {
      players[key]()
    } catch {
      // Web Audio not available
    }
  }, [muted])

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      localStorage.setItem('polla-muted', next ? '1' : '0')
      return next
    })
  }, [])

  return { play, muted, toggleMute }
}
