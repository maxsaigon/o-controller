# CR-N775 Artwork and Audio Format Support

## Cover Artwork

**Current Status:** Unknown / Unverified
**Recommendation:** Use Placeholder Fallback

While the eISCP protocol supports a command `NJA` for retrieving jacket art (album cover), its behavior is often inconsistent across different Onkyo models. Some models provide a direct URL to a locally hosted image (e.g., via DLNA or a built-in web server), while others send binary image data through multiple packets, which requires complex buffering and decoding. Without access to a physical CR-N775 to verify how it implements `NJA` during Network, USB, or CD playback, we cannot guarantee reliable artwork extraction.

Therefore, for this iteration, we will rely on a high-quality placeholder image that matches the Onkyo Hi-res player aesthetic. This limitation is intentional to ensure stability.

## Audio Format (Sample Rate, Bit Depth, Codec)

**Current Status:** Unknown / Unverified
**Recommendation:** Keep UI hidden/fallback

The eISCP protocol often exposes format details through commands like `NFI` (Network Format Info) or similar variants. However, the exact command and format of the response (e.g., `FLAC / 48kHz / 24bit`) varies significantly by input source (NET vs. USB vs. CD) and firmware version. Until we can capture real responses from a CR-N775, we will add the optional fields (`format`, `sampleRate`, `bitDepth`) to our shared data contract (`NowPlayingMeta`), but leave them empty in the service implementation.

The UI should gracefully hide these fields when data is unavailable.
