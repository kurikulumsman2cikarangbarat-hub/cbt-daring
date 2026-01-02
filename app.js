// ==================== CONFIGURATION ====================
const API_URL = "https://worker-abk.kurikulum-sman2cikarangbarat.workers.dev";
let exam = { 
    questions: [], 
    currentIndex: 0, 
    answers: {}, 
    student: {}, 
    config: {}, 
    timeLeft: 0, 
    start: null, 
    sessionId: null,
    sessionData: null,
    tabSwitchCount: 0,
    securityChecks: [],
    isFullscreen: false
};

// ==================== UTILITY FUNCTIONS ====================
function showToast(message, duration = 2000) { 
    const toast = document.getElementById('toast'); 
    toast.innerText = message; 
    toast.style.opacity = 1;
    
    setTimeout(() => {
        toast.style.opacity = 0;
    }, duration);
}

function generateClientHash() {
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown'
    ];
    return btoa(components.join('|')).substr(0, 32);
}

// ==================== VIEW MANAGEMENT ====================
function showView(viewId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

function showConfirm() { 
    document.getElementById('modal-confirm').style.display = 'flex'; 
}

function hideConfirm() { 
    document.getElementById('modal-confirm').style.display = 'none'; 
}

// ==================== FULLSCREEN HANDLING ====================
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        enterFullscreen();
    } else {
        exitFullscreen();
    }
}

function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(e => console.log("Fullscreen error:", e));
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    }
    exam.isFullscreen = true;
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    exam.isFullscreen = false;
}

// ==================== LOGIN PROCESS ====================
async function login() {
    const nama = document.getElementById('input-nama').value.trim();
    const kelas = document.getElementById('input-kelas').value;
    const rombel = document.getElementById('input-kelompok').value;
    const token = document.getElementById('input-token').value.trim();
    
    if (!nama || !kelas || !rombel || !token) {
        showToast("Harap lengkapi semua kolom!");
        return;
    }
    
    if (nama.length < 3 || nama.length > 100) {
        showToast("Nama harus 3-100 karakter");
        return;
    }
    
    showView('view-loading');
    document.getElementById('loading-text').innerText = "Verifikasi token...";
    
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Hash': generateClientHash()
            },
            body: JSON.stringify({
                nama: nama,
                kelas: kelas,
                rombel: `${kelas} - ${rombel}`,
                token: token
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Login gagal");
        }
        
        // Simpan session data
        exam.sessionId = data.session_id;
        exam.student = {
            nama: nama,
            kelas: kelas,
            rombel: `${kelas} - ${rombel}`,
            token: token
        };
        exam.config = {
            mapel: data.ujian.mapel,
            guru: data.ujian.guru,
            durasi: data.ujian.durasi
        };
        
        // Tampilkan welcome page
        showWelcome(data.ujian);
        
    } catch (error) {
        showView('view-login');
        showToast(error.message);
        console.error("Login error:", error);
    }
}

function showWelcome(ujianData) {
    const welcomeHTML = `
        <h3 style="color: #1a73e8; margin-bottom: 15px;">Halo, ${exam.student.nama}!</h3>
        <p style="margin-bottom: 15px;">
            Anda akan mengerjakan ujian <strong>${ujianData.mapel}</strong><br>
            untuk kelas <strong>${exam.student.rombel}</strong>
        </p>
        
        <div style="background: #e8f0fe; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <p style="margin-bottom: 10px; color: #1a73e8; font-weight: bold;">📋 Informasi Ujian:</p>
            <div style="text-align: left; padding: 0 15px;">
                <p>🎯 Mata Pelajaran: <strong>${ujianData.mapel}</strong></p>
                <p>👨‍🏫 Guru Pengampu: <strong>${ujianData.guru}</strong></p>
                <p>⏱️ Waktu: <strong>${ujianData.durasi} menit</strong></p>
                <p>🔑 Token: <strong>${exam.student.token}</strong></p>
            </div>
        </div>
        
        <div class="security-warning">
            <p><strong>⚠️ PERINGATAN KEAMANAN:</strong></p>
            <p style="font-size: 0.9rem; margin-top: 5px;">
                Sistem akan mencatat setiap aktivitas selama ujian.<br>
                Jangan meninggalkan halaman ini sebelum ujian selesai.
            </p>
        </div>
        
        <p style="font-style: italic; color: #666; margin-top: 20px;">
            "Kejujuran adalah fondasi karakter yang kuat"
        </p>
    `;
    
    document.getElementById('welcome-text').innerHTML = welcomeHTML;
    showView('view-welcome');
}

// ==================== EXAM START ====================
async function startExam() {
    showView('view-loading');
    document.getElementById('loading-text').innerText = "Memuat soal...";
    
    try {
        // Ambil soal dari server
        const response = await fetch(`${API_URL}/api/soal?token=${exam.student.token}`, {
            headers: {
                'X-Session-ID': exam.sessionId,
                'X-Client-Hash': generateClientHash()
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Gagal mengambil soal");
        }
        
        exam.questions = data.soal;
        exam.timeLeft = exam.config.durasi * 60;
        exam.start = new Date();
        
        // Masuk fullscreen
        enterFullscreen();
        
        // Mulai timer
        startTimer();
        
        // Tampilkan soal pertama
        showView('view-exam');
        renderQuestion();
        
        // Mulai monitoring security
        startSecurityMonitoring();
        
    } catch (error) {
        showView('view-welcome');
        showToast(error.message);
        console.error("Start exam error:", error);
    }
}

// ==================== QUESTION RENDERING ====================
function renderQuestion() {
    if (exam.questions.length === 0) return;
    
    const q = exam.questions[exam.currentIndex];
    const qId = q.id;
    
    // Update nomor soal
    document.getElementById('q-number').innerText = `${exam.currentIndex + 1} / ${exam.questions.length}`;
    
    // Tampilkan soal
    document.getElementById('q-text').innerHTML = `<strong>Soal ${exam.currentIndex + 1}:</strong><br>${q.soal}`;
    
    // Tampilkan gambar jika ada
    const img = document.getElementById('q-img');
    if (q.img_link) {
        img.src = q.img_link;
        img.style.display = 'block';
        
        // Fallback untuk Google Drive links
        if (q.img_link.includes('drive.google.com')) {
            const fileId = q.img_link.match(/[-\w]{25,}/);
            if (fileId) {
                img.src = `https://drive.google.com/thumbnail?id=${fileId[0]}&sz=w1000`;
            }
        }
    } else {
        img.style.display = 'none';
    }
    
    // Tampilkan opsi jawaban
    let optionsHTML = '';
    const options = [
        { letter: 'A', text: q.opsi_a },
        { letter: 'B', text: q.opsi_b },
        { letter: 'C', text: q.opsi_c },
        { letter: 'D', text: q.opsi_d },
        { letter: 'E', text: q.opsi_e }
    ].filter(opt => opt.text && opt.text.trim() !== '');
    
    options.forEach((opt, index) => {
        const isSelected = exam.answers[qId] === opt.letter;
        optionsHTML += `
            <div class="option ${isSelected ? 'selected' : ''}" 
                 onclick="selectAnswer('${qId}', '${opt.letter}')">
                <b>${opt.letter}.</b> ${opt.text}
            </div>
        `;
    });
    
    document.getElementById('q-options').innerHTML = optionsHTML;
    
    // Update navigation
    updateNavigation();
    
    // Tampilkan tombol kirim jika semua soal terjawab
    const totalAnswered = Object.keys(exam.answers).length;
    const totalQuestions = exam.questions.length;
    document.getElementById('btn-kirim-trigger').style.display = 
        (totalAnswered === totalQuestions) ? 'block' : 'none';
}

function selectAnswer(questionId, answer) {
    exam.answers[questionId] = answer;
    renderQuestion();
    
    // Auto-advance setelah 300ms jika bukan soal terakhir
    setTimeout(() => {
        if (exam.currentIndex < exam.questions.length - 1) {
            nextQuestion();
        }
    }, 300);
}

function nextQuestion() {
    if (exam.currentIndex < exam.questions.length - 1) {
        exam.currentIndex++;
        renderQuestion();
    }
}

function prevQuestion() {
    if (exam.currentIndex > 0) {
        exam.currentIndex--;
        renderQuestion();
    }
}

function jumpToQuestion(index) {
    if (index >= 0 && index < exam.questions.length) {
        exam.currentIndex = index;
        renderQuestion();
    }
}

function updateNavigation() {
    let navHTML = '';
    
    exam.questions.forEach((q, index) => {
        const isAnswered = exam.answers[q.id];
        const isCurrent = index === exam.currentIndex;
        
        let className = 'nav-box';
        if (isCurrent) className += ' current';
        if (isAnswered) className += ' answered';
        
        navHTML += `
            <div class="${className}" onclick="jumpToQuestion(${index})">
                ${index + 1}
            </div>
        `;
    });
    
    document.getElementById('nav-grid').innerHTML = navHTML;
}

// ==================== TIMER MANAGEMENT ====================
function startTimer() {
    updateTimerDisplay();
    
    exam.timerInterval = setInterval(() => {
        exam.timeLeft--;
        updateTimerDisplay();
        
        if (exam.timeLeft <= 0) {
            clearInterval(exam.timerInterval);
            showToast("Waktu habis! Mengirim jawaban...");
            setTimeout(submitData, 1000);
        }
        
        // Auto-save setiap 30 detik
        if (exam.timeLeft % 30 === 0) {
            saveProgressLocally();
        }
        
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(exam.timeLeft / 60);
    const seconds = exam.timeLeft % 60;
    document.getElementById('timer-display').innerText = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Change color when less than 5 minutes
    if (exam.timeLeft < 300) {
        document.getElementById('timer-display').style.color = '#ff4444';
    }
}

// ==================== SECURITY MONITORING ====================
function startSecurityMonitoring() {
    // Track tab switching
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            exam.tabSwitchCount++;
            showToast(`⚠️ Jangan meninggalkan halaman! (Pelanggaran: ${exam.tabSwitchCount}x)`);
            
            if (exam.tabSwitchCount >= 3) {
                showToast("🚨 PERINGATAN AKHIR! Anda terlalu sering meninggalkan halaman!");
            }
        }
    });
    
    // Block right click
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showToast("Klik kanan dinonaktifkan selama ujian");
    });
    
    // Block keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'i' || e.key === 'I')) {
            e.preventDefault();
            showToast("Shortcut keyboard dinonaktifkan");
        }
        
        if (e.key === 'F12') {
            e.preventDefault();
            showToast("Developer tools dinonaktifkan");
        }
    });
}

// ==================== LOCAL PROGRESS SAVING ====================
function saveProgressLocally() {
    try {
        const progress = {
            answers: exam.answers,
            currentIndex: exam.currentIndex,
            timeLeft: exam.timeLeft,
            timestamp: new Date().toISOString(),
            sessionId: exam.sessionId
        };
        
        localStorage.setItem(`cbt_progress_${exam.student.token}`, JSON.stringify(progress));
    } catch (error) {
        console.error("Gagal menyimpan progress lokal:", error);
    }
}

function loadProgressLocally() {
    try {
        const saved = localStorage.getItem(`cbt_progress_${exam.student.token}`);
        if (saved) {
            const progress = JSON.parse(saved);
            exam.answers = progress.answers || {};
            exam.currentIndex = progress.currentIndex || 0;
            exam.timeLeft = progress.timeLeft || exam.timeLeft;
            
            showToast("Progress sebelumnya dimuat", 3000);
        }
    } catch (error) {
        console.error("Gagal memuat progress:", error);
    }
}

// ==================== SUBMIT EXAM ====================
async function submitData() {
    hideConfirm();
    clearInterval(exam.timerInterval);
    
    // Blokir interaksi lebih lanjut
    document.getElementById('view-exam').style.pointerEvents = 'none';
    showView('view-loading');
    document.getElementById('loading-text').innerText = "Mengirim jawaban...";
    
    try {
        // Persiapkan jawaban string
        let jawabanString = '';
        exam.questions.forEach((q, index) => {
            jawabanString += exam.answers[q.id] || '-';
        });
        
        // Kirim ke server
        const response = await fetch(`${API_URL}/api/nilai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': exam.sessionId,
                'X-Client-Hash': generateClientHash()
            },
            body: JSON.stringify({
                session_id: exam.sessionId,
                jawaban: jawabanString
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Gagal mengirim jawaban");
        }
        
        // Hapus progress lokal
        localStorage.removeItem(`cbt_progress_${exam.student.token}`);
        
        // Tampilkan hasil
        showResult(data);
        
    } catch (error) {
        // Fallback: Simpan ke localStorage untuk retry nanti
        const backupData = {
            sessionId: exam.sessionId,
            jawaban: exam.answers,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(`cbt_backup_${exam.student.token}`, JSON.stringify(backupData));
        
        showToast("Gagal mengirim. Data disimpan untuk dikirim nanti.");
        
        // Tampilkan halaman result dengan warning
        showResult({
            success: false,
            message: "Jawaban disimpan lokal. Hubungi pengawas.",
            hasil: { nilai: 0, benar: 0, salah: 0, total_soal: exam.questions.length }
        });
    }
}

function showResult(resultData) {
    exitFullscreen();
    
    let resultHTML = '';
    
    if (resultData.success) {
        resultHTML = `
            <h3 style="color: #27ae60;">✅ JAWABAN BERHASIL DIKIRIM</h3>
            <p>Nama: <strong>${exam.student.nama}</strong></p>
            <p>Kelas: <strong>${exam.student.rombel}</strong></p>
            <p>Mata Pelajaran: <strong>${exam.config.mapel}</strong></p>
            
            <div style="background: #e8f0fe; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <h4 style="color: #1a73e8; margin-bottom: 10px;">📊 HASIL UJIAN</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; text-align: left;">
                    <div>Soal Dijawab: <strong>${Object.keys(exam.answers).length}/${exam.questions.length}</strong></div>
                    <div>Jawaban Benar: <strong>${resultData.hasil.benar}</strong></div>
                    <div>Jawaban Salah: <strong>${resultData.hasil.salah}</strong></div>
                    <div>Nilai Akhir: <strong>${resultData.hasil.nilai}</strong></div>
                </div>
            </div>
            
            <div style="background: #fff3cd; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ff9800;">
                <p style="margin: 0; color: #856404; font-weight: bold;">📋 LAPORAN KEAMANAN</p>
                <p style="margin: 5px 0 0 0; color: #856404;">
                    Pelanggaran tab: <strong>${exam.tabSwitchCount} kali</strong><br>
                    ID Submission: <code style="font-size: 0.8rem;">${resultData.nilai_id || 'N/A'}</code>
                </p>
            </div>
            
            <p style="color: #666; font-size: 0.9rem; margin-top: 20px;">
                Tunjukkan layar ini kepada pengawas ruangan.
            </p>
        `;
    } else {
        resultHTML = `
            <h3 style="color: #e74c3c;">⚠️ PERHATIAN</h3>
            <p>${resultData.message}</p>
            
            <div style="background: #ffeaa7; padding: 15px; border-radius: 10px; margin: 20px 0;">
                <p><strong>Data telah disimpan secara lokal:</strong></p>
                <p>Token: <code>${exam.student.token}</code></p>
                <p>Waktu: ${new Date().toLocaleString()}</p>
            </div>
            
            <p style="color: #666;">
                Silakan hubungi pengawas untuk bantuan teknis.
            </p>
        `;
    }
    
    document.getElementById('final-msg').innerHTML = resultHTML;
    showView('view-result');
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    // Expose functions to global scope
    window.login = login;
    window.startExam = startExam;
    window.showConfirm = showConfirm;
    window.hideConfirm = hideConfirm;
    window.submitData = submitData;
    window.toggleFullscreen = toggleFullscreen;
    window.nextQ = nextQuestion;
    window.prevQ = prevQuestion;
    window.jump = jumpToQuestion;
    
    // Shorter alias for answer selection
    window.selectAnswer = selectAnswer;
    
    // Load any saved progress
    setTimeout(() => {
        // Check if there's a token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
            document.getElementById('input-token').value = token;
        }
    }, 500);
});

// ==================== GLOBAL EXPORTS ====================
// Export untuk navigation grid
window.jumpToQuestion = jumpToQuestion;
