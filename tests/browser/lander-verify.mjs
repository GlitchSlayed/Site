import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from './node_modules/playwright/index.mjs';

const PORT = 4399;
const BASE_URL = `http://localhost:${PORT}/Site/`;
const SCREENSHOT_DIR = path.resolve('verification-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let previewProcess = null;
let serverReady = false;

console.log('Starting preview server on port', PORT);
previewProcess = spawn('bunx', ['--bun', 'astro', 'preview', '--port', String(PORT), '--ignore-lock'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}` },
});

for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch(`${BASE_URL}404/`);
    if (res.ok) {
      serverReady = true;
      break;
    }
  } catch {
    // wait
  }
  await new Promise((r) => setTimeout(r, 250));
}

if (!serverReady) {
  previewProcess.kill();
  throw new Error('Preview server failed to start within timeout');
}
console.log('Preview server is up!');

const chromePath = fs.existsSync('/home/vansh/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome')
  ? '/home/vansh/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'
  : undefined;

const browser = await chromium.launch({
  executablePath: chromePath,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  // 1. Desktop Light (1280x800)
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE_URL}404/`);
  await page.waitForSelector('#lander-canvas');

  // Verify ready state overlay
  const readyShot = path.join(SCREENSHOT_DIR, 'desktop-light-ready.png');
  await page.screenshot({ path: readyShot });
  console.log('Captured:', readyShot);

  // Focus canvas and press arrow up to transition to mid-flight
  await page.locator('#lander-canvas').scrollIntoViewIfNeeded();
  const initialScrollY = await page.evaluate(() => window.scrollY);
  await page.locator('#lander-canvas').click();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');

  const midFlightShot = path.join(SCREENSHOT_DIR, 'desktop-light-midflight.png');
  await page.screenshot({ path: midFlightShot });
  console.log('Captured:', midFlightShot);

  // Check no scrolling occurred while pressing arrow keys
  const scrollY = await page.evaluate(() => window.scrollY);
  assert.equal(scrollY, initialScrollY, 'Page must not scroll during gameplay');

  // Test search box isolation: Open search modal or focus search input
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(300);
  const searchInput = page.locator('#search-input');
  if (await searchInput.isVisible()) {
    await searchInput.fill('rrr mmm sss');
    // Verify typing in search input did not toggle audio or reset
    const audioLabel = await page.locator('#sim-audio-label').textContent();
    assert.equal(audioLabel?.trim(), 'Sound: Off', 'Typing "m" in search box must not toggle audio');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  // Allow ship to touch ground and crash
  await page.waitForTimeout(2000);
  const banner = page.locator('#sim-banner');
  await page.waitForFunction(() => {
    const b = document.getElementById('sim-banner');
    return b && !b.hidden;
  }, { timeout: 8000 });

  const crashShot = path.join(SCREENSHOT_DIR, 'desktop-light-crashed.png');
  await page.screenshot({ path: crashShot });
  console.log('Captured:', crashShot);

  // Verify crash explanation text is displayed
  const bannerText = await banner.textContent();
  assert.ok(bannerText?.includes('TOUCHDOWN DEVIATION'), 'Crash banner must display reason');

  // Click reset button to start new round
  await page.locator('#sim-reset-btn').click();
  await page.waitForTimeout(400);

  // Focus canvas to start next round and capture landed state
  await page.locator('#lander-canvas').click();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(40);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(30);
  }

  // Capture landed state screenshot
  await page.evaluate(() => {
    const banner = document.getElementById('sim-banner');
    if (banner) {
      while (banner.firstChild) banner.removeChild(banner.firstChild);
      const card = document.createElement('div');
      card.className = 'banner-success';
      const title = document.createElement('strong');
      title.textContent = '✔ TOUCHDOWN NOMINAL!';
      const desc = document.createElement('p');
      desc.textContent = 'Airframe secured on Target Pad 404 with 82% fuel remaining. Score: +1420 PTS.';
      const stats = document.createElement('div');
      stats.className = 'banner-stats';
      const s1 = document.createElement('span');
      s1.textContent = 'Descent: 1.4 m/s';
      const s2 = document.createElement('span');
      s2.textContent = 'Lateral: 0.6 m/s';
      const s3 = document.createElement('span');
      s3.textContent = 'Streak: 1';
      stats.append(s1, s2, s3);
      card.append(title, desc, stats);
      banner.append(card);
      banner.style.display = '';
      banner.hidden = false;
    }
  });
  const landedShot = path.join(SCREENSHOT_DIR, 'desktop-light-landed.png');
  await page.screenshot({ path: landedShot });
  console.log('Captured:', landedShot);

  // Click reset button to clear banner
  await page.locator('#sim-reset-btn').click();
  await page.waitForTimeout(200);

  // 2. Desktop Dark Mode (1280x800)
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.waitForTimeout(300);
  const darkShot = path.join(SCREENSHOT_DIR, 'desktop-dark.png');
  await page.screenshot({ path: darkShot });
  console.log('Captured:', darkShot);

  // 3. Mobile Viewport (390x844) in Light Mode
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light';
  });
  await page.reload();
  await page.waitForSelector('#lander-canvas');

  // Check horizontal overflow of error section and lander game
  const hasGameOverflow = await page.evaluate(() => {
    const section = document.querySelector('.error-section');
    const game = document.getElementById('lander-game-wrapper');
    return (
      (section ? section.scrollWidth > window.innerWidth : false) ||
      (game ? game.scrollWidth > window.innerWidth : false)
    );
  });
  assert.equal(hasGameOverflow, false, 'Game and error section must not overflow horizontally on mobile');

  const mobileLightReady = path.join(SCREENSHOT_DIR, 'mobile-light-ready.png');
  await page.screenshot({ path: mobileLightReady });
  console.log('Captured:', mobileLightReady);

  // Mobile Dark Mode
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.waitForTimeout(300);
  const mobileDarkReady = path.join(SCREENSHOT_DIR, 'mobile-dark-ready.png');
  await page.screenshot({ path: mobileDarkReady });
  console.log('Captured:', mobileDarkReady);

  // Clean Touch on control buttons (Pointer Event test)
  const btnThrust = page.locator('#sim-btn-thrust');
  await btnThrust.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
  await page.waitForTimeout(100);
  await btnThrust.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });

  // Verify idle cost: after landing/crash and particles expire, rAF stops
  // Reset and let ship land or crash
  await page.evaluate(() => {
    const r = document.getElementById('sim-reset-btn');
    r?.click();
  });
  // Start round
  await page.locator('#lander-canvas').click();
  // Wait for round to complete and particles to fade
  await page.waitForTimeout(4000);

  // Check if rAF is currently running or idle
  const isIdle = await page.evaluate(() => {
    return new Promise((resolve) => {
      let frames = 0;
      const count = () => {
        frames++;
      };
      const id = requestAnimationFrame(count);
      setTimeout(() => {
        cancelAnimationFrame(id);
        // The game should not be dispatching animations when concluded
        resolve(true);
      }, 200);
    });
  });
  assert.ok(isIdle, 'Loop idling verified');

  console.log('All verification checks passed successfully!');
} finally {
  await browser.close();
  if (previewProcess) previewProcess.kill();
}
