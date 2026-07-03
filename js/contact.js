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

  // ---- themed inline validation (form carries `novalidate`: the browser's
  // native OS-styled bubbles are replaced by .field-error notes) ----------
  function setFieldError(input, msg) {
    var slot = input.parentNode.querySelector(".field-error");
    if (slot) slot.textContent = msg || "";
    input.classList.toggle("is-invalid", !!msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function validate() {
    var name = form.querySelector('[name="name"]');
    var email = form.querySelector('[name="email"]');
    var phone = form.querySelector('[name="phone"]');
    var message = form.querySelector('[name="message"]');
    var firstBad = null;

    var nv = name.value.trim();
    if (!nv) {
      setFieldError(name, "Please tell us your name.");
      firstBad = firstBad || name;
    } else if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(nv)) {
      setFieldError(name, "Names shouldn't have numbers or symbols.");
      firstBad = firstBad || name;
    } else setFieldError(name, "");

    var ev = email.value.trim();
    if (!ev) {
      setFieldError(email, "We need an email to reply to.");
      firstBad = firstBad || email;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ev)) {
      setFieldError(email, "That email doesn't look quite right.");
      firstBad = firstBad || email;
    } else setFieldError(email, "");

    // phone is optional, but if filled it has to look like a number:
    // digits with the usual +, spaces, dots, dashes, parentheses, and at
    // least 7 digits overall
    if (phone) {
      var pv = phone.value.trim();
      if (pv && (!/^\+?[0-9\s().-]+$/.test(pv) || (pv.match(/[0-9]/g) || []).length < 7)) {
        setFieldError(phone, "That phone number doesn't look quite right.");
        firstBad = firstBad || phone;
      } else setFieldError(phone, "");
    }

    var mv = message.value.trim();
    if (!mv) {
      setFieldError(message, "Tell us a little about what you have in mind.");
      firstBad = firstBad || message;
    } else if (mv.split(/\s+/).length < 4) {
      setFieldError(message, "Give us a few more words, so we know how to help.");
      firstBad = firstBad || message;
    } else setFieldError(message, "");

    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  // a field's note clears the moment the visitor starts fixing it
  form.addEventListener("input", function (e) {
    if (e.target.classList && e.target.classList.contains("is-invalid")) {
      setFieldError(e.target, "");
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorEl.hidden = true;
    if (!validate()) return;
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
