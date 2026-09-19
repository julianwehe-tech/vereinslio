(() => {
  "use strict";
  const plans = { start: ["Start", "Bis zu 100 Mitglieder · 3 Zugänge", "19,00 €"], team: ["Team", "Bis zu 300 Mitglieder · 5 Zugänge", "39,00 €"], verband: ["Verband", "Bis zu 1.000 Mitglieder · 10 Zugänge", "69,00 €"] };
  const input = new URLSearchParams(location.search).get("plan");
  const selected = plans[input] ? input : "team";
  document.querySelector(`input[value="${selected}"]`).checked = true;
  const render = () => {
    const value = document.querySelector('input[name="plan"]:checked').value;
    const [name, limits, price] = plans[value];
    document.getElementById("summary-plan").textContent = name;
    document.getElementById("summary-limits").textContent = limits;
    document.getElementById("summary-price").textContent = price;
  };
  document.querySelectorAll('input[name="plan"]').forEach((node) => node.addEventListener("change", render));
  render();
})();
