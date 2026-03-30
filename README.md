# ✨ Clipart AI — Multi-Style Clipart Generator

Transform any photo into 5 AI-generated art styles simultaneously.

**Built for**: Frontend Assignment — AI Clipart Generator  
**Platform**: Android (React Native + Expo)  
**APK**: [Google Drive Link — add after build]  
**Screen Recording**: [Google Drive Link — add after recording]

---

## Screenshots

> Add screenshots after running the app

---

## Setup Guide

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo@latest`
- EAS CLI: `npm install -g eas-cli`
- Vercel CLI: `npm install -g vercel`
- A [Replicate](https://replicate.com) account (free — no credit card needed for limited usage)
- A [Vercel](https://vercel.com) account (free tier)

---

### Step 1 — Deploy the Backend

```bash
cd backend
vercel deploy --prod
```

When prompted:
- Set up and deploy? **Yes**
- Link to existing project? **No**
- Project name: **clipart-ai-backend**
- Directory: **./**

After deploy, go to your **Vercel Dashboard → Project → Settings → Environment Variables** and add:

| Key | Value |
|-----|-------|
| `REPLICATE_API_KEY` | Your key from https://replicate.com/account/api-tokens |

Then **redeploy** so the env var takes effect:
```bash
vercel --prod
```

Your backend URL will be something like: `https://clipart-ai-backend.vercel.app`

---

### Step 2 — Configure the Mobile App

Open `mobile/constants/index.ts` and update line 2:

```ts
export const BACKEND_URL = 'https://clipart-ai-backend.vercel.app'; // ← your actual URL
```

---

### Step 3 — Install Dependencies & Run

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your Android device.

> **Important**: Your phone and computer must be on the **same Wi-Fi network**.

---

### Step 4 — Build APK for Submission

```bash
cd mobile
eas login           # log in with your Expo account
eas build:configure # first time only — creates project on expo.dev
eas build --platform android --profile preview
```

EAS builds in the cloud (~10–15 mins). Download the `.apk` from the link it provides, upload to Google Drive, and update the README link above.

---

## Project Structure

```
clipart-project/
├── backend/
│   ├── api/
│   │   ├── generate.js     # POST — starts a Replicate prediction
│   │   └── status.js       # GET  — polls prediction status
│   ├── vercel.json         # CORS headers + function config
│   └── package.json
│
└── mobile/
    ├── app/
    │   ├── _layout.tsx     # Expo Router stack navigator
    │   ├── index.tsx       # Home — photo upload screen
    │   └── results.tsx     # Results — 5-style grid screen
    ├── components/
    │   ├── StyleResultCard.tsx   # Card: image + save/share actions
    │   └── SkeletonCard.tsx      # Pulsing loading placeholder
    ├── hooks/
    │   └── useGeneration.ts      # Full prediction lifecycle per style
    ├── services/
    │   └── api.ts                # Typed backend API wrappers
    ├── store/
    │   └── imageStore.ts         # Singleton: passes image between screens
    ├── constants/
    │   └── index.ts              # Style configs + BACKEND_URL
    ├── app.json
    ├── eas.json
    └── package.json
```

---

## Tech Decisions

### React Native + Expo 51
Chosen over Native Android (Kotlin) because:
- Faster iteration speed — critical under 72-hour constraint
- Expo's managed workflow handles camera, gallery, media library, and file system permissions out of the box
- Expo Router gives file-based navigation with zero config
- EAS Build produces a real APK without needing Android Studio locally

### Replicate — `fofr/face-to-many` model
- Purpose-built for face style transfer (cartoon, anime, pixel, sketch, flat)
- Free tier available with no credit card
- ~$0.002 per image — extremely low cost for a demo
- Returns a URL, not base64 — no large payload handling needed in the app
- **Tradeoff**: Slower than DALL-E (30–90s per image) but significantly cheaper and more face-accurate

### Vercel Serverless Backend
- Keeps `REPLICATE_API_KEY` completely off the device — no key ever shipped in the APK
- Zero cost on free tier for this usage level
- Node 18 built-in `fetch` — zero dependencies
- **Tradeoff**: Cold starts can add ~1–2s to the very first request

### Parallel Generation (all 5 at once)
- All 5 `useGeneration` hooks fire simultaneously the moment the results screen mounts
- Each hook manages its own `startGeneration` → polling loop independently
- Progress bar reflects how many have completed out of 5
- **Tradeoff**: 5 simultaneous Replicate predictions uses more credits vs sequential, but the UX is dramatically better — user sees results trickling in rather than waiting for all

### Image Processing
- Client-side resize to **512×512** before upload using `expo-image-manipulator`
- Compressed to JPEG at 85% quality
- Keeps payload under ~200KB — well within Vercel's 4.5MB request limit
- **Tradeoff**: Slight quality reduction vs sending the full-res original

### Polling vs WebSockets
- Polling at 3-second intervals chosen over WebSockets for simplicity
- Replicate doesn't support WebSocket callbacks for predictions
- 3s interval is responsive enough without hammering the API
- Auto-stops after 6 minutes with a user-facing timeout message

---

## Tradeoffs Made

| Decision | What we got | What we gave up |
|----------|-------------|-----------------|
| Expo managed workflow | Zero native config, fast setup | Less control over native modules |
| Replicate over DALL-E | Lower cost, better face fidelity | Slower generation (30–90s vs 15s) |
| Polling over webhooks | Simpler code, no additional infra | Slightly less real-time |
| 512×512 compression | Fast uploads, no payload errors | Slightly lower source quality |
| 5 parallel predictions | Fast perceived results, great UX | More API credit usage |

---

## Bonus Features Implemented

- ✅ Batch generation — all 5 styles fire simultaneously
- ✅ Skeleton loaders — pulsing animated placeholders (not spinners)
- ✅ Per-card retry — individual style can be retried without redoing all
- ✅ Progress bar — shows X/5 completed in real time
- ✅ Save to gallery — downloads PNG to device gallery
- ✅ Native share sheet — shares via any installed app

---

## Security

- API key stored only in Vercel environment variables — never in the app or repo
- Input validation on both client (format, size) and server
- Image size capped at ~1.5MB base64 on the backend
- No user data stored — images are processed transiently by Replicate

---

## Submission Checklist

- [ ] Android APK uploaded to Google Drive
- [ ] APK link added to this README
- [ ] Screen recording uploaded to Google Drive (shows upload → generation → download/share)
- [ ] Screen recording link added to this README
- [ ] App installs and runs on physical device
- [ ] GitHub repo shared with clean commit history
- [ ] README complete (this file)
