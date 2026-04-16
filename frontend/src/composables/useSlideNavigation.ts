import { computed } from 'vue'
import type { useSlidesStore } from '@/stores/slides'

type SlidesStore = ReturnType<typeof useSlidesStore>

/**
 * Encapsulates slide navigation logic: current index, total count,
 * and the previous/next/goToSlide actions that delegate to the Pinia store.
 */
export function useSlideNavigation(slidesStore: SlidesStore) {
  const currentSlideIndex = computed(() => slidesStore.currentSlideIndex)
  const totalSlides = computed(() => slidesStore.totalSlides)
  const currentSlide = computed(() => slidesStore.currentSlide)

  const currentNarration = computed(() =>
    currentSlide.value ? slidesStore.getNarration(currentSlide.value.index) : undefined
  )
  const currentAudio = computed(() =>
    currentSlide.value ? slidesStore.getAudio(currentSlide.value.index) : undefined
  )

  const previousSlide = () => {
    if (currentSlideIndex.value > 0) {
      slidesStore.previousSlide()
    }
  }

  const nextSlide = () => {
    if (currentSlideIndex.value < totalSlides.value - 1) {
      slidesStore.nextSlide()
    }
  }

  const goToSlide = (index: number) => {
    slidesStore.goToSlide(index)
  }

  return {
    currentSlideIndex,
    totalSlides,
    currentSlide,
    currentNarration,
    currentAudio,
    previousSlide,
    nextSlide,
    goToSlide,
  }
}
