# Qualtrics + OpenAI Chatbot (Option B: backend keeps the key)

A tiny [Vercel](https://vercel.com) backend that lets participants chat with an
OpenAI model inside a Qualtrics survey question, **without exposing your API key**.

```
Participant browser  ──►  Qualtrics question JS  ──►  Vercel /api/chat  ──►  OpenAI
   (sees no key)              (sees no key)            (holds the key)
```

The full transcript is saved into a Qualtrics Embedded Data field so it appears
in your normal data export.

---

## Files

| File | What it is |
|------|------------|
| `api/chat.js` | The Vercel serverless function. Holds the key, calls OpenAI. |
| `qualtrics-question.js` | Paste into your Qualtrics question. Renders the chat box. |
| `package.json` | Marks the project as an ES module. No dependencies needed. |

---

## Part 1 — Deploy the backend to Vercel

1. Put these files in a GitHub repo (or use the Vercel CLI / drag-and-drop).
2. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → import the repo.
3. Framework preset: **Other**. No build command needed.
4. Before deploying, open **Settings → Environment Variables** and add:

   | Name | Value |
   |------|-------|
   | `OPENAI_API_KEY` | your OpenAI secret key (required) |
   | `OPENAI_MODEL` | e.g. `gpt-4o-mini` (optional) |
   | `MAX_TURNS` | e.g. `8` (optional — keep in sync with the survey JS) |
   | `MAX_TOKENS` | e.g. `400` (optional) |
   | `SYSTEM_PROMPT` | your chatbot instructions (optional) |

5. Deploy. Your endpoint will be:
   `https://YOUR-PROJECT.vercel.app/api/chat`

**Test it** from a terminal:

```bash
curl -X POST https://YOUR-PROJECT.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

You should get back `{"reply":"..."}`.

---

## Part 2 — Set up Qualtrics

1. **Add the Embedded Data field.** In the survey builder, open **Survey Flow**,
   add an **Embedded Data** element at the very top, create a field named exactly
   `chat_transcript`, and leave its value blank. Save. (This guarantees the
   transcript is stored in your results.)

2. **Create the chat question.** Add a **Text/Graphic** question where you want
   the conversation to happen.

3. **Add the JavaScript.** Edit that question → gear icon → **Add JavaScript**,
   delete the placeholder, and paste the contents of `qualtrics-question.js`.

4. **Edit two lines at the top of that JS:**
   - `BACKEND_URL` → your Vercel URL + `/api/chat`
   - `MAX_TURNS` → match the server value

5. **Preview** the survey and chat with the bot. Then check **Data & Analysis** —
   you should see the `chat_transcript` column filled with the JSON conversation.

---

## Security notes

- The OpenAI key only ever lives in the Vercel environment variable. It is never
  sent to the browser.
- The system prompt lives on the server, so participants can't read or override it.
- CORS is locked to `*.qualtrics.com` origins.
- Still set a **monthly spending limit** on your OpenAI key as a backstop.

## Cost notes

You pay OpenAI per token. `gpt-4o-mini` is the cheapest sensible default. Vercel's
free Hobby tier is fine for typical study volumes; check their limits if you expect
thousands of simultaneous participants.
