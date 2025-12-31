const WORKER = "https://worker-abk.kurikulum-sman2cikarangbarat.workers.dev";

let soal = [];
let index = 0;
let jawaban = [];
let timer = 0;
let tabSwitch = 0;

/* ============ UI HELPERS ============ */
function show(id) {
  document.querySelectorAll(".card").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

/* ============ START ============ */
async function start() {
  const nama = namaInput.value.trim();
  const token = tokenInput.value.trim();

  if (!nama || !token) {
    loginError.innerText = "Lengkapi data";
    return;
  }

  loginError.innerText = "Memuat soal...";

  const res = await fetch(`${WORKER}/api/soal?token=${token}`);
  const data = await res.json();

  if (!data.soal) {
    loginError.innerText = "Token tidak valid";
    return;
  }

  soal = data.soal;
  jawaban = new Array(soal.length).fill(null);
  timer = data.durasi * 60;

  show("examView");
  render();
  runTimer();
}

/* ============ RENDER ============ */
function render() {
  counter.innerText = `Soal ${index + 1} / ${soal.length}`;
  soalDiv.innerHTML = soal[index].soal;

  opsi.innerHTML = "";
  soal[index].opsi.forEach((o, i) => {
    const div = document.createElement("div");
    div.className = "option" + (jawaban[index] === i ? " active" : "");
    div.innerText = o;
    div.onclick = () => {
      jawaban[index] = i;
      render();
    };
    opsi.appendChild(div);
  });
}

/* ============ NAV ============ */
function next() {
  if (index < soal.length - 1) index++;
  render();
}

function prev() {
  if (index > 0) index--;
  render();
}

/* ============ TIMER ============ */
function runTimer() {
  setInterval(() => {
    timer--;
    const m = String(Math.floor(timer / 60)).padStart(2, "0");
    const s = String(timer % 60).padStart(2, "0");
    timerDisplay.innerText = `${m}:${s}`;
    if (timer <= 0) submit();
  }, 1000);
}

/* ============ SUBMIT ============ */
async function submit() {
  show("resultView");
  resultText.innerText = "Mengirim jawaban...";

  const res = await fetch(`${WORKER}/api/submit-ujian`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nama: namaInput.value,
      token: tokenInput.value,
      jawaban,
      tab_switch: tabSwitch
    })
  });

  const data = await res.json();

  resultText.innerHTML = `
    Nilai: <b>${data.nilai}</b><br>
    Benar: ${data.benar} / ${data.total}
  `;
}

/* ============ CHEAT TRACK ============ */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) tabSwitch++;
});
