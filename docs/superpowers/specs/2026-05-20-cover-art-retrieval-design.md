# Cover Art Retrieval from Music Server Design Specification

This document details the design for retrieving cover art when streaming music from the Music Server (DLNA/USB) on Onkyo receivers like the CR-N775.

## Overview
While the eISCP protocol supports a command `NJA` for retrieving jacket art, it is often unsupported or unreliable during Music Server streaming. Instead, the receiver hosts the current cover art on its built-in web server at `/album_art.cgi`.

However, the raw response from `album_art.cgi` includes three proprietary metadata header lines prepended to the binary image data. This design spec outlines a backend-driven approach to periodically check this endpoint when a song starts playing on a network or USB input, strip the headers, cache the clean image, and serve it via `/cover-art`.

---

## 1. Header Stripping Logic
The response from `album_art.cgi` contains non-standard headers at the beginning, typically looking like this:
```
[Header Line 1]
[Header Line 2]
[Header Line 3]
[Binary Image Data]
```
To obtain a valid image (JPEG, PNG, or BMP) without corruption, we must strip these headers programmatically in the service.

### Algorithm
1. Read the HTTP response body as a Node.js `Buffer`.
2. Locate the start of the actual image data:
   * **Magic Byte Signatures:** Scan the buffer for the first occurrence of:
     * JPEG: `[0xFF, 0xD8]`
     * PNG: `[0x89, 0x50, 0x4E, 0x47]`
     * BMP: `[0x42, 0x4D]`
   * **Newline Fallback:** If no known image signature is found, locate the index of the third newline byte (`0x0A`, `\n`) within the first 500 bytes.
3. Slice the buffer:
   * If a magic byte signature is found, slice the buffer starting at its index.
   * If a newline fallback is used, slice immediately after the third newline.
   * If neither is found, fallback to the raw response buffer.

---

## 2. Background Polling & Retry Mechanism
Since the receiver's internal CGI endpoint may take 500ms–1.5s to update after metadata change commands (`NTI`, `NAT`) are broadcast via eISCP, the backend service will handle the fetch in the background with retry logic.

### Flow
1. **Trigger:** The backend service subscribes to state store notifications. When the active input is `net` or `usb` and the track `title` changes to a non-empty string, a background fetch is scheduled.
2. **Timing & Retries:**
   * Wait **1000ms** before performing the first fetch.
   * If the fetch fails (connection issue or a non-200/404 response), retry up to **2 times** with exponential backoff (+2000ms, then +4000ms).
   * Abort the active retry chain if the track title or input changes during the process to avoid race conditions.
3. **State Integration:**
   * If the fetch succeeds, cache the cleaned binary image in memory.
   * Update the state store: `store.setCoverArt('/cover-art?t=' + Date.now())`.
   * If all retries fail, or if the input switches away from `net`/`usb`, clear the cover art: `store.setCoverArt(undefined)`.

---

## 3. Mock Mode Support
To allow offline verification and testing:
* When `config.MOCK_MODE` is true, a change in title immediately sets `coverArtUrl = '/cover-art?t=' + Date.now()`.
* The `/cover-art` route will serve a hardcoded, high-quality base64 mock JPEG image.

---

## 4. Verification Plan
* **Unit Tests (`server.test.ts`):**
  * Validate header stripping with mock inputs (3-line header + JPEG, JPEG only, PNG, BMP).
  * Verify that `/cover-art` returns the mock image in Mock Mode.
  * Verify that state changes trigger setting the `coverArtUrl` in Mock Mode.
* **Manual Verification:**
  * Run the app in development mode, trigger track changes in Mock Mode, and verify the frontend updates to show the mock cover artwork.
