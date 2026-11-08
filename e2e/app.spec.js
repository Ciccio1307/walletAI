import { test, expect } from '@playwright/test';

let counter = 0;

/** Registers a fresh user through the UI and lands on the profile page. */
async function registerViaUI(page) {
  const id = `${test.info().project.name}-${Date.now()}-${counter++}`.replace(/[^a-z0-9._-]/gi, '');
  await page.goto('/login');
  await page.getByRole('button', { name: 'Registrati' }).click();
  const inputs = page.locator('form input');
  await inputs.nth(0).fill('Utente Test');
  await inputs.nth(1).fill(id.slice(0, 32));
  await inputs.nth(2).fill(`${id}@example.com`);
  await inputs.nth(3).fill('password123');
  await inputs.nth(4).fill('password123');
  await page.getByRole('button', { name: 'Crea account' }).click();
  await expect(page).toHaveURL(/\/profile$/);
}

async function addTransaction(page, text) {
  await page.locator('.ai-input').fill(text);
  await page.getByRole('button', { name: 'Analizza' }).click();
}

/** Confirms the single-transaction preview and waits for the list to settle. */
async function confirmPreview(page) {
  await page.locator('.preview-card').getByRole('button', { name: /Conferma/ }).click();
  await expect(page.locator('.save-success')).toBeVisible();
  await expect(page.locator('.save-success')).toHaveCount(0);
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

test('registrazione, inserimento e lista senza elementi sovrapposti', async ({ page }) => {
  const errors = trackErrors(page);
  await registerViaUI(page);

  await page.goto('/transactions');
  await addTransaction(page, 'sushi 22€ ieri');

  const preview = page.locator('.preview-card');
  await expect(preview).toContainText('sushi');
  await expect(preview).toContainText('22,00 €');
  await confirmPreview(page);

  const row = page.locator('.tx-row').filter({ hasText: 'sushi' });
  await expect(row).toBeVisible();
  await expect(page.locator('.date-separator').first()).toHaveText('Ieri');

  // Regression: the swipe-to-delete background was painted over every row,
  // hiding the amount and the action buttons. That layer has
  // pointer-events: none, which elementFromPoint ignores, so make everything
  // hit-testable while checking: we want what is visually on top.
  const style = await page.addStyleTag({ content: '* { pointer-events: auto !important; }' });
  for (const selector of ['.tx-amount', '.tx-edit-btn', '.tx-delete']) {
    const target = row.locator(selector);
    const covered = await target.evaluate((el) => {
      // elementFromPoint only sees the viewport; centre the element so the
      // fixed bottom navigation cannot overlap it.
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit === el || el.contains(hit) ? null : (hit?.className || String(hit));
    });
    expect(covered, `${selector} è coperto da: ${covered}`).toBeNull();
  }
  await style.evaluate((node) => node.remove());

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasHorizontalScroll).toBe(false);
  expect(errors).toEqual([]);
});

test('transazioni multiple con la virgola decimale', async ({ page }) => {
  await registerViaUI(page);
  await page.goto('/transactions');
  await addTransaction(page, 'pizza 12,50€, taxi 8€');

  const multi = page.locator('.multi-preview');
  await expect(multi).toContainText('2 transazioni rilevate');
  await expect(multi).toContainText('12,50 €');
  await expect(multi).toContainText('8,00 €');
});

test('elimina una transazione e la ripristina con Annulla', async ({ page }) => {
  await registerViaUI(page);
  await page.goto('/transactions');
  await addTransaction(page, 'caffè 1,20€');
  await confirmPreview(page);

  const row = page.locator('.tx-row').filter({ hasText: 'caffè' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Elimina transazione' }).click();
  await expect(row).toHaveCount(0);

  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(page.locator('.tx-row').filter({ hasText: 'caffè' })).toBeVisible();
});

test('logout riporta al login e protegge le pagine', async ({ page, isMobile }) => {
  await registerViaUI(page);
  const logout = isMobile
    ? page.locator('.bottom-nav').getByRole('button', { name: /Esci/ })
    : page.locator('.navbar-logout');
  await logout.click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/transactions');
  await expect(page).toHaveURL(/\/login$/);
});
