const vscode = require('vscode');

function activate(context) {
  console.log('Oneko extension activated!');
  
  const provider = new OnekoViewProvider(context.extensionUri, context.globalState);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'onekoView',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('oneko.showMenu', async () => {
      const choice = await vscode.window.showQuickPick([
        '😴 Toggle Sleep', 
        '🔄 Reset Position',
        '⚡ Change Speed',
        '🐱 Pet the Cat',
        '🎨 Change Skin',
        '🖼️ Change Background',
        '⚽ Toggle Ball'
      ], {
        placeHolder: 'What do you want to do with the cat?'
      });
      
      if (!choice) return;
      
      if (choice.includes('Ball')) {
        provider.sendMessage({ command: 'toggleBall' });
      }
      else if (choice.includes('Background')) {
        const backgrounds = [
          { label: 'Default', value: '' },
          { label: 'Cat Room', value: 'cat-room-1.png' },
          { label: '🎨 Custom Image', value: 'custom' }
        ];
        const bgPick = await vscode.window.showQuickPick(backgrounds.map(b => b.label));
        const selected = backgrounds.find(b => b.label === bgPick);
        if (selected) {
          if (selected.value === 'custom') {
            const fileUri = await vscode.window.showOpenDialog({
              canSelectMany: false,
              openLabel: 'Select Background Image',
              filters: { 'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }
            });
            if (fileUri && fileUri[0]) {
              await context.globalState.update('oneko.customBackgroundPath', fileUri[0].fsPath);
              const fileDir = vscode.Uri.joinPath(fileUri[0], '..');
              provider.addLocalResourceRoot(fileDir);
              const webviewUri = provider.getWebviewUri(fileUri[0]);
              provider.sendMessage({ command: 'setBackground', background: webviewUri, isCustom: true });
            }
          } else {
            await context.globalState.update('oneko.background', selected.value);
            await context.globalState.update('oneko.customBackgroundPath', undefined);
            provider.sendMessage({ command: 'setBackground', background: selected.value });
          }
        }
      }
      else if (choice.includes('Skin')) {
        const skins = [
          { label: 'Neko', value: 'oneko-classic.gif' },
          { label: 'Bhondu', value: 'oneko-dog.gif' },
          { label: 'Maia', value: 'oneko-maia.gif' },
          { label: 'Tora', value: 'oneko-tora.gif' }
        ];
        const skinPick = await vscode.window.showQuickPick(skins.map(s => s.label));
        const selected = skins.find(s => s.label === skinPick);
        if (selected) {
          await context.globalState.update('oneko.skin', selected.value);
          provider.sendMessage({ command: 'setSkin', skin: selected.value });
        }
      }
      else if (choice.includes('Sleep')) {
        provider.sendMessage({ command: 'toggleSleep' });
      } else if (choice.includes('Reset')) {
        provider.sendMessage({ command: 'reset' });
      } else if (choice.includes('Speed')) {
        const speeds = ['🐌 Slow', '🚶 Normal', '🏃 Fast', '⚡ Super Fast'];
        const speed = await vscode.window.showQuickPick(speeds);
        if (speed) {
          const speedValue = speed.includes('Slow') ? 5 : speed.includes('Normal') ? 10 : speed.includes('Fast') ? 15 : 20;
          await context.globalState.update('oneko.speed', speedValue);
          provider.sendMessage({ command: 'setSpeed', speed: speedValue });
        }
      } else if (choice.includes('Pet')) {
        vscode.window.showInformationMessage('🐱 *purr purr* The cat is happy!');
        provider.sendMessage({ command: 'pet' });
      }
    })
  );
}

class OnekoViewProvider {
  constructor(extensionUri, globalState) {
    this._extensionUri = extensionUri;
    this._globalState = globalState;
    this._view = undefined;
  }

  addLocalResourceRoot(uri) {
    if (this._view && this._view.webview) {
      this._view.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri, uri]
      };
    }
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    
    webviewView.webview.html = this._getHomeHtml(webviewView.webview);
    
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'saveState') {
        await this._globalState.update('oneko.state', message.state);
      }
    });
    
    setTimeout(() => {
      this._restoreState(webviewView.webview);
    }, 100);
  }
  
  async _restoreState(webview) {
    const savedState = this._globalState.get('oneko.state');
    const savedSkin = this._globalState.get('oneko.skin');
    const savedBackground = this._globalState.get('oneko.background');
    const savedCustomBgPath = this._globalState.get('oneko.customBackgroundPath');
    const savedSpeed = this._globalState.get('oneko.speed');
    
    if (savedState) {
      this.sendMessage({ command: 'restoreState', state: savedState });
    }
    if (savedSkin) {
      this.sendMessage({ command: 'setSkin', skin: savedSkin });
    }
    if (savedSpeed) {
      this.sendMessage({ command: 'setSpeed', speed: savedSpeed });
    }
    if (savedCustomBgPath) {
      try {
        const fileUri = vscode.Uri.file(savedCustomBgPath);
        const fileDir = vscode.Uri.joinPath(fileUri, '..');
        this.addLocalResourceRoot(fileDir);
        const webviewUri = this.getWebviewUri(fileUri);
        this.sendMessage({ command: 'setBackground', background: webviewUri, isCustom: true });
      } catch (error) {
        console.error('Failed to restore custom background:', error);
      }
    } else if (savedBackground) {
      this.sendMessage({ command: 'setBackground', background: savedBackground });
    }
  }
  
  sendMessage(message) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  getWebviewUri(uri) {
    if (this._view && this._view.webview) {
      return this._view.webview.asWebviewUri(uri).toString();
    }
    return '';
  }

  _getHomeHtml(webview) {
    const defaultSkin = this._globalState.get('oneko.skin') || 'oneko-classic.gif';
    const onekoGifUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'resources', defaultSkin)
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${webview.cspSource} data: https: vscode-webview-resource:;">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
      font-family: var(--vscode-font-family);
      overflow: hidden;
      width: 100%;
      height: 100%;
      position: relative;
    }
    #container {
      position: absolute;
      inset: 0;
      min-height: 300px;
    }
    #oneko {
      width: 32px;
      height: 32px;
      position: absolute;
      background-image: url('${onekoGifUri}');
      background-size: auto;
      image-rendering: pixelated;
      cursor: grab;
      z-index: 999;
      transition: none;
    }
    #oneko:active { cursor: grabbing; }
    #ball {
      width: 20px;
      height: 20px;
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a);
      box-shadow: 0 2px 4px rgba(0,0,0,0.3), inset -2px -2px 4px rgba(0,0,0,0.2), inset 2px 2px 4px rgba(255,255,255,0.3);
      cursor: pointer;
      z-index: 998;
      display: none;
    }
    #ball.active { display: block; }
  </style>
</head>
<body>
  <div id="container">
    <div id="ball"></div>
    <div id="oneko"></div>
  </div>
  
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const nekoEl = document.getElementById('oneko');
      const ballEl = document.getElementById('ball');
      const container = document.getElementById('container');

      // ── helpers ──────────────────────────────────────────────────────────────
      function getRect() {
        // clientWidth/clientHeight is more reliable than getBoundingClientRect in VSCode webviews.
        // Subtract 4px bottom inset so ball never clips under the panel chrome.
        return {
          width:  Math.max(container.clientWidth  || window.innerWidth,  100),
          height: Math.max((container.clientHeight || window.innerHeight) - 4, 200)
        };
      }

      function clampX(x) { const r = getRect(); return Math.min(Math.max(16, x), r.width  - 16); }
      function clampY(y) { const r = getRect(); return Math.min(Math.max(16, y), r.height - 16); }
      function clampBallX(x) { const r = getRect(); return Math.min(Math.max(ballRadius, x), r.width  - ballRadius); }
      function clampBallY(y) { const r = getRect(); return Math.min(Math.max(ballRadius, y), r.height - ballRadius); }

      // ── state ─────────────────────────────────────────────────────────────────
      let rect = getRect();
      let nekoPosX   = rect.width  / 2;
      let nekoPosY   = rect.height / 2;
      let mousePosX  = nekoPosX;
      let mousePosY  = nekoPosY;

      let frameCount        = 0;
      let idleTime          = 0;
      let idleAnimation     = null;
      let idleAnimationFrame= 0;
      let forceSleep        = false;
      let grabbing          = false;
      let grabStop          = true;
      let nudge             = false;
      let nekoSpeed         = 10;
      let isFollowing       = false;
      let roamTarget        = null;
      let roamTimer         = null;

      // wall-stuck detection
      let stuckFrames   = 0;
      let lastNekoX     = nekoPosX;
      let lastNekoY     = nekoPosY;
      const STUCK_LIMIT = 25; // frames before we force a new roam target

      // cat personality / mood
      // moods: 'normal' | 'zoomies' | 'curious' | 'aloof' | 'bored'
      let catMood           = 'normal';
      let moodTimer         = 0;
      let zoomiesSpeed      = nekoSpeed * 2.5;
      let ignoreMouseUntil  = 0;   // timestamp — cat ignores cursor while aloof
      let tailWagFrame      = 0;

      // Ball physics
      let ballActive  = false;
      let ballX       = 0;   // will be set properly on toggle
      let ballY       = 0;
      let ballVelX    = 0;
      let ballVelY    = 0;
      const ballRadius= 10;
      const friction  = 0.97;
      let ballGrabbed = false;
      let chasingBall = false;
      // Throttle chase-decision so it isn't re-rolled every frame
      let chaseDecisionCooldown = 0;

      // ── sprite map ────────────────────────────────────────────────────────────
      const spriteSets = {
        idle:         [[-3, -3]],
        alert:        [[-7, -3]],
        scratchSelf:  [[-5, 0], [-6, 0], [-7, 0]],
        scratchWallN: [[0, 0],  [0, -1]],
        scratchWallS: [[-7,-1], [-6,-2]],
        scratchWallE: [[-2,-2], [-2,-3]],
        scratchWallW: [[-4, 0], [-4,-1]],
        tired:        [[-3,-2]],
        sleeping:     [[-2, 0], [-2,-1]],
        N:  [[-1,-2], [-1,-3]],
        NE: [[ 0,-2], [ 0,-3]],
        E:  [[-3, 0], [-3,-1]],
        SE: [[-5,-1], [-5,-2]],
        S:  [[-6,-3], [-7,-2]],
        SW: [[-5,-3], [-6,-1]],
        W:  [[-4,-2], [-4,-3]],
        NW: [[-1, 0], [-1,-1]]
      };

      // ── save / restore ────────────────────────────────────────────────────────
      function saveState() {
        vscode.postMessage({ command: 'saveState', state: {
          nekoPosX, nekoPosY, forceSleep, nekoSpeed,
          ballActive, ballX, ballY
        }});
      }
      setInterval(saveState, 2000);

      // ── sprite ────────────────────────────────────────────────────────────────
      function setSprite(name, frame) {
        const set = spriteSets[name];
        if (!set) return;
        const sprite = set[frame % set.length];
        nekoEl.style.backgroundPosition = \`\${sprite[0] * 32}px \${sprite[1] * 32}px\`;
      }

      function resetIdleAnimation() {
        idleAnimation      = null;
        idleAnimationFrame = 0;
      }

      // ── mood system ───────────────────────────────────────────────────────────
      function pickNewMood() {
        const moods = ['normal', 'normal', 'normal', 'curious', 'aloof', 'bored'];
        catMood   = moods[Math.floor(Math.random() * moods.length)];
        moodTimer = 300 + Math.floor(Math.random() * 400); // frames

        if (catMood === 'aloof') {
          ignoreMouseUntil = Date.now() + 6000 + Math.random() * 8000;
        }
        if (catMood === 'bored') {
          // bored cats do zoomies eventually
          setTimeout(() => {
            if (catMood === 'bored') {
              catMood    = 'zoomies';
              moodTimer  = 60 + Math.floor(Math.random() * 80);
              zoomiesSpeed = nekoSpeed * 2.2 + Math.random() * nekoSpeed;
            }
          }, 2000 + Math.random() * 3000);
        }
      }

      function tickMood() {
        moodTimer--;
        if (moodTimer <= 0) pickNewMood();
      }

      // ── roam ──────────────────────────────────────────────────────────────────
      function getSafeRoamTarget() {
        const r = getRect();
        const margin = 40;
        return {
          x: margin + Math.random() * (r.width  - margin * 2),
          y: margin + Math.random() * (r.height - margin * 2)
        };
      }

      function startRoaming() {
        if (roamTimer) clearInterval(roamTimer);
        roamTimer = setInterval(() => {
          if (!isFollowing && !forceSleep && !grabbing && !chasingBall) {
            // Curious cats pick targets near edges; bored cats roam more; aloof cats sit still
            if (catMood === 'aloof') return;
            roamTarget = getSafeRoamTarget();
          }
        }, 4000 + Math.random() * 8000);
      }

      // ── stuck detection ───────────────────────────────────────────────────────
      function checkStuck() {
        const dx = Math.abs(nekoPosX - lastNekoX);
        const dy = Math.abs(nekoPosY - lastNekoY);
        if (dx < 0.5 && dy < 0.5 && (roamTarget || chasingBall)) {
          stuckFrames++;
          if (stuckFrames > STUCK_LIMIT) {
            if (chasingBall) {
              // Cat is stuck chasing ball — give up chasing and roam away from wall
              chasingBall          = false;
              chaseDecisionCooldown= 60; // long cooldown so cat doesn't immediately retry
              // Roam to center-ish so it doesn't hug the wall
              const r = getRect();
              roamTarget = {
                x: r.width  / 2 + (Math.random() - 0.5) * r.width  * 0.3,
                y: r.height / 2 + (Math.random() - 0.5) * r.height * 0.3
              };
            } else {
              roamTarget = getSafeRoamTarget();
            }
            isFollowing = false;
            stuckFrames = 0;
            resetIdleAnimation();
          }
        } else {
          stuckFrames = 0;
        }
        lastNekoX = nekoPosX;
        lastNekoY = nekoPosY;
      }

      // ── ball ──────────────────────────────────────────────────────────────────
      function updateBall() {
        if (!ballActive || ballGrabbed) return;

        ballVelX *= friction;
        ballVelY *= friction;
        ballX    += ballVelX;
        ballY    += ballVelY;

        const r = getRect();

        // Wall bounce
        if (ballX - ballRadius < 0)          { ballX = ballRadius;           ballVelX =  Math.abs(ballVelX) * 0.8; }
        if (ballX + ballRadius > r.width)    { ballX = r.width - ballRadius; ballVelX = -Math.abs(ballVelX) * 0.8; }
        if (ballY - ballRadius < 0)          { ballY = ballRadius;           ballVelY =  Math.abs(ballVelY) * 0.8; }
        if (ballY + ballRadius > r.height)   { ballY = r.height - ballRadius;ballVelY = -Math.abs(ballVelY) * 0.8; }

        if (Math.abs(ballVelX) < 0.1 && Math.abs(ballVelY) < 0.1) { ballVelX = 0; ballVelY = 0; }

        // Wall repulsion — gentle inward drift so ball never sits dead in a corner
        const repulseZone = 55;
        const repulseMax  = 0.15;
        if (ballX < repulseZone)            ballVelX += repulseMax * (1 - ballX / repulseZone);
        if (ballX > r.width  - repulseZone) ballVelX -= repulseMax * (1 - (r.width  - ballX) / repulseZone);
        if (ballY < repulseZone)            ballVelY += repulseMax * (1 - ballY / repulseZone);
        if (ballY > r.height - repulseZone) ballVelY -= repulseMax * (1 - (r.height - ballY) / repulseZone);

        // Cat ↔ ball collision
        const catDist = Math.hypot(nekoPosX - ballX, nekoPosY - ballY);
        const minDist = 16 + ballRadius + 2;
        if (catDist < minDist && catDist > 0 && !grabbing) {
          const angle = Math.atan2(nekoPosY - ballY, nekoPosX - ballX);
          nekoPosX = clampX(ballX + Math.cos(angle) * minDist);
          nekoPosY = clampY(ballY + Math.sin(angle) * minDist);
          nekoEl.style.left = \`\${nekoPosX - 16}px\`;
          nekoEl.style.top  = \`\${nekoPosY - 16}px\`;

          if (chasingBall) {
            const cx = r.width  / 2;
            const cy = r.height / 2;
            const nearWall = ballX < 45 || ballX > r.width - 45 || ballY < 45 || ballY > r.height - 45;
            const catAngle      = Math.atan2(ballY - nekoPosY, ballX - nekoPosX);
            const toCenterAngle = Math.atan2(cy - ballY, cx - ballX);
            const blend  = nearWall ? 0.9 : 0.25;
            const lerpX  = Math.cos(catAngle) * (1 - blend) + Math.cos(toCenterAngle) * blend;
            const lerpY  = Math.sin(catAngle) * (1 - blend) + Math.sin(toCenterAngle) * blend;
            const tapAngle = Math.atan2(lerpY, lerpX);
            // Weak tap — cat paws gently, ball shouldn't rocket into walls
            const tapStr = (nearWall ? 2.5 : 2.0) + Math.random() * 1.5;
            ballVelX += Math.cos(tapAngle) * tapStr;
            ballVelY += Math.sin(tapAngle) * tapStr;
            // Low max vel — ball rolls, doesn't fly
            const maxVel = 7;
            const curVel = Math.hypot(ballVelX, ballVelY);
            if (curVel > maxVel) { ballVelX = (ballVelX/curVel)*maxVel; ballVelY = (ballVelY/curVel)*maxVel; }
          }
        }

        // Hard clamp every frame — ball can NEVER be outside bounds regardless of
        // stale getRect, resize events, or physics tunneling
        ballX = Math.max(ballRadius, Math.min(r.width  - ballRadius, ballX));
        ballY = Math.max(ballRadius, Math.min(r.height - ballRadius, ballY));

        ballEl.style.left = \`\${ballX - ballRadius}px\`;
        ballEl.style.top  = \`\${ballY  - ballRadius}px\`;
      }

      // ── idle behaviour ────────────────────────────────────────────────────────
      function idle() {
        idleTime++;
        tickMood();

        // Cat may fall asleep on its own if idle long enough
        if (idleTime > 120 && !forceSleep && Math.random() < 0.008) {
          forceSleep = true;
          saveState();
        }

        if (idleTime > 10 && Math.floor(Math.random() * 200) === 0 && idleAnimation == null) {
          const r = getRect();
          let pool = ['scratchSelf', 'scratchSelf'];           // weighted
          if (catMood === 'curious') pool.push('alert');       // peek around
          if (nekoPosX < 32)            pool.push('scratchWallW');
          if (nekoPosY < 32)            pool.push('scratchWallN');
          if (nekoPosX > r.width  - 32) pool.push('scratchWallE');
          if (nekoPosY > r.height - 32) pool.push('scratchWallS');
          // Never include 'sleeping' here — handled separately via forceSleep
          idleAnimation = pool[Math.floor(Math.random() * pool.length)];
        }

        if (forceSleep) idleAnimation = 'sleeping';

        switch (idleAnimation) {
          case 'sleeping':
            if (idleAnimationFrame < 8 && nudge && forceSleep) {
              setSprite('idle', 0); break;
            } else if (nudge) {
              nudge = false;
              resetIdleAnimation();
            }
            if (idleAnimationFrame < 8) { setSprite('tired', 0); break; }
            setSprite('sleeping', Math.floor(idleAnimationFrame / 4));
            if (idleAnimationFrame > 192 && !forceSleep) resetIdleAnimation();
            break;
          case 'alert':
            // curious peek — look around then return
            setSprite('alert', 0);
            if (idleAnimationFrame > 20) resetIdleAnimation();
            break;
          case 'scratchWallN':
          case 'scratchWallS':
          case 'scratchWallE':
          case 'scratchWallW':
          case 'scratchSelf':
            setSprite(idleAnimation, idleAnimationFrame);
            if (idleAnimationFrame > 9) resetIdleAnimation();
            break;
          default:
            setSprite('idle', 0);
            return;
        }
        idleAnimationFrame++;
      }

      // ── main frame ────────────────────────────────────────────────────────────
      function frame() {
        frameCount++;
        updateBall();
        checkStuck();
        if (chaseDecisionCooldown > 0) chaseDecisionCooldown--;

        if (grabbing) {
          grabStop && setSprite('alert', 0);
          return;
        }

        const aloof = catMood === 'aloof' && Date.now() < ignoreMouseUntil;
        const speed = (catMood === 'zoomies') ? zoomiesSpeed : nekoSpeed;

        let targetX = mousePosX;
        let targetY = mousePosY;

        // ── ball chasing ──
        if (ballActive && !ballGrabbed && !forceSleep && !aloof) {
          const ballDist   = Math.hypot(nekoPosX - ballX, nekoPosY - ballY);
          const ballSpeed  = Math.hypot(ballVelX, ballVelY);
          const ballMoving = ballSpeed > 0.5;

          // Start chasing: ball is moving OR nearby (cat gets curious even about still ball)
          if (!chasingBall && chaseDecisionCooldown === 0) {
            const shouldChase = (ballMoving && ballDist < 240) || (ballDist < 80 && Math.random() < 0.02);
            if (shouldChase && Math.random() < 0.18) {
              chasingBall          = true;
              isFollowing          = false;
              roamTarget           = null;
              chaseDecisionCooldown= 20;
            }
          }

          if (chasingBall) {
            const r           = getRect();
            const approachDist= 16 + ballRadius + 14;
            const wallMargin  = 40;
            const nearLeft    = ballX < wallMargin;
            const nearRight   = ballX > r.width  - wallMargin;
            const nearTop     = ballY < wallMargin;
            const nearBottom  = ballY > r.height - wallMargin;
            const nearWall    = nearLeft || nearRight || nearTop || nearBottom;
            const cx          = r.width  / 2;
            const cy          = r.height / 2;

            // Angle FROM center TO ball — points toward the wall/corner the ball is against
            const toCornerAngle = Math.atan2(ballY - cy, ballX - cx);
            // Angle FROM ball TO center — the direction we want to hit it
            const toOpenAngle   = toCornerAngle + Math.PI;

            if (nearWall) {
              // Cat needs to get to the CORNER SIDE of the ball (same side as wall)
              // so it can push the ball back toward open space.
              // Phase 1: arc around to the corner side
              // Phase 2: once there, push through toward center

              // Target position is ON THE WALL SIDE of the ball, offset further into corner
              const cornerApproach = approachDist + 6;
              const rawTX = ballX + Math.cos(toCornerAngle) * cornerApproach;
              const rawTY = ballY + Math.sin(toCornerAngle) * cornerApproach;

              // This target may be out of bounds (inside the wall) — that's fine,
              // the cat will arc along the edge to get as close as it can,
              // naturally curving around the ball from the wall side.
              // Clamp loosely — allow cat to get close to edge
              targetX = Math.min(Math.max(8, rawTX), r.width  - 8);
              targetY = Math.min(Math.max(8, rawTY), r.height - 8);

            } else if (!ballMoving) {
              // Stopped in open space — circle playfully
              const circleR = approachDist + Math.sin(frameCount * 0.03) * 8;
              targetX = Math.min(Math.max(16, ballX + Math.cos(frameCount * 0.035) * circleR), r.width  - 16);
              targetY = Math.min(Math.max(16, ballY + Math.sin(frameCount * 0.035) * circleR), r.height - 16);
              if (Math.random() < 0.012) { targetX = ballX; targetY = ballY; }

            } else {
              // Ball moving in open space — intercept from behind
              const velAngle    = Math.atan2(ballVelY, ballVelX);
              const behindAngle = velAngle + Math.PI + Math.sin(frameCount * 0.07) * 0.35;
              targetX = Math.min(Math.max(16, ballX + Math.cos(behindAngle) * approachDist), r.width  - 16);
              targetY = Math.min(Math.max(16, ballY + Math.sin(behindAngle) * approachDist), r.height - 16);
            }

            if (ballDist > 280 || (!ballMoving && !nearWall && Math.random() < 0.003)) {
              chasingBall          = false;
              chaseDecisionCooldown= 30;
            }
          }
        }

        // ── roam target fallback ──
        if (!isFollowing && !chasingBall && roamTarget && !forceSleep) {
          targetX = roamTarget.x;
          targetY = roamTarget.y;
        }

        // If aloof, cat just stays put (idle)
        if (aloof && !chasingBall) {
          idle();
          return;
        }

        const diffX    = nekoPosX - targetX;
        const diffY    = nekoPosY - targetY;
        const distance = Math.hypot(diffX, diffY);

        // Clear roam target on arrival
        if (roamTarget && distance < 12) roamTarget = null;

        if (forceSleep && distance < speed) {
          nekoPosX = clampX(targetX);
          nekoPosY = clampY(targetY);
          nekoEl.style.left = \`\${nekoPosX - 16}px\`;
          nekoEl.style.top  = \`\${nekoPosY - 16}px\`;
          idle();
          return;
        }

        const stopDist = (chasingBall) ? 0 : 48;
        if ((distance < speed || distance < stopDist) && !forceSleep && !roamTarget && !chasingBall) {
          idle();
          return;
        }

        idleAnimation      = null;
        idleAnimationFrame = 0;

        // Alert flash when waking up
        if (idleTime > 1) {
          setSprite('alert', 0);
          idleTime = Math.min(idleTime, 7);
          idleTime--;
          return;
        }
        idleTime = 0;

        // Direction sprite
        let direction = '';
        if (distance > 0) {
          if (diffY / distance >  0.5) direction += 'N';
          if (diffY / distance < -0.5) direction += 'S';
          if (diffX / distance >  0.5) direction += 'W';
          if (diffX / distance < -0.5) direction += 'E';
        }
        if (!direction) direction = 'idle';
        setSprite(direction, frameCount);

        if (distance > 0) {
          nekoPosX = clampX(nekoPosX - (diffX / distance) * speed);
          nekoPosY = clampY(nekoPosY - (diffY / distance) * speed);
        }

        nekoEl.style.left = \`\${nekoPosX - 16}px\`;
        nekoEl.style.top  = \`\${nekoPosY - 16}px\`;
      }

      // ── mouse interaction ─────────────────────────────────────────────────────
      let mouseInteractions  = 0;
      let interactionTimeout = null;

      container.addEventListener('mousemove', (e) => {
        if (forceSleep) return;
        const r    = container.getBoundingClientRect();
        const mx   = e.clientX - r.left;
        const my   = e.clientY - r.top;
        const dist = Math.hypot(mx - nekoPosX, my - nekoPosY);

        const aloof = catMood === 'aloof' && Date.now() < ignoreMouseUntil;
        if (aloof) return;  // cat ignores you when feeling aloof

        if (dist < 100 && !isFollowing && !chasingBall) {
          mouseInteractions++;
          clearTimeout(interactionTimeout);
          if (mouseInteractions >= 2) {
            isFollowing  = true;
            mousePosX    = mx;
            mousePosY    = my;
            forceSleep   = false;
            roamTarget   = null;
            setTimeout(() => { isFollowing = false; mouseInteractions = 0; },
              8000 + Math.random() * 7000);
          }
          interactionTimeout = setTimeout(() => { mouseInteractions = 0; }, 3000);
        }

        if (isFollowing) { mousePosX = mx; mousePosY = my; }
      });

      // ── ball drag ─────────────────────────────────────────────────────────────
      ballEl.addEventListener('mousedown', (e) => {
        if (!ballActive) return;
        e.stopPropagation();
        ballGrabbed = true;
        chasingBall = false;
        const r     = container.getBoundingClientRect();
        let lx      = e.clientX - r.left;
        let ly      = e.clientY - r.top;
        let lt      = Date.now();

        const mm = (e) => {
          const r2 = container.getBoundingClientRect();
          const cx = e.clientX - r2.left;
          const cy = e.clientY - r2.top;
          const dt = Math.max((Date.now() - lt) / 16.67, 0.1);
          ballVelX  = (cx - lx) / dt;
          ballVelY  = (cy - ly) / dt;
          ballX     = clampBallX(cx);
          ballY     = clampBallY(cy);
          lx = cx; ly = cy; lt = Date.now();
        };
        const mu = () => {
          ballGrabbed = false;
          ballVelX *= 1.5; ballVelY *= 1.5;
          document.removeEventListener('mousemove', mm);
          document.removeEventListener('mouseup',   mu);
        };
        document.addEventListener('mousemove', mm);
        document.addEventListener('mouseup',   mu);
      });

      // ── cat drag ──────────────────────────────────────────────────────────────
      nekoEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        grabbing     = true;
        isFollowing  = false;
        forceSleep   = false;
        chasingBall  = false;
        const r      = container.getBoundingClientRect();
        let sx       = e.clientX - r.left;
        let sy       = e.clientY - r.top;
        let snx      = nekoPosX;
        let sny      = nekoPosY;
        let gi;

        const mm = (e) => {
          const r2 = container.getBoundingClientRect();
          const cx  = e.clientX - r2.left;
          const cy  = e.clientY - r2.top;
          const dx  = cx - sx, dy = cy - sy;
          const adx = Math.abs(dx), ady = Math.abs(dy);
          if (adx > ady && adx > 10) setSprite(dx > 0 ? 'scratchWallW' : 'scratchWallE', frameCount);
          else if (ady > adx && ady > 10) setSprite(dy > 0 ? 'scratchWallN' : 'scratchWallS', frameCount);
          if (grabStop || adx > 10 || ady > 10) {
            grabStop = false;
            clearTimeout(gi);
            gi = setTimeout(() => { grabStop = true; nudge = false; sx = cx; sy = cy; snx = nekoPosX; sny = nekoPosY; }, 150);
          }
          nekoPosX = clampX(snx + cx - sx);
          nekoPosY = clampY(sny + cy - sy);
          nekoEl.style.left = \`\${nekoPosX - 16}px\`;
          nekoEl.style.top  = \`\${nekoPosY - 16}px\`;
        };
        const mu = () => {
          grabbing = false; nudge = true;
          resetIdleAnimation(); saveState();
          document.removeEventListener('mousemove', mm);
          document.removeEventListener('mouseup',   mu);
        };
        document.addEventListener('mousemove', mm);
        document.addEventListener('mouseup',   mu);
      });

      nekoEl.addEventListener('dblclick', () => {
        forceSleep  = !forceSleep;
        isFollowing = false; chasingBall = false; nudge = false;
        if (!forceSleep) resetIdleAnimation();
        saveState();
      });

      // ── init ──────────────────────────────────────────────────────────────────
      // Use requestAnimationFrame-based init so we get real dimensions
      requestAnimationFrame(() => {
        rect     = getRect();
        nekoPosX = rect.width  / 2;
        nekoPosY = rect.height / 2;
        mousePosX= nekoPosX;
        mousePosY= nekoPosY;
        nekoEl.style.left = \`\${nekoPosX - 16}px\`;
        nekoEl.style.top  = \`\${nekoPosY - 16}px\`;
      });

      pickNewMood();
      startRoaming();
      setInterval(frame, 100);

      // ── message handler ───────────────────────────────────────────────────────
      window.addEventListener('message', event => {
        const msg = event.data;
        switch (msg.command) {
          case 'restoreState':
            if (msg.state) {
              const r = getRect();
              // Clamp restored positions to current viewport
              nekoPosX   = clampX(msg.state.nekoPosX || r.width  / 2);
              nekoPosY   = clampY(msg.state.nekoPosY || r.height / 2);
              forceSleep = msg.state.forceSleep || false;
              nekoSpeed  = msg.state.nekoSpeed  || 10;
              ballActive = msg.state.ballActive || false;
              // Clamp ball too
              ballX = clampBallX(msg.state.ballX || r.width  / 2);
              ballY = clampBallY(msg.state.ballY || r.height / 2);
              if (ballActive) ballEl.classList.add('active');
              nekoEl.style.left = \`\${nekoPosX - 16}px\`;
              nekoEl.style.top  = \`\${nekoPosY - 16}px\`;
            }
            break;

          case 'toggleBall': {
            ballActive = !ballActive;
            if (ballActive) {
              // Always spawn ball at safe center of current viewport
              const r = getRect();
              ballX    = r.width  / 2;
              ballY    = r.height / 2;
              ballVelX = 0; ballVelY = 0;
              ballEl.classList.add('active');
              ballEl.style.left = \`\${ballX - ballRadius}px\`;
              ballEl.style.top  = \`\${ballY - ballRadius}px\`;
            } else {
              ballEl.classList.remove('active');
              chasingBall = false;
            }
            saveState();
            break;
          }

          case 'toggleSleep':
            forceSleep  = !forceSleep;
            isFollowing = false; chasingBall = false; nudge = false;
            if (!forceSleep) resetIdleAnimation();
            saveState();
            break;

          case 'reset': {
            const r  = getRect();
            nekoPosX = r.width  / 2;
            nekoPosY = r.height / 2;
            forceSleep  = false; isFollowing = false;
            roamTarget  = null;  chasingBall = false;
            stuckFrames = 0;
            if (roamTimer) clearInterval(roamTimer);
            startRoaming();
            saveState();
            break;
          }

          case 'setSpeed':
            nekoSpeed    = msg.speed;
            zoomiesSpeed = nekoSpeed * 2.5;
            saveState();
            break;

          case 'pet':
            // Wake up if sleeping, react happily
            forceSleep = false;
            resetIdleAnimation();
            setSprite('alert', 0);
            setTimeout(() => setSprite('idle', 0), 500);
            setTimeout(() => setSprite('scratchSelf', 0), 1000);
            setTimeout(() => setSprite('idle', 0), 1800);
            catMood   = 'normal';
            moodTimer = 200;
            break;

          case 'setBackground':
            if (msg.background) {
              let bgUrl;
              if (msg.isCustom) {
                bgUrl = msg.background;
              } else {
                bgUrl = '${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources'))}/' + msg.background;
              }
              document.body.style.backgroundImage    = "url('" + bgUrl + "')";
              document.body.style.backgroundSize     = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat   = 'no-repeat';
            } else {
              document.body.style.backgroundImage = '';
            }
            break;

          case 'setSkin': {
            const uri = '${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources'))}/' + msg.skin;
            nekoEl.style.backgroundImage = \`url('\${uri}')\`;
            break;
          }
        }
      });
    })();
  </script>
</body>
</html>`;
  }
}

function deactivate() {}

module.exports = { activate, deactivate };