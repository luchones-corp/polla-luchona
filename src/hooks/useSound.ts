import { useCallback, useState } from 'react'

type SoundKey = 'whistle' | 'crowd' | 'ding'

const SOUND_FILES: Record<SoundKey, string> = {
  whistle: '/sounds/whistle.mp3',
  crowd: '/sounds/crowd.mp3',
  ding: '/sounds/ding.mp3',
}

const audioCache: Partial<Record<SoundKey, HTMLAudioElement>> = {}

function getAudio(key: SoundKey): HTMLAudioElement {
  if (!audioCache[key]) {
    audioCache[key] = new Audio(SOUND_FILES[key])
  }
  return audioCache[key]
}

export function useSound() {
  const [muted, setMuted] = useState(() => localStorage.getItem('polla-muted') === '1')

  const play = useCallback((key: SoundKey) => {
    if (muted) return
    try {
      const audio = getAudio(key)
      audio.currentTime = 0
      audio.play().catch(() => {})
    } catch {
      // Audio not available
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
