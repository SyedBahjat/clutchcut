# ClutchCut

Finds the standout moments in long gameplay videos and cuts them into clips. It runs on your
own computer: paste a link or choose a file, and the video never leaves your machine.

Paste a link or drop a file. Today it finds moments from the audio (shouts, laughs, crashes that jump above the stream's
normal level), keeps the setup before each one and the reaction after, and lands the cuts in
a pause. Clips can be vertical with the whole picture kept, vertical zoomed in, or left as-is,
and you can adjust any clip's start and end and re-cut it.

## Install

**macOS** (Apple silicon or Intel). Paste this into Terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/SyedBahjat/clutchcut/main/install.sh | bash
```

It downloads the latest release, puts ClutchCut in Applications and opens it ([read the script](install.sh)).

<details>
<summary>Prefer the .dmg? Read this first</summary>

ClutchCut isn't notarized by Apple, so macOS blocks it when a browser downloads it ("ClutchCut
is damaged" or "Apple could not verify…"). After dragging it to Applications, run this once:

```sh
xattr -cr /Applications/ClutchCut.app
```

This only removes the "downloaded from the internet" flag.
</details>

**Windows:** download `ClutchCut-Setup-x.y.z.exe` from [Releases](https://github.com/SyedBahjat/clutchcut/releases/latest).
On the SmartScreen prompt, click **More info** → **Run anyway**.

## Run from source

You need [Node.js](https://nodejs.org) 22 or newer. From the project folder:

```sh
npm start      # installs what the app needs the first time, then opens it
npm test       # checks the clip-finding logic
npm run web    # the website, at http://localhost:3000
```

(`npm start` works from this folder; the app itself lives in `desktop/`.)

## Releasing

Set the version in `desktop/package.json`, then push a matching tag (`v0.1.0`). GitHub Actions
builds the Mac and Windows installers and attaches them to a release.

## Your responsibility

You are responsible for having the rights to the videos you download, clip and post.

## Licence

MIT. The installers bundle [FFmpeg](https://ffmpeg.org) (GPL build, via `ffmpeg-static`), and
link downloads use [yt-dlp](https://github.com/yt-dlp/yt-dlp), fetched on first use.
