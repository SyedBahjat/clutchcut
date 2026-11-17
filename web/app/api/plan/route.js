import { engine, ffmpeg, ytdlp, cleanLink, linkInfo, readable, MAX_CLIPS, MAX_HOURS } from '../../../lib/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

// POST { url, count } → { title, clips: [{ peak, scoreDb, start, end }] }
// Only the audio is streamed through the analyser; nothing is saved.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = cleanLink(body.url);
    const count = Math.min(MAX_CLIPS, Math.max(1, Math.floor(Number(body.count)) || 5));
    const source = { url, ytdlp: await ytdlp() };

    const info = await linkInfo(source);
    if (info.live) return Response.json({ error: 'That stream is live right now. Live clipping needs the desktop app, which keeps listening as it broadcasts.' }, { status: 400 });
    if (info.duration > MAX_HOURS * 3600) return Response.json({ error: `That video is over ${MAX_HOURS} hours. Use the desktop app for long videos; it has no time limit.` }, { status: 400 });

    const clips = await engine.findMoments(ffmpeg, source, count);
    return Response.json({ title: info.title, clips });
  } catch (e) {
    return Response.json({ error: readable(e) }, { status: 400 });
  }
}
