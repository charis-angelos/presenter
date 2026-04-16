import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LoginView from '@/views/LoginView.vue'

vi.mock('@/services/api', () => ({
  authApi: {
    initiateOAuth: vi.fn().mockResolvedValue({ authUrl: 'https://example.backlog.jp/OAuth2' }),
    handleCallback: vi.fn(),
    getUserInfo: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  },
}))

describe('LoginView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders the login button', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia()] },
    })
    const btn = wrapper.find('.login-button')
    expect(btn.exists()).toBe(true)
  })

  it('login button shows "Backlogでログイン" text when not loading', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('Backlogでログイン')
  })

  it('renders the application title', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('Intelligent Presenter')
  })

  it('login button is enabled when not loading', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia()] },
    })
    const btn = wrapper.find('.login-button')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('displays the feature list', () => {
    const wrapper = mount(LoginView, {
      global: { plugins: [createPinia()] },
    })
    const items = wrapper.findAll('.feature-list li')
    expect(items.length).toBeGreaterThan(0)
  })
})
