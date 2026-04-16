import { ref } from 'vue'
import type { Ref, ComputedRef } from 'vue'

/**
 * Encapsulates audio playback state and event handlers.
 * Handles play/pause toggling, audio lifecycle events, and auto-advance
 * to the next slide when audio ends.
 */
export function useAudioPlayer(
  audioPlayer: Ref<HTMLAudioElement | undefined>,
  currentSlideIndex: ComputedRef<number>,
  totalSlides: ComputedRef<number>,
  nextSlide: () => void
) {
  const isPlaying = ref(false)

  const togglePlayPause = () => {
    isPlaying.value = !isPlaying.value
    if (audioPlayer.value) {
      if (isPlaying.value) {
        audioPlayer.value.play()
      } else {
        audioPlayer.value.pause()
      }
    }
  }

  const onAudioEnded = () => {
    isPlaying.value = false
    // Auto-advance to next slide after audio finishes
    if (currentSlideIndex.value < totalSlides.value - 1) {
      setTimeout(() => nextSlide(), 1000)
    }
  }

  const onAudioLoadStart = () => {
    // Audio element has started loading — no action needed
  }

  const onAudioCanPlay = () => {
    if (isPlaying.value) {
      audioPlayer.value?.play()
    }
  }

  /** Reset playback state when navigating to a different slide. */
  const resetAudio = () => {
    if (audioPlayer.value) {
      audioPlayer.value.pause()
      audioPlayer.value.currentTime = 0
    }
    isPlaying.value = false
  }

  return {
    isPlaying,
    togglePlayPause,
    onAudioEnded,
    onAudioLoadStart,
    onAudioCanPlay,
    resetAudio,
  }
}
