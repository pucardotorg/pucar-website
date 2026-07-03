/* =========================================================
   PUCAR — contact modal (header "Get in touch" CTA)
   The form is a Netlify Form: it exists statically in index.html
   (data-netlify="true" + hidden form-name input) so Netlify's
   build-time parser registers it; this script submits it via
   fetch as application/x-www-form-urlencoded to "/" -- Netlify's
   documented AJAX pattern -- then swaps in the success note.
   ========================================================= */
(function () {
  "use strict";

  var modal = document.getElementById("contactModal");
  var openBtn = document.getElementById("contactOpen");
  var form = document.getElementById("contactForm");
  var successEl = document.getElementById("contactSuccess");
  var errorEl = document.getElementById("contactError");
  var submitBtn = document.getElementById("contactSubmit");
  if (!modal || !openBtn || !form) return;

  function open() {
    // fresh state on every open
    form.hidden = false;
    successEl.hidden = true;
    errorEl.hidden = true;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    var first = form.querySelector('input[name="name"]');
    if (first) first.focus();
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  openBtn.addEventListener("click", open);
  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-close")) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) close();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(form)).toString()
    })
      .then(function (res) {
        if (!res.ok) throw new Error("submit failed: " + res.status);
        form.hidden = true;
        successEl.hidden = false;
        form.reset();
      })
      .catch(function () {
        errorEl.hidden = false; // e.g. local preview, where Netlify isn't there to receive it
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send message";
      });
  });
})();
