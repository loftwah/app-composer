import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual Astro enhancement. This is a controller check, not a
// claim of browser layout, screen-reader or physical-device acceptance.
const source = readFileSync(new URL('../src/components/HeroShowcase.astro', import.meta.url), 'utf8');
const controller = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const js = ts.transpileModule(controller, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const ids = ['paperwork', 'ldraw', 'analytics'];
function fixture(hash = '', reduced = false) {
  let focused;
  const element = (dataset = {}) => {
    const attributes = new Map(), listeners = {}, classes = new Set(), styles = new Map();
    return { dataset, attributes, listeners, classes, styles, hidden: false, tabIndex: 0,
      classList: { add: (name) => classes.add(name), toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
      style: { setProperty: (name, value) => styles.set(name, value), removeProperty: (name) => styles.delete(name) },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 540 }),
      setAttribute: (name, value) => attributes.set(name, value),
      addEventListener: (name, callback) => { listeners[name] = callback; },
      focus() { focused = this; },
      trigger(type, values = {}) {
        const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values };
        listeners[type]?.(event);
        return event;
      },
    };
  };
  const list = element();
  const choices = ids.map((id) => ({ ...element({ heroChoice: id }), hash: `#hero-panel-${id}` }));
  const panels = ids.map((id) => element({ heroPanel: id }));
  const artwork = ids.map((id) => element({ heroArt: id }));
  const scene = element();
  scene.querySelector = () => element();
  const motionListeners = {};
  const motion = { matches: !reduced, addEventListener: (name, callback) => { motionListeners[name] = callback; } };
  const reducedMotion = { matches: reduced };
  let observer;
  class Observer {
    constructor(callback) { this.callback = callback; observer = this; this.disconnected = false; }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  const hero = {
    querySelector: (selector) => selector === '[data-hero-scene]' ? scene : list,
    querySelectorAll: (selector) => selector === '[data-hero-choice]' ? choices : selector === '[data-hero-panel]' ? panels : artwork,
  };
  new Function('document', 'window', 'matchMedia', 'IntersectionObserver', js)(
    { querySelector: () => hero }, { location: { hash }, IntersectionObserver: Observer },
    (query) => query === '(prefers-reduced-motion: reduce)' ? reducedMotion : motion, Observer,
  );
  return { list, choices, panels, artwork, scene, motion, motionListeners, observer, focused: () => focused };

}
function selected(f, id) {
  assert.deepEqual(f.choices.map((choice) => choice.attributes.get('aria-selected')), ids.map((value) => String(value === id)));
  assert.deepEqual(f.choices.map((choice) => choice.tabIndex), ids.map((value) => value === id ? 0 : -1));
  assert.deepEqual(f.panels.map((panel) => panel.hidden), ids.map((value) => value !== id));
  assert.deepEqual(f.artwork.map((art) => art.classes.has('is-spotlit')), ids.map((value) => value === id));
}

test('spotlights start on Paperwork, switch repeatedly and preserve tab semantics', () => {
  const f = fixture();
  selected(f, 'paperwork');
  assert.equal(f.list.attributes.get('role'), 'tablist');
  f.choices.forEach((choice, index) => {
    assert.equal(choice.attributes.get('role'), 'tab');
    assert.equal(choice.attributes.get('aria-controls'), `hero-panel-${ids[index]}`);
    assert.equal(f.panels[index].attributes.get('role'), 'tabpanel');
    assert.equal(f.panels[index].attributes.get('aria-labelledby'), `hero-choice-${ids[index]}`);
    assert.equal(f.panels[index].tabIndex, 0);
  });
  for (const index of [2, 1, 1, 0, 2]) {
    assert.equal(f.choices[index].trigger('click').defaultPrevented, true);
    selected(f, ids[index]);
  }
});

test('keyboard navigation wraps, moves focus, and supports Home, End and Space', () => {
  const f = fixture();
  f.choices[0].trigger('keydown', { key: 'ArrowLeft' });
  selected(f, 'analytics');
  assert.equal(f.focused(), f.choices[2]);
  f.choices[2].trigger('keydown', { key: 'ArrowRight' });
  selected(f, 'paperwork');
  f.choices[0].trigger('keydown', { key: 'End' });
  selected(f, 'analytics');
  f.choices[2].trigger('keydown', { key: 'Home' });
  selected(f, 'paperwork');
  assert.equal(f.choices[1].trigger('keydown', { key: ' ' }).defaultPrevented, true);
  selected(f, 'ldraw');
  assert.equal(f.choices[1].trigger('keydown', { key: 'Tab' }).defaultPrevented, false);
  assert.equal(f.choices[1].trigger('keydown', { key: 'Escape' }).defaultPrevented, false);
});

test('direct links select their panel; no-JavaScript copy stays available with real destinations', () => {
  selected(fixture('#hero-panel-analytics'), 'analytics');
  selected(fixture('#something-else'), 'paperwork');
  assert.ok(source.includes('href={`#hero-panel-${spotlight.id}`}'));
  assert.ok(!source.match(/<section[^>]*data-hero-panel[^>]*\shidden[\s=>]/));
  assert.ok(source.includes("href: '/activity'"));
  assert.ok(source.includes("apps.find((app) => app.id === 'paperwork')!.href"));
  assert.ok(source.includes("apps.find((app) => app.id === 'ldraw')!.href"));
  assert.ok(source.includes('@media (prefers-reduced-motion: no-preference)'));
  assert.ok(!controller.match(/\b(fetch|localStorage|sessionStorage)\b/));
});


test('pointer depth is bounded, resets on exit/cancel and stops when motion preferences change', () => {
  const f = fixture();
  f.scene.trigger('pointermove', { pointerType: 'touch', clientX: 600, clientY: 540 });
  assert.equal(f.scene.styles.size, 0);
  f.scene.trigger('pointermove', { pointerType: 'mouse', clientX: 900, clientY: 900 });
  assert.equal(f.scene.styles.get('--studio-pitch'), '-4.5deg');
  assert.equal(f.scene.styles.get('--studio-yaw'), '6deg');
  f.scene.trigger('pointerleave');
  assert.equal(f.scene.styles.size, 0);
  f.scene.trigger('pointermove', { pointerType: 'mouse', clientX: 0, clientY: 0 });
  f.scene.trigger('pointercancel');
  assert.equal(f.scene.styles.size, 0);
  f.scene.trigger('pointermove', { pointerType: 'mouse', clientX: 0, clientY: 0 });
  f.motion.matches = false;
  f.motionListeners.change();
  f.scene.trigger('pointermove', { pointerType: 'mouse', clientX: 600, clientY: 540 });
  assert.equal(f.scene.styles.size, 0);
});

test('arrival is finite and reduced motion keeps the resting assembly usable', () => {
  const f = fixture();
  f.observer.callback([{ isIntersecting: false }]);
  assert.equal(f.scene.classes.has('has-arrived'), false);
  f.observer.callback([{ isIntersecting: true }]);
  assert.equal(f.scene.classes.has('has-arrived'), true);
  assert.equal(f.observer.disconnected, true);
  const reduced = fixture('', true);
  assert.equal(reduced.observer, undefined);
  reduced.scene.trigger('pointermove', { pointerType: 'mouse', clientX: 600, clientY: 540 });
  assert.equal(reduced.scene.styles.size, 0);
  reduced.choices[2].trigger('click');
  selected(reduced, 'analytics');
});
