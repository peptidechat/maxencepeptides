/* Mobile nav toggle + dynamic fixed-header offset. Shared across all pages. */
(function () {
  // 1) hamburger menu
  document.addEventListener("click", function (e) {
    var nav = document.querySelector(".nav");
    if (!nav) return;
    if (e.target.closest(".nav-toggle")) { e.preventDefault(); nav.classList.toggle("nav-open"); return; }
    if (e.target.closest(".nav-links a")) { nav.classList.remove("nav-open"); return; }
    if (!e.target.closest(".nav")) nav.classList.remove("nav-open");
  });

  // 2) measure the real fixed-header height (announce can wrap on mobile) and expose it as
  //    --announce-h (so the fixed nav sits right below it) and --header-h (body offset).
  function measure() {
    var a = document.querySelector(".announce");
    var n = document.querySelector(".nav");
    var ah = a ? a.offsetHeight : 0;
    document.documentElement.style.setProperty("--announce-h", ah + "px");
    var h = ah + (n ? n.offsetHeight : 0);
    document.documentElement.style.setProperty("--header-h", h + "px");
  }
  measure();
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  // re-measure after webfonts settle (nav height can shift a few px)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  setTimeout(measure, 300);
})();
