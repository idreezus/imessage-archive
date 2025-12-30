# Electron Video Streaming with Custom Protocols

## Problem

Serving video files via `protocol.handle()` fails with `FFmpegDemuxer: data source error` even when range requests are handled correctly.

## Solution

Three elements must work together:

```typescript
// 1. Register scheme with ALL required privileges (before app.whenReady)
protocol.registerSchemesAsPrivileged([{
  scheme: "attachment",
  privileges: {
    standard: true,        // Required for Chromium's media pipeline
    secure: true,
    supportFetchAPI: true,
    stream: true,          // Required for video/audio streaming
    bypassCSP: true,
  },
}]);

// 2. Use net.fetch with pathToFileURL (inside protocol.handle)
protocol.handle("attachment", async (request) => {
  const filePath = extractPathFromUrl(request.url);
  return net.fetch(pathToFileURL(filePath).toString());
});
```

## Why Each Piece Matters

| Privilege | Purpose |
|-----------|---------|
| `standard: true` | Chromium's `MultibufferDataSource` expects RFC 3986 URL parsing |
| `stream: true` | Tells `blink::WebMediaPlayerImpl` the protocol supports streaming |
| `net.fetch()` | Integrates with Chromium's network stack; manual `Response` objects don't |

## Common Pitfall: IP Normalization

With `standard: true`, numeric URL paths get normalized as IP addresses:
- `attachment://42/file.mp4` → `attachment://0.0.0.42/file.mp4`

**Fix:** Add a non-numeric prefix to URLs:
- `attachment://file/42/file.mp4` (won't be normalized)

## What Doesn't Work

| Approach | Result |
|----------|--------|
| `Response(buffer, { headers })` | FFmpegDemuxer error |
| `Response(Readable.toWeb(stream))` | FFmpegDemuxer error |
| Missing `standard: true` | FFmpegDemuxer error |
| Missing `stream: true` | FFmpegDemuxer error |
| `net.fetch` without proper privileges | FFmpegDemuxer error |

## References

- [Electron Protocol API](https://www.electronjs.org/docs/latest/api/protocol)
- [Issue #38749 - Video seeking bug](https://github.com/electron/electron/issues/38749)
- [PR #22955 - Stream protocol fix](https://github.com/electron/electron/pull/22955)
