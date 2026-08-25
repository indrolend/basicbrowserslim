import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function filesBelow(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...await filesBelow(path));
    else found.push(path);
  }
  return found;
}

test('all runtime JavaScript is valid ES-module source without conflict markers', async () => {
  const files = [resolve(root, 'main.js'), ...await filesBelow(resolve(root, 'js'))]
    .filter((path) => path.endsWith('.js'));

  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /^(?:<<<<<<<|=======|>>>>>>>)/m, relative(root, path));
    const parsed = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: source,
      encoding: 'utf8',
    });
    assert.equal(parsed.status, 0, `${relative(root, path)}\n${parsed.stderr}`);
  }
});

test('section and item identities are unique and every image hero exists', async () => {
  globalThis.window = {};
  const { SPA_SECTIONS, getSection, getItem, getHeroSpec } = await import('../js/spa/spaData.js');

  assert.ok(SPA_SECTIONS.length > 1);
  assert.equal(new Set(SPA_SECTIONS.map(({ id }) => id)).size, SPA_SECTIONS.length);

  for (const [sectionIndex, section] of SPA_SECTIONS.entries()) {
    assert.equal(getSection(sectionIndex), section);
    assert.ok(section.items.length > 0, section.id);
    assert.equal(new Set(section.items.map(({ id }) => id)).size, section.items.length, section.id);

    for (const [itemIndex, item] of section.items.entries()) {
      assert.equal(getItem(sectionIndex, itemIndex), item);
      const hero = getHeroSpec(sectionIndex, itemIndex);
      assert.ok(hero.kind === 'text' || hero.kind === 'image', `${section.id}/${item.id}`);
      if (hero.kind === 'image') {
        assert.equal(existsSync(resolve(root, hero.src)), true, hero.src);
      }
    }
  }
});
