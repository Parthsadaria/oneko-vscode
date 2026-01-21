const vscode = require('vscode');

function activate(context) {
  console.log('Oneko extension activated!');
  
  const provider = new OnekoViewProvider(context.extensionUri, context.globalState);
  
  // Register the webview view provider for the sidebar panel
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
  
  // Menu command
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
              filters: {
                'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
              }
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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
      font-family: var(--vscode-font-family);
      overflow: hidden;
      height: 100vh;
      position: relative;
    }
    #container {
      width: 100%;
      height: 100%;
      position: relative;
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
    }
    #oneko:active {
      cursor: grabbing;
    }
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
    #ball.active {
      display: block;
    }
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
      
      let nekoPosX = 100;
      let nekoPosY = 100;
      let mousePosX = nekoPosX;
      let mousePosY = nekoPosY;
      let frameCount = 0;
      let idleTime = 0;
      let idleAnimation = null;
      let idleAnimationFrame = 0;
      let forceSleep = false;
      let grabbing = false;
      let grabStop = true;
      let nudge = false;
      let nekoSpeed = 10;
      let isFollowing = false;
      let roamTarget = null;
      let roamTimer = null;
      
      // Ball physics
      let ballActive = false;
      let ballX = 200;
      let ballY = 200;
      let ballVelX = 0;
      let ballVelY = 0;
      let ballRadius = 10;
      let friction = 0.97;
      let ballGrabbed = false;
      let chasingBall = false;
      
      const spriteSets = {
        idle: [[-3, -3]],
        alert: [[-7, -3]],
        scratchSelf: [[-5, 0], [-6, 0], [-7, 0]],
        scratchWallN: [[0, 0], [0, -1]],
        scratchWallS: [[-7, -1], [-6, -2]],
        scratchWallE: [[-2, -2], [-2, -3]],
        scratchWallW: [[-4, 0], [-4, -1]],
        tired: [[-3, -2]],
        sleeping: [[-2, 0], [-2, -1]],
        N: [[-1, -2], [-1, -3]],
        NE: [[0, -2], [0, -3]],
        E: [[-3, 0], [-3, -1]],
        SE: [[-5, -1], [-5, -2]],
        S: [[-6, -3], [-7, -2]],
        SW: [[-5, -3], [-6, -1]],
        W: [[-4, -2], [-4, -3]],
        NW: [[-1, 0], [-1, -1]]
      };
      
      function saveState() {
        const state = {
          nekoPosX,
          nekoPosY,
          forceSleep,
          nekoSpeed,
          ballActive,
          ballX,
          ballY
        };
        vscode.postMessage({ command: 'saveState', state });
      }
      
      setInterval(saveState, 2000);
      
      function setSprite(name, frame) {
        const sprite = spriteSets[name][frame % spriteSets[name].length];
        nekoEl.style.backgroundPosition = \`\${sprite[0] * 32}px \${sprite[1] * 32}px\`;
      }
      
      function resetIdleAnimation() {
        idleAnimation = null;
        idleAnimationFrame = 0;
      }
      
      function getRandomRoamTarget() {
        const rect = container.getBoundingClientRect();
        return {
          x: Math.random() * (rect.width - 64) + 32,
          y: Math.random() * (rect.height - 64) + 32
        };
      }
      
      function startRoaming() {
        if (roamTimer) clearInterval(roamTimer);
        roamTimer = setInterval(() => {
          if (!isFollowing && !forceSleep && !grabbing && !chasingBall) {
            roamTarget = getRandomRoamTarget();
          }
        }, 5000 + Math.random() * 10000);
      }
      
      function updateBall() {
        if (!ballActive || ballGrabbed) return;
        
        const rect = container.getBoundingClientRect();
        
        // Apply friction
        ballVelX *= friction;
        ballVelY *= friction;
        
        // Update position
        ballX += ballVelX;
        ballY += ballVelY;
        
        // Wall collisions with bounce
        if (ballX - ballRadius < 0) {
          ballX = ballRadius;
          ballVelX = Math.abs(ballVelX) * 0.8;
        }
        if (ballX + ballRadius > rect.width) {
          ballX = rect.width - ballRadius;
          ballVelX = -Math.abs(ballVelX) * 0.8;
        }
        if (ballY - ballRadius < 0) {
          ballY = ballRadius;
          ballVelY = Math.abs(ballVelY) * 0.8;
        }
        if (ballY + ballRadius > rect.height) {
          ballY = rect.height - ballRadius;
          ballVelY = -Math.abs(ballVelY) * 0.8;
        }
        
        // Stop if moving very slowly
        if (Math.abs(ballVelX) < 0.1 && Math.abs(ballVelY) < 0.1) {
          ballVelX = 0;
          ballVelY = 0;
        }
        
        // Check collision with cat - prevent overlap and apply force
        const catDist = Math.sqrt((nekoPosX - ballX) ** 2 + (nekoPosY - ballY) ** 2);
        const minDist = 16 + ballRadius + 2; // Cat radius + ball radius + small buffer
        
        if (catDist < minDist && !grabbing) {
          // Push cat away from ball to prevent overlap
          const angle = Math.atan2(nekoPosY - ballY, nekoPosX - ballX);
          const overlap = minDist - catDist;
          nekoPosX = ballX + Math.cos(angle) * minDist;
          nekoPosY = ballY + Math.sin(angle) * minDist;
          
          // Clamp cat position within bounds
          nekoPosX = Math.min(Math.max(16, nekoPosX), rect.width - 16);
          nekoPosY = Math.min(Math.max(16, nekoPosY), rect.height - 16);
          
          nekoEl.style.left = \`\${nekoPosX - 16}px\`;
          nekoEl.style.top = \`\${nekoPosY - 16}px\`;
          
          // Cat taps the ball - apply force based on approach direction
          if (chasingBall) {
            const tapAngle = Math.atan2(ballY - nekoPosY, ballX - nekoPosX);
            const tapStrength = 3 + Math.random() * 2; // Random variation for playfulness
            ballVelX += Math.cos(tapAngle) * tapStrength;
            ballVelY += Math.sin(tapAngle) * tapStrength;
            
            // Clamp max ball velocity
            const maxVel = 15;
            const currentVel = Math.sqrt(ballVelX ** 2 + ballVelY ** 2);
            if (currentVel > maxVel) {
              ballVelX = (ballVelX / currentVel) * maxVel;
              ballVelY = (ballVelY / currentVel) * maxVel;
            }
          }
        }
        
        ballEl.style.left = \`\${ballX - ballRadius}px\`;
        ballEl.style.top = \`\${ballY - ballRadius}px\`;
      }
      
      function idle() {
        idleTime += 1;
        
        if (idleTime > 100 && !forceSleep && Math.random() < 0.01) {
          forceSleep = true;
          saveState();
        }
        
        if (idleTime > 10 && Math.floor(Math.random() * 200) === 0 && idleAnimation == null) {
          let availableIdleAnimations = ['sleeping', 'scratchSelf'];
          const rect = container.getBoundingClientRect();
          if (nekoPosX < 32) availableIdleAnimations.push('scratchWallW');
          if (nekoPosY < 32) availableIdleAnimations.push('scratchWallN');
          if (nekoPosX > rect.width - 32) availableIdleAnimations.push('scratchWallE');
          if (nekoPosY > rect.height - 32) availableIdleAnimations.push('scratchWallS');
          idleAnimation = availableIdleAnimations[Math.floor(Math.random() * availableIdleAnimations.length)];
        }
        
        if (forceSleep) {
          idleAnimation = 'sleeping';
        }
        
        switch (idleAnimation) {
          case 'sleeping':
            if (idleAnimationFrame < 8 && nudge && forceSleep) {
              setSprite('idle', 0);
              break;
            } else if (nudge) {
              nudge = false;
              resetIdleAnimation();
            }
            if (idleAnimationFrame < 8) {
              setSprite('tired', 0);
              break;
            }
            setSprite('sleeping', Math.floor(idleAnimationFrame / 4));
            if (idleAnimationFrame > 192 && !forceSleep) {
              resetIdleAnimation();
            }
            break;
          case 'scratchWallN':
          case 'scratchWallS':
          case 'scratchWallE':
          case 'scratchWallW':
          case 'scratchSelf':
            setSprite(idleAnimation, idleAnimationFrame);
            if (idleAnimationFrame > 9) {
              resetIdleAnimation();
            }
            break;
          default:
            setSprite('idle', 0);
            return;
        }
        idleAnimationFrame += 1;
      }
      
      function frame() {
        frameCount += 1;
        updateBall();
        
        if (grabbing) {
          grabStop && setSprite('alert', 0);
          return;
        }
        
        let targetX = mousePosX;
        let targetY = mousePosY;
        
        // Ball chasing logic
        if (ballActive && !ballGrabbed && !forceSleep) {
          const ballDist = Math.sqrt((nekoPosX - ballX) ** 2 + (nekoPosY - ballY) ** 2);
          const ballMoving = Math.abs(ballVelX) > 0.5 || Math.abs(ballVelY) > 0.5;
          const ballSlow = Math.abs(ballVelX) < 2 && Math.abs(ballVelY) < 2;
          
          // Start chasing if ball is moving and within range
          if (ballMoving && ballDist < 200 && Math.random() < 0.3) {
            chasingBall = true;
            isFollowing = false;
            roamTarget = null;
          }
          
          // When chasing, approach the ball strategically
          if (chasingBall) {
            const approachDist = 16 + ballRadius + 8; // Stop a bit away from the ball
            
            if (ballMoving) {
              // Intercept moving ball - predict where it will be
              const predictionTime = 0.3;
              const predictX = ballX + ballVelX * predictionTime * 10;
              const predictY = ballY + ballVelY * predictionTime * 10;
              targetX = predictX;
              targetY = predictY;
            } else if (ballSlow || !ballMoving) {
              // Ball stopped or very slow - circle around it playfully
              const circleAngle = (frameCount * 0.05) + (Math.random() - 0.5) * 0.3;
              const circleRadius = approachDist + 5;
              targetX = ballX + Math.cos(circleAngle) * circleRadius;
              targetY = ballY + Math.sin(circleAngle) * circleRadius;
              
              // Occasionally pounce at the ball
              if (Math.random() < 0.02) {
                targetX = ballX;
                targetY = ballY;
              }
            }
            
            // Stop chasing if ball is very far or stopped for too long
            if (ballDist > 250 || (!ballMoving && Math.random() < 0.005)) {
              chasingBall = false;
            }
          }
        }
        
        if (!isFollowing && !chasingBall && roamTarget && !forceSleep) {
          targetX = roamTarget.x;
          targetY = roamTarget.y;
        }
        
        const diffX = nekoPosX - targetX;
        const diffY = nekoPosY - targetY;
        const distance = Math.sqrt(diffX ** 2 + diffY ** 2);
        
        if (roamTarget && distance < 10) {
          roamTarget = null;
        }
        
        if (forceSleep && Math.abs(diffY) < nekoSpeed && Math.abs(diffX) < nekoSpeed) {
          nekoPosX = targetX;
          nekoPosY = targetY;
          nekoEl.style.left = \`\${nekoPosX - 16}px\`;
          nekoEl.style.top = \`\${nekoPosY - 16}px\`;
          idle();
          return;
        }
        
        if ((distance < nekoSpeed || distance < 48) && !forceSleep && !roamTarget && !chasingBall) {
          idle();
          return;
        }
        
        idleAnimation = null;
        idleAnimationFrame = 0;
        
        if (idleTime > 1) {
          setSprite('alert', 0);
          idleTime = Math.min(idleTime, 7);
          idleTime -= 1;
          return;
        }
        
        let direction = diffY / distance > 0.5 ? 'N' : '';
        direction += diffY / distance < -0.5 ? 'S' : '';
        direction += diffX / distance > 0.5 ? 'W' : '';
        direction += diffX / distance < -0.5 ? 'E' : '';
        setSprite(direction, frameCount);
        
        nekoPosX -= (diffX / distance) * nekoSpeed;
        nekoPosY -= (diffY / distance) * nekoSpeed;
        
        const rect = container.getBoundingClientRect();
        nekoPosX = Math.min(Math.max(16, nekoPosX), rect.width - 16);
        nekoPosY = Math.min(Math.max(16, nekoPosY), rect.height - 16);
        
        nekoEl.style.left = \`\${nekoPosX - 16}px\`;
        nekoEl.style.top = \`\${nekoPosY - 16}px\`;
      }
      
      let mouseInteractions = 0;
      let interactionTimeout = null;
      
      container.addEventListener('mousemove', (e) => {
        if (forceSleep) return;
        
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const distance = Math.sqrt((mouseX - nekoPosX) ** 2 + (mouseY - nekoPosY) ** 2);
        
        if (distance < 100 && !isFollowing && !chasingBall) {
          mouseInteractions++;
          clearTimeout(interactionTimeout);
          
          if (mouseInteractions >= 2) {
            isFollowing = true;
            mousePosX = mouseX;
            mousePosY = mouseY;
            forceSleep = false;
            roamTarget = null;
            
            setTimeout(() => {
              isFollowing = false;
              mouseInteractions = 0;
            }, 8000 + Math.random() * 7000);
          }
          
          interactionTimeout = setTimeout(() => {
            mouseInteractions = 0;
          }, 3000);
        }
        
        if (isFollowing) {
          mousePosX = mouseX;
          mousePosY = mouseY;
        }
      });
      
      // Ball interaction
      ballEl.addEventListener('mousedown', (e) => {
        if (!ballActive) return;
        e.stopPropagation();
        ballGrabbed = true;
        chasingBall = false;
        const rect = container.getBoundingClientRect();
        let lastX = e.clientX - rect.left;
        let lastY = e.clientY - rect.top;
        let lastTime = Date.now();
        
        const mousemove = (e) => {
          const rect = container.getBoundingClientRect();
          const currentX = e.clientX - rect.left;
          const currentY = e.clientY - rect.top;
          const currentTime = Date.now();
          const dt = (currentTime - lastTime) / 16.67;
          
          ballVelX = (currentX - lastX) / dt;
          ballVelY = (currentY - lastY) / dt;
          
          ballX = currentX;
          ballY = currentY;
          
          lastX = currentX;
          lastY = currentY;
          lastTime = currentTime;
        };
        
        const mouseup = () => {
          ballGrabbed = false;
          ballVelX *= 1.5;
          ballVelY *= 1.5;
          document.removeEventListener('mousemove', mousemove);
          document.removeEventListener('mouseup', mouseup);
        };
        
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);
      });
      
      nekoEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        grabbing = true;
        isFollowing = false;
        forceSleep = false;
        chasingBall = false;
        const rect = container.getBoundingClientRect();
        let startX = e.clientX - rect.left;
        let startY = e.clientY - rect.top;
        let startNekoX = nekoPosX;
        let startNekoY = nekoPosY;
        let grabInterval;
        
        const mousemove = (e) => {
          const rect = container.getBoundingClientRect();
          const currentX = e.clientX - rect.left;
          const currentY = e.clientY - rect.top;
          const deltaX = currentX - startX;
          const deltaY = currentY - startY;
          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);
          
          if (absDeltaX > absDeltaY && absDeltaX > 10) {
            setSprite(deltaX > 0 ? 'scratchWallW' : 'scratchWallE', frameCount);
          } else if (absDeltaY > absDeltaX && absDeltaY > 10) {
            setSprite(deltaY > 0 ? 'scratchWallN' : 'scratchWallS', frameCount);
          }
          
          if (grabStop || absDeltaX > 10 || absDeltaY > 10) {
            grabStop = false;
            clearTimeout(grabInterval);
            grabInterval = setTimeout(() => {
              grabStop = true;
              nudge = false;
              startX = currentX;
              startY = currentY;
              startNekoX = nekoPosX;
              startNekoY = nekoPosY;
            }, 150);
          }
          
          nekoPosX = startNekoX + currentX - startX;
          nekoPosY = startNekoY + currentY - startY;
          nekoEl.style.left = \`\${nekoPosX - 16}px\`;
          nekoEl.style.top = \`\${nekoPosY - 16}px\`;
        };
        
        const mouseup = () => {
          grabbing = false;
          nudge = true;
          resetIdleAnimation();
          saveState();
          document.removeEventListener('mousemove', mousemove);
          document.removeEventListener('mouseup', mouseup);
        };
        
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);
      });
      
      nekoEl.addEventListener('dblclick', () => {
        forceSleep = !forceSleep;
        isFollowing = false;
        chasingBall = false;
        nudge = false;
        if (!forceSleep) {
          resetIdleAnimation();
        }
        saveState();
      });
      
      nekoEl.style.left = \`\${nekoPosX - 16}px\`;
      nekoEl.style.top = \`\${nekoPosY - 16}px\`;
      
      startRoaming();
      setInterval(frame, 100);
      
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'restoreState':
            if (message.state) {
              nekoPosX = message.state.nekoPosX || nekoPosX;
              nekoPosY = message.state.nekoPosY || nekoPosY;
              forceSleep = message.state.forceSleep || false;
              nekoSpeed = message.state.nekoSpeed || 10;
              ballActive = message.state.ballActive || false;
              ballX = message.state.ballX || ballX;
              ballY = message.state.ballY || ballY;
              if (ballActive) ballEl.classList.add('active');
              nekoEl.style.left = \`\${nekoPosX - 16}px\`;
              nekoEl.style.top = \`\${nekoPosY - 16}px\`;
            }
            break;
          case 'toggleBall':
            ballActive = !ballActive;
            if (ballActive) {
              const rect = container.getBoundingClientRect();
              ballX = rect.width / 2;
              ballY = rect.height / 2;
              ballVelX = 0;
              ballVelY = 0;
              ballEl.classList.add('active');
            } else {
              ballEl.classList.remove('active');
              chasingBall = false;
            }
            saveState();
            break;
          case 'toggleSleep':
            forceSleep = !forceSleep;
            isFollowing = false;
            chasingBall = false;
            nudge = false;
            if (!forceSleep) resetIdleAnimation();
            saveState();
            break;
          case 'reset':
            const rect = container.getBoundingClientRect();
            nekoPosX = rect.width / 2;
            nekoPosY = rect.height / 2;
            forceSleep = false;
            isFollowing = false;
            roamTarget = null;
            chasingBall = false;
            saveState();
            break;
          case 'setSpeed':
            nekoSpeed = message.speed;
            saveState();
            break;
          case 'pet':
            setSprite('alert', 0);
            setTimeout(() => setSprite('idle', 0), 1000);
            break;
          case 'setBackground':
            if (message.background) {
              let bgUrl;
              if (message.isCustom) {
                bgUrl = message.background;
              } else {
                bgUrl = '${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources'))}/' + message.background;
              }
              document.body.style.backgroundImage = "url('" + bgUrl + "')";
              document.body.style.backgroundSize = 'cover';
              document.body.style.backgroundPosition = 'center';
              document.body.style.backgroundRepeat = 'no-repeat';
            } else {
              document.body.style.backgroundImage = '';
            }
            break;
          case 'setSkin':
            const resourcesUri = '${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources'))}';
            const newSkinUri = resourcesUri + '/' + message.skin;
            nekoEl.style.backgroundImage = \`url('\${newSkinUri}')\`;
            break;
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