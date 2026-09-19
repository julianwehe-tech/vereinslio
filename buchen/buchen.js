(() => {
  "use strict";
  const plans = { start: ["Start", "Bis zu 100 Mitglieder · 3 Zugänge", "19,00 €"], team: ["Team", "Bis zu 300 Mitglieder · 5 Zugänge", "39,00 €"], verband: ["Verband", "Bis zu 1.000 Mitglieder · 10 Zugänge", "69,00 €"] };
  const form = document.getElementById("booking-form");
  const fields = [...form.querySelectorAll("[data-step]")];
  const progress = [...form.querySelectorAll(".booking-progress span")];
  const message = document.getElementById("booking-message");
  const submit = document.getElementById("booking-submit");
  const apiOrigin = document.querySelector('meta[name="vereinslio-api-origin"]').content.trim().replace(/\/$/, "");
  let step = 1;
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
  const showStep = (next) => {
    step = next;
    fields.forEach((field, index) => { field.hidden = index + 1 !== step; });
    progress.forEach((item, index) => item.classList.toggle("is-active", index + 1 <= step));
    message.textContent = "";
    document.querySelector(".checkout").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const stepValid = (current) => {
    const invalid = [...fields[current - 1].querySelectorAll("input[required]")].find((input) => !input.checkValidity());
    if (!invalid) return true;
    invalid.reportValidity();
    return false;
  };
  form.querySelectorAll(".next-step").forEach((button) => button.addEventListener("click", () => {
    if (stepValid(step)) showStep(step + 1);
  }));
  form.querySelectorAll(".previous-step").forEach((button) => button.addEventListener("click", () => showStep(step - 1)));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!stepValid(3)) return;
    if (!apiOrigin) {
      message.textContent = "Die sichere Buchungsinfrastruktur wird gerade eingerichtet. Es wurden keine Daten übertragen.";
      return;
    }
    submit.disabled = true;
    const originalLabel = submit.innerHTML;
    submit.textContent = "Buchung wird vorbereitet …";
    try {
      const response = await fetch(`${apiOrigin}/v1/onboardings`, { method: "POST", body: new FormData(form), credentials: "omit" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || "Die Buchung konnte nicht vorbereitet werden.");
      if (payload?.data?.approvalUrl) location.assign(payload.data.approvalUrl);
      message.textContent = "Die Rechnungsanfrage wurde angelegt. Nach Bestätigung erhalten Sie die Einrichtungsinformationen.";
      submit.hidden = true;
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : "Die Buchung konnte nicht vorbereitet werden.";
      submit.disabled = false;
      submit.innerHTML = originalLabel;
    }
  });
  render();
})();
