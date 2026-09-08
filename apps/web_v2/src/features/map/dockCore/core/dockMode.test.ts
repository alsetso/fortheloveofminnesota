/**
 * DockMode selector tests — run with:
 *   npx --yes tsx --test src/features/map/explore/dockMode.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveDockMode } from './dockMode';

describe('resolveDockMode', () => {
  it('prioritizes overlay sheets over card/snap', () => {
    assert.equal(
      resolveDockMode({
        snap: 'full',
        dockCardOpen: true,
        contactsSheetOpen: true,
        createPostSheetOpen: false,
      }),
      'overlay',
    );
    assert.equal(
      resolveDockMode({
        snap: 'collapsed',
        dockCardOpen: false,
        contactsSheetOpen: false,
        createPostSheetOpen: true,
      }),
      'overlay',
    );
  });

  it('returns card whenever a dock card owns the sheet', () => {
    assert.equal(
      resolveDockMode({
        snap: 'half',
        dockCardOpen: true,
        contactsSheetOpen: false,
        createPostSheetOpen: false,
      }),
      'card',
    );
  });

  it('maps snap detents to hidden/peek/browse', () => {
    assert.equal(
      resolveDockMode({
        snap: 'collapsed',
        dockCardOpen: false,
        contactsSheetOpen: false,
        createPostSheetOpen: false,
      }),
      'hidden',
    );
    assert.equal(
      resolveDockMode({
        snap: 'quarter',
        dockCardOpen: false,
        contactsSheetOpen: false,
        createPostSheetOpen: false,
      }),
      'peek',
    );
    assert.equal(
      resolveDockMode({
        snap: 'half',
        dockCardOpen: false,
        contactsSheetOpen: false,
        createPostSheetOpen: false,
      }),
      'browse',
    );
    assert.equal(
      resolveDockMode({
        snap: 'full',
        dockCardOpen: false,
        contactsSheetOpen: false,
        createPostSheetOpen: false,
      }),
      'browse',
    );
  });
});
