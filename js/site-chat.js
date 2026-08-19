/* Orbit concierge on the marketing site. Injects its own widget, keeps history in memory. */
(function () {
  "use strict";
  var FN = "https://hpaxoxnwffzxginnbpgy.supabase.co/functions/v1/site-chat";
  var history = [];

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

  function add(text, who) {
    var d = document.createElement("div");
    d.className = "gmsg " + who;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function toggle() {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  }
  fab.addEventListener("click", toggle);
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
      body: JSON.stringify({ messages: history.slice(-10) }),
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
