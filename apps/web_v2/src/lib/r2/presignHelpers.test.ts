import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildR2ObjectKey,
  extensionForUpload,
  isAllowedR2ContentType,
  maxBytesForContentType,
  normalizeR2ContentType,
  sanitizeUploadFilename,
} from './presignHelpers';

describe('r2 presignHelpers', () => {
  it('allows expected MIME types', () => {
    assert.equal(isAllowedR2ContentType('image/jpeg'), true);
    assert.equal(isAllowedR2ContentType('video/mp4'), true);
    assert.equal(isAllowedR2ContentType('application/pdf'), false);
  });

  it('normalizes codec params before allowlist compare', () => {
    assert.equal(normalizeR2ContentType('video/mp4;codecs=avc1'), 'video/mp4');
    assert.equal(
      normalizeR2ContentType('video/webm;codecs=vp8,opus'),
      'video/webm',
    );
    assert.equal(normalizeR2ContentType('image/jpg'), 'image/jpeg');
    assert.equal(isAllowedR2ContentType('video/mp4;codecs=avc1'), true);
    assert.equal(isAllowedR2ContentType('video/mp4; codecs=avc1.42E01E'), true);
    assert.equal(isAllowedR2ContentType('video/unknown;codecs=x'), false);
  });

  it('enforces photo vs video size caps', () => {
    assert.equal(maxBytesForContentType('image/png'), 15 * 1024 * 1024);
    assert.equal(maxBytesForContentType('video/mp4'), 100 * 1024 * 1024);
    assert.equal(
      maxBytesForContentType('video/mp4;codecs=avc1'),
      100 * 1024 * 1024,
    );
  });

  it('rejects path segments in filenames', () => {
    assert.equal(sanitizeUploadFilename('../../etc/passwd'), 'passwd');
    assert.equal(sanitizeUploadFilename(''), null);
    assert.equal(sanitizeUploadFilename('nice.jpg'), 'nice.jpg');
  });

  it('builds ownership-prefixed keys from normalized type', () => {
    const key = buildR2ObjectKey({
      authUserId: 'user-1',
      kind: 'posts',
      filename: 'shot.JPEG',
      contentType: 'image/jpeg',
    });
    assert.match(key, /^user-1\/posts\/\d+-[a-z0-9]+\.jpg$/);
    const pageKey = buildR2ObjectKey({
      authUserId: 'user-1',
      kind: 'pages',
      filename: 'logo.png',
      contentType: 'image/png',
    });
    assert.match(pageKey, /^user-1\/pages\/\d+-[a-z0-9]+\.png$/);
    assert.equal(extensionForUpload('a.webp', 'image/webp'), 'webp');
    assert.equal(
      extensionForUpload('video', 'video/mp4;codecs=avc1'),
      'mp4',
    );
    assert.equal(
      extensionForUpload('video', 'video/webm;codecs=vp9,opus'),
      'webm',
    );
  });
});
