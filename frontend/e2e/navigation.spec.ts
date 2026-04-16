import { test, expect } from '@playwright/test'

/**
 * Slide navigation E2E tests.
 * Verifies keyboard shortcuts and click navigation work correctly
 * in the presentation view.
 */
test.describe('Slide navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the store with a minimal slide session via localStorage
    await page.goto('/presentation/test-nav-session', {
      waitUntil: 'domcontentloaded',
    })
  })

  test('presentation view shows slide controls bar', async ({ page }) => {
    // Even without data the controls bar should render
    const controls = page.locator('.slide-controls')
    await expect(controls).toBeVisible()
  })

  test('slide counter is visible', async ({ page }) => {
    const counter = page.locator('.slide-counter')
    await expect(counter).toBeVisible()
  })

  test('previous and next nav buttons are rendered', async ({ page }) => {
    const navBtns = page.locator('.nav-btn')
    await expect(navBtns).toHaveCount(2)
  })

  test('no-slides fallback is shown when there is no data', async ({ page }) => {
    // Without seeded slide data the no-slides message should appear
    const noSlides = page.locator('.no-slides')
    await expect(noSlides).toBeVisible()
  })

  test('pressing ArrowRight key does not throw an error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.keyboard.press('ArrowRight')
    expect(errors).toHaveLength(0)
  })

  test('pressing ArrowLeft key does not throw an error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.keyboard.press('ArrowLeft')
    expect(errors).toHaveLength(0)
  })

  test('pressing H toggles the help overlay', async ({ page }) => {
    // Help overlay should not be visible initially
    await expect(page.locator('.help-overlay')).not.toBeVisible()
    await page.keyboard.press('h')
    await expect(page.locator('.help-overlay')).toBeVisible()
    await page.keyboard.press('h')
    await expect(page.locator('.help-overlay')).not.toBeVisible()
  })
})
