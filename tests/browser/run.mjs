import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4321/Site/';
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  let commentRequests = 0;
  await page.route('https://giscus.app/client.js', async route => {
    if (++commentRequests === 1) return route.fulfill({status:503,body:'Simulated block'});
    await route.fulfill({contentType:'application/javascript',body:`
      const script = document.currentScript;
      const iframe = document.createElement('iframe');
      iframe.className = 'giscus-frame';
      iframe.src = 'https://giscus.app/test-frame';
      script.parentElement.append(iframe);
    `});
  });
  await page.route('https://giscus.app/test-frame', route => route.fulfill({contentType:'text/html',body:`
    <p>Simulated discussion</p><script>
      parent.postMessage({giscus:{resizeHeight:200}}, '*');
      addEventListener('message', event => {
        if (event.data?.giscus?.setConfig) document.body.dataset.theme = event.data.giscus.setConfig.theme;
      });
    </script>
  `}));
  // Real uPlot and Three loaders; only the model's network failure is controlled.
  let modelRequests = 0;
  await page.route('**/__checks/model.gltf', async route => {
    if (++modelRequests === 1) return route.fulfill({status:503,body:'Retry fixture'});
    const positions = Buffer.from(new Float32Array([-1,-1,0,1,-1,0,0,1,0]).buffer).toString('base64');
    await route.fulfill({contentType:'model/gltf+json',body:JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:`data:application/octet-stream;base64,${positions}`,byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-1,-1,0],max:[1,1,0]}]})});
  });
  await page.goto(new URL('__checks/audit/',base).href);
  await page.waitForSelector('.reader-enhancements:not([hidden])');
  assert.equal(await page.locator('#reader').getAttribute('data-mode'),'continuous');
  await page.locator('#section-4').scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.getElementById('section-4').scrollIntoView({block:'start', behavior:'instant'}));
  // DOM click avoids scrolling the toolbar into view before remembering the article position.
  await page.locator('button[data-mode="spread"]').evaluate(button=>(/** @type {HTMLElement} */ (button)).click());
  assert.ok(await page.locator('#section-4').isVisible());
  await page.setViewportSize({width:800,height:1000});
  await page.waitForFunction(()=>document.querySelector('#reader').dataset.mode==='continuous');
  await page.setViewportSize({width:1440,height:1000});
  await page.waitForFunction(()=>document.querySelector('#reader').dataset.mode==='spread');
  assert.ok(await page.locator('#section-4').isVisible());
  // Browser beforematch must reveal the right spread without losing live DOM.
  await page.locator('#section-0').evaluate(node=>node.closest('.story-page').dispatchEvent(new Event('beforematch')));
  assert.ok(await page.locator('#section-0').isVisible());
  await page.keyboard.press('Control+f');
  assert.equal(await page.locator('#reader').getAttribute('data-mode'),'continuous');
  await page.keyboard.press('Escape');
  await page.locator('#section-4').scrollIntoViewIfNeeded();
  const geometry = await page.evaluate(()=>({header:document.querySelector('.header').getBoundingClientRect().bottom,toolbar:document.querySelector('.reader-toolbar').getBoundingClientRect().top}));
  assert.ok(geometry.toolbar >= geometry.header-1,'reader toolbar must clear header');
  await page.getByRole('button',{name:'Mount scoped plot'}).click();
  await page.locator('.eng-plot:has-text("Scoped function") canvas').first().waitFor();
  assert.equal(await page.locator('.eng-plot-error').count(),0);
  await page.getByRole('button',{name:'Toggle hidden plot'}).click();
  await page.locator('[data-testid="hidden-plot"] canvas').first().waitFor();
  await page.locator('.eng-viewer').scrollIntoViewIfNeeded();
  await page.locator('.eng-viewer [role="alert"]').waitFor();
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.eng-viewer-toolbar button').disabled);
  assert.equal(modelRequests,2);
  assert.equal(await page.locator('.eng-viewer-toolbar button').count(),2);
  assert.equal(await page.locator('.eng-viewer canvas').count(),1);
  await page.getByRole('button',{name:'Fit view',exact:true}).click();
  const mdx = page.locator('[data-testid="mdx-fixture"]');
  await mdx.getByRole('button',{name:'Force'}).focus();
  await page.keyboard.press('Enter');
  assert.equal(await mdx.locator('th[aria-sort="ascending"]').count(),1);
  assert.match(await mdx.locator('tbody tr').first().innerText(),/A/);
  assert.equal(await mdx.locator('select').inputValue(),'2');
  const heatmap = mdx.locator('.eng-heatmap-canvas');
  await heatmap.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  assert.match(await mdx.locator('.mdx-heatmap-readout').innerText(),/No measurement/);
  await mdx.locator('.eng-scatter-plot-container canvas').first().scrollIntoViewIfNeeded();
  await mdx.locator('.eng-scatter-plot-container canvas').first().waitFor();
  assert.equal(await mdx.locator('[role="alert"]').count(),0);
  await mdx.getByRole('button',{name:'Hide Code'}).click();
  assert.equal(await mdx.locator('.eng-cell-toggle-btn').getAttribute('aria-expanded'),'false');
  await page.locator('[data-comments]').scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'Retry discussion'}).waitFor();
  await page.getByRole('button',{name:'Retry discussion'}).click();
  await page.locator('iframe.giscus-frame').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-comments-status]').textContent==='');
  assert.equal(commentRequests,2);
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await page.frameLocator('iframe.giscus-frame').locator('body[data-theme="dark_dimmed"]').waitFor();
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';});
  await page.frameLocator('iframe.giscus-frame').locator('body[data-theme="light"]').waitFor();
  await page.goto(base);
  assert.ok(await page.locator('canvas.technical-surface').count()<=1);
  await page.goto(new URL('projects/',base).href);
  assert.equal(await page.locator('canvas.technical-surface').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Browser regressions passed.');
} finally { await browser.close(); }
