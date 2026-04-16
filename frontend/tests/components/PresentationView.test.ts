import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import PresentationView from '@/views/PresentationView.vue'

// Stub all composables so PresentationView renders without real deps
vi.mock('@/composables/useSlideNavigation', () => ({
  useSlideNavigation: vi.fn(() => ({
    currentSlideIndex: { value: 0 },
    totalSlides: { value: 3 },
    currentSlide: { value: null },
    currentNarration: { value: undefined },
    currentAudio: { value: undefined },
    previousSlide: vi.fn(),
    nextSlide: vi.fn(),
    goToSlide: vi.fn(),
  })),
}))

vi.mock('@/composables/useAudioPlayer', () => ({
  useAudioPlayer: vi.fn(() => ({
    isPlaying: { value: false },
    togglePlayPause: vi.fn(),
    onAudioEnded: vi.fn(),
    onAudioLoadStart: vi.fn(),
    onAudioCanPlay: vi.fn(),
    resetAudio: vi.fn(),
  })),
}))

vi.mock('@/composables/useFullscreen', () => ({
  useFullscreen: vi.fn(() => ({
    isFullscreen: { value: false },
    toggleFullscreen: vi.fn(),
  })),
}))

vi.mock('@/composables/useSlideRenderer', () => ({
  useSlideRenderer: vi.fn(() => ({
    compiledSlideHTML: { value: '<p>Test slide HTML</p>' },
    compileCurrentSlide: vi.fn(),
  })),
}))

vi.mock('@/services/api', () => ({
  slideApi: {
    generateSlides: vi.fn(),
    getSlideStatus: vi.fn(),
  },
  authApi: {
    initiateOAuth: vi.fn(),
    handleCallback: vi.fn(),
    getUserInfo: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  },
}))

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/presentation/:slideId', component: PresentationView }],
  })
}

describe('PresentationView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders the slide controls bar', async () => {
    const router = makeRouter()
    await router.push('/presentation/test-id')
    const wrapper = mount(PresentationView, {
      global: { plugins: [createPinia(), router] },
    })
    expect(wrapper.find('.slide-controls').exists()).toBe(true)
  })

  it('renders the slide counter', async () => {
    const router = makeRouter()
    await router.push('/presentation/test-id')
    const wrapper = mount(PresentationView, {
      global: { plugins: [createPinia(), router] },
    })
    expect(wrapper.find('.slide-counter').exists()).toBe(true)
  })

  it('renders previous and next navigation buttons', async () => {
    const router = makeRouter()
    await router.push('/presentation/test-id')
    const wrapper = mount(PresentationView, {
      global: { plugins: [createPinia(), router] },
    })
    const navBtns = wrapper.findAll('.nav-btn')
    expect(navBtns.length).toBeGreaterThanOrEqual(2)
  })

  it('renders the slide navigation panel', async () => {
    const router = makeRouter()
    await router.push('/presentation/test-id')
    const wrapper = mount(PresentationView, {
      global: { plugins: [createPinia(), router] },
    })
    expect(wrapper.find('.slide-navigation').exists()).toBe(true)
  })

  it('clicking previous button calls previousSlide', async () => {
    const { useSlideNavigation } = await import('@/composables/useSlideNavigation')
    const mockPreviousSlide = vi.fn()
    ;(useSlideNavigation as ReturnType<typeof vi.fn>).mockReturnValue({
      currentSlideIndex: { value: 1 },
      totalSlides: { value: 3 },
      currentSlide: { value: null },
      currentNarration: { value: undefined },
      currentAudio: { value: undefined },
      previousSlide: mockPreviousSlide,
      nextSlide: vi.fn(),
      goToSlide: vi.fn(),
    })

    const router = makeRouter()
    await router.push('/presentation/test-id')
    const wrapper = mount(PresentationView, {
      global: { plugins: [createPinia(), router] },
    })

    const prevBtn = wrapper.findAll('.nav-btn')[0]
    await prevBtn.trigger('click')
    expect(mockPreviousSlide).toHaveBeenCalled()
  })
})
