const WORKER = "https://worker-abk.kurikulum-sman2cikarangbarat.workers.dev";

let soal = [];
let jawaban = [];

async function start() {
  const token = document.getElementById("token").value;
  const log = document.getElementById("log");

  log.textContent = "Mengambil soal...";

  const res = await fetch(`${WORKER}/api/soal?token=${token}`);
  const data = await res.json();

  if (!data.ok) {
    log.textContent = data.error;
    return;
  }

  soal = data.soal;
  render();
}

function render() {
  const box = document.getElementById("soal");
  box.innerHTML = "";

  soal.forEach((q, i) => {
    box.innerHTML += `
      <div class="soal">
        <b>${i+1}. ${q.soal}</b>
        ${q.opsi.map(o => `
          <label class="opsi">
            <input type="radio" name="q${i}" value="${o}" 
              onchange="jawaban[${i}]='${o}'">
            ${o}
          </label>
        `).join("")}
      </div>
    `;
  });

  document.getElementById("kirim").style.display = "block";
}

async function submit() {
  const payload = {
    nama: document.getElementById("nama").value,
    token: document.getElementById("token").value,
    jawaban
  };

  const log = document.getElementById("log");
  log.textContent = "Mengirim jawaban...";

  const res = await fetch(`${WORKER}/api/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  log.textContent = JSON.stringify(data, null, 2);
}
