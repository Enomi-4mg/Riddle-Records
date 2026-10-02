import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { Window } from "happy-dom";
const script = fs.readFileSync(new URL("../../script.js", import.meta.url), "utf8");
test("site navigation synchronizes inert, overlay, focus, Escape and page transitions", () => {
  const window = new Window({ url: "https://example.com/" });
  window.document.body.innerHTML = '<button class="menu_toggle"></button><div class="sidebar-overlay" hidden></div><nav class="sidebar" inert><button class="sidebar-close">close</button><a href="/works/">Works</a></nav>';
  const context = vm.createContext({ window, document: window.document, Element: window.Element, navigator: window.navigator, console, setTimeout, URL, IntersectionObserver: class { observe() {} unobserve() {} } });
  vm.runInContext(script, context);
  const trigger = window.document.querySelector('.menu_toggle'), sidebar = window.document.querySelector('.sidebar');
  trigger.click();
  assert.equal(trigger.getAttribute('aria-expanded'), 'true'); assert.equal(sidebar.inert, false);
  assert.equal(window.document.querySelector('.sidebar-overlay').hidden, false);
  assert.equal(window.document.activeElement.className, 'sidebar-close');
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(sidebar.inert, true); assert.equal(window.document.activeElement, trigger);
  trigger.click(); window.document.querySelector('.sidebar-overlay').click(); assert.equal(sidebar.inert, true);
  trigger.click(); window.document.dispatchEvent(new window.Event('astro:page-load')); assert.equal(sidebar.inert, true);
  window.happyDOM.abort();
});

test("scroll enhancement keeps content visible with no observer or reduced motion", () => {
  for (const reduced of [false, true]) {
    const window = new Window({ url: "https://example.com/" });
    window.document.body.innerHTML = '<main><h1>Visible title</h1><p>Readable text</p></main>';
    window.matchMedia = () => ({ matches: reduced, addEventListener() {} });
    vm.runInContext(script, vm.createContext({ window, document: window.document, Element: window.Element, navigator: window.navigator, console, setTimeout, URL }));
    assert.equal(window.document.querySelector('p').style.opacity, '');
    assert.equal(window.document.querySelector('p').className, '');
    window.happyDOM.abort();
  }
});
