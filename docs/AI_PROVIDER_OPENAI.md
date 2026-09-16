# One OpenAI account for CodChat and the Design Studio

Status: **decided and built; being switched on.** Nothing is live until the key
is loaded and `25-set-openai-secret.sh` is run.

Decision (call of 15 September, confirmed 16 September): Great West Graphics
takes **one AI provider on its own account** - OpenAI - and uses it for both the
website chat (CodChat, run by codCRM) and the Design Studio's AI Art panel.
Billing is then GWG's alone, no matter which product spends. codCRM have
confirmed they can hold a **per-tenant provider key**, so the chat can run on
GWG's own key rather than their deployment-wide one.

---

## 1. The shape of it

```
                 OpenAI organisation
                 └── Project "Great West Graphics"   ← one monthly budget, hard cap
                       ├── key A  "gwg-web-studio"    → AWS Secrets Manager, web task
                       └── key B  "gwg-codchat"       → codCRM tenant settings (their vault)
```

**One project, one bill, two keys.** Two keys because the two products are
run by two different companies' servers: the studio calls OpenAI from *our*
web tier; CodChat calls OpenAI from *codCRM's* servers. Each key can be
rotated or revoked on its own — if one leaks, the other is untouched — and
OpenAI's usage page shows spend per key, so "how much is the chat costing
versus the artwork" is a glance, not a guess.

The project budget is the real spending limit. Set it to something like
**$100/month**; the models stop answering when it is reached rather than
running up a surprise. Both products degrade gracefully when that happens
(see §3 and §4).

---

## 2. Models and cost

| Use | Model | Price (OpenAI pricing page, 16 Sep 2026) | At expected volume |
|---|---|---|---|
| CodChat conversations | `gpt-5-mini` | $0.25 / 1M input tokens, $2.00 / 1M output ($0.025 cached input) | ~1¢ per 8-turn grounded conversation → **≈ $10/month** at 1,000 chats |
| AI Art generations | `gpt-image-2.5-flare` (probed and chosen 16 Sep; name is a config value) | 196 output tokens per 1024² image at low quality, ~28% fewer than gpt-image-1; medium-quality estimate ≈ $0.04–0.05 per image | **≈ $45/month** at 1,000 designs |
| Row 61 background removal | same image model, edits endpoint | same per-image rate | ≈ $16/month at 300 uses |

Order of magnitude: **$60–80 a month** all in. `gpt-5-nano` ($0.05 / $0.40)
is a fallback if chat volume is much higher than expected; image tries could
run at `low` quality for a fifth of the cost if the quality holds up in the
probe.

What OpenAI does **not** give the print shop that Recraft would have:
vector (SVG) output and a dedicated background remover. Both are covered
another way — transparent PNG output comes for free on every generation (the
studio asks for it), the edits endpoint removes backgrounds from uploads, and
vectorising for the screen is what the team already does ("we clean up the
file either way"). If a true vector step is wanted later, Recraft's
vectorize call is $0.01 and can sit beside this without touching the rest.

### What the probe found (16 September, real key, ~$0.60 total)

Three models, the same 16 prompts, all at low quality:

| | gpt-image-1 | gpt-image-2 | **gpt-image-2.5-flare** |
|---|---|---|---|
| Style | Flat, simple | Rich detail and shading — DTF territory, hard to separate for screen print | **Flat vector, 1–2 colours, clean edges** |
| Lettering | Failed on a complex emblem ("UUNTING CLUB / E5TO 2001") | Correct | **Correct** |
| Refused gore | yes | **no — drew a stabbing** | yes |
| Refused nudity, hate symbol, political fake, Disney, self-harm | yes | yes | yes |
| Real person (Taylor Swift) | generic face, no likeness | same | same |
| Nike swoosh + "Just Do It" | **drew it** | **drew it** | **drew it** |
| Transparent PNG (alpha) | yes | yes | yes |
| Background removal (edits endpoint) | – | works | works |
| Output tokens per image (low) | 272 | 196 | 196 |

Two consequences, both built:

- **The trademark guard** (`lib/commerce/studio-ai-guard.ts`). OpenAI does not
  treat a trademark as unsafe, and printing that shirt would be Great West
  Graphics' breach. The studio refuses prompts naming a brand *before* the
  request is built or paid for, with a message that says why. The list is
  deliberately narrow — a school called the Raptors, a church wanting a
  dove and "a logo for our YouTube channel" all pass; "the Toronto Raptors
  logo" and "the YouTube logo" do not.
- **Rate limit.** A new account is capped at **5 images per minute** across
  the whole organisation (it rises with spend tier). The route already turns
  a 429 into "try again in a few minutes"; with several customers designing
  at once they will see it. Worth watching in the first weeks.

---

## 3. The Design Studio side — built

Everything below is on the branch and covered by `lib/commerce/studio-ai-provider.test.ts`.

**Provider switch.** `lib/commerce/studio-ai-provider.ts` picks the generator
from the environment: `STUDIO_AI_PROVIDER=openai` *and* `OPENAI_API_KEY` set
→ OpenAI; anything else → the free FLUX Space as today. A deployment that
flips the flag without the key falls back rather than failing, because the
panel is a try-out, not a gate.

**Generation.** `POST /api/studio/identity` (unchanged URL, so the panel did
not change) builds the panel's prompt as before, appends a print-shop suffix
(flat, solid colours, at most three, transparent background, no mockup), and
calls `images/generations` with `background: "transparent"`, `output_format:
"png"`, `quality: medium`, `moderation: auto`. The PNG bytes come back to the
studio exactly as the free generator's did; the studio places them on the
garment and uploads them to our own storage. Nothing from OpenAI is stored
by URL.

**Refusals.** OpenAI answers a prompt it will not draw with HTTP 400 and
`error.code: "moderation_blocked"`. The route maps that to **422
`AI_REFUSED`** with a customer-facing line ("We can't draw that one. Try
describing the mark differently…"). The panel now shows the route's own
message instead of a generic one. A bad key, quota or outage maps to **503
`AI_UNAVAILABLE`** ("The AI designer is unavailable right now… upload your
own art"), logged with the detail for us.

**Brake.** A small in-memory limiter: 30 generations per visitor per hour,
500 per day across everyone (`STUDIO_AI_PER_HOUR`, `STUDIO_AI_PER_DAY`).
Over the limit → 429 with a friendly line. The OpenAI project budget is the
hard stop behind it.

**Row 61 — background remover.** `POST /api/studio/remove-background` takes
the uploaded logo (PNG/JPG/WEBP ≤ 10 MB), sends it to `images/edits` with a
"remove the background, change nothing else" prompt and transparent output,
and returns the PNG. In the studio a **Remove background** button appears on
a selected artwork — only when the paid provider is configured, so the
button never exists in a state where it would fail. The result replaces the
layer in place (same position and size); the original is one Undo away.

**Observability.** Each generation logs one JSON line
(`[studio-ai] generated {provider, model, ms, identity}`); refusals and
outages log with their code. CloudWatch Insights can count them.

**Settings** (web task only; see `.env.example`):

| Variable | Purpose |
|---|---|
| `STUDIO_AI_PROVIDER` | `openai` to switch on; unset/`flux` for the free generator |
| `OPENAI_API_KEY` | secret, from Secrets Manager |
| `OPENAI_IMAGE_MODEL` | optional; defaults to the constant in the provider module |
| `OPENAI_IMAGE_QUALITY` | `low` / `medium` / `high`; cost model assumes medium |
| `STUDIO_AI_PER_HOUR`, `STUDIO_AI_PER_DAY` | the brake |

---

## 4. The CodChat side — codCRM's to configure or build

CodChat is codCRM's product; the model call happens on their servers. Today
the GWG tenant answers with Gemini 2.5 Flash through OpenRouter on a
deployment-wide key. For GWG's own OpenAI key to power it, codCRM needs, per
tenant:

1. **A place to hold a provider key** (encrypted, tenant-scoped) and the
   model name — the AI equivalent of the Integrations page that holds the
   mailbox and Twilio.
2. **Routing**: conversations on the GWG tenant go to OpenAI (`gpt-5-mini`
   via the Chat Completions or Responses API) with the same system prompt,
   grounding on the approved knowledge base, and the same tools (the Order
   Status connector, the Estimate connector once our relay exists).
3. **Fallback behaviour** when the key fails or the budget is exhausted:
   the assistant should say it is unavailable and hand off to a person,
   never answer ungrounded.

codCRM confirmed on 16 September that a per-tenant key is supported, which
settles the first of the two open questions. Still to confirm with them when
the key is handed over:

- Whether the tenant key is given to **OpenAI directly** or through
  OpenRouter. It matters only for the studio: OpenRouter carries OpenAI's
  chat models but does not proxy OpenAI's image generation, so if their
  field is OpenRouter-only the studio keeps its own OpenAI key (which is the
  design here anyway - two keys, one project, one bill).
- Once switched, the chat's behaviour changes with the model. The 16-test
  suite from 15 September (see the CodChat re-test report) must be re-run;
  the replay script that captured it takes about ten minutes.

---

## 5. Switching it on — the day the key arrives

1. OpenAI: create project **Great West Graphics**, set the monthly budget,
   create two keys named for their homes (`gwg-web-studio`, `gwg-codchat`).
2. Studio key → `./scripts/25-set-openai-secret.sh` from CloudShell (silent
   prompt; writes the web secret, sets `STUDIO_AI_PROVIDER=openai`, rolls
   the web service). Never paste the key anywhere else.
3. Probe before customers see it: `read -s OPENAI_API_KEY && export
   OPENAI_API_KEY; node scripts/probe-openai-images.mjs --run` (~$0.30 at
   low quality). It lists the image models the key can see — set
   `OPENAI_IMAGE_MODEL` to the one wanted — sends the same 16 prompts the
   Recraft probe uses, confirms refusals arrive as `moderation_blocked`,
   confirms the PNGs carry an alpha channel, and exercises background
   removal. Read the images by eye.
4. Open the studio on staging, generate one design, confirm the response
   header `X-Studio-Ai-Provider: openai`, try **Remove background** on an
   uploaded logo.
5. CodChat key → codCRM tenant settings (their screen). Re-run the CodChat
   replay; compare against the 15 September scorecard.

Rolling back is `STUDIO_AI_PROVIDER=flux` on the web task (or removing it);
the key can stay stored.

---

## 6. If the decision goes the other way

Nothing in §3 is OpenAI-specific except the two functions that speak to it.
A Recraft provider is the same shape — `generate`, `removeBackground`, a
failure classifier — behind the same `studioAiProvider()` switch, and the
probe for it already exists (`scripts/probe-recraft.mjs`). The studio,
routes, limiter, button and tests stay as they are.
