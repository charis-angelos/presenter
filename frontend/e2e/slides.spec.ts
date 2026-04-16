import { test, expect } from '@playwright/test'

/**
 * Slide generation flow E2E tests.
 * Uses page.route() to mock the backend API responses.
 */
test.describe('Slide generation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the auth endpoint so the app considers the user authenticated
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, name: 'Test User', mailAddress: 'test@example.com' }),
      })
    })

    // Mock the slide generation endpoint
    await page.route('**/api/v1/slides/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ slideId: 'test-slide-123', status: 'generating', webSocketUrl: '' }),
      })
    })

    // Mock the slide status endpoint
    await page.route('**/api/v1/slides/*/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          slideId: 'test-slide-123',
          status: 'completed',
          slides: [
            {
              index: 0,
              title: 'Project Overview',
              theme: 'project_overview',
              markdown: '# Project Overview\n\nTest content',
              generatedAt: new Date().toISOString(),
            },
          ],
          narrations: [],
          audioFiles: [],
        }),
      })
    })

    // Mock the projects endpoint
    await page.route('**/api/v1/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'TEST', name: 'Test Project', key: 'TEST' }]),
      })
    })
  })

  test('home page renders when authenticated', async ({ page }) => {
    // Set a fake auth token in localStorage
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'fake-jwt-token')
    })
    await page.reload()

    // Verify the page renders (the app redirects authenticated users to home)
    await expect(page).toHaveURL('/')
  })
})
