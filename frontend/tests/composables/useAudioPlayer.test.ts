import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

function makeAudioElement() {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    currentTime: 0,
  } as unknown as HTMLAudioElement
}

describe('useAudioPlayer', () => {
  let audioEl: HTMLAudioElement
  let audioPlayer: ReturnType<typeof ref<HTMLAudioElement | undefined>>
  let currentSlideIndex: ReturnType<typeof computed<number>>
  let totalSlides: ReturnType<typeof computed<number>>
  let nextSlide: ReturnType<typeof vi.fn>

  beforeEach(() => {
    audioEl = makeAudioElement()
    audioPlayer = ref(audioEl)
    currentSlideIndex = computed(() => 0)
    totalSlides = computed(() => 3)
    nextSlide = vi.fn()
  })

  describe('initial state', () => {
    it('starts not playing', () => {
      const { isPlaying } = useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)
      expect(isPlaying.value).toBe(false)
    })
  })

  describe('togglePlayPause', () => {
    it('sets isPlaying to true and calls play()', () => {
      const { isPlaying, togglePlayPause } = useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)
      togglePlayPause()
      expect(isPlaying.value).toBe(true)
      expect(audioEl.play).toHaveBeenCalled()
    })

    it('sets isPlaying to false and calls pause() on second toggle', () => {
      const { isPlaying, togglePlayPause } = useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)
      togglePlayPause()
      togglePlayPause()
      expect(isPlaying.value).toBe(false)
      expect(audioEl.pause).toHaveBeenCalled()
    })

    it('does not throw when audioPlayer ref is undefined', () => {
      const emptyRef = ref<HTMLAudioElement | undefined>(undefined)
      const { togglePlayPause } = useAudioPlayer(emptyRef, currentSlideIndex, totalSlides, nextSlide)
      expect(() => togglePlayPause()).not.toThrow()
    })
  })

  describe('onAudioEnded', () => {
    it('sets isPlaying to false', () => {
      const { isPlaying, togglePlayPause, onAudioEnded } = useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)
      togglePlayPause() // set to playing
      onAudioEnded()
      expect(isPlaying.value).toBe(false)
    })

    it('schedules nextSlide when not on last slide', () => {
      vi.useFakeTimers()
      const idx = computed(() => 0)
      const total = computed(() => 3)
      const { onAudioEnded } = useAudioPlayer(audioPlayer, idx, total, nextSlide)
      onAudioEnded()
      vi.advanceTimersByTime(1000)
      expect(nextSlide).toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('does NOT schedule nextSlide when on last slide', () => {
      vi.useFakeTimers()
      const idx = computed(() => 2)
      const total = computed(() => 3)
      const { onAudioEnded } = useAudioPlayer(audioPlayer, idx, total, nextSlide)
      onAudioEnded()
      vi.advanceTimersByTime(1000)
      expect(nextSlide).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  describe('onAudioCanPlay', () => {
    it('calls play() when isPlaying is true', () => {
      const { isPlaying, togglePlayPause, onAudioCanPlay } = useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)
      togglePlayPause() // isPlaying = true
      ;(audioEl.play as ReturnType<typeof vi.fn>).mockClear()
      onAudioCanPlay()
      expect(audioEl.play).toHaveBeenCalled()
    })

    it('does NOT call play() when isPlaying is false', () => {
      const { onAudioCanPlay } = useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)
      onAudioCanPlay()
      expect(audioEl.play).not.toHaveBeenCalled()
    })
  })

  describe('resetAudio', () => {
    it('pauses and resets currentTime', () => {
      const { resetAudio } = useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)
      audioEl.currentTime = 30
      resetAudio()
      expect(audioEl.pause).toHaveBeenCalled()
      expect(audioEl.currentTime).toBe(0)
    })

    it('sets isPlaying to false', () => {
      const { isPlaying, togglePlayPause, resetAudio } = useAudioPlayer(audioPlayer, currentSlideIndex, totalSlides, nextSlide)
      togglePlayPause()
      resetAudio()
      expect(isPlaying.value).toBe(false)
    })
  })
})
