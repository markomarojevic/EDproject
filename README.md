# Expressive Touch

A musical instrument you play by tilting your phone in 4 directions (Up, Down, Left, Right).
First prototype for the Interaction Design course. Plain HTML/CSS/JS (ES modules), no framework, no build step.

## Structure

```
index.html      screens + bottom navigation
style.css       styling
js/app.js       wires everything together
js/audio.js     16 synthesized sounds, playSound(id, time?)
js/tilt.js      tilt detection + keyboard arrow keys
js/recorder.js  layer recording, looped playback, localStorage
js/ui.js        screen rendering
```

## When tilting plays sound

- **Home screen:** tilting plays the current 4-sound combination. Tap the blob to pause/resume
  (grey, still blob with a pause icon = paused). Leaving Home stops playing; coming back resumes it
  unless you paused it yourself.
- **Studio:** only while a layer is being recorded (3-2-1 countdown + the recording loop).
- **Sound Map, Info and Studio when not recording:** tilting plays nothing.
- Keyboard arrow keys and the on-screen arrows follow the same rules.

## Tunable constants

| Constant | File | Default | Meaning |
|---|---|---|---|
| `TRIGGER_DEG` | js/tilt.js | 15 | angle (°) from the neutral position that triggers a direction (slider default) |
| `RESET_DEG` | js/tilt.js | 7 | an axis must return within this angle before the same direction can trigger again (~45% of trigger) |
| `INVERT_UP_DOWN` | js/tilt.js | false | swap Up/Down if they feel reversed |
| `LOOP_MS` | js/recorder.js | 8000 | loop length in ms |
| `BEAT_MS` | js/recorder.js | 500 | metronome click spacing (500 = 120 BPM) |

The **Sensitivity** slider on the Home screen changes the trigger angle live (8°–35°); reset is ~45% of it.
The value is remembered in the browser.

**Debug view:** tap the "Expressive Touch" title 5 times quickly. It shows relative and raw beta/gamma
angles, thresholds, which axis is waiting to return, whether playing is active, and the last detected direction.

## Running on a computer (Windows)

ES modules don't work over `file://`, so you need a local server. In PowerShell, in the project folder:

```powershell
npx serve -l 3000
# or
python -m http.server 3000
```

Open <http://localhost:3000>. A computer has no tilt sensor — the **arrow keys** (← ↑ → ↓)
fire the same events as tilting. You can also click the on-screen arrows.

## Testing on a real phone (HTTPS)

Tilt sensors (`deviceorientation`) only work on HTTPS pages, and `http://192.168.x.x` is not HTTPS.
The easiest way is a temporary HTTPS tunnel to your local server.

### Option A: Cloudflare Tunnel (no sign-up)

1. Install `cloudflared` (once), in PowerShell:
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
   Close and reopen PowerShell so the command is recognized.
2. In the first PowerShell window, start the server in the project folder:
   ```powershell
   cd C:\Users\marko\OneDrive\Desktop\EDproject
   npx serve -l 3000
   ```
3. In a second PowerShell window, start the tunnel:
   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```
4. Find the `https://something-something.trycloudflare.com` address in the output and open it on your phone
   (easiest: send yourself the link or make a QR code).
5. On the phone, tap the blob on the Home screen.
   - **iPhone (Safari):** a "Motion & Orientation Access" dialog appears → *Allow*.
     If it doesn't appear: Settings → Safari → make sure motion access isn't blocked, then reload the page.
   - **Android (Chrome):** no permission needed.
6. Hold the phone comfortably, press **Calibrate**, and tilt.
7. Done? `Ctrl+C` in both windows.

### Option B: ngrok

1. Create a free account at <https://ngrok.com> and copy your authtoken.
2. Install and configure:
   ```powershell
   winget install --id ngrok.ngrok
   ngrok config add-authtoken YOUR_TOKEN
   ```
3. Start the server (`npx serve -l 3000`) and in a second window:
   ```powershell
   ngrok http 3000
   ```
4. Open the `https://....ngrok-free.app` address on your phone (click "Visit Site" on the first visit).

### Tips

- Turn off rotation or lock it to portrait — the app is designed for portrait.
- On iPhone, make sure the silent mode switch is off (otherwise there's no sound).
- If Up/Down feel reversed, set `INVERT_UP_DOWN = true` in `js/tilt.js`.
- Layers are stored in the browser's `localStorage` — each address (localhost, tunnel) has its own storage.
- The trycloudflare address changes every time you start the tunnel.
