// ==================== KONFIGURASI ====================
const API_URL = "https://ujian-baru.kurikulum-sman2cikarangbarat.workers.dev";

// ==================== STATE MANAGEMENT ====================
let state = {
    sessionId: null,
    examData: null,
    questions: [],
    currentIndex: 0,
    answers: [],
    timerInterval: null,
    remainingTime: 0,
    tabSwitchCount: 0,
    isExamActive: false,
    examSubmitted: false,
    student: { nama: '', jenjang: '', kelas: '', token: '' }
};

// ==================== HELPER FUNCTIONS ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showError(message) {
    const errorBox = document.getElementById('login-error');
    errorBox.textContent = message;
    errorBox.style.display = 'block';
}

function showNotification(message, type = 'info') {
    // Hapus notifikasi lama
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    notification.querySelector('.notification-close').onclick = () => notification.remove();
    
    setTimeout(() => notification.remove(), 5000);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    // Setup jenjang dropdown
    const kelasData = {
        'X': ['X-A', 'X-B', 'X-C', 'X-D', 'X-E', 'X-F'],
        'XI': ['XI-A', 'XI-B', 'XI-C', 'XI-D', 'XI-E', 'XI-F', 'XI-G'],
        'XII': ['XII-A', 'XII-B', 'XII-C', 'XII-D', 'XII-E', 'XII-F', 'XII-G']
    };
    
    const jenjangSelect = document.getElementById('jenjang');
    if (jenjangSelect) {
        jenjangSelect.addEventListener('change', function() {
            const kelasSelect = document.getElementById('kelas');
            const jenjang = this.value;
            
            if (!jenjang) {
                kelasSelect.innerHTML = '<option value="">Pilih Jenjang terlebih dahulu</option>';
                kelasSelect.disabled = true;
                return;
            }
            
            kelasSelect.innerHTML = '<option value="">Pilih Kelas</option>';
            kelasData[jenjang].forEach(kelas => {
                const option = document.createElement('option');
                option.value = kelas;
                option.textContent = kelas;
                kelasSelect.appendChild(option);
            });
            
            kelasSelect.disabled = false;
        });
    }
    
    // Enter key untuk login
    const tokenInput = document.getElementById('token');
    if (tokenInput) {
        tokenInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleLogin();
        });
    }
});

// ==================== LOGIN HANDLER ====================
async function handleLogin() {
    // Ambil data form
    const nama = document.getElementById('nama').value.trim();
    const jenjang = document.getElementById('jenjang').value;
    const kelas = document.getElementById('kelas').value;
    const token = document.getElementById('token').value.trim();
    
    // Validasi sederhana
    if (!nama || !jenjang || !kelas || !token) {
        showError('Harap isi semua data dengan lengkap');
        return;
    }
    
    // Simpan ke state
    state.student = { nama, jenjang, kelas, token };
    
    // Tampilkan loading
    showScreen('screen-loading');
    document.getElementById('loading-message').textContent = 'Memproses login...';
    
    try {
        // 1. LOGIN
        const loginRes = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                nama: nama,
                kelas: jenjang,
                rombel: kelas,
                token: token
            })
        });
        
        // Cek response status
        if (!loginRes.ok) {
            throw new Error(`HTTP ${loginRes.status}: Gagal login`);
        }
        
        const loginData = await loginRes.json();
        
        if (!loginData.success) {
            throw new Error(loginData.error || 'Login gagal');
        }
        
        // 2. SIMPAN SESSION
        state.sessionId = loginData.session?.id;
        state.examData = loginData.ujian;
        
        if (!state.sessionId) {
            throw new Error('Session tidak valid');
        }
        
        if (!state.examData?.durasi) {
            throw new Error('Data ujian tidak lengkap');
        }
        
        // 3. AMBIL SOAL
        document.getElementById('loading-message').textContent = 'Mengambil soal...';
        
        const soalRes = await fetch(
            `${API_URL}/api/soal?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(state.sessionId)}`
        );
        
        if (!soalRes.ok) {
            throw new Error(`HTTP ${soalRes.status}: Gagal mengambil soal`);
        }
        
        const soalData = await soalRes.json();
        
        if (!soalData.success) {
            throw new Error(soalData.error || 'Tidak ada soal');
        }
        
        if (!soalData.soal?.length) {
            throw new Error('Soal tidak tersedia');
        }
        
        // 4. SETUP EXAM
        state.questions = soalData.soal;
        state.answers = new Array(soalData.soal.length).fill(null);
        state.remainingTime = state.examData.durasi * 60;
        state.isExamActive = true;
        
        // Setup UI
        setupExamScreen();
        showScreen('screen-exam');
        startTimer();
        showQuestion(0);
        
        // Fullscreen
        setTimeout(() => {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
        }, 500);
        
        // Tab switch tracking
        startTabSwitchTracking();
        
        showNotification('Ujian dimulai. Selamat mengerjakan!', 'success');
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = error.message;
        
        // Handle error khusus
        if (error.message.includes('HTTP 500')) {
            errorMessage = 'Server sedang mengalami masalah. Silakan coba lagi nanti.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Koneksi internet terputus. Periksa koneksi Anda.';
        } else if (error.message.includes('token')) {
            errorMessage = 'Token tidak valid. Periksa kembali.';
        }
        
        showScreen('screen-login');
        showError(errorMessage);
    }
}

// ==================== EXAM FUNCTIONS ====================
function setupExamScreen() {
    // Update info
    document.getElementById('exam-kelas').textContent = state.student.kelas;
    document.getElementById('exam-mapel').textContent = state.examData?.mapel || '-';
    document.getElementById('exam-guru').textContent = state.examData?.nama_guru || '-';
    
    // Setup grid
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';
    
    state.questions.forEach((_, i) => {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.textContent = i + 1;
        item.onclick = () => showQuestion(i);
        grid.appendChild(item);
    });
    
    updateProgress();
}

function showQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    
    state.currentIndex = index;
    const question = state.questions[index];
    
    // Update soal
    document.getElementById('question-text').textContent = question.soal;
    
    // Update gambar
    const imgElement = document.getElementById('question-image');
    if (question.img_link?.trim()) {
        const imageId = question.img_link.trim();
        imgElement.src = `https://lh3.googleusercontent.com/d/${imageId}`;
        imgElement.style.display = 'block';
        imgElement.onerror = () => imgElement.style.display = 'none';
    } else {
        imgElement.style.display = 'none';
    }
    
    // Update pilihan
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    
    const options = [
        { letter: 'A', text: question.opsi_a || '' },
        { letter: 'B', text: question.opsi_b || '' },
        { letter: 'C', text: question.opsi_c || '' },
        { letter: 'D', text: question.opsi_d || '' }
    ];
    
    if (question.opsi_e?.trim()) {
        options.push({ letter: 'E', text: question.opsi_e });
    }
    
    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        if (state.answers[index] === opt.letter) {
            optionDiv.classList.add('selected');
        }
        
        optionDiv.onclick = () => selectAnswer(opt.letter);
        
        optionDiv.innerHTML = `
            <div class="option-letter">${opt.letter}</div>
            <div class="option-text">${opt.text || '[Tidak ada teks]'}</div>
        `;
        
        container.appendChild(optionDiv);
    });
    
    updateProgress();
}

function selectAnswer(answer) {
    state.answers[state.currentIndex] = answer;
    
    // Update UI
    document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
    document.querySelectorAll('.option').forEach(opt => {
        if (opt.querySelector('.option-letter').textContent === answer) {
            opt.classList.add('selected');
        }
    });
    
    updateProgress();
    
    // Auto next
    setTimeout(() => {
        if (state.currentIndex < state.questions.length - 1) {
            showQuestion(state.currentIndex + 1);
        }
    }, 300);
}

function prevQuestion() {
    if (state.currentIndex > 0) {
        showQuestion(state.currentIndex - 1);
    }
}

function nextQuestion() {
    if (state.currentIndex < state.questions.length - 1) {
        showQuestion(state.currentIndex + 1);
    }
}

function updateProgress() {
    const total = state.questions.length;
    const current = state.currentIndex + 1;
    const answered = state.answers.filter(a => a !== null).length;
    
    document.getElementById('exam-progress').textContent = `${current}/${total}`;
    
    // Show/hide buttons
    document.getElementById('btn-prev').classList.toggle('hidden', state.currentIndex === 0);
    document.getElementById('btn-next').classList.toggle('hidden', state.currentIndex === total - 1);
    document.getElementById('btn-submit').classList.toggle('hidden', answered !== total);
    
    // Update grid
    const gridItems = document.querySelectorAll('.grid-item');
    gridItems.forEach((item, index) => {
        item.classList.remove('answered', 'current');
        if (state.answers[index] !== null) item.classList.add('answered');
        if (index === state.currentIndex) item.classList.add('current');
    });
}

// ==================== TIMER ====================
function startTimer() {
    clearInterval(state.timerInterval);
    
    state.timerInterval = setInterval(() => {
        state.remainingTime--;
        
        const minutes = Math.floor(state.remainingTime / 60);
        const seconds = state.remainingTime % 60;
        document.getElementById('exam-timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Warning colors
        const timerEl = document.getElementById('exam-timer');
        if (state.remainingTime <= 300) {
            timerEl.style.background = '#e74c3c';
        } else if (state.remainingTime <= 600) {
            timerEl.style.background = '#ff9800';
        }
        
        // Time's up
        if (state.remainingTime <= 0) {
            clearInterval(state.timerInterval);
            submitExam();
        }
    }, 1000);
}

// ==================== TAB SWITCH TRACKING ====================
function startTabSwitchTracking() {
    state.tabSwitchCount = 0;
    
    document.addEventListener('visibilitychange', () => {
        if (state.isExamActive && !state.examSubmitted && document.hidden) {
            state.tabSwitchCount++;
            showNotification('Anda meninggalkan halaman ujian!', 'error');
        }
    });
}

// ==================== SUBMIT EXAM ====================
async function submitExam() {
    if (state.examSubmitted) return;
    
    state.examSubmitted = true;
    state.isExamActive = false;
    
    clearInterval(state.timerInterval);
    
    // Exit fullscreen
    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
    
    showScreen('screen-loading');
    document.getElementById('loading-message').textContent = 'Mengirim jawaban...';
    
    try {
        const jawabanArray = state.answers.map(answer => answer || '-');
        
        const submitRes = await fetch(`${API_URL}/api/nilai`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                session_id: state.sessionId,
                jawaban: jawabanArray,
                tab_switch_count: state.tabSwitchCount
            })
        });
        
        if (!submitRes.ok) {
            throw new Error(`HTTP ${submitRes.status}: Gagal mengirim jawaban`);
        }
        
        const submitData = await submitRes.json();
        
        if (!submitData.success) {
            throw new Error(submitData.error || 'Gagal mengirim jawaban');
        }
        
        // Show result
        showResult();
        
    } catch (error) {
        console.error('Submit error:', error);
        showResult(); // Tetap tampilkan hasil meski error
    }
}

function showResult() {
    // Hitung waktu (estimation)
    const waktuPengerjaan = Math.max(0, (state.examData?.durasi || 0) - Math.floor(state.remainingTime / 60));
    
    document.getElementById('result-nama').textContent = state.student.nama;
    document.getElementById('result-kelas').textContent = state.student.kelas;
    document.getElementById('result-mapel').textContent = state.examData?.mapel || '-';
    document.getElementById('result-total-soal').textContent = state.questions.length;
    document.getElementById('result-dijawab').textContent = `${state.answers.filter(a => a !== null).length} soal`;
    document.getElementById('result-nilai').textContent = `${waktuPengerjaan} menit`;
    
    showScreen('screen-result');
    showNotification('Ujian berhasil diselesaikan!', 'success');
}

function showPenutup() {
    const waktuPengerjaan = Math.max(0, (state.examData?.durasi || 0) - Math.floor(state.remainingTime / 60));
    
    document.getElementById('penutup-message').innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h3 style="color: #1a73e8; margin-bottom: 20px;">
                <i class="fas fa-certificate"></i> Bukti Penyelesaian Ujian
            </h3>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                <p style="margin-bottom: 15px; font-size: 1.1rem; color: #333;">
                    <strong>${state.student.nama}</strong><br>
                    <span style="color: #666;">${state.student.kelas}</span>
                </p>
                
                <div style="border-top: 1px solid #e0e0e0; padding-top: 15px; margin-top: 15px;">
                    <p style="margin-bottom: 10px;">
                        <strong>Mata Pelajaran:</strong><br>
                        ${state.examData?.mapel || '-'}
                    </p>
                    
                    <p style="margin-bottom: 10px;">
                        <strong>Jumlah Soal:</strong><br>
                        ${state.questions.length} soal
                    </p>
                    
                    <p style="margin-bottom: 10px;">
                        <strong>Waktu Pengerjaan:</strong><br>
                        ${waktuPengerjaan} menit
                    </p>
                </div>
            </div>
            
            <p style="color: #2e7d32; font-weight: 600; padding: 15px; background: #e8f5e9; border-radius: 8px;">
                <i class="fas fa-check-circle"></i> Tunjukkan bukti ini kepada pengawas ujian
            </p>
        </div>
    `;
    
    // Tab switch info
    const tabInfo = document.getElementById('tab-switch-info');
    if (state.tabSwitchCount > 0) {
        tabInfo.innerHTML = `
            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #ff9800;">
                <i class="fas fa-exclamation-triangle" style="color: #ff9800;"></i> 
                <strong style="color: #e65100;">Catatan:</strong> 
                Terdapat <strong>${state.tabSwitchCount} kali</strong> aktivitas berpindah tab/window.
            </div>
        `;
        tabInfo.style.display = 'block';
    } else {
        tabInfo.style.display = 'none';
    }
    
    showScreen('screen-penutup');
}

function keluarAplikasi() {
    // Reset semua
    state = {
        sessionId: null,
        examData: null,
        questions: [],
        currentIndex: 0,
        answers: [],
        timerInterval: null,
        remainingTime: 0,
        tabSwitchCount: 0,
        isExamActive: false,
        examSubmitted: false,
        student: { nama: '', jenjang: '', kelas: '', token: '' }
    };
    
    // Reset form
    document.getElementById('nama').value = '';
    document.getElementById('jenjang').value = '';
    document.getElementById('kelas').innerHTML = '<option value="">Pilih Jenjang terlebih dahulu</option>';
    document.getElementById('kelas').disabled = true;
    document.getElementById('token').value = '';
    document.getElementById('login-error').style.display = 'none';
    
    showScreen('screen-login');
}

// ==================== BROWSER PROTECTION ====================
window.addEventListener('beforeunload', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        e.returnValue = 'Jawaban Anda belum disimpan. Yakin ingin meninggalkan halaman?';
        return e.returnValue;
    }
});

// Context menu
document.addEventListener('contextmenu', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        return false;
    }
});

// Copy-paste protection
['copy', 'paste', 'cut'].forEach(event => {
    document.addEventListener(event, function(e) {
        if (state.isExamActive && !state.examSubmitted) {
            e.preventDefault();
            return false;
        }
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        const blockedKeys = [
            'F5', 'F12', 
            (e.ctrlKey && e.key === 'r'),
            (e.ctrlKey && e.shiftKey && e.key === 'R'),
            (e.ctrlKey && e.key === 'F5'),
            (e.ctrlKey && e.key === 'p'),
            (e.ctrlKey && e.shiftKey && e.key === 'P'),
            (e.ctrlKey && e.key === 's'),
            (e.ctrlKey && e.key === 'u'),
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')),
            (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')),
            (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c'))
        ];
        
        if (blockedKeys.some(condition => condition)) {
            e.preventDefault();
            return false;
        }
    }
});

// Selection prevention
document.addEventListener('selectstart', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        return false;
    }
});
