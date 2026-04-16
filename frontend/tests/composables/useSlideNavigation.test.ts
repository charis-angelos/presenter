import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import { useSlideNavigation } from '@/composables/useSlideNavigation'

function makeMockStore(overrides: Partial<ReturnType<typeof makeMockStore>> = {}) {
  return {
    currentSlideIndex: 0,
    totalSlides: 3,
    currentSlide: { index: 0, title: 'Slide 1', theme: 'project_overview' as const, markdown: '', generatedAt: new Date() },
    getNarration: vi.fn().mockReturnValue(undefined),
    getAudio: vi.fn().mockReturnValue(undefined),
    previousSlide: vi.fn(),
    nextSlide: vi.fn(),
    goToSlide: vi.fn(),
    ...overrides,
  }
}

describe('useSlideNavigation', () => {
  describe('computed refs', () => {
    it('exposes currentSlideIndex from store', () => {
      const store = makeMockStore({ currentSlideIndex: 2 })
      const { currentSlideIndex } = useSlideNavigation(store as any)
      expect(currentSlideIndex.value).toBe(2)
    })

    it('exposes totalSlides from store', () => {
      const store = makeMockStore({ totalSlides: 5 })
      const { totalSlides } = useSlideNavigation(store as any)
      expect(totalSlides.value).toBe(5)
    })

    it('exposes currentSlide from store', () => {
      const slide = { index: 1, title: 'Test', theme: 'progress' as any, markdown: '', generatedAt: new Date() }
      const store = makeMockStore({ currentSlide: slide })
      const { currentSlide } = useSlideNavigation(store as any)
      expect(currentSlide.value).toBe(slide)
    })

    it('returns undefined narration when no current slide', () => {
      const store = makeMockStore({ currentSlide: null })
      const { currentNarration } = useSlideNavigation(store as any)
      expect(currentNarration.value).toBeUndefined()
    })

    it('calls getNarration with slide index when slide exists', () => {
      const store = makeMockStore()
      const { currentNarration } = useSlideNavigation(store as any)
      // Access to trigger computed evaluation
      const _ = currentNarration.value
      expect(store.getNarration).toHaveBeenCalledWith(0)
    })
  })

  describe('previousSlide', () => {
    it('calls store.previousSlide when index > 0', () => {
      const store = makeMockStore({ currentSlideIndex: 1 })
      const { previousSlide } = useSlideNavigation(store as any)
      previousSlide()
      expect(store.previousSlide).toHaveBeenCalled()
    })

    it('does NOT call store.previousSlide when at first slide', () => {
      const store = makeMockStore({ currentSlideIndex: 0 })
      const { previousSlide } = useSlideNavigation(store as any)
      previousSlide()
      expect(store.previousSlide).not.toHaveBeenCalled()
    })
  })

  describe('nextSlide', () => {
    it('calls store.nextSlide when not on last slide', () => {
      const store = makeMockStore({ currentSlideIndex: 1, totalSlides: 3 })
      const { nextSlide } = useSlideNavigation(store as any)
      nextSlide()
      expect(store.nextSlide).toHaveBeenCalled()
    })

    it('does NOT call store.nextSlide on last slide', () => {
      const store = makeMockStore({ currentSlideIndex: 2, totalSlides: 3 })
      const { nextSlide } = useSlideNavigation(store as any)
      nextSlide()
      expect(store.nextSlide).not.toHaveBeenCalled()
    })
  })

  describe('goToSlide', () => {
    it('delegates to store.goToSlide with the given index', () => {
      const store = makeMockStore()
      const { goToSlide } = useSlideNavigation(store as any)
      goToSlide(2)
      expect(store.goToSlide).toHaveBeenCalledWith(2)
    })
  })
})
