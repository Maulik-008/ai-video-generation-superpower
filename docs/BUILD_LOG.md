# How video-studio was built: stage-by-stage build log

A plain-language record of everything done in this session: what you asked, what was built at each stage, which tools, agents and prompts were used, what went wrong, and how many tokens it cost.

- **Session:** 3 November 2026, about 2 hours of wall-clock time (09:54 to 11:53 UTC, including your reading time).
- **Model:** Claude Sonnet 5.5 (`claude-sonnet-5-5`) in Claude Code inside VS Code.
- **Result:** a skill that turns any story into a finished animated video with voices, plus a worker agent, a code-rendered video engine, and 3 working example videos.
- **Where the numbers come from:** the session's own transcript on disk (`~/.claude/projects/.../<session>.jsonl`), summed per API call. Section 2 explains how to read them.

---

## 1. The big picture

### What exists now

```
You: "make a video about <any story>"
  │
  ▼
/video-studio  (the DIRECTOR skill, runs in the main conversation)
  ├─ 1 Understand   read what you already said (premise, tone, length, language…)
  ├─ 2 Ask          multiple-choice questions, only for what is missing
  ├─ 3 Brainstorm   3 different story concepts → you pick one
  ├─ 4 Script       full shot list + dialogue → you confirm once
  └─ 5 Write        studio/projects/<slug>/story.json
  │
  ▼
video-producer  (the WORKER agent)
  ├─ validate story.json
  ├─ voices        free Microsoft Edge neural voices → WAV, trimmed, lip-sync envelope
  ├─ render        three.js characters + sets in headless Chrome, 6 parallel browsers
  ├─ look          reads preview still frames, fixes technical problems (camera, cast…)
  └─ mux           ffmpeg: video + mixed audio → MP4 in Videos\VideoStudio
  │
  ▼
Director reports the file, offers quick tweaks (a re-render takes about 30 seconds)
```

### Key numbers

| Item | Value |
|---|---|
| Your messages (prompts) | 9 requests, plus 1 mid-turn message |
| Main-session API calls | 92 (when measured, just before this file was written) |
| Tool calls by me | 121 (Bash 45, Write 36, Read 21, PowerShell 5, Edit 4, Agent 3, Grep 2, ToolSearch 2, Glob 1, connector 2) |
| Subagents run | 2 (both finished successfully) |
| Output tokens (what the model wrote) | about 252,000 main + 13,600 in subagents ≈ **265,000** |
| Code written | about 2,800 lines (studio engine) |
| Instruction/prompt files written | about 750 lines (skill, agent, engines, formats, references, README) |
| Videos produced | 3 (30.5 s, 15.8 s, 26.8 s), all 720×1280 with audio |
| Render speed | a 30 s video renders in about 13 s on an RTX 4060 (about 25 s for the whole build) |

---

## 2. Token usage

### How to read the numbers

Every time the model is called, the call reports four counts:

| Column | Meaning | Cost character |
|---|---|---|
| **New input** | Tokens sent fresh and not cached | normal price (tiny here) |
| **Cache write** | Tokens added to the conversation memory that the next calls can reuse | above the normal input price (roughly 1.25× to 2×, depending on how long the cache lives) |
| **Cache read** | The existing conversation re-read on every call | a small fraction of the input price (roughly 0.1×) |
| **Output** | Tokens the model wrote (code, files, replies, thinking) | the most expensive per token |

**Cache read looks huge (24.6 million) but it is not 24.6 million new tokens.** The whole conversation (from about 70 thousand tokens at the start to about 400 thousand by the end) is re-read on every one of the 92 calls, which is why it grows with each call. It is billed at a small fraction of the normal price. The meaningful numbers are **cache write + new input** (what actually got added) and **output**.

I can't see price lists or your plan, so **I cannot give a dollar figure**. Claude Code's `/cost` command (or your plan's usage page) shows the real cost for this session.

### Main session, by stage

| # | Stage | API calls | New input | Cache write | Cache read | Output |
|---|---|---:|---:|---:|---:|---:|
| 1 | Read the repo, suggest names | 6 | 14 | 65,995 | 422,922 | 2,634 |
| 2 | "Make it generic" (answer) | 1 | 4 | 1,452 | 97,184 | 1,234 |
| 3 | Rename and restructure to `video-studio` | 4 | 10 | 14,140 | 412,189 | 12,440 |
| 4 | "Is this possible?" (feasibility) | 3 | 10 | 10,328 | 341,396 | 2,083 |
| 5 | Analyse your two sample videos | 6 | 14 | 12,265 | 755,701 | 5,369 |
| 6 | **Build the complete flow** | **52** | 106 | **240,042** | 14,596,756 | **199,925** |
| 7 | Verify agent #1, apply its feedback | 6 | 14 | 13,258 | 2,292,140 | 7,437 |
| 8 | Suggest story ideas | 1 | 4 | 1,396 | 388,669 | 1,554 |
| 9 | "The 3 A.M. Deploy": script and agent #2 | 4 | 10 | 10,641 | 1,580,848 | 8,907 |
| 10 | Verify agent #2, fix, polish | 5 | 12 | 10,169 | 2,025,726 | 4,930 |
| 11 | This document (partial, measured before the write) | 4 | 10 | 6,259 | 1,652,270 | 5,070 |
| | **Total** | **92** | **208** | **385,945** | **24,565,801** | **251,583** |

**Stage 6 is 79% of all output.** That is where the engine, the schema, the character system, the six sets and the instruction files were written. Everything else was conversation, checking and small fixes.

### Subagents (their own separate conversations)

| Agent | What it did | API calls | New + cache write | Cache read | Output | Tool calls | Time |
|---|---|---:|---:|---:|---:|---:|---|
| #1 `a7f5d45…` | Built `hindi-chai` from the written instructions only | 16 | 94,780 | 1,187,948 | 7,660 | 21 | 131 s |
| #2 `aaf6f2e…` | Built `the-3am-deploy` | 15 | 97,646 | 1,111,185 | 5,939 | 26 | 131 s |

The agents' own completion notices reported 96,585 and 98,577 total tokens; the small difference from the table is how the two sources count. Both agents also made the standard `set_up_session` call to the ZURU Connector Hub that your organisation's instructions require at session start.

### Everything together

| | Tokens |
|---|---:|
| Fresh tokens added (new input + cache write): main + 2 agents | about 579,000 |
| Output tokens: main + 2 agents | about 265,000 |
| Cache reads (re-reading context, cheap): main + 2 agents | about 26.9 million |

**What drove the cost:** the number of steps (92 calls × re-reading a growing context) more than the size of any single step. The most effective ways to spend less next time: give a clear brief up front, keep the conversation shorter by starting a fresh session for unrelated tasks, and avoid reading large images repeatedly (each Read of a frame costs context that is then re-read on every later call).

---

## 3. Stage by stage

Each stage lists: **your prompt → what I understood → steps → tools → result → problems and decisions**.

### Stage 1: Read the repo and suggest a better name

**Your prompts:** "see browser based video generation repo please and read this all" and, mid-turn, "and suggest a this skill's name more better please".

**Steps**
1. Org rule: called the ZURU Connector Hub `set_up_session` once before anything else (needed a `ToolSearch` to load its schema first). It returned 48 connectors and 25 saved skills; none were relevant.
2. Listed the working folder; found `browser-based-video-generate-ai-agent/`.
3. Read all four files (README, SKILL, format reference, agent) and the git log (one commit).

**Tools:** ToolSearch, `set_up_session`, Glob, Bash (ls, find, git), Read ×4.

**What the repo was:** a Claude Code skill `talkstuff-video` plus an agent `talkstuff-video-producer` that drive *your own Chrome* through ChatGPT's TalkStuff GPT, Gemini (images) and Google Flow / Grok Imagine (videos).

**Result:** a summary and 4 better names. I noted that the old name was tied to one GPT that retires on 2026-12-11, and that the agent file pointed at a wrong folder path.

### Stage 2: "Make it more generic, we will add more later"

**Your prompt:** "no make it more better like generic because in future we will implement more into it"

**Result:** proposed `video-studio` / `video-producer`, with the idea that **formats** (what kind of video) live in separate files and the skill/agent stay generic. Also suggested the repo name `video-super-power`, matching your sibling repos. No files changed.

### Stage 3: Rename and restructure

**Your prompt:** "make like this: video-studio / video-producer"

**Steps:** `git mv` the skill folder, the agent file and the format file (to keep history); rewrote `SKILL.md`, `formats/talkstuff.md`, the agent file and the README; changed `plan.json` from `characters[]` to a generic `items[]`; searched for leftover old names (none).

**Tools:** Bash (`git mv`), Write ×4, Grep, Bash (git status).

**Decision:** I did not rename the repo folder itself, because it was the folder the session was running in. (You committed the rename yourself later.)

### Stage 4: "Can Claude make animated videos with voice for any story?"

**Your prompt:** "can it be possible with claude we can create some skill or code which can generate this kind of videos…"

**Steps:** Explained that Claude cannot render video itself; it writes the script and code and other tools render. Loaded and listed the tools of ZURU's `image-gen` connector (fal.ai) to see what was available (text-to-image, image-to-video, text-to-speech, lip-sync, music…). Proposed 3 approaches: browser, API, code-rendered.

**Tools:** ToolSearch, ZURU Connector Hub `list_tools`.

**Note:** this stage proposed the API route; the next prompt ruled it out.

### Stage 5: Analyse your two sample videos

**Your prompt:** "see I am giving you an example of videos… don't depend on ZURU APIs or ZURU accounts… see in downloads these 2 files" (with a screenshot).

**Steps**
1. Found `1000353897.mp4` and `1000353898.mp4` in Downloads (56 s and 50 s).
2. No ffmpeg installed. Created an **isolated Python venv in the scratchpad** and installed `imageio-ffmpeg` (bundles an ffmpeg binary). Copied the videos there (worked on copies).
3. Probed streams: both 720×1280, 30 fps, AAC audio.
4. Extracted one frame every 4 seconds into contact sheets and read them.

**Tools:** PowerShell (file listing, Shell metadata, venv, pip), Read ×2 (images).

**What I saw:** low-poly 3D dialogue shorts, a human developer and an orange cube "AI", night-city and violet-space sets, burned-in captions coloured per speaker, cuts every few seconds, comedic punchlines. I did not listen to the audio.

**Decision from your constraint:** no ZURU connectors in the pipeline. Everything must run on free tools.

### Stage 6: Build the complete flow (the big one)

**Your prompt:** "Okay create complete flow with agent: when I ask the agent with a story… if it has a question it can ask me with options, and after brainstorm it can generate a video…"

This stage had 16 sub-steps.

| Step | What happened |
|---|---|
| 6.1 Check the machine | Node 22, npm 10, latest versions of every package, Chrome path, GPU (RTX 4060), 28 threads, 32 GB RAM |
| 6.2 First design: Remotion | Scaffolded a Remotion + react-three-fiber project and started `npm install` in the background |
| 6.3 **Licence check, pivot** | Remotion needs a paid company licence for organisations with more than 3 people, which would make ZURU use risky. **Dropped it** and designed a smaller renderer: three.js in headless Chrome (puppeteer-core) + ffmpeg. All tools are MIT/Apache, except the ffmpeg binary (GPL-3.0, separate program). Details in section 7 (a broad `taskkill` was blocked here) |
| 6.4 New dependencies | `three`, `esbuild`, `puppeteer-core`, `msedge-tts`, `zod`, `ffmpeg-static`, `tsx`, `typescript`. Installed in 21 s |
| 6.5 Probe the free voice library | `msedge-tts` only outputs MP3/Opus (my WAV request used an enum value that doesn't exist). Fixed by decoding MP3 → 24 kHz WAV with ffmpeg. A test call worked |
| 6.6 Schema | `types.ts`: the `story.json` contract with zod (characters, sets, emotions, actions, camera, voices) and the computed `timeline` types |
| 6.7 Voice pipeline | WAV parser, silence trimming, **lip-sync envelope** (mouth openness per frame from the audio), Edge TTS with retries and cache, **automatic offline fallback** (Windows speech) for the whole run |
| 6.8 Story validation | Beyond the schema: unknown speakers, missing durations, duplicate ids, cast checks, length warnings |
| 6.9 Timeline builder | Turns story + audio into exact frames, caption chunks per speaker, and music |
| 6.10 First test | An original example story ("Just One Small Change") through validate and TTS: 8 lines, 28.3 s |
| 6.11 The 3D engine | Character system (human, cube, blob) with a shared face (eyes, brows, mouth, blink), 10 emotions and 8 gestures; 6 sets built from primitives; camera rigs (8 shot types, 7 moves, hand-held drift); a `World` that renders any frame from the timeline |
| 6.12 Render side | esbuild bundle of the engine, browser launcher, frame capture, ffmpeg audio mix (adelay, amix, loudnorm, optional music ducking) |
| 6.13 First stills | Rendered one frame per shot on the GPU: it worked first time. Fixed: string lights that looked like soap bubbles, empty floor in the two-shot, the cube cropped in its close-up, brows lost in the hair. Added a wide title shot to test overlays |
| 6.14 Full render, **failure #1** | 6 tabs in one browser: every screenshot timed out after 180 s (Chrome only renders the visible tab). Fixed by launching **one browser per worker**. Result: 915 frames in 13 s |
| 6.15 Verify the real MP4 | Extracted a contact sheet and ran audio analysis: speech started at 2.48 s (expected 2.45 s), peak −1.5 dB, no clipping |
| 6.16 Gallery test | A second test story covering the other 5 sets and the blob/cap/bob characters. Found and fixed 6 problems (read-only `position` bug in the park bench, fog washing out wide shots, floors ending too early, blown-out office window, laptop hiding the centre character, table not moving with the laptop) |
| 6.17 Verified voice names | Pulled the live list: 322 voices, including Hindi and Gujarati |
| 6.18 Instruction files (the "prompts") | See section 4: `story.md`, `brainstorm.md`, `studio.md`, `browser.md` (assembled from the old files so nothing was lost), the new director `SKILL.md`, the generic `video-producer.md`, README |
| 6.19 Independent agent test | A fresh agent built a **Hindi** story using only the written instructions (section 5) |

**Tools:** 78 tool calls in this stage (mostly Write and Bash, plus Read for the preview images, Edit, PowerShell and one Agent launch).

### Stage 7: Act on agent #1's report

**Trigger:** the agent finished and reported back. Its report is data, not instructions, so I evaluated it myself.

**Verified:** rebuilt both videos and looked at contact sheets (Hindi captions render as real Devanagari).

**Fixes made (in the engine, not only in the docs):**
1. `preview`/`render` silently used a stale `timeline.json` after you edited a story. They now rebuild it automatically when `story.json` is newer.
2. The laptop covered a face in medium shots. It now parks beside the focus character in close/medium shots.
3. Added to the runbook: check props covering faces, partial captions are not a bug, a better size check.

Also saved a project memory note (design constraints) for future sessions.

### Stage 8: Story ideas

**Your prompt:** "suggest some idea please"

**Result:** 8 story ideas (each with cast, set, hook line, punchline), uses beyond comedy, and 6 engine upgrade ideas (sound effects first). No tools used.

### Stage 9: "The 3 A.M. Deploy"

**Your prompt:** "choose this idea and create it please: The 3 a.m. deploy"

**Steps**
1. Acted as the director. You had already chosen the concept, so I skipped the question rounds.
2. Rewrote the joke's logic: the loophole is "You said three a.m. It is three oh seven", which fits the title and avoids a timezone claim that would have been false.
3. Wrote `story.json` (9 shots, 7 voiced lines), validated it.
4. Tried the `video-producer` agent: **"Agent type not found"**, because new agent files only register after a Claude Code restart. Fell back to a general-purpose agent told to follow `video-producer.md`.
5. Agent #2 built the video on the first try (26.8 s).

### Stage 10: Verify agent #2, fix, polish

**Agent's findings I acted on:**
- The laptop covered Dev's mouth in the over-shoulder shot → also parked it away in over-shoulder shots.
- The `!` marker on the laptop screen text was dropped → now shown.
- I spotted a caption wrapping "a.m." alone on a line → added `text-wrap: balance`.

Rebuilt, checked the contact sheet and audio levels (mean −19 dB, peak −1.5 dB).

### Stage 11: This document

I measured real usage from the transcript, counted lines of code, and wrote this file.

---

## 4. The prompts and instructions (what actually "programs" the agent)

In this project the prompts are **files in the repo**. They are what Claude reads when you run `/video-studio`.

| File | Role | Lines |
|---|---|---:|
| `.claude/skills/video-studio/SKILL.md` | **The director.** Triggers on "make a video…", defines the five moves, when to ask, when to skip ("surprise me"), how to launch the agent, the safety rules | 60 |
| `.claude/skills/video-studio/references/brainstorm.md` | The **question bank** (exact options for length, tone, world, cast, language), how to brainstorm 3 distinct concepts with `preview`, the final confirmation | 91 |
| `.claude/skills/video-studio/formats/story.md` | What the engine can draw, the `story.json` contract, the voice table, and the **writing rules** (hook in 2 s, short lines, shot rhythm, acting) | 140 |
| `.claude/skills/video-studio/engines/studio.md` | Commands, requirements, the **worker runbook** (validate → build → look at stills → fix → verify → report), troubleshooting | 87 |
| `.claude/skills/video-studio/engines/browser.md` | The older Gemini + Flow/Grok route, kept intact | 158 |
| `.claude/skills/video-studio/formats/talkstuff.md` | TalkStuff talking-object format (browser engine) | 89 |
| `.claude/agents/video-producer.md` | The worker agent: scope rules, "creative content is not yours to change", return format | 48 |
| `README.md` | Human-facing overview | 68 |

**Design choices worth knowing**
- **Questions only in the director, never in the agent:** only the main conversation can ask you questions.
- **Generic skill + specific formats/engines:** to add a new kind of video, add a file in `formats/`; to add a new way of rendering, add one in `engines/`. The skill and agent do not change.
- **One confirmation covers the build:** it states clearly that the dialogue text goes to Microsoft's free TTS service.
- **The agent fixes technical problems only** (camera, cast, timing); it never rewrites the story.

### The two prompts sent to agents (verbatim)

**Agent #1 (Hindi test):**
> You are acting as the `video-producer` worker agent. Your instructions are in this file; read it first and follow it exactly: `…\.claude\agents\video-producer.md`. It will point you to the studio engine runbook (section "Worker runbook"). Follow that too.
> Brief from the director: engine: studio · project slug: hindi-chai · studio folder (absolute): `…\studio` · res: 720p · provider: auto · The user approved this build (voices via Microsoft's free TTS, rendering locally, files written under studio/projects and the user's Videos folder). The story.json is already written. The dialogue is Hindi on purpose: when you look at the stills, also check that the Devanagari captions render as real glyphs. This is a test of whether the written runbook is sufficient on its own, so do not rely on any other context. Do not change dialogue. At the end, return the exact STATUS block the runbook specifies, and add one line: "runbook feedback: …".

**Agent #2 (the 3 A.M. Deploy):**
> You are acting as the `video-producer` worker agent… (same opening) …Brief from the director: engine: studio · project slug: the-3am-deploy · studio folder (absolute): `…\studio` · res: 720p · provider: auto · The user approved this build (voices via Microsoft's free TTS, rendering locally, files written under studio/projects and the user's Videos folder). story.json is already written and validated. Do not change dialogue. Return the exact STATUS block the runbook specifies.

---

## 5. The agents: what they did and why a general-purpose agent

| | Agent #1 (Hindi test) | Agent #2 (3 A.M. Deploy) |
|---|---|---|
| Type used | `general-purpose`, told to follow `video-producer.md` | same |
| Why not `video-producer` directly | New agent files are registered at session start, so it was "not found" | same |
| Followed | agent file → studio runbook | same |
| Steps | validate → build → read 5 stills → fixed one camera (medium → close, because the laptop covered an eye) → rebuilt → verified | validate → build → read 9 stills → no fixes needed → verified |
| Result | `DONE`, 15.8 s, voices: edge | `DONE`, 26.8 s, voices: edge |
| Useful feedback | 5 points on the runbook (stale preview, props covering faces, partial captions, size rule). All applied | Found the laptop covering Dev's mouth and the missing `!` marker. Both fixed |

**Why this was a good test:** both agents had no memory of the conversation. They only had the written instructions, so every gap in the docs showed up as a question or a mistake.

---

## 6. Technology used

| Layer | Tool | Licence | Why |
|---|---|---|---|
| 3D drawing | three.js | MIT | Low-poly characters and sets from primitives, deterministic per frame |
| Headless browser | puppeteer-core + your Chrome/Edge | Apache-2.0 | Renders WebGL on your GPU; no download needed |
| Bundling | esbuild | MIT | Bundles the engine into one script in milliseconds |
| Voices | msedge-tts (Microsoft Edge neural voices) | MIT | Free, 322 voices, many languages, no account |
| Offline voice | Windows System.Speech (PowerShell) | built in | Fallback when there is no internet |
| Audio/video mix | ffmpeg (system, or `ffmpeg-static`) | GPL-3.0 (binary) | adelay, amix, loudnorm, sidechain ducking, h264 |
| Validation | zod | MIT | Clear error messages for the story file |
| Run TypeScript | tsx + typescript | MIT/Apache | Scripts without a build step |

**Not used on purpose:** Remotion (licence), ZURU connectors/fal.ai (your requirement), any paid API.

### Files in the engine

| Area | Files | Lines |
|---|---|---:|
| Schema | `src/types.ts` | 159 |
| Characters | `src/engine/characters.ts` (human, cube, blob, shared face) | 541 |
| Sets | `src/engine/sets.ts` (6 sets, laptop) | 586 |
| World + camera | `world.ts` 218 · `camera.ts` 126 · `emotions.ts` 52 · `textures.ts` 127 · `util.ts` 27 · `main.ts` 36 | 586 |
| Player page | `src/player/index.html` | 31 |
| Pipeline scripts | `scripts/*.ts`, `scripts/lib/*.ts`, `sapi.ps1` | about 870 |

---

## 7. What went wrong, and what it taught us

| # | Problem | How it was found | Fix / lesson |
|---|---|---|---|
| 1 | Planned Remotion; its licence is not free for a company this size | Checked licence while designing | Replaced it with a custom, fully free renderer |
| 2 | **Blocked command:** I tried `taskkill /IM node.exe` to stop an install | The permission classifier denied it (it would kill *every* Node process on your machine). The install had already finished anyway | Removed only my own files. Saved as a lesson in memory: never use broad process kills |
| 3 | Asked the voice library for a WAV format that does not exist | A test failed with "stream closed" | Read the library's real type definitions; decode MP3 with ffmpeg |
| 4 | Parallel tabs in one browser stalled | Full render timed out after 3 minutes | One browser per worker |
| 5 | `Mesh.position` is read-only | Gallery test crashed | Build the bench with `position.set` |
| 6 | Wide shots washed out by fog; floors ended before the frame did; office window blown out; laptop hid the middle character | Gallery contact sheet | Fog distances, bigger floors, normal-blend clouds, laptop slides sideways |
| 7 | Preview used old data after editing a story | **Agent #1 found it** | Timeline auto-rebuilds when the story is newer |
| 8 | Laptop covered faces | Agent #1 and agent #2 | Parks beside the focus character (and away from the shoulder camera) |
| 9 | "Agent type video-producer not found" | Launching agent #2 | New agent files need a Claude Code restart; used the same instructions through a general-purpose agent |
| 10 | A chain of `&&` meant a failed type-check skipped the render but still produced a "contact sheet" from old frames | Noticed that the sheet looked unchanged | Re-ran with the type error fixed. Lesson: check each step's result before reading its output |

---

## 8. How to use and extend it

**Use it**
```
/video-studio a robot and a kid argue about whether homework is a good idea
/video-studio <paste a script or article>
/video-studio --engine browser Toothbrush, angry, bathroom sink     # the older Flow/Grok route
```
(Restart Claude Code once so the new skill and agent are registered.)

**Without Claude**
```
cd studio
npm install
npm run build -- the-3am-deploy       # validate → voices → stills → render → copy to Videos
npm run preview -- my-story --shots s01,s03
```

**Extend it**

| You want | Do this |
|---|---|
| A new kind of video | Add a file to `.claude/skills/video-studio/formats/` |
| A new look/place | Add a function in `src/engine/sets.ts` and a name in `types.ts` (`SETS`) |
| A new character type | Add a builder in `src/engine/characters.ts` and a name in `KINDS` |
| Sound effects (the top gap) | Add an `sfx` field to lines in `types.ts`, place short WAVs in `timeline.ts`, mix them in `render.ts` |
| Music | Already supported: `music.file` in `story.json` (ducked under speech) |
| A different voice engine | Add a provider in `scripts/lib/tts.ts` (it only has to return a 24 kHz mono WAV) |

---

## 9. Honest limits

- **No sound effects or composed music yet.** The engine mixes a music file you supply, but it cannot create one.
- **Three character shapes and six sets.** No crowds, vehicles or realistic animals; the director reshapes ideas to fit.
- **Voices are good, not actors.** They are free neural voices; expression comes from the face and body.
- **I did not listen to the audio.** I verified timing and levels with measurements and looked at frames, but the voices' quality is for your ears.
- **Not yet tested:** very long videos (over 90 s), 1080p, landscape/square aspect, five-character casts, a music file, and the `browser` engine after the rename.
- **Token figures** are measured from the transcript and are accurate for tokens, but they are not a price. Use `/cost` or your usage page for the money.
- **Nothing is committed** to git by this work (you committed the earlier rename yourself).

## 10. Suggested next steps

1. Restart Claude Code, run `/video-studio` with an idea of your own, and see the question flow live.
2. Build **sound effects** (notification pings, keyboard clicks, door knocks) so insert shots are not silent.
3. Add **a "series bible"** so recurring characters keep the same look and voice across episodes.
4. Try a 60-second 1080p story and a landscape one to find the next set of limits.


---

## 11. Addendum: better voices (README rewrite, voice research, voice upgrade)

Written after the stages above. Everything here happened after section 10.

### What you asked

1. "Please update the README properly now as per good and proper flow."
2. "How can we make a voice better, calm and with emotional attachment? Please think and provide a better free solution."
3. "Please add this ability and download that voice and add that as demo, and before developing you can ask also these things which need to be chosen, and make sure it should always work properly."

### What was done, step by step

| Step | What happened |
|---|---|
| README | Rewritten in a proper reading order (what it is, quick start, how it works, writing a story, reference, extend, troubleshoot). The snippet, links, npm scripts and example projects in it were checked mechanically |
| Research | Searched the current free text-to-speech options and read the primary sources for the top three (Chatterbox, Kokoro, Orpheus: licences, sizes, controls). **Measured what the existing Edge service can do:** it accepts speed and pitch, but rejects pauses, emphasis and emotion styles. Built 8 A/B listening samples of the same lines |
| Questions | Before building I checked your machine (RTX 4060 8 GB, plenty of disk, Python 3.11 already installed) and the real download sizes, then asked 4 multiple-choice questions. **Your answers:** all three engines (Kokoro + Chatterbox + calm Edge), a new calm emotional demo story voiced each way, English + Hindi, no voice cloning |
| Install | Two separate Python 3.11 environments (their numpy requirements conflict): Kokoro (ONNX, no PyTorch) and Chatterbox (PyTorch 2.6 with CUDA 12.4). Models into git-ignored folders |
| Voice system | One interface for four engines (Edge, Windows voice, Kokoro, Chatterbox), a fallback chain per character, delivery presets (`natural`, `warm`, `calm`), a quality gate, a cache, a health check, a repeatable setup script |
| Demo | `A Quiet Apology` (a person and a blob, 10 gentle lines) in English and Hindi, built four ways each: Edge natural, Edge calm, Kokoro calm, Chatterbox calm |
| Verification | Whisper transcription of every demo video, pitch measurement per character, fault injection, regression of the existing stories, a repeat run of the setup |

Your downloads this stage: Kokoro 0.35 GB, PyTorch with CUDA about 2.5 GB, Chatterbox model about 3 GB (stored 3.0 GB), plus a 1 GB Whisper model that I added for the self-check (so about 7 GB in total, not the 6 GB I quoted when asking).

### Problems found by testing, and fixed

| # | Problem | How it was found | Fix |
|---|---|---|---|
| 1 | "Calm" Kokoro was no slower than normal speech (3.0 words/s) | Measured words per second per variant | Recalibrated the presets to a measured target (calm about 2.4 to 2.8, warm about 2.9) |
| 2 | Calm chopped short sentences into fragments, so a 7-word line took 5.7 s and sounded stilted | Per-line duration comparison | Pauses only go between substantial sentences; short ones stay together |
| 3 | **A stale voice cache** reused old audio after the sentence plan changed | A "fix" that changed nothing | The cache key now includes everything that affects the sound |
| 4 | An invalid Kokoro voice id was silently replaced | Fault injection | It now warns |
| 5 | **Chatterbox Hindi sometimes garbled a line, skipped a one-word line, or invented words** | Whisper transcription of the whole video (similarity 0.862) | Chatterbox now checks its own work: transcribe, compare, retry up to 3 takes, else fall back. Similarity rose to 0.939 and every line passed |
| 6 | My length check counted only letters, so valid Hindi looked "too long" | The health check flagged a good clip | Combining marks now count |
| 7 | **One failed health check made an engine permanently unavailable** (the next check repeated the old verdict) | Reading the check output carefully | The health check always re-tests; builds trust the last recorded result |
| 8 | Hot output could be stored clipped | A 0.0 dB peak on a Chatterbox clip | Peak limiting in the worker and clipping detection in the gate |

### Verification results

| Check | Result |
|---|---|
| Whole-video transcription vs the script (1.0 = identical) | English: Edge 1.0, Kokoro 0.99, Chatterbox 0.98. Hindi: Edge 0.96, Kokoro 0.95, Chatterbox 0.94 |
| Characters sound different (median pitch) | Mira 176 to 262 Hz vs Pip 110 to 139 Hz on every engine and language |
| Existing story, default settings | Still 803 frames, 26.8 s |
| Engines switched off / crashing / failed status | Each falls back, the reason is recorded, a video is still produced |
| Fully cached run | Starts no engine |
| Setup run twice | Second run is a quiet no-op ending in a passing health check |
| All 8 demo videos | Each used the engine it was meant to, no fallbacks |

**What this does not prove:** that the voices sound pleasant. I cannot listen. The transcriptions show the speech is intelligible and on script; the demo exists so that you can judge the feeling.

### Agents and tools in this stage

No subagents. Tools: Bash (about 120 calls in total in the session), Write, Read, PowerShell (long installs in the background), WebSearch and WebFetch (research), one `AskUserQuestion` call with 4 questions, ToolSearch.

### Token usage for this addendum's work

Measured from the session transcript as the difference since section 2's table (it includes the README rewrite, the research and the voice upgrade):

| | Tokens |
|---|---:|
| API calls | 99 |
| New input + cache write | about 277,000 |
| Output | about 214,000 |
| Cache reads (re-reading context, cheap) | about 56.8 million |

Session totals now: 191 API calls, about 663,000 cache-write tokens, about 466,000 output tokens, 229 tool calls (Bash 119, Write 53, Read 23, PowerShell 12, Edit 4, Agent 3, ToolSearch 3, WebSearch 3). The long background installs and renders cost wall-clock time, not tokens.

### Files added or changed

`studio/scripts/lib/voices/` (presets, engines, audio, bank), `studio/scripts/voices-setup.ts`, `voices-check.ts`, `demo.ts`, `lib/build.ts`, `studio/voice/` (Kokoro and Chatterbox workers, the optional Whisper checker), two demo stories, the schema and CLI flags, the timeline builder, and the README, skill, format, engine and question-bank documents.
