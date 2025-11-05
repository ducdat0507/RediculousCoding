(function () {
  const vscode = acquireVsCodeApi();

  const els = {
    toggles: {
      booms: document.getElementById("explosions"),
      blips: document.getElementById("blips"),
      keys: document.getElementById("chars"),
      shakes: document.getElementById("shake"),
      sounds: document.getElementById("sound"),
      fireworks: document.getElementById("fireworks"),
      reducedEffects: document.getElementById("reducedEffects"),
    },
    levelLabel: document.getElementById("levelLabel"),
    currentXPLabel: document.getElementById("currentXPLabel"),
    targetXPLabel: document.getElementById("targetXPLabel"),
    xpBar: document.getElementById("xpBar"),
    resetBtn: document.getElementById("resetBtn"),
    testFireworks: document.getElementById("testFireworks"),
    fwCanvas: document.getElementById("fwCanvas")
  };

  // WebAudio engine using decoded WAV buffers
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  const buffers = { blip: null, boom: null, fireworks: null };
  let audioUnlocked = false;
  let lastAudioPlayTime = 0;
  let lastAudioKind = "";
  async function fetchArrayBuffer(url) {
    const res = await fetch(url);
    return await res.arrayBuffer();
  }
  async function preloadSounds(uris) {
    try {
      actx = actx || new AudioCtx();
      const entries = Object.entries(uris);
      for (const [k, u] of entries) {
        const ab = await fetchArrayBuffer(u);
        buffers[k] = await actx.decodeAudioData(ab);
      }
    } catch {}
  }
  async function unlockAudio() {
    if (audioUnlocked) return;
    try {
      actx = actx || new AudioCtx();
      if (actx.state === 'suspended') await actx.resume();
      audioUnlocked = true;
      const n = document.getElementById('soundNotice');
      if (n) n.remove();
    } catch {}
  }
  function playWav(kind, opts = {}) {
    try {
      if (!audioUnlocked || !buffers[kind]) return;
      let now = Date.now();
      if (now - lastAudioPlayTime < 33 && kind == lastAudioKind) return;
      lastAudioKind = kind;
      lastAudioPlayTime = now;
      if (actx && actx.state === 'suspended') {
        actx.resume().catch(() => {});
      }
      const src = actx.createBufferSource();
      src.buffer = buffers[kind];
      src.playbackRate.value = Math.max(0.5, Math.min(3.0, opts.playbackRate ?? 1));
      const gain = actx.createGain();
      gain.gain.value = opts.volume ?? 0.5;
      src.connect(gain).connect(actx.destination);
      src.start();
    } catch (e) {
      console.error(e);
    }
  }

  // Fireworks particles on canvas
  const fw = {
    running: false,
    particles: [],
    start() {
      const canvas = els.fwCanvas;
      canvas.classList.remove("hidden");
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      this.particles = [];
      for (let i = 0; i < 200; i++) {
        let velocity = (Math.random() ** 3 + Math.random() * 0.5) * 8 * window.devicePixelRatio;
        let angle = Math.random() * Math.PI * 2;
        this.particles.push({
          x: canvas.width / 2,
          y: canvas.height + 10,
          vx: velocity * Math.sin(angle),
          vy: velocity * Math.cos(angle) - 5,
          life: 120 + Math.random() * 240,
          color: `hsl(${Math.random() * 360}, 90%, 60%)`
        });
      }
      this.running = true;
      this.loop();
      setTimeout(() => this.stop(), 10000);
    },
    stop() {
      this.running = false;
      els.fwCanvas.classList.add("hidden");
    },
    loop() {
      if (!this.running) return;
      const ctx = els.fwCanvas.getContext("2d");
      ctx.clearRect(0, 0, els.fwCanvas.width, els.fwCanvas.height);
      this.particles.forEach(p => {
        p.vy += 0.10 * window.devicePixelRatio;
        p.x += p.vx;
        if (p.x < 0) {
          p.x = -p.x;
          p.vx = Math.max(0, -p.vx) * 0.75;
        } else if (p.x > els.fwCanvas.width) {
          p.x = els.fwCanvas.width * 2 - p.x;
          p.vx = Math.min(0, -p.vx) * 0.75;
        }
        p.y += p.vy;
        p.life -= 1;
        ctx.globalAlpha = Math.min(1, p.life / 60);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
      this.particles = this.particles.filter(p => p.life > 0 && p.y < els.fwCanvas.height + 30);
      requestAnimationFrame(() => this.loop());
    }
  };

  // Wire toggles
  for (const toggle in els.toggles) {
    els.toggles[toggle].addEventListener("change", (e) => {
      vscode.postMessage({ type: "toggle", key: toggle, value: e.target.checked });
    });
  }

  els.resetBtn.addEventListener("click", () => {
    vscode.postMessage({ type: "resetXp" })
  });

  function setState({ xp, level, xpNext, xpLevelStart = 0 }) {
    const current = xp - xpLevelStart;
    const max = xpNext - xpLevelStart;
    els.levelLabel.textContent = level.toLocaleString("en-US");
    els.currentXPLabel.textContent = xp.toLocaleString("en-US");
    els.targetXPLabel.textContent = xpNext.toLocaleString("en-US");
    const pct = Math.max(0, Math.min(1, (current / Math.max(1, max))));
    els.xpBar.style.setProperty("--progress", pct);
  }

  window.addEventListener("message", e => {
    const msg = e.data;
    switch (msg.type) {
      case "init":
        // Settings
        preloadSounds({ 
          blip: msg.soundUris.blip, 
          boom: msg.soundUris.boom, 
          fireworks: msg.soundUris.fireworks
        });
        // Unlock audio on first interaction
        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('keydown', unlockAudio, { once: true });
        setState(msg);
        // Jump to next case
      case "settings":
        els.toggles.booms.checked = msg.settings.booms.enabled;
        els.toggles.blips.checked = msg.settings.blips.enabled;
        els.toggles.keys.checked = msg.settings.keys.enabled;
        els.toggles.shakes.checked = msg.settings.shakes.enabled;
        els.toggles.sounds.checked = msg.settings.sounds.enabled;
        els.toggles.fireworks.checked = msg.settings.fireworks.enabled;
        els.toggles.reducedEffects.checked = msg.settings.reducedEffects.enabled;
      case "state":
        setState(msg);
        break;
      case "blip":
        playWav('blip', { volume: msg.volume, playbackRate: msg.pitch ?? 1.0 });
        break;
      case "boom":
        playWav('boom', { volume: msg.volume });
        break;
      case "fireworks":
        playWav('fireworks', { volume: msg.volume });
        fw.start();
        break;
    }
  });

  // Wait for DOM to be ready before sending ready message
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      vscode.postMessage({ type: "ready" });
    });
  } else {
    vscode.postMessage({ type: "ready" });
  }
})();