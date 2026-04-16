import { test, expect } from '@playwright/test'

/**
 * Authentication page E2E tests.
 * Requires the Vite dev server running on http://localhost:5173
 */
test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored auth state
    await page.context().clearCookies()
  })

  test('login page renders and shows the OAuth button', async ({ page }) => {
    await page.goto('/')
    const loginBtn = page.locator('.login-button')
    await expect(loginBtn).toBeVisible()
    await expect(loginBtn).toContainText('Backlogでログイン')
  })

  test('login button is enabled when not loading', async ({ page }) => {
    await page.goto('/')
    const loginBtn = page.locator('.login-button')
    await expect(loginBtn).toBeEnabled()
  })

  test('page title contains application name', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.login-title')).toContainText('Intelligent Presenter')
  })

  test('feature list is visible', async ({ page }) => {
    await page.goto('/')
    const items = page.locator('.feature-list li')
    await expect(items).toHaveCount(5)
  })
})
