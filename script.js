const WORKER_URL = "https://worker-abk.kurikulum-sman2cikarangbarat.workers.dev/api/submit-ujian";

// simulasi jawaban (contoh)
const jawaban = ["A", "C", "B", "D", "A"];

async function submitUjian() {
  const nama = document.getElementById("nama").value;
  const token = document.getElementById("token").value;

  if (!nama || !token) {
    alert("Lengkapi data!");
    return;
  }

  const payload = {
    nama,
    token,
    jawaban,
    tab_switch: 0
  };

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    document.getElementById("result").innerText =
      JSON.stringify(data, null, 2);

  } catch (e) {
    alert("Gagal mengirim data");
  }
}
