const API_URL = "https://nocob-proxy.kurikulum-sman2cikarangbarat.workers.dev";
let exam = { 
    questions: [], 
    currentIndex: 0, 
    answers: {}, 
    student: {}, 
    config: {}, 
    timeLeft: 0, 
    start: null, 
    optionStates: {}, 
    cheatCount: 0,
    tabSwitchCount: 0 
};

// ==================== FUNGSI FULLSCREEN SIMPLE ====================
function enterFullscreen() {
    const elem = document.documentElement;
    
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {
            // Jika gagal, tetap lanjut tanpa fullscreen
        });
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen().catch(() => {});
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen().catch(() => {});
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

// ==================== FUNGSI UTAMA ====================
function showToast(m) { 
    const t = document.getElementById('toast'); 
    t.innerText = m; 
    t.style.opacity = 1;
    setTimeout(() => t.style.opacity = 0, 2000);
}

function filterKelompok() {
    const t = document.getElementById('input-kelas').value;
    const s = document.getElementById('input-kelompok');
    s.innerHTML = '<option value="" disabled selected>-- Pilih Kelas --</option>';
    ["A","B","C","D","E","F","G","H","I","J","K","L"].forEach(h => {
        let o = document.createElement("option"); o.value = `${t} - ${h}`; o.text = `${t} - ${h}`; s.appendChild(o);
    });
}

function showConfirm() { document.getElementById('modal-confirm').style.display = 'flex'; }
function hideConfirm() { document.getElementById('modal-confirm').style.display = 'none'; }

function showWelcome() {
    const welcomeText = `
        <h3 style="color: #1a73e8; margin-bottom: 15px;">Halo, ${exam.student.nama}!</h3>
        <p style="margin-bottom: 15px;">
            Anda akan mengerjakan ujian <strong>${exam.config.mapel}</strong><br>
            untuk kelas <strong>${exam.student.rombel}</strong>
        </p>
        <div style="background: #e8f0fe; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <p style="margin-bottom: 10px;">📝 <strong>Petunjuk:</strong></p>
            <ul style="text-align: left; margin-left: 20px;">
                <li>Kerjakan soal dengan sungguh-sungguh dan jujur</li>
                <li>Waktu ujian: <strong>${exam.config.durasi} menit</strong></li>
                <li>Total soal: <strong>${exam.questions.length} butir</strong></li>
                <li>Pilih jawaban dengan mengklik opsi yang tersedia</li>
                <li>Klik KIRIM setelah semua soal terjawab</li>
            </ul>
        </div>
        <p style="font-style: italic; color: #666;">
            "Kejujuran adalah fondasi karakter yang kuat.<br>
            Hasil terbaik datang dari usaha yang tulus."
        </p>
        <p style="margin-top: 20px; font-weight: bold; color: #27ae60;">
            Selamat mengerjakan! 🎯
        </p>
    `;
    
    document.getElementById('welcome-text').innerHTML = welcomeText;
    document.getElementById('view-loading').classList.remove('active');
    document.getElementById('view-welcome').classList.add('active');
}

function startExam() {
    document.getElementById('view-welcome').classList.remove('active');
    document.getElementById('view-exam').classList.add('active');
    renderQuestion();
    startTimer();
}

async function login() {
    const n = document.getElementById('input-nama').value, k = document.getElementById('input-kelas').value, 
          g = document.getElementById('input-kelompok').value, t = document.getElementById('input-token').value.trim();
    if(!n || !k || !g || !t) return showToast("Lengkapi semua kolom!");

    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-loading').classList.add('active');

    try {
        const [rU, rS] = await Promise.all([
            fetch(`${API_URL}/api/ujian?where=(token,eq,${t})`),
            fetch(`${API_URL}/api/bank_soal?where=(token,eq,${t})`)
        ]);
        const [dU, dS] = await Promise.all([rU.json(), rS.json()]);

        if(!dU.list.length) throw new Error("Token Salah!");
        
        exam.questions = dS.list.sort(() => Math.random() - 0.5);
        exam.student = { nama: n, tingkat: k, rombel: g, token: t };
        exam.config = { mapel: dU.list[0].mapel, guru: dU.list[0].nama_guru, durasi: dU.list[0].durasi };
        exam.timeLeft = (parseInt(dU.list[0].durasi) || 90) * 60;
        exam.start = new Date();

        // LANGSUNG FULLSCREEN tanpa modal konfirmasi
        enterFullscreen();
        
        // Tampilkan welcome page
        showWelcome();
        
    } catch(e) { showToast(e.message); location.reload(); }
}

function renderQuestion() {
    const q = exam.questions[exam.currentIndex];
    const qId = q.Id || q.id;
    document.getElementById('q-number').innerText = `${exam.currentIndex + 1} / ${exam.questions.length}`;
    document.getElementById('q-text').innerHTML = q.soal;

    const img = document.getElementById('q-img');
    if(q.img_link) { 
        const id = q.img_link.match(/[-\w]{25,}/);
        img.src = id ? `https://lh3.googleusercontent.com/u/0/d/${id[0]}` : q.img_link;
        img.style.display = 'block';
    } else { img.style.display = 'none'; }

    if (!exam.optionStates[qId]) {
        let opts = [{l:'A',t:q.opsi_a},{l:'B',t:q.opsi_b},{l:'C',t:q.opsi_c},{l:'D',t:q.opsi_d},{l:'E',t:q.opsi_e}].filter(o=>o.t);
        exam.optionStates[qId] = opts.sort(() => Math.random() - 0.5);
    }

    let h = '';
    exam.optionStates[qId].forEach((o, i) => {
        const letter = String.fromCharCode(65 + i);
        const sel = exam.answers[qId] === o.l ? 'selected' : '';
        h += `<div class="option ${sel}" onclick="setAns('${qId}','${o.l}')"><b>${letter}.</b> ${o.t}</div>`;
    });
    document.getElementById('q-options').innerHTML = h;

    const done = Object.keys(exam.answers).length === exam.questions.length;
    document.getElementById('btn-kirim-trigger').style.display = done ? 'block' : 'none';
    renderNav();
}

function setAns(id, l) { 
    exam.answers[id] = l; renderQuestion(); 
    setTimeout(() => { if(exam.currentIndex < exam.questions.length - 1) jump(exam.currentIndex + 1); }, 400);
}
    
function startTimer() {
    exam.timer = setInterval(() => {
        exam.timeLeft--;
        let m = Math.floor(exam.timeLeft/60).toString().padStart(2,'0'), s = (exam.timeLeft%60).toString().padStart(2,'0');
        document.getElementById('timer-display').innerText = `${m}:${s}`;
        if(exam.timeLeft <= 0) submitData();
    }, 1000);
}

function jump(i) { exam.currentIndex = i; renderQuestion(); }
function nextQ() { if(exam.currentIndex < exam.questions.length-1) jump(exam.currentIndex+1); }
function prevQ() { if(exam.currentIndex > 0) jump(exam.currentIndex-1); }

function renderNav() {
    document.getElementById('nav-grid').innerHTML = exam.questions.map((q, i) => 
        `<div class="nav-box ${exam.answers[q.Id||q.id]?'answered':''} ${i===exam.currentIndex?'current':''}" onclick="jump(${i})">${i+1}</div>`
    ).join('');
}

async function submitData() {
    hideConfirm();
    clearInterval(exam.timer);
    document.getElementById('view-exam').style.display = 'none';
    document.getElementById('view-loading').classList.add('active');
    document.getElementById('loading-text').innerText = "Menyimpan ke Server...";

    let sorted = [...exam.questions].sort((a,b) => (a.Id||a.id) - (b.Id||b.id));
    let strAns = "", benar = 0;
    sorted.forEach(q => {
        const a = exam.answers[q.Id||q.id] || "-";
        strAns += a;
        // Jika kunci kosong, default ke "A", jika tidak gunakan kunci dari database
        const kunciBenar = q.kunci && q.kunci.trim() !== "" ? q.kunci : "A";
        if(a === kunciBenar) benar++;
    });

    const now = new Date();
    
    // FUNGSI UNTUK KONVERSI KE GMT+7
    function toGMT7(date) {
        // Tambah 7 jam (7 * 60 * 60 * 1000 milidetik)
        const gmt7Time = new Date(date.getTime() + (7 * 60 * 60 * 1000));
        // Format: YYYY-MM-DD HH:MM:SS
        return gmt7Time.toISOString().slice(0,19).replace('T',' ');
    }
    
    // Konversi waktu mulai dan selesai ke GMT+7
    const waktuMulaiGMT7 = toGMT7(exam.start);
    const waktuSelesaiGMT7 = toGMT7(now);
    
    // Hitung durasi dalam menit
    const durasiMs = now - exam.start;
    const durasiMenit = Math.floor(durasiMs / 60000);
    
    const payload = {
        nama_siswa: exam.student.nama,
        token: exam.student.token,
        mapel: exam.config.mapel,
        kelas: exam.student.tingkat,
        id_kelas: exam.student.rombel,
        jml_benar: benar,
        jml_salah: exam.questions.length - benar,
        nilai: Math.round((benar/exam.questions.length)*100),
        nama_guru: exam.config.guru,
        jawaban: strAns,
        curang: exam.cheatCount,
        jml_curang: exam.tabSwitchCount, 
        wkt_diberikan: exam.config.durasi + " Menit",
        wkt_mulai: waktuMulaiGMT7, // WAKTI GMT+7
        wkt_selesai: waktuSelesaiGMT7, // WAKTI GMT+7
        wkt_digunakan: durasiMenit + " Menit"
    };

    try {
        await fetch(`${API_URL}/api/nilai`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        // Exit fullscreen saat selesai
        exitFullscreen();
        
        document.getElementById('view-loading').classList.remove('active');
        document.getElementById('view-result').classList.add('active');
        
        // TAMPILKAN LAPORAN PELANGGARAN DI HALAMAN AKHIR
        let pelanggaranMessage = "";
        if (exam.tabSwitchCount === 0) {
            pelanggaranMessage = "<p style='color:#27ae60; margin:10px 0;'>✅ Tidak tercatat meninggalkan halaman ujian.</p>";
        } else {
            pelanggaranMessage = `
                <div style="background:#fff3cd; padding:12px; border-radius:8px; margin:15px 0; border-left:4px solid #ff9800;">
                    <p style="margin:0; color:#856404; font-weight:bold;">📋 LAPORAN PELANGGARAN:</p>
                    <p style="margin:5px 0 0 0; color:#856404;">
                        Anda meninggalkan halaman ujian sebanyak: <strong>${exam.tabSwitchCount} kali</strong>
                        <br>Data ini telah tercatat dan akan diketahui guru Mapel sebagai pertimbangan pemberian Nilai.
                    </p>
                </div>
            `;
        }
        
        document.getElementById('final-msg').innerHTML = `
            Jawaban <b>${exam.student.nama}</b> berhasil terkirim.<br>
            ${pelanggaranMessage}
            Silakan tunjukkan layar ini kepada pengawas.
        `;
    } catch(e) { 
        showToast("Gagal kirim, mencoba ulang..."); 
        setTimeout(submitData, 3000); 
    }
}

// EVENT LISTENER UNTUK MENCATAT BERPINDAH TAB (TANPA NOTIFIKASI)
document.addEventListener("visibilitychange", () => {
    if (document.hidden && document.getElementById('view-exam').classList.contains('active')) {
        exam.tabSwitchCount++; 
        exam.cheatCount++;
    }
});

