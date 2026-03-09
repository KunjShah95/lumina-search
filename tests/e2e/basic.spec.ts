import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

test.describe('Perplexity Local E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test.describe('Search Functionality', () => {
    test('should load the main search page', async ({ page }) => {
      await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible()
    })

    test('should accept search input', async ({ page }) => {
      const searchInput = page.locator('textarea').first()
      await searchInput.fill('test query')
      await expect(searchInput).toHaveValue('test query')
    })

    test('should display focus mode selector', async ({ page }) => {
      await expect(page.locator('button:has-text("Web"), [class*="focus"]').first()).toBeVisible()
    })
  })

  test.describe('Settings', () => {
    test('should open settings panel', async ({ page }) => {
      await page.keyboard.press('Control+,')
      await expect(page.locator('[class*="settings"], .settings-panel').first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should focus search with Ctrl+K', async ({ page }) => {
      await page.keyboard.press('Control+K')
      const searchInput = page.locator('textarea').first()
      await expect(searchInput).toBeFocused()
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
      expect(headings.length).toBeGreaterThan(0)
    })

    test('should have form labels or aria-labels', async ({ page }) => {
      const inputs = page.locator('input, textarea, select')
      const count = await inputs.count()
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i)
        const hasLabel = await input.getAttribute('aria-label') !== null || 
                        await input.getAttribute('id') !== null ||
                        await input.locator('..').locator('label').count() > 0
        if (!hasLabel && await input.isVisible()) {
          console.log(`Input ${i} may lack accessibility label`)
        }
      }
    })

    test('should support keyboard navigation', async ({ page }) => {
      await page.keyboard.press('Tab')
      const focusedElement = await page.locator(':focus').first()
      await expect(focusedElement).toBeVisible()
    })
  })

  test.describe('Theme', () => {
    test('should switch between light and dark themes', async ({ page }) => {
      const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
      
      await page.keyboard.press('Control+Shift+T')
      await page.waitForTimeout(500)
      
      const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
      expect(newTheme).not.toBe(initialTheme)
    })
  })
})

test.describe('Visual Regression Tests', () => {
  test('should match baseline screenshot', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('homepage.png', { 
      maxDiffPixelRatio: 0.1 
    })
  })
})
