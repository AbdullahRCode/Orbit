/* Orbit concierge on the marketing site. Injects its own widget, keeps history in memory. */
(function () {
  "use strict";
  var FN = "https://hpaxoxnwffzxginnbpgy.supabase.co/functions/v1/site-chat";
  var history = [];
  var visitorId = (function () {
    try {
      var k = "orbit_visitor_id";
      var v = localStorage.getItem(k);
      if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return null; }
  })();

  var fab = document.createElement("button");
  fab.className = "guide-fab";
  fab.setAttribute("aria-label", "Chat with Orbit");
  fab.innerHTML = '<span class="logo-mark"><span class="ring" style="border-color:var(--ice);"></span><span class="moon"></span></span>';
  var panel = document.createElement("div");
  panel.className = "guide-panel";
  panel.hidden = true;
  panel.innerHTML =
    '<div class="guide-head"><strong>Orbit</strong>' +
    '<span class="muted" style="font-size:12px;">Digital concierge, ask anything about Orbit</span>' +
    '<button class="guide-close" aria-label="Close">&times;</button></div>' +
    '<div class="guide-msgs"><div class="gmsg them">Hi, I am Orbit. Ask me what we do, what it costs, or how compliance works. Or book a free intelligence audit anytime.</div></div>' +
    '<div class="guide-input"><input class="pinput" style="margin-top:0;" maxlength="1200" placeholder="Ask about Orbit">' +
    '<button class="btn btn-primary" style="padding:12px 18px;">Send</button></div>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var msgs = panel.querySelector(".guide-msgs");
  var input = panel.querySelector("input");
  var send = panel.querySelector(".guide-input .btn");

  // Rotating multilingual invite bubble. Cycles every 5s while the panel is
  // closed, stops for good once the person opens the chat or dismisses it.
  var GREETINGS = [
    "Ask me a question",
    "\u092e\u0941\u091d\u0938\u0947 \u092a\u0942\u091b\u0947\u0902", // Hindi
    "\u0a2e\u0a48\u0a28\u0942\u0902 \u0a2a\u0942\u0a1b\u0a4b", // Punjabi
    "\u6709\u4ec0\u4e48\u95ee\u9898\u5c31\u95ee\u6211", // Mandarin
    "Magtanong sa akin", // Tagalog
    "Preg\u00fantame algo", // Spanish
    "H\u1ecfi t\u00f4i b\u1ea5t c\u1ee9 \u0111i\u1ec1u g\u00ec", // Vietnamese
    "\uc9c8\ubb38\ud574 \ubcf4\uc138\uc694", // Korean
    "\u0627\u0633\u0623\u0644\u0646\u064a \u0633\u0624\u0627\u0644\u0627\u064b", // Arabic
    "Posez-moi une question", // French
  ];
  var bubble = document.createElement("div");
  bubble.className = "guide-bubble";
  bubble.setAttribute("role", "button");
  bubble.setAttribute("aria-label", "Open chat with Orbit");
  bubble.textContent = GREETINGS[0];
  document.body.appendChild(bubble);
  bubble.addEventListener("click", function () { toggle(); stopBubble(); });

  var bubbleIdx = 0, bubbleTimer = null;
  function stopBubble() {
    if (bubbleTimer) { clearInterval(bubbleTimer); bubbleTimer = null; }
    bubble.style.display = "none";
  }
  function startBubble() {
    bubbleTimer = setInterval(function () {
      bubbleIdx = (bubbleIdx + 1) % GREETINGS.length;
      bubble.style.opacity = "0";
      setTimeout(function () {
        bubble.textContent = GREETINGS[bubbleIdx];
        bubble.style.opacity = "1";
      }, 200);
    }, 5000);
  }
  startBubble();

  function add(text, who) {
    var d = document.createElement("div");
    d.className = "gmsg " + who;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function toggle() {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { input.focus(); stopBubble(); }
  }
  fab.addEventListener("click", function () { toggle(); stopBubble(); });
  panel.querySelector(".guide-close").addEventListener("click", toggle);

  function go() {
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    add(text, "me");
    history.push({ role: "user", content: text });
    send.disabled = true;
    fetch(FN, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-10), visitor_id: visitorId }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var reply = d.reply || "Book a free intelligence audit and we will answer everything live.";
        add(reply, "them");
        history.push({ role: "assistant", content: reply });
      })
      .catch(function () { add("Connection hiccup. Please try again.", "them"); })
      .finally(function () { send.disabled = false; });
  }
  send.addEventListener("click", go);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
})();
