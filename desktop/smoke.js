'use strict';
// End-to-end check of the real app: opens the window, clips a video through the
// UI, saves a screenshot.   npx electron smoke.js <video> <screenshot.png>
const { app } = require('electron');
const fs = require('node:fs');

const [video, shot] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    const js = (code) => win.webContents.executeJavaScript(code);
    await js(`document.getElementById('source').value = ${JSON.stringify(video)};
              document.getElementById('job').requestSubmit();`);
    let state;
    for (let i = 0; i < 240; i++) {
      await sleep(500);
      state = await js(`({ clips: document.querySelectorAll('.clip').length,
                           busy: document.getElementById('go').disabled,
                           status: document.getElementById('status').textContent })`);
      if (!state.busy) break;
    }
    await sleep(1500); // let the video thumbnails paint
    fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
    console.log(JSON.stringify(state));
    app.exit(state.clips > 0 ? 0 : 1);
  });
});

require('./main.js');
