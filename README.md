# ClipArt AI — AI Clipart Generator

Transform any face photo into 5 distinct art styles using AI.  Built as a production-quality Android app.

---

## Links

- **APK Download:** [https://drive.google.com/file/d/1q9ELkmVCZnSpS2bW8RE_7YDF6e7Qh0aN/view?usp=drivesdk]
- **Screen Recording:** [https://drive.google.com/file/d/1s2BFGYQmI7xn0WCK6aAKzvRPminSoFSB/view?usp=drivesdk]
- **Backend:** Deployed on Vercel

---

## Tech Stack

| Layer | Choice |
|---|---|
| Mobile | React Native (Expo SDK 54) |
| Routing | Expo Router |
| Backend | Node.js serverless functions on Vercel |
| AI Generation | Replicate — InstantID style transfer model |
| Background Removal | remove.bg API |
| Image Processing | expo-image-manipulator |

---

## Setup

### Mobile
```bash
cd mobile
npm install --legacy-peer-deps
npx expo start
```

### Backend
```bash
cd backend
# Create .env.local with:
# REPLICATE_API_TOKEN=your_key
# REMOVE_BG_API_KEY=your_key
vercel --prod
```

---

## Features Built

### Core
- **Camera + Gallery upload** with client-side resize to 512×512 and JPEG compression before any network call
- **5 simultaneous art styles:** Cartoon, Flat Art, Anime, Pixel Art, Sketch
- **Async generation** — each style generates sequentially to respect API rate limits, fully non-blocking UI
- **Skeleton loaders** with shimmer sweep animation (not spinners)
- **Download to gallery** and **native share sheet** for every generated image
- **Before/After slider** — drag to compare original vs generated
- **Background removal** via remove.bg API with toggle to restore original

### Bonus (beyond assessment requirements)
- **Prompt customization** — text input to append a style hint to every generation prompt
- **Style intensity control** — stepper UI that maps to the model's `style_strength_ratio` parameter (10–80 range)
- **Result caching** — persistent JSON cache using expo-file-system with djb2 hashing. Same photo + same settings loads instantly on repeat with a visible ⚡ Cached badge so it's obvious to the user
- **Single style deep-dive screen** — tap any result card to open a full-screen view of that style with its own progress bar, remove background, save, share, and before/after
- **No-face detection** — friendly error screen when the model can't find a face, instead of a broken result

---

## Where I Got Stuck (and How I Solved It)

### 1. npm peer dependency conflict
EAS builds kept failing with `ERESOLVE could not resolve react-dom@19.2.4`. Root cause: the lockfile was generated locally with `--legacy-peer-deps` but EAS runs plain `npm ci`. Fixed by deleting `node_modules`, regenerating the lockfile cleanly, and committing it before triggering the build.

### 2. Background removal failing silently
The `removeBg` endpoint kept returning 502 errors. Went through three iterations: wrong version hash → rate limited by Replicate (429) → switched to remove.bg API entirely. Final root cause was that Replicate's CDN URLs for generated images are access-restricted, so passing the URL directly to a second model never worked. Switched to downloading the image in the backend first, converting to base64, then sending raw pixels.

### 3. Gradle build failing on style images
EAS Gradle build failed with `AAPT: error: file failed to compile` on the style preview images. The PNG files sourced from the web had metadata or encoding that Android's resource compiler rejected. Fixed by reprocessing all 5 images through Pillow (Python) to produce clean, standard PNGs.

### 4. APK vs AAB confusion
First successful EAS build produced an `.aab` (Android App Bundle) which can't be sideloaded directly. Had to ensure `eas.json` preview profile explicitly set `buildType: apk` and run with `--profile preview` flag specifically.

### 5. Splash screen logo mismatch
The native splash screen (white background, from Android launcher) didn't match the in-app JS splash transition (dark background), causing a jarring flash. Fixed by using the actual `icon.png` asset in `SplashTransition.tsx` instead of rebuilding the logo with emoji characters, and setting `android.backgroundColor` in `app.json`.

---

## Tradeoffs Made

### Sequential vs parallel generation
The assessment preferred parallel generation of all 5 styles simultaneously. We chose sequential (one finishes → next starts) deliberately — the Replicate free tier rate limits concurrent requests, causing most parallel attempts to fail with 429. Sequential generation is slower but reliable. Noted in the UI with "Each style generates in sequence."

### Replicate CDN URL caching
The result cache stores Replicate output URLs, not local files. Replicate URLs are temporary CDN links that expire (hours to days). A more robust implementation would download each image to local storage on success. This was a conscious speed tradeoff — downloading 5 images on every generation would add significant time and storage.

### Style intensity UX
The model's `style_strength_ratio` parameter accepts 15–50. We expose a wider 10–80 range to the user (mapped internally) to give a more intuitive sense of "low to high" without exposing the model's internal constraints.

### Icon cropping
The Android adaptive icon crops slightly at the edges on some launchers. This is a known issue with the foreground image not having enough padding for the adaptive icon safe zone. A fixed `adaptive-icon.png` was generated and committed but a rebuild was not done before submission due to time constraints.

---

## Ideas I Wanted to Build But Couldn't

### Face detection pre-check
Wanted to run face detection client-side (using a TensorFlow.js model or expo-face-detector) before sending the image to the backend, so users get instant feedback if their photo won't work — instead of waiting 30+ seconds for the generation to fail. The hook infrastructure for `noFace` detection is already in place in `useGeneration.ts`, waiting for a pre-check layer.

### Parallel generation with queue management
A proper job queue on the backend (e.g. using Vercel KV or Upstash) would allow all 5 styles to be dispatched simultaneously with the backend managing retry logic, instead of the client orchestrating sequential calls.

### SVG/vector output
The assessment listed SVG output as a bonus. Genuinely difficult — the Replicate model outputs raster images. Would have required a separate raster-to-vector conversion step (e.g. using Potrace or a vector-tracing API) after generation.

### Face consistency improvements
Noticed that across the 5 styles, face likeness varies — some styles preserve facial features better than others. Wanted to experiment with higher `instant_id_strength` values per style but this trades off style intensity. No clean solution found within the time constraint.

---

## Security

- No API keys in the mobile app — all Replicate and remove.bg keys live in Vercel environment variables
- Input validation on the backend: image size capped at 2.5MB, style validated against a whitelist, prompt suffix capped at 120 chars
- Vercel provides basic rate limiting at the infrastructure level

---

## Code Structure

```
clipart-project/
├── mobile/
│   ├── app/               # Expo Router screens
│   │   ├── index.tsx      # Home — upload + style selection
│   │   ├── results.tsx    # 2-col grid of all 5 styles
│   │   └── single.tsx     # Full-screen single style view
│   ├── components/
│   │   ├── StyleResultCard.tsx   # Individual style card with all actions
│   │   ├── SkeletonCard.tsx      # Shimmer loading skeleton
│   │   ├── BeforeAfterSlider.tsx # Drag-to-compare modal
│   │   └── SplashTransition.tsx  # App launch animation
│   ├── hooks/
│   │   └── useGeneration.ts      # Generation lifecycle + caching + polling
│   ├── services/
│   │   ├── api.ts                # Backend API calls
│   │   └── cache.ts              # Persistent result cache
│   ├── store/
│   │   └── imageStore.ts         # In-memory image state
│   └── constants/
│       └── index.ts              # STYLES, COLORS design tokens
└── backend/
    └── api/
        ├── generate.js    # Style generation via Replicate
        ├── status.js      # Prediction polling
        ├── removebg.js    # Background removal via remove.bg
        └── index.js       # Health check
```

---

## Known Issues & Areas of Improvement

### 1. Status Bar / Edge-to-Edge Layout
Some screens show text being overridden by the system status bar or navigation bar on certain Android devices. This was not present during development and testing on Expo Go — it only appeared after APK conversion, where Android's edge-to-edge enforcement behaves differently than the Expo development environment. Attempted a fix by setting `androidStatusBar` and `navigationBarColor` in `app.json` and updating `_layout.tsx`, and rebuilt the APK, but couldn't fully resolve it across all devices within the time constraint. A few more days would have been sufficient to test across multiple devices and fix this properly.

### 2. App Icon Cropping
The launcher icon appears slightly cropped on some Android home screens. This is an adaptive icon safe zone issue — the foreground image needs more padding to stay within the 66% safe zone that Android enforces. Again, this was not visible during Expo Go testing and only appeared post-APK. A corrected `adaptive-icon.png` was generated and committed to the repo but a final rebuild was not done before submission due to time constraints.

### 3. More High-Signal Features With More Time
Given a few more days, these features would have been added:
- **Parallel generation** with a proper backend job queue instead of sequential client-side orchestration
- **Client-side face detection** before upload so users get instant feedback instead of waiting 30+ seconds for a generation to fail
- **SVG/vector output** via a raster-to-vector conversion step after generation
- **Gallery of past generations** persisted across sessions
- **Social sharing with a branded frame** around the generated clipart
