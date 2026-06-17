/* ============================================================================
 * QUALTRICS QUESTION JAVASCRIPT
 * ----------------------------------------------------------------------------
 * Paste this into a Text/Graphic question:
 *   Edit question  ->  gear icon  ->  Add JavaScript
 *
 * BEFORE IT WORKS:
 *  1. Replace BACKEND_URL below with your deployed Vercel URL + /api/chat
 *  2. In Survey Flow, add an Embedded Data field named exactly: chat_transcript
 *     (set it at the TOP of the flow, blank, so the transcript saves reliably)
 *  3. MAX_TURNS here should match MAX_TURNS on the server.
 * ==========================================================================*/

Qualtrics.SurveyEngine.addOnReady(function () {
  // ---- Settings ----
  var BACKEND_URL = "https://YOUR-PROJECT.vercel.app/api/chat"; // <-- CHANGE THIS
  var MAX_TURNS = 8;          // how many messages the participant may send
  var EMBEDDED_FIELD = "chat_transcript";
  var OPENING_LINE = "Hi! Thanks for joining. What's on your mind today?";

  var qThis = this;
  var questionContainer = document.getElementById("question-" + this.questionId) || this.getQuestionContainer();

  // Conversation state. The system prompt is NOT here — it lives on the server.
  var messages = [];
  var userTurns = 0;

  // Don't let participants advance until they've engaged / finished.
  this.hideNextButton();

  // ---- Build the chat UI ----
  var wrap = document.createElement("div");
  wrap.style.cssText =
    "max-width:640px;margin:8px 0;border:1px solid #ccc;border-radius:8px;overflow:hidden;font-family:inherit;";

  var log = document.createElement("div");
  log.style.cssText =
    "height:320px;overflow-y:auto;padding:12px;background:#fafafa;display:flex;flex-direction:column;gap:8px;";

  var inputRow = document.createElement("div");
  inputRow.style.cssText = "display:flex;border-top:1px solid #ccc;";

  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type your message...";
  input.style.cssText = "flex:1;border:none;padding:12px;font-size:15px;outline:none;";

  var sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.textContent = "Send";
  sendBtn.style.cssText =
    "border:none;background:#2b6cb0;color:#fff;padding:0 20px;font-size:15px;cursor:pointer;";

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  wrap.appendChild(log);
  wrap.appendChild(inputRow);
  questionContainer.appendChild(wrap);

  var notice = document.createElement("div");
  notice.style.cssText = "max-width:640px;margin:6px 0;font-size:13px;color:#555;";
  questionContainer.appendChild(notice);

  // ---- Helpers ----
  function addBubble(role, text) {
    var b = document.createElement("div");
    var isUser = role === "user";
    b.style.cssText =
      "max-width:80%;padding:8px 12px;border-radius:12px;font-size:15px;line-height:1.4;white-space:pre-wrap;" +
      (isUser
        ? "align-self:flex-end;background:#2b6cb0;color:#fff;"
        : "align-self:flex-start;background:#e6e6e6;color:#111;");
    b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
  }

  function saveTranscript() {
    Qualtrics.SurveyEngine.setEmbeddedData(EMBEDDED_FIELD, JSON.stringify(messages));
  }

  function setBusy(busy) {
    input.disabled = busy;
    sendBtn.disabled = busy;
    sendBtn.textContent = busy ? "..." : "Send";
  }

  function finish(reason) {
    input.disabled = true;
    sendBtn.disabled = true;
    input.placeholder = "Conversation complete.";
    notice.textContent = reason + " You can now continue to the next page.";
    qThis.showNextButton();
  }

  // Show the opening assistant line (not sent to the model; purely a greeting).
  addBubble("assistant", OPENING_LINE);
  messages.push({ role: "assistant", content: OPENING_LINE });
  notice.textContent = "Messages remaining: " + MAX_TURNS;

  // ---- Send a message ----
  function send() {
    var text = (input.value || "").trim();
    if (!text) return;

    addBubble("user", text);
    messages.push({ role: "user", content: text });
    userTurns += 1;
    input.value = "";
    saveTranscript();
    setBusy(true);

    fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var reply = (data && data.reply) || "(no response)";
        addBubble("assistant", reply);
        messages.push({ role: "assistant", content: reply });
        saveTranscript();
        setBusy(false);

        var remaining = MAX_TURNS - userTurns;
        if (remaining <= 0) {
          finish("You've reached the end of the conversation.");
        } else {
          notice.textContent = "Messages remaining: " + remaining;
          input.focus();
        }
      })
      .catch(function (err) {
        console.error(err);
        addBubble("assistant", "Sorry, there was a connection error. Please try again.");
        setBusy(false);
      });
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  });
});
