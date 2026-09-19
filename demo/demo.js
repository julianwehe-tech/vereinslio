(() => {
  "use strict";
  const views = [...document.querySelectorAll("[data-view-panel]")];
  const navItems = [...document.querySelectorAll(".nav-item")];
  const toast = document.getElementById("toast");
  let toastTimer;

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  };

  const showView = (view) => {
    views.forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
    navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === view));
    document.querySelector(".demo-content").scrollTo({ top: 0, behavior: "smooth" });
  };

  navItems.forEach((item) => item.addEventListener("click", () => showView(item.dataset.view)));
  document.querySelectorAll("[data-view-target]").forEach((item) => item.addEventListener("click", () => showView(item.dataset.viewTarget)));
  document.querySelectorAll("[data-toast]").forEach((item) => item.addEventListener("click", () => showToast(item.dataset.toast)));

  const setTaskCount = () => {
    const open = new Set([...document.querySelectorAll(".task-check:not(.done)")].map((button) => button.dataset.task)).size;
    document.getElementById("task-count").textContent = String(open);
    document.getElementById("overview-task-count").textContent = String(open);
  };

  document.querySelectorAll(".task-check").forEach((item) => item.addEventListener("click", () => {
    const task = item.dataset.task;
    document.querySelectorAll(`.task-check[data-task="${task}"]`).forEach((button) => {
      button.classList.add("done");
      button.closest("li").classList.add("completed");
      button.setAttribute("aria-label", "Aufgabe erledigt");
    });
    setTaskCount();
    showToast("Aufgabe als erledigt markiert. Die Demo wird beim Neuladen zurückgesetzt.");
  }));

  document.getElementById("reset-demo").addEventListener("click", () => location.reload());
})();
