(() => {
  "use strict";

  const nav = document.getElementById("hauptnav");
  const toggle = document.querySelector(".menu-toggle");

  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
})();
