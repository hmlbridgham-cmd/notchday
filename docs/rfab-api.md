# Reality Fabricator API

Reference for making pictures, video, game art, and loading animations with the account at https://rfab.ai. Open this when a task needs that art. Nothing here applies otherwise.

Send the key from the `RFAB_API_KEY` environment variable as the `X-API-Key` header. The value lives in `.env` and is not stored in this file.

Base URL: `https://api.rfab.ai`

Complete reference, if a task needs more than this summary: https://rfab.ai/llms-full.txt

## Pictures

`POST /api/image-generation/generate` with a JSON body:

```json
{
  "prompt": "...",
  "modelId": "openai:gpt-image-2",
  "width": 1024,
  "height": 1024,
  "async": true
}
```

The response includes a `jobId`. `GET /api/image-generation/job/:jobId` returns the image URL once the job is completed. Image URLs are permanent.

The default quality tier looks the same as the higher ones at normal size. Better results come from a better model or a better prompt.

Ranked models: `GET /api/image-generation/models`.

## Video

`POST /api/image-generation/generate-video` starts from a still picture:

```json
{
  "imageUrl": "...",
  "prompt": "...",
  "videoModelId": "atlascloud:seedance-2.5-i2v",
  "duration": 5
}
```

The same job endpoint returns `result.videoUrl` when the job is completed. Prompts work best when they describe only what moves. `"camera locked"` keeps the camera still.

## Game art

Use style `"pixel-art"` or `"game-assets"` for sprites. Use `alphaRegion` for HUD frames with a see-through window. `POST /api/image-generation/isolate-figure` produces a transparent cut-out.

Sets match when every prompt starts with the same character paragraph.

## Page headers and buttons

Draw larger than the slot (for example 1536×1024) and crop. Image models misspell words, so headings and button labels go on top in HTML.

## Loading animations

Follow the "Transparent Looping Animation" section of the full reference: green-screen character, animate, key out with ffmpeg, and loop as a transparent `.webm`.

## Cost

Calls spend tokens from the account balance (`GET /api/tokens/balance`). $1 = 50,000 tokens. A picture is a few cents.
