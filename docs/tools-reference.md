# Tools Reference

ClipChat exposes 20 FFmpeg operations as tools. Each tool accepts a JSON input object and returns either structured data or the path to an output file.

**Usage:** Submit via `POST /api/v1/jobs` with `{ "tool": "<name>", "input": { ... } }`, or via `POST /api/v1/tools/<name>` with just the input object.

All file paths (`input_file`, `audio_file`) must be absolute server paths — either from the `path` field of an uploaded file or a path accessible to the server process.

---

## 1. `get_video_info`

Extract metadata from a video or audio file using ffprobe.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input_file` | string | Yes | Absolute path to the video/audio file |

**Output (job.output):**
```json
{
  "duration": 120.5,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "codec": "h264",
  "audio_codec": "aac",
  "size_bytes": 52428800,
  "bitrate": 3478000
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/tools/get_video_info \
  -H "Authorization: Bearer clp_..." \
  -H "Content-Type: application/json" \
  -d '{ "input_file": "/uploads/video.mp4" }'
```

---

## 2. `trim_video`

Cut a video between two time positions using stream copy (fast, no re-encode).

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "start_time": "10",
  "end_time": "30",
  "output_format": "mp4"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `start_time` | string | Yes | — | Start position in seconds or `HH:MM:SS` format |
| `end_time` | string | Yes | — | End position in seconds or `HH:MM:SS` format |
| `output_format` | string | No | Same as input | Output container format (mp4, mov, etc.) |

**Output (job.output):** Path to trimmed file (string).

**Example — trim seconds 10 to 30:**
```bash
curl -X POST http://localhost:3000/api/v1/tools/trim_video \
  -H "Authorization: Bearer clp_..." \
  -H "Content-Type: application/json" \
  -d '{
    "input_file": "/uploads/video.mp4",
    "start_time": "10",
    "end_time": "30"
  }'
```

**Example — using timestamp format:**
```json
{
  "input_file": "/uploads/video.mp4",
  "start_time": "00:01:30",
  "end_time": "00:02:00"
}
```

---

## 3. `merge_clips`

Concatenate multiple video clips. With `transition: "none"` uses stream copy (fast). With `fade` or `crossfade` re-encodes with the xfade filter.

**Input:**
```json
{
  "input_files": ["/path/clip1.mp4", "/path/clip2.mp4"],
  "transition": "none",
  "transition_duration": 0.5
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_files` | string[] | Yes | — | At least 2 video paths to concatenate in order |
| `transition` | string | No | `"none"` | Transition type (see below) |
| `transition_duration` | number | No | `0.5` | Duration of transition in seconds (ignored for `"none"`) |

**Output (job.output):** Path to merged file (string).

**Transition options:**

| Category | Values |
|----------|--------|
| None | `none` |
| Fades | `fade`, `crossfade`, `fadeblack`, `fadewhite` |
| Slides | `slideleft`, `slideright`, `slideup`, `slidedown` |
| Wipes | `wipeleft`, `wiperight`, `wipeup`, `wipedown` |
| Special | `dissolve`, `pixelize`, `zoomin`, `circleopen`, `circleclose` |

**Example — fast concat:**
```json
{
  "input_files": ["/uploads/intro.mp4", "/uploads/main.mp4", "/uploads/outro.mp4"],
  "transition": "none"
}
```

**Example — slide transition:**
```json
{
  "input_files": ["/uploads/a.mp4", "/uploads/b.mp4"],
  "transition": "slideleft",
  "transition_duration": 0.8
}
```

**Note:** Any transition other than `"none"` requires re-encoding. All clips should have the same resolution and frame rate.

---

## 4. `resize_video`

Change video dimensions using a preset or explicit width/height. Uses the `scale` filter.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "preset": "720p",
  "pad": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `width` | integer | No | — | Output width in pixels |
| `height` | integer | No | — | Output height in pixels |
| `preset` | string | No | — | Preset name (see below) |
| `pad` | boolean | No | `false` | Add black bars instead of cropping |

Provide either `preset` OR `width`/`height` (at least one dimension).

**Presets:**

| Preset | Resolution |
|--------|------------|
| `720p` | 1280×720 |
| `1080p` | 1920×1080 |
| `4k` | 3840×2160 |
| `square` | 1080×1080 |
| `9:16` | 1080×1920 |
| `16:9` | 1920×1080 |

**Output (job.output):** Path to resized file (string).

**Example — resize to 720p:**
```json
{
  "input_file": "/uploads/video.mp4",
  "preset": "720p"
}
```

**Example — custom dimensions with padding:**
```json
{
  "input_file": "/uploads/video.mp4",
  "width": 1080,
  "height": 1080,
  "pad": true
}
```

---

## 5. `extract_audio`

Extract the audio track from a video file.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "format": "mp3",
  "quality": "medium"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `format` | string | No | `"mp3"` | Output format: `"mp3"`, `"aac"`, `"wav"` |
| `quality` | string | No | `"medium"` | Bitrate preset: `"low"` (128k), `"medium"` (192k), `"high"` (320k) |

**Output (job.output):** Path to audio file (string).

**Example:**
```json
{
  "input_file": "/uploads/video.mp4",
  "format": "mp3",
  "quality": "high"
}
```

---

## 6. `replace_audio`

Replace or mix the audio track in a video.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "audio_file": "/path/to/music.mp3",
  "mix": false,
  "audio_volume": 1.0,
  "original_volume": 0.0
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `audio_file` | string | Yes | — | New audio file to use |
| `mix` | boolean | No | `false` | Mix both tracks together (true) or replace (false) |
| `audio_volume` | number | No | `1.0` | Volume of the new audio track (0–2) |
| `original_volume` | number | No | `0.0` | Volume of the original audio track (0–2, only used when `mix: true`) |

**Output (job.output):** Path to output video (string).

**Example — replace audio completely:**
```json
{
  "input_file": "/uploads/video.mp4",
  "audio_file": "/uploads/music.mp3",
  "mix": false
}
```

**Example — mix background music at 30%:**
```json
{
  "input_file": "/uploads/video.mp4",
  "audio_file": "/uploads/music.mp3",
  "mix": true,
  "original_volume": 1.0,
  "audio_volume": 0.3
}
```

---

## 7. `add_text_overlay`

Burn text into the video using the `drawtext` FFmpeg filter.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "text": "Hello World",
  "start_time": "2",
  "end_time": "8",
  "position": { "x": "(w-text_w)/2", "y": "h-text_h-20" },
  "style": {
    "font": "Arial",
    "size": 36,
    "color": "white",
    "background_color": "black@0.5"
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `text` | string | Yes | — | Text to display |
| `start_time` | string | No | — | When text appears (seconds) |
| `end_time` | string | No | — | When text disappears (seconds) |
| `position.x` | string | No | `"(w-text_w)/2"` | X position (FFmpeg expression) |
| `position.y` | string | No | `"h-text_h-20"` | Y position (FFmpeg expression) |
| `style.font` | string | No | `"Arial"` | Font name |
| `style.size` | number | No | `24` | Font size in pixels |
| `style.color` | string | No | `"white"` | Font color (name or hex) |
| `style.background_color` | string | No | — | Background box color (e.g., `"black@0.5"`) |

**Output (job.output):** Path to video with text (string).

**Position expressions** use FFmpeg variables: `w` (video width), `h` (video height), `text_w` (text width), `text_h` (text height).

**Example — centered subtitle-style text:**
```json
{
  "input_file": "/uploads/video.mp4",
  "text": "Chapter 1",
  "start_time": "0",
  "end_time": "5",
  "style": { "size": 48, "color": "yellow" }
}
```

---

## 8. `add_subtitles`

Add an SRT subtitle file to a video — burned in (hardcoded) or as a soft track.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "subtitle_source": "/path/to/subtitles.srt",
  "style": {
    "font_size": 24,
    "font_color": "#FFFFFF",
    "position": "bottom"
  },
  "burn_in": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `subtitle_source` | string | Yes | — | Path to `.srt` file |
| `burn_in` | boolean | No | `true` | Burn subtitles into video (`true`) or add as soft track (`false`) |
| `style.font_size` | number | No | — | Font size |
| `style.font_color` | string | No | — | Font color (hex, e.g., `"#FFFFFF"`) |
| `style.position` | string | No | `"bottom"` | `"bottom"`, `"top"`, or `"center"` |

**Output (job.output):** Path to video with subtitles (string).

**Example:**
```json
{
  "input_file": "/uploads/video.mp4",
  "subtitle_source": "/uploads/captions.srt",
  "burn_in": true,
  "style": { "font_size": 28 }
}
```

**Note:** Burned-in subtitles require FFmpeg to be compiled with `libass`. The Docker image includes this by default.

---

## 9. `change_speed`

Speed up or slow down a video. Adjusts both video and audio.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "speed_factor": 2.0,
  "preserve_audio_pitch": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `speed_factor` | number | Yes | — | Playback speed multiplier: `0.25`–`4.0` (2.0 = 2× speed) |
| `preserve_audio_pitch` | boolean | No | `true` | Use `atempo` to keep audio pitch correct |

**Output (job.output):** Path to speed-adjusted video (string).

**Examples:**
- `0.5` — slow motion (half speed)
- `1.5` — 1.5× speed
- `2.0` — double speed
- `4.0` — 4× timelapse

**Note:** `speed_factor` outside `0.5–2.0` chains multiple `atempo` filters automatically to stay within FFmpeg's supported range.

**Example:**
```json
{
  "input_file": "/uploads/video.mp4",
  "speed_factor": 0.5,
  "preserve_audio_pitch": true
}
```

---

## 10. `export_video`

Re-encode a video with a specific codec, quality level, or target file size.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "format": "mp4",
  "codec": "h264",
  "quality": "medium",
  "target_size_mb": 10,
  "resolution": "1280x720"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `format` | string | Yes | — | Output container: `"mp4"`, `"webm"`, `"mov"`, `"gif"` |
| `codec` | string | No | `"h264"` | Video codec: `"h264"`, `"h265"`, `"vp9"`, `"av1"` |
| `quality` | string | No | `"medium"` | CRF preset: `"low"` (CRF 35), `"medium"` (CRF 23), `"high"` (CRF 18), `"lossless"` (CRF 0) |
| `target_size_mb` | number | No | — | Target output file size in MB (uses bitrate targeting) |
| `resolution` | string | No | — | Resize during export, e.g., `"1280x720"` |

**Output (job.output):** Path to exported file (string).

**Codec compatibility:**
| Codec | Format |
|-------|--------|
| `h264` | mp4, mov |
| `h265` | mp4, mov |
| `vp9` | webm |
| `av1` | webm, mp4 |

**Example — compress for web:**
```json
{
  "input_file": "/uploads/video.mp4",
  "format": "mp4",
  "codec": "h264",
  "quality": "high"
}
```

**Example — target 10MB file:**
```json
{
  "input_file": "/uploads/video.mp4",
  "format": "mp4",
  "target_size_mb": 10
}
```

**Example — convert to WebM:**
```json
{
  "input_file": "/uploads/video.mp4",
  "format": "webm",
  "codec": "vp9",
  "quality": "medium"
}
```

---

## 11. `crop_video`

Crop a video to a specific region or use a smart preset that centers the crop automatically.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "preset": "square_center"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `preset` | string | No | — | Smart crop preset (see below) — takes priority over width/height |
| `width` | integer | No | — | Crop width in pixels (required if no preset) |
| `height` | integer | No | — | Crop height in pixels (required if no preset) |
| `x` | integer | No | `0` | Crop origin X (ignored when preset is set) |
| `y` | integer | No | `0` | Crop origin Y (ignored when preset is set) |

**Presets:**

| Preset | Description |
|--------|-------------|
| `square_center` | Crops the largest centered square (min of width and height) |
| `portrait_center` | Crops a 9:16 portrait region centered horizontally |
| `landscape_center` | Crops a 16:9 landscape region centered vertically |

**Output (job.output):** Path to cropped file (string). Audio is copied unchanged.

**Example — square crop for Instagram:**
```json
{
  "input_file": "/uploads/video.mp4",
  "preset": "square_center"
}
```

**Example — manual crop region:**
```json
{
  "input_file": "/uploads/video.mp4",
  "width": 640,
  "height": 360,
  "x": 320,
  "y": 180
}
```

---

## 12. `rotate_flip`

Rotate a video by 90/180/270 degrees and/or flip it horizontally or vertically.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "rotation": 90,
  "flip": "horizontal"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `rotation` | number | No | — | Degrees clockwise: `90`, `180`, or `270` |
| `flip` | string | No | — | `"horizontal"`, `"vertical"`, or `"both"` |

At least one of `rotation` or `flip` should be set. Both can be combined (rotation is applied first).

**Output (job.output):** Path to transformed file (string). Audio is copied unchanged.

**Example — rotate a portrait video to landscape:**
```json
{
  "input_file": "/uploads/video.mp4",
  "rotation": 90
}
```

**Example — mirror horizontally:**
```json
{
  "input_file": "/uploads/video.mp4",
  "flip": "horizontal"
}
```

---

## 13. `color_adjust`

Adjust the color and tone of a video using FFmpeg's `eq` and `hue` filters.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "brightness": 0.1,
  "contrast": 1.2,
  "saturation": 1.5,
  "gamma": 1.0,
  "hue": 0
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `brightness` | number | No | — | Brightness offset: `-1.0` (black) to `1.0` (white), `0` = no change |
| `contrast` | number | No | — | Contrast multiplier: `0` to `2.0`, `1.0` = no change |
| `saturation` | number | No | — | Saturation multiplier: `0` (grayscale) to `3.0`, `1.0` = no change |
| `gamma` | number | No | — | Gamma curve: `0.1` to `10.0`, `1.0` = no change |
| `hue` | number | No | — | Hue rotation in degrees: `-180` to `180`, `0` = no change |

At least one field should be set. Only specified fields are applied.

**Output (job.output):** Path to color-adjusted file (string). Audio is copied unchanged.

**Example — brighten and boost saturation:**
```json
{
  "input_file": "/uploads/video.mp4",
  "brightness": 0.1,
  "saturation": 1.4
}
```

**Example — desaturate (grayscale):**
```json
{
  "input_file": "/uploads/video.mp4",
  "saturation": 0
}
```

**Example — warm tone shift:**
```json
{
  "input_file": "/uploads/video.mp4",
  "hue": 15,
  "saturation": 1.2,
  "contrast": 1.1
}
```

---

## 14. `compress_video`

Reduce file size using named quality presets. Distinct from `export_video` in that it targets file-size reduction with user-friendly preset names and handles audio compression.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "preset": "mobile",
  "target_size_mb": 25
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `preset` | string | Yes | — | Compression preset (see below) |
| `target_size_mb` | number | No | — | Override CRF with 2-pass bitrate targeting (minimum 100 kbps) |

**Presets:**

| Preset | Codec | CRF | Max height | Audio |
|--------|-------|-----|------------|-------|
| `web` | H.264 | 23 | none | AAC 128k |
| `mobile` | H.264 | 28 | 720p | AAC 96k |
| `whatsapp` | H.264 | 30 | 720p | AAC 128k |
| `telegram` | H.264 | 26 | none | AAC 128k |
| `archive` | H.265 | 28 | none | AAC 128k |

**Output (job.output):** Path to compressed `.mp4` file (string).

**Example — compress for mobile:**
```json
{
  "input_file": "/uploads/video.mp4",
  "preset": "mobile"
}
```

**Example — target 15MB for WhatsApp:**
```json
{
  "input_file": "/uploads/video.mp4",
  "preset": "whatsapp",
  "target_size_mb": 15
}
```

---

## 15. `generate_thumbnail`

Extract a single frame from a video as a still image.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "timestamp": "5",
  "format": "jpg",
  "width": 640
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `timestamp` | string | Yes | — | Frame position in seconds or `HH:MM:SS` format |
| `format` | string | No | `"jpg"` | Output format: `"jpg"`, `"png"`, `"webp"` |
| `width` | integer | No | — | Scale output to this width (preserves aspect ratio) |

**Output (job.output):** Path to image file (`.jpg`, `.png`, or `.webp`).

**Note:** The web UI automatically renders the result as an `<img>` instead of the video player when the output is an image file.

**Example — extract a JPG thumbnail at 5 seconds:**
```json
{
  "input_file": "/uploads/video.mp4",
  "timestamp": "5"
}
```

**Example — extract a 480px-wide WebP:**
```json
{
  "input_file": "/uploads/video.mp4",
  "timestamp": "00:01:30",
  "format": "webp",
  "width": 480
}
```

---

## 16. `normalize_audio`

Normalize loudness to a target LUFS value using FFmpeg's `loudnorm` filter (EBU R128). Video stream is copied without re-encoding.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "target_lufs": -14,
  "true_peak": -1
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video (must have an audio stream) |
| `target_lufs` | number | No | `-14` | Target integrated loudness in LUFS (–24 to –5). –14 = YouTube/Spotify standard |
| `true_peak` | number | No | `-1` | True peak ceiling in dBTP (–9 to 0) |

**Output (job.output):** Path to normalized `.mp4` file (string).

**Error:** If the input has no audio stream, the job fails with "no audio stream found".

**Example — normalize for YouTube:**
```json
{
  "input_file": "/uploads/video.mp4",
  "target_lufs": -14
}
```

**Example — normalize for broadcast (–23 LUFS):**
```json
{
  "input_file": "/uploads/video.mp4",
  "target_lufs": -23,
  "true_peak": -2
}
```

---

## 17. `fade_audio`

Add an audio fade-in, fade-out, or both. Video stream is copied without re-encoding.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "fade_in_duration": 1.0,
  "fade_out_duration": 2.0
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `fade_in_duration` | number | No | `0` | Fade-in duration in seconds (0 = no fade) |
| `fade_out_duration` | number | No | `0` | Fade-out duration in seconds (0 = no fade) |

At least one of `fade_in_duration` or `fade_out_duration` should be greater than 0.

If the sum of both durations exceeds the video length, each is capped to `duration / 2`.

**Output (job.output):** Path to output `.mp4` file (string).

**Example — 1s fade in and 2s fade out:**
```json
{
  "input_file": "/uploads/video.mp4",
  "fade_in_duration": 1.0,
  "fade_out_duration": 2.0
}
```

---

## 18. `add_watermark`

Overlay a logo or image onto a video at a specified position.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "watermark_file": "/path/to/logo.png",
  "position": "bottom_right",
  "opacity": 0.8,
  "scale": 0.15,
  "margin": 10
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `watermark_file` | string | Yes | — | Watermark image (PNG with transparency recommended) |
| `position` | string | No | `"bottom_right"` | Position: `"top_left"`, `"top_right"`, `"bottom_left"`, `"bottom_right"`, `"center"` |
| `opacity` | number | No | `1` | Watermark opacity (0–1) |
| `scale` | number | No | `0.15` | Watermark width as fraction of video width (0.01–1) |
| `margin` | integer | No | `10` | Margin from edge in pixels |

**Output (job.output):** Path to watermarked `.mp4` file (string).

**Example — semi-transparent logo at bottom-right:**
```json
{
  "input_file": "/uploads/video.mp4",
  "watermark_file": "/uploads/logo.png",
  "position": "bottom_right",
  "opacity": 0.7
}
```

---

## 19. `create_gif`

Create an animated GIF from a video or segment using two-pass palette generation for optimal quality.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "start_time": "5",
  "end_time": "10",
  "fps": 10,
  "width": 480,
  "optimize": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `start_time` | string | No | — | Start of segment (seconds or `HH:MM:SS`) |
| `end_time` | string | No | — | End of segment (seconds or `HH:MM:SS`) |
| `fps` | number | No | `10` | GIF frame rate (1–30) |
| `width` | integer | No | `480` | Output width in pixels (height auto-calculated) |
| `optimize` | boolean | No | `true` | Use Bayer dithering for smaller file size |

**Output (job.output):** Path to `.gif` file (string).

**Example — 5-second clip as GIF:**
```json
{
  "input_file": "/uploads/video.mp4",
  "start_time": "10",
  "end_time": "15",
  "fps": 12,
  "width": 480
}
```

---

## 20. `blur_region`

Blur a rectangular region of the video. Supports named zone presets and optional time-range gating.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "preset": "lower_third",
  "blur_strength": 15,
  "start_time": "5",
  "end_time": "20"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `preset` | string | No | — | Zone preset (see below) — takes priority over manual coords |
| `x` | integer | No | — | Blur region left edge in pixels (manual override) |
| `y` | integer | No | — | Blur region top edge in pixels (manual override) |
| `width` | integer | No | — | Blur region width in pixels (manual override) |
| `height` | integer | No | — | Blur region height in pixels (manual override) |
| `blur_strength` | number | No | `10` | Blur radius (1–20) |
| `start_time` | string | No | — | Only blur after this time (seconds or `HH:MM:SS`) |
| `end_time` | string | No | — | Only blur before this time (seconds or `HH:MM:SS`) |

**Presets** (region computed from video dimensions):

| Preset | Region |
|--------|--------|
| `face_top_center` | Top-center 50% width, 40% height — covers common face position |
| `lower_third` | Bottom 33% of frame — covers on-screen text/captions |
| `full_frame` | Entire frame (default when no preset or coords given) |

If neither preset nor manual `x/y/width/height` are provided, defaults to `full_frame`.

**Output (job.output):** Path to output `.mp4` file (string).

**Example — blur lower-third text for 5 seconds:**
```json
{
  "input_file": "/uploads/video.mp4",
  "preset": "lower_third",
  "start_time": "10",
  "end_time": "15"
}
```

**Example — blur a custom region:**
```json
{
  "input_file": "/uploads/video.mp4",
  "x": 100,
  "y": 50,
  "width": 200,
  "height": 150,
  "blur_strength": 20
}
```
