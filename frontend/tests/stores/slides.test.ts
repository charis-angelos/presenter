/**
 * Test suite for slides store
 * Tests slide generation, navigation, and WebSocket functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSlidesStore } from '@/stores/slides'
import type { SlideContent } from '@/types/slides'

// Mock the API services
vi.mock('@/services/api', () => ({
  slideApi: {
    generateSlides: vi.fn(),
    getSlideStatus: vi.fn(),
  },
  websocketService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}))

/** Helper: create a minimal valid SlideContent for tests */
function makeSlide(index: number, theme = 'project_overview'): SlideContent {
  return {
    index,
    theme: theme as SlideContent['theme'],
    title: `Slide ${index + 1}`,
    markdown: `# Slide ${index + 1}\nContent`,
    generatedAt: new Date().toISOString(),
  }
}

describe('Slides Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('initializes with empty default state', () => {
    const store = useSlidesStore()
    expect(store.slides).toEqual([])
    expect(store.currentSlideIndex).toBe(0)
    expect(store.isGenerating).toBe(false)
    expect(store.isStreamingComplete).toBe(false)
    expect(store.currentSlideId).toBeNull()
    expect(store.hasSlides).toBe(false)
    expect(store.websocketConnected).toBe(false)
    expect(store.generationError).toBeNull()
  })

  it('totalSlides reflects expectedTotalSlides before streaming completes', () => {
    const store = useSlidesStore()
    expect(store.totalSlides).toBe(10) // default
    store.expectedTotalSlides = 3
    expect(store.totalSlides).toBe(3)
  })

  it('totalSlides reflects actual slide count after streaming completes', () => {
    const store = useSlidesStore()
    store.slides.push(makeSlide(0), makeSlide(1))
    store.isStreamingComplete = true
    expect(store.totalSlides).toBe(2)
  })

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  it('nextSlide and previousSlide navigate correctly', () => {
    const store = useSlidesStore()
    store.slides.push(makeSlide(0), makeSlide(1), makeSlide(2))
    store.isStreamingComplete = true

    expect(store.currentSlideIndex).toBe(0)
    store.nextSlide()
    expect(store.currentSlideIndex).toBe(1)
    store.previousSlide()
    expect(store.currentSlideIndex).toBe(0)
  })

  it('previousSlide does not go below 0', () => {
    const store = useSlidesStore()
    store.slides.push(makeSlide(0))
    store.isStreamingComplete = true

    store.previousSlide()
    expect(store.currentSlideIndex).toBe(0)
  })

  it('nextSlide does not exceed last slide', () => {
    const store = useSlidesStore()
    store.slides.push(makeSlide(0), makeSlide(1))
    store.isStreamingComplete = true

    store.goToSlide(1)
    store.nextSlide()
    expect(store.currentSlideIndex).toBe(1)
  })

  it('goToSlide rejects invalid indices', () => {
    const store = useSlidesStore()
    store.slides.push(makeSlide(0))
    store.isStreamingComplete = true

    store.goToSlide(-1)
    expect(store.currentSlideIndex).toBe(0)
    store.goToSlide(99)
    expect(store.currentSlideIndex).toBe(0)
  })

  it('currentSlide returns the correct slide', () => {
    const store = useSlidesStore()
    const s0 = makeSlide(0)
    const s1 = makeSlide(1)
    store.slides.push(s0, s1)
    store.currentSlideIndex = 1
    expect(store.currentSlide).toEqual(s1)
  })

  // -------------------------------------------------------------------------
  // generateSlides
  // -------------------------------------------------------------------------

  it('generateSlides resets state and sets slideId on success', async () => {
    const store = useSlidesStore()
    store.slides.push(makeSlide(0))
    store.currentSlideIndex = 1

    const { slideApi } = await import('@/services/api')
    vi.mocked(slideApi.generateSlides).mockResolvedValue({
      slideId: 'slide-abc',
      status: 'generating',
      websocketUrl: '/ws/slides/slide-abc',
    })

    localStorage.setItem('auth_token', 'tok')
    await store.generateSlides({ projectId: '1', themes: ['project_overview'], language: 'ja' })

    expect(store.slides).toEqual([])
    expect(store.currentSlideIndex).toBe(0)
    expect(store.currentSlideId).toBe('slide-abc')
    expect(store.isGenerating).toBe(true)
    expect(store.generationError).toBeNull()
  })

  it('generateSlides sets generationError and rethrows on failure', async () => {
    const store = useSlidesStore()
    const { slideApi } = await import('@/services/api')
    vi.mocked(slideApi.generateSlides).mockRejectedValue(new Error('network error'))

    await expect(
      store.generateSlides({ projectId: '1', themes: ['project_overview'], language: 'ja' })
    ).rejects.toThrow('network error')

    expect(store.isGenerating).toBe(false)
    expect(store.generationError).toBe('network error')
  })

  // -------------------------------------------------------------------------
  // clearSlides
  // -------------------------------------------------------------------------

  it('clearSlides resets all state including generationError', () => {
    const store = useSlidesStore()
    store.slides.push(makeSlide(0))
    store.currentSlideId = 'some-id'
    store.isGenerating = true
    store.generationError = 'Something went wrong'
    store.currentSlideIndex = 1

    store.clearSlides()

    expect(store.slides).toEqual([])
    expect(store.currentSlideId).toBeNull()
    expect(store.isGenerating).toBe(false)
    expect(store.generationError).toBeNull()
    expect(store.currentSlideIndex).toBe(0)
    expect(store.websocketConnected).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Narration / Audio accessors
  // -------------------------------------------------------------------------

  it('getNarration and getAudio return undefined for missing indices', () => {
    const store = useSlidesStore()
    expect(store.getNarration(0)).toBeUndefined()
    expect(store.getAudio(0)).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // hasSlides / canStartPresentation
  // -------------------------------------------------------------------------

  it('hasSlides is true when slides array is non-empty', () => {
    const store = useSlidesStore()
    expect(store.hasSlides).toBe(false)
    store.slides.push(makeSlide(0))
    expect(store.hasSlides).toBe(true)
  })

  it('canStartPresentation is true when generating or has slides', () => {
    const store = useSlidesStore()
    expect(store.canStartPresentation).toBe(false)
    store.isGenerating = true
    expect(store.canStartPresentation).toBe(true)
    store.isGenerating = false
    store.slides.push(makeSlide(0))
    expect(store.canStartPresentation).toBe(true)
  })
})
