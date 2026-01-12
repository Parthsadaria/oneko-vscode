const vscode = require('vscode');

function activate(context) {
  console.log('Oneko extension activated!');
  
  const provider = new OnekoViewProvider(context.extensionUri);
  
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
  '🖼️ Change Background' // <-- Add this line
], {
  placeHolder: 'What do you want to do with the cat?'
});
      
      if (!choice) return;
      if (choice.includes('Background')) {
  const backgrounds = [
    { label: 'Default', value: '' },
    { label: 'Cat Room', value: 'cat-room-1.png' },
    // { label: 'Night', value: 'bg2.png' }
  ];
  const bgPick = await vscode.window.showQuickPick(backgrounds.map(b => b.label));
  const selected = backgrounds.find(b => b.label === bgPick);
  if (selected) {
    provider.sendMessage({ command: 'setBackground', background: selected.value });
  }
}
      if (choice.includes('Skin')) {
  const skins = [
    { label: 'Neko', value: 'oneko-classic.gif' },
    { label: 'Bhondu', value: 'oneko-dog.gif' },
    { label: 'Maia', value: 'oneko-maia.gif' },
     { label: 'Tora', value: 'oneko-maia.gif' }
  ];
  const skinPick = await vscode.window.showQuickPick(skins.map(s => s.label));
  const selected = skins.find(s => s.label === skinPick);
  if (selected) {
    provider.sendMessage({ command: 'setSkin', skin: selected.value });
  }
}
      if (choice.includes('Sleep')) {
        provider.sendMessage({ command: 'toggleSleep' });
      } else if (choice.includes('Reset')) {
        provider.sendMessage({ command: 'reset' });
      } else if (choice.includes('Speed')) {
        const speeds = ['🐌 Slow', '🚶 Normal', '🏃 Fast', '⚡ Super Fast'];
        const speed = await vscode.window.showQuickPick(speeds);
        if (speed) {
          const speedValue = speed.includes('Slow') ? 5 : speed.includes('Normal') ? 10 : speed.includes('Fast') ? 15 : 20;
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
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this._view = undefined;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    
    webviewView.webview.html = this._getHomeHtml(webviewView.webview);
  }
  
  sendMessage(message) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  _getHomeHtml(webview) {
    const defaultSkin = 'oneko-classic.gif';
    const onekoGifUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'resources', defaultSkin)
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${webview.cspSource} data:;">
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
  </style>
</head>
<body>
  <div id="container">
    <div id="oneko"></div>
  </div>
  
  <script>
    (function() {
      const nekoEl = document.getElementById('oneko');
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
          if (!isFollowing && !forceSleep && !grabbing) {
            roamTarget = getRandomRoamTarget();
          }
        }, 5000 + Math.random() * 10000);
      }
      
      function idle() {
        idleTime += 1;
        
        if (idleTime > 100 && !forceSleep && Math.random() < 0.01) {
          forceSleep = true;
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
        
        if (grabbing) {
          grabStop && setSprite('alert', 0);
          return;
        }
        
        let targetX = mousePosX;
        let targetY = mousePosY;
        
        if (!isFollowing && roamTarget && !forceSleep) {
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
        
        if ((distance < nekoSpeed || distance < 48) && !forceSleep && !roamTarget) {
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
        
        if (distance < 100 && !isFollowing) {
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
      
      nekoEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        grabbing = true;
        isFollowing = false;
        forceSleep = false;
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
          document.removeEventListener('mousemove', mousemove);
          document.removeEventListener('mouseup', mouseup);
        };
        
        document.addEventListener('mousemove', mousemove);
        document.addEventListener('mouseup', mouseup);
      });
      
      nekoEl.addEventListener('dblclick', () => {
        forceSleep = !forceSleep;
        isFollowing = false;
        nudge = false;
        if (!forceSleep) {
          resetIdleAnimation();
        }
      });
      
      nekoEl.style.left = \`\${nekoPosX - 16}px\`;
      nekoEl.style.top = \`\${nekoPosY - 16}px\`;
      
      startRoaming();
      setInterval(frame, 100);
      
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'toggleSleep':
            forceSleep = !forceSleep;
            isFollowing = false;
            nudge = false;
            if (!forceSleep) resetIdleAnimation();
            break;
          case 'reset':
            const rect = container.getBoundingClientRect();
            nekoPosX = rect.width / 2;
            nekoPosY = rect.height / 2;
            forceSleep = false;
            isFollowing = false;
            roamTarget = null;
            break;
          case 'setSpeed':
            nekoSpeed = message.speed;
            break;
          case 'pet':
            setSprite('alert', 0);
            setTimeout(() => setSprite('idle', 0), 1000);
            break;
          case 'setBackground':
            if (message.background) {
              const bgUri = '${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources'))}/' + message.background;
              document.body.style.backgroundImage = "url('" + bgUri + "')";
              document.body.style.backgroundSize = 'cover';
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