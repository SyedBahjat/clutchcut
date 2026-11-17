'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const engine = require('./engine');
const live = require('./live');

// Bundled ffmpeg lives outside the app archive once packaged.
const ffmpeg = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
// CLUTCHCUT_OUTPUT lets tests write somewhere disposable instead of the Videos folder.
const outputRoot = () => process.env.CLUTCHCUT_OUTPUT || path.join(app.getPath('videos'), app.getName());

const YTDLP_ASSET = { darwin: 'yt-dlp_macos', win32: 'yt-dlp.exe', linux: 'yt-dlp_linux' };

// Link downloads need yt-dlp, which must stay current to keep working, so it is
// fetched on first use rather than shipped inside the installer.
// ponytail: fetched once and never refreshed; add an update check when links start failing
async function ensureYtdlp(onProgress) {
  const asset = YTDLP_ASSET[process.platform];
  if (!asset) throw new Error('Link downloads are not supported on this system. Choose a video file instead.');
  const dest = path.join(app.getPath('userData'), asset);
  if (fs.existsSync(dest)) return dest;
  onProgress({ text: 'Setting up link downloads (first time only)…' });
  const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`);
  if (!res.ok) throw new Error(`Could not set up link downloads (HTTP ${res.status}). Check your connection.`);
  fs.writeFileSync(`${dest}.part`, Buffer.from(await res.arrayBuffer()), { mode: 0o755 });
  fs.renameSync(`${dest}.part`, dest);
  return dest;
}

// A link becomes { url, ytdlp }; a path becomes { file }. Nothing is downloaded here.
async function resolveSource(source, onProgress) {
  if (/^https?:\/\//i.test(source)) {
    if (!URL.canParse(source)) throw new Error('That link does not look valid.');
    return { url: source, ytdlp: await ensureYtdlp(onProgress) };
  }
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error('That video file could not be found.');
  return { file: source };
}

function insideOutput(file) {
  const resolved = path.resolve(String(file));
  if (!resolved.startsWith(outputRoot() + path.sep)) throw new Error('That file is outside the clips folder.');
  return resolved;
}

const toView = (clip) => ({ ...clip, url: `${pathToFileURL(clip.file).href}?t=${Date.now()}` });

ipcMain.handle('pick', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mkv', 'mov', 'webm', 'flv', 'avi', 'm4v'] }],
  });
  return filePaths[0] ?? null;
});

ipcMain.handle('clip', async (event, { source, count, frame, sensitivity }) => {
  const onProgress = (msg) => event.sender.send('progress', msg);
  source = String(source ?? '').trim();
  count = Math.min(30, Math.max(1, Math.floor(Number(count)) || 10));
  if (!source) throw new Error('Paste a link or choose a video file first.');

  const outDir = path.join(outputRoot(), new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-'));
  fs.mkdirSync(outDir, { recursive: true });

  try {
    onProgress({ text: 'Checking the link…' });
    const src = await resolveSource(source, onProgress);
    frame = String(frame);
    if (src.url && await live.isLive(src)) return await startLiveSession(event, src, outDir, frame, sensitivity);
    const clips = await engine.clipVideo({ ffmpeg, source: src, count, frame, outDir, onProgress });
    return { source, frame, clips: clips.map(toView) };
  } catch (e) {
    try { fs.rmdirSync(outDir); } catch { /* has clips in it; keep them */ }
    throw e;
  }
});

// One live stream at a time: clips arrive on the 'live-event' channel until it ends or is stopped.
let session = null;

async function startLiveSession(event, src, outDir, frame, sensitivity) {
  if (session) throw new Error('A live stream is already being clipped. Stop it first.');
  event.sender.send('progress', { text: 'Connecting to the live stream…' });
  const send = (e) => {
    if (event.sender.isDestroyed()) return;
    event.sender.send('live-event', e.type === 'clip' ? { ...e, clip: toView(e.clip) } : e);
    if (e.type === 'ended') session = null;
  };
  session = await live.startLive({ ffmpeg, source: src, outDir, frame, sensitivity: String(sensitivity || 'normal'), onEvent: send })
    .catch((e) => { session = null; throw e; });
  return { live: true, frame };
}

ipcMain.handle('live-stop', async () => { if (session) await session.stop(); });
app.on('before-quit', () => { session?.kill(); });

ipcMain.handle('recut', async (event, { source, file, start, end, frame }) => {
  start = Number(start);
  end = Number(end);
  if (!(start >= 0) || !(end > start)) throw new Error('End must be after start.');
  file = insideOutput(file);
  const src = await resolveSource(String(source), (msg) => event.sender.send('progress', msg));
  await engine.render({ ffmpeg, source: src, start, end, dest: file, frame: String(frame) });
  return toView({ file, start, end });
});

ipcMain.handle('save', async (event, file) => {
  file = insideOutput(file);
  const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: path.join(app.getPath('downloads'), path.basename(file)),
    filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
  });
  if (canceled || !filePath) return null;
  fs.copyFileSync(file, filePath);
  return filePath;
});

ipcMain.handle('remove', async (event, file) => {
  file = insideOutput(file);
  const { response } = await dialog.showMessageBox(BrowserWindow.fromWebContents(event.sender), {
    type: 'warning',
    message: 'Delete this clip?',
    detail: `${path.basename(file)} will be removed from your computer. This cannot be undone.`,
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  });
  if (response !== 0) return false;
  fs.rmSync(file, { force: true });
  return true;
});

// Fixed address: the page cannot ask the app to open anything else.
ipcMain.handle('star', () => shell.openExternal('https://github.com/SyedBahjat/clutchcut'));

ipcMain.handle('reveal', (_event, file) => shell.showItemInFolder(insideOutput(file)));

ipcMain.handle('open-folder', () => {
  fs.mkdirSync(outputRoot(), { recursive: true });
  return shell.openPath(outputRoot());
});

// The website hands a link over as clutchcut://clip?url=<video link>. It only fills in the
// box; the person still presses the button, so a web page can never start work by itself.
const PROTOCOL = 'clutchcut';
let win = null;
let pendingLink = null;

function linkFrom(args) {
  const raw = args.find((a) => String(a).startsWith(`${PROTOCOL}://`));
  if (!raw || !URL.canParse(raw)) return null;
  const target = new URL(raw).searchParams.get('url') ?? '';
  return /^https?:\/\//i.test(target) && URL.canParse(target) ? target : null;
}

function offer(link) {
  if (!link) return;
  if (win && !win.webContents.isLoading()) {
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send('prefill', link);
  } else {
    pendingLink = link;
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => offer(linkFrom(argv)));
  app.on('open-url', (event, url) => { event.preventDefault(); offer(linkFrom([url])); }); // macOS

  app.whenReady().then(() => {
    // Registering only when installed keeps `npm start` from hijacking the link handler.
    if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL);
    const icon = path.join(__dirname, 'build', 'icon.png');
    if (process.platform === 'darwin' && fs.existsSync(icon)) app.dock?.setIcon(icon);

    win = new BrowserWindow({
      width: 1180,
      height: 820,
      minWidth: 760,
      minHeight: 600,
      backgroundColor: '#0b0a09',
      icon: fs.existsSync(icon) ? icon : undefined,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
    });
    win.setMenuBarVisibility(false);
    win.webContents.once('did-finish-load', () => {
      offer(pendingLink ?? linkFrom(process.argv));
      pendingLink = null;
    });
    win.loadFile(path.join(__dirname, 'index.html'));
  });

  app.on('window-all-closed', () => app.quit());
}
