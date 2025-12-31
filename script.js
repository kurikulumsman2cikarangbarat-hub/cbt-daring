const WORKER = "https://worker-abk.kurikulum-sman2cikarangbarat.workers.dev";

let soal = [];
let jawaban = [];

function log(msg) {
  document.getElementById("log").textContent = JSON.stringify(msg, null, 2);
}

async function login() {
  const token = document.getElementById("token").value.trim();
  const nama = document.getElementById("nama").value.trim();

  if (!token || !nama) return alert("Lengkapi data");

  const res = await fetch(`${WORKER}/api/submit-ujian`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "cek",
      token,
      nama,
      jawaban: []
    })
  });

  const data = await res.json();
  log(data);

  if (!res.ok) {
    alert(data.error);
    return;
  }

  soal = data.soal;
  document.getElementById("login").hidden = true;
  document.getElementById("exam").hidden = false;

  tampilSoal(0);
}

function tampilSoal(i) {
  const q = soal[i];
  document.getElementById("soal").innerHTML = q.soal;

  const opsi = document.getElementById("opsi");
  opsi.innerHTML = "";

  ["A","B","C","D","E"].forEach(h => {
    if (q[`opsi_${h.toLowerCase()}`]) {
      const b = document.createElement("button");
      b.textContent = `${h}. ${q[`opsi_${h.toLowerCase()}`]}`;
      b.onclick = () => jawaban[i] = h;
      opsi.appendChild(b);
    }
  });
}

async function kirim() {
  const token = document.getElementById("token").value.trim();
  const nama = document.getElementById("nama").value.trim();

  const res = await fetch(`${WORKER}/api/submit-ujian`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, nama, jawaban })
  });

  const data = await res.json();
  log(data);

  alert(`Nilai: ${data.nilai}`);
}
