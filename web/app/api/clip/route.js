import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { engine, ffmpeg, ytdlp, cleanLink, readable, FRAMES, MAX_CLIP_SECONDS } from '../../../lib/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

// GET ?url&start&end&frame → the clip as an mp4, streamed straight back.
// Only those seconds are fetched, and the file is deleted once it has been sent.
export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clutchcut-'));
  const done = () => fs.rmSync(dir, { recursive: true, force: true });
  try {
    const url = cleanLink(q.get('url'));
    const start = Number(q.get('start'));
    const end = Number(q.get('end'));
    const frame = q.get('frame');
    if (!(start >= 0) || !(end > start) || end - start > MAX_CLIP_SECONDS) throw new Error(`A clip must be between 0 and ${MAX_CLIP_SECONDS} seconds long.`);
    if (!FRAMES.includes(frame)) throw new Error('Unknown shape.');

    const dest = path.join(dir, 'clip.mp4');
    await engine.render({ ffmpeg, source: { url, ytdlp: await ytdlp() }, start, end, dest, frame });

    const file = fs.createReadStream(dest);
    file.on('close', done);
    return new Response(Readable.toWeb(file), {
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(fs.statSync(dest).size), 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    done();
    return Response.json({ error: readable(e) }, { status: 400 });
  }
}
