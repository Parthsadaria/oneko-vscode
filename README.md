# 🐱 Oneko Cat — VS Code Extension

A pixel cat that **lives inside VS Code** — roams around, chases your cursor, and naps when bored.

---

## 🖼️ See It in Action

| Following Cursor | Sleeping | Roaming |
|:---:|:---:|:---:|
| ![Following](https://raw.githubusercontent.com/Parthsadaria/oneko-vscode/refs/heads/main/media/following.gif) | ![Sleeping](https://raw.githubusercontent.com/Parthsadaria/oneko-vscode/refs/heads/main/media/sleeping.gif) | ![Roaming](https://raw.githubusercontent.com/Parthsadaria/oneko-vscode/refs/heads/main/media/roaming.gif) |

---

## 📍 Where to Find the Cat

After installation, look in your **Explorer sidebar** — scroll past **Timeline** and you'll see **ONEKO CAT**. Click to expand. The cat lives right there.

> 💡 **Can't see it?** Check the [FAQ](#-faq) below.

---

## ✨ What It Does

- **Roams** to random spots every 5–15 seconds
- **Follows your cursor** — tease it 2–3 times and it'll start chasing you
- **Gets bored** — goes back to wandering after ~10 seconds of chasing
- **Falls asleep** when idle
- **Scratches walls** near the panel edges
- **Draggable** — pick it up and drop it anywhere

---

## 🎮 Controls

| Action | Result |
|---|---|
| Move cursor near cat (2–3×) | Cat starts following |
| Drag | Move cat anywhere |
| Double-click | Toggle sleep / wake |
| ⋯ menu | Speed, sleep, reset, pet |

---

## 📦 Install

**VS Code Marketplace** *(easiest)*
1. `Ctrl+Shift+X` → search **"Oneko Cat"** → Install

**From VSIX**
1. Download `.vsix` from [Releases](https://github.com/Parthsadaria/oneko-vscode/releases)
2. `Ctrl+Shift+P` → `Extensions: Install from VSIX`

**From Source**
```bash
git clone https://github.com/Parthsadaria/oneko-vscode.git
cd oneko-vscode
npm install
vsce package
code --install-extension oneko-vscode-1.0.0.vsix
```

---

## ❓ FAQ

**The cat panel isn't showing up — where is it?**
Scroll to the bottom of your Explorer sidebar. The **ONEKO CAT** section appears below **Timeline** and **Outline**. If it's still missing, try reloading VS Code (`Ctrl+Shift+P` → `Developer: Reload Window`).

**The panel is there but I see nothing / it's blank.**
Expand the panel and resize it — drag the panel border to make it taller. The cat needs space to appear!

**The cat disappeared.**
Open the ⋯ menu in the panel title and click **Reset Position**. That brings it back to center.

**Can I make it faster or slower?**
Yes — ⋯ menu → **Change Speed** (Slow / Normal / Fast / Super Fast).

**How do I make it follow me?**
Move your cursor close to the cat and back away, a couple of times. After 2–3 teases it'll start chasing.

**Can I turn it off without uninstalling?**
Collapse the ONEKO CAT panel — the cat pauses when the panel is hidden.

---

## 🛠️ Development

```bash
git clone https://github.com/Parthsadaria/oneko-vscode.git
cd oneko-vscode
npm install
code .
# Press F5 to launch the extension in debug mode
```

---

## 📝 Credits

- Original concept: [oneko.js](https://github.com/adryd325/oneko.js) by adryd325
- Classic oneko sprite sheet

---

**Enjoying the cat? [Leave a review](https://marketplace.visualstudio.com/items?itemName=parthsadaria.oneko-vscode) or ⭐ [star the repo](https://github.com/Parthsadaria/oneko-vscode) — it helps a lot!**
