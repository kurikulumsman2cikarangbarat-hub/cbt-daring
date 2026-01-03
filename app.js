// ==================== KONFIGURASI ====================
// Pastikan URL API sesuai dengan deployment worker Anda
const API_URL = "https://worker-abk.kurikulum-sman2cikarangbarat.workers.dev";

// ==================== STATE MANAGEMENT ====================
let state = {
    // Login data
    sessionId: null,
    sessionSeed: null,
    
    // Exam data
    examData: null,
    questions: [],
    
    // Progress
    currentIndex: 0,
    answers: {},
    
    // Timer
    startTime: null,
    timerInterval: null,
    remainingTime: 0,
    
    // Tracking
    tabSwitchCount: 0,
    isExamActive: false,
    examSubmitted: false,
    
    // Student data
    student: {
        nama: '',
        jenjang: '',  // X, XI, XII
        kelas: '',    // Kelas lengkap (X-A, XI-B, dll)
        token: ''
    }
};

// ==================== KELAS DATA ====================
const kelasData = {
    'X': ['X-A', 'X-B', 'X-C', 'X-D', 'X-E', 'X-F'],
    'XI': ['XI-A', 'XI-B', 'XI-C', 'XI-D', 'XI-E', 'XI-F', 'XI-G'],
    'XII': ['XII-A', 'XII-B', 'XII-C', 'XII-D', 'XII-E', 'XII-F', 'XII-G']
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    // Setup jenjang dropdown change event
    document.getElementById('jenjang').addEventListener('change', function() {
        updateKelasDropdown(this.value);
    });
    
    // Setup enter key for login
    document.getElementById('token').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Clear any existing exam data
    clearExamData();
});

// ==================== HELPER FUNCTIONS ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showError(message, isLoginError = true) {
    if (isLoginError) {
        const errorBox = document.getElementById('login-error');
        errorBox.textContent = message;
        errorBox.style.display = 'block';
        setTimeout(() => errorBox.style.display = 'none', 5000);
    } else {
        alert(message);
    }
}

function updateKelasDropdown(jenjang) {
    const kelasSelect = document.getElementById('kelas');
    
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
}

// ==================== LOGIN HANDLER ====================
async function handleLogin() {
    // Collect data
    const nama = document.getElementById('nama').value.trim();
    const jenjang = document.getElementById('jenjang').value;
    const kelas = document.getElementById('kelas').value;
    const token = document.getElementById('token').value.trim();
    
    // Validation
    if (!nama || !jenjang || !kelas || !token) {
        showError('Harap isi semua data dengan lengkap');
        return;
    }
    
    if (nama.length < 3) {
        showError('Nama minimal 3 karakter');
        return;
    }
    
    // Save student data
    state.student = { 
        nama: nama, 
        jenjang: jenjang,  // Ini adalah jenjang (X, XI, XII)
        kelas: kelas,      // Ini adalah kelas lengkap (X-A, XI-B, dll)
        token: token 
    };
    
    // Show loading
    showScreen('screen-loading');
    
    try {
        // PERBAIKAN 1: Check token - ubah endpoint sesuai worker
        document.getElementById('loading-message').textContent = 'Memeriksa token ujian...';
        
        const checkRes = await fetch(`${API_URL}/api/check-token?token=${encodeURIComponent(token)}`);
        
        if (!checkRes.ok) {
            throw new Error(`HTTP ${checkRes.status}: Gagal memeriksa token`);
        }
        
        const checkData = await checkRes.json();
        
        if (!checkData.success) {
            throw new Error(checkData.error || 'Token ujian tidak ditemukan');
        }
        
        if (!checkData.exists) {
            throw new Error('Token ujian tidak ditemukan atau sudah kadaluarsa');
        }
        
        // PERBAIKAN 2: Login dengan data yang sesuai
        document.getElementById('loading-message').textContent = 'Login ke sistem...';
        
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
        
        if (!loginRes.ok) {
            const errorText = await loginRes.text();
            throw new Error(`HTTP ${loginRes.status}: ${errorText}`);
        }
        
        const loginData = await loginRes.json();
        
        if (!loginData.success) {
            throw new Error(loginData.error || 'Gagal login ke sistem');
        }
        
        state.sessionId = loginData.session_id;
        state.sessionSeed = loginData.session_seed;
        state.examData = loginData.ujian;
        
        // Step 3: Get questions
        document.getElementById('loading-message').textContent = 'Mengambil soal ujian...';
        
        const soalRes = await fetch(
            `${API_URL}/api/soal?token=${encodeURIComponent(token)}&session_seed=${state.sessionSeed}`
        );
        
        if (!soalRes.ok) {
            throw new Error(`HTTP ${soalRes.status}: Gagal mengambil soal`);
        }
        
        const soalData = await soalRes.json();
        
        if (!soalData.success) {
            throw new Error(soalData.error || 'Gagal mengambil soal');
        }
        
        if (!soalData.soal || soalData.soal.length === 0) {
            throw new Error('Tidak ada soal yang tersedia untuk ujian ini');
        }
        
        state.questions = soalData.soal;
        state.startTime = new Date();
        state.remainingTime = state.examData.durasi * 60;
        state.isExamActive = true;
        
        // Step 4: Setup exam screen
        setupExamScreen();
        showScreen('screen-exam');
        startTimer();
        showQuestion(0);
        
        // Step 5: Start tab switch tracking
        startTabSwitchTracking();
        
        console.log('Login berhasil:', {
            sessionId: state.sessionId,
            jumlahSoal: state.questions.length,
            durasi: state.examData.durasi
        });
        
    } catch (error) {
        console.error('Login error detail:', error);
        
        // Tampilkan pesan error yang lebih spesifik
        let errorMessage = error.message;
        
        // Periksa jika error terkait koneksi
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            errorMessage = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
        }
        
        // Periksa jika token tidak valid
        if (errorMessage.includes('Token') || errorMessage.includes('token')) {
            errorMessage = 'Token ujian tidak valid. Pastikan token yang dimasukkan benar.';
        }
        
        showScreen('screen-login');
        showError(errorMessage);
    }
}

// ==================== EXAM SETUP ====================
function setupExamScreen() {
    // Update exam info
    document.getElementById('exam-kelas').textContent = state.student.kelas;
    document.getElementById('exam-mapel').textContent = state.examData?.mapel || '-';
    document.getElementById('exam-guru').textContent = state.examData?.nama_guru || '-';
    
    // Setup question grid
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';
    
    for (let i = 0; i < state.questions.length; i++) {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.textContent = i + 1;
        item.onclick = () => showQuestion(i);
        grid.appendChild(item);
    }
    
    updateProgress();
}

function updateProgress() {
    const total = state.questions.length;
    const current = state.currentIndex + 1;
    const answered = Object.keys(state.answers).length;
    
    // Update progress text
    document.getElementById('exam-progress').textContent = `${current}/${total}`;
    
    // Update navigation buttons
    document.getElementById('btn-prev').classList.toggle('hidden', state.currentIndex === 0);
    document.getElementById('btn-next').classList.toggle('hidden', state.currentIndex === total - 1);
    document.getElementById('btn-submit').classList.toggle('hidden', answered !== total);
    
    // Update grid
    const gridItems = document.querySelectorAll('.grid-item');
    gridItems.forEach((item, index) => {
        item.classList.remove('answered', 'current');
        
        if (state.answers[index] !== undefined) {
            item.classList.add('answered');
        }
        
        if (index === state.currentIndex) {
            item.classList.add('current');
        }
    });
}

function showQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    
    state.currentIndex = index;
    const question = state.questions[index];
    
    // Update question text
    document.getElementById('question-text').textContent = question.soal;
    
    // Update image
    const imgElement = document.getElementById('question-image');
    if (question.img_link && question.img_link.trim() !== '') {
        imgElement.src = question.img_link;
        imgElement.style.display = 'block';
    } else {
        imgElement.style.display = 'none';
    }
    
    // Update options
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    
    // PERBAIKAN 3: Ambil opsi dari object soal
    // Worker mengembalikan opsi_a, opsi_b, opsi_c, opsi_d, opsi_e
    const options = [
        { letter: 'A', text: question.opsi_a || '' },
        { letter: 'B', text: question.opsi_b || '' },
        { letter: 'C', text: question.opsi_c || '' },
        { letter: 'D', text: question.opsi_d || '' }
    ];
    
    if (question.opsi_e && question.opsi_e.trim() !== '') {
        options.push({ letter: 'E', text: question.opsi_e });
    }
    
    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        
        if (state.answers[index] === opt.letter) {
            optionDiv.classList.add('selected');
        }
        
        optionDiv.onclick = () => {
            selectAnswer(opt.letter);
        };
        
        optionDiv.innerHTML = `
            <div class="option-letter">${opt.letter}</div>
            <div class="option-text">${opt.text || '[Tidak ada teks]'}</div>
        `;
        
        container.appendChild(optionDiv);
    });
    
    updateProgress();
}

function selectAnswer(answer) {
    const currentIndex = state.currentIndex;
    state.answers[currentIndex] = answer;
    
    // Update UI
    const options = document.querySelectorAll('.option');
    options.forEach(opt => opt.classList.remove('selected'));
    
    options.forEach(opt => {
        if (opt.querySelector('.option-letter').textContent === answer) {
            opt.classList.add('selected');
        }
    });
    
    updateProgress();
    
    // Auto-next after 500ms
    setTimeout(() => {
        if (currentIndex < state.questions.length - 1) {
            showQuestion(currentIndex + 1);
        }
    }, 500);
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

// ==================== TIMER ====================
function startTimer() {
    clearInterval(state.timerInterval);
    
    state.timerInterval = setInterval(() => {
        state.remainingTime--;
        
        const minutes = Math.floor(state.remainingTime / 60);
        const seconds = state.remainingTime % 60;
        
        document.getElementById('exam-timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when time is running out
        const timerElement = document.getElementById('exam-timer');
        if (state.remainingTime <= 300) { // 5 minutes
            timerElement.style.background = '#e74c3c';
        } else if (state.remainingTime <= 600) { // 10 minutes
            timerElement.style.background = '#ff9800';
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
    // Only track during exam
    state.tabSwitchCount = 0;
    
    document.addEventListener('visibilitychange', () => {
        if (!state.isExamActive || state.examSubmitted) return;
        
        if (document.hidden) {
            state.tabSwitchCount++;
            console.log(`Tab switch detected: ${state.tabSwitchCount}`);
        }
    });
}

// ==================== SUBMIT EXAM ====================
function confirmSubmit() {
    // Langsung submit tanpa konfirmasi
    submitExam();

async function submitExam() {
    if (state.examSubmitted) return;
    state.examSubmitted = true;
    state.isExamActive = false;
    
    clearInterval(state.timerInterval);
    document.removeEventListener('visibilitychange', startTabSwitchTracking);
    
    showScreen('screen-loading');
    document.getElementById('loading-message').textContent = 'Mengirim jawaban...';
    
    try {
        // Prepare answer string
        let jawabanString = '';
        let jawabanDetail = {};
        
        for (let i = 0; i < state.questions.length; i++) {
            const answer = state.answers[i] || '-';
            jawabanString += answer;
            
            // Simpan detail jawaban untuk validasi
            jawabanDetail[i] = {
                question_id: state.questions[i]?.original_id || i,
                answer: answer,
                question_number: i + 1
            };
        }
        
        // PERBAIKAN 4: Submit to server dengan data yang benar
        const submitRes = await fetch(`${API_URL}/api/nilai`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                session_id: state.sessionId,
                jawaban: jawabanString,
                jawaban_detail: jawabanDetail,
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
        showResult(submitData);
        
    } catch (error) {
        console.error('Submit error:', error);
        // Fallback to local result jika server error
        showResult({
            success: true,
            hasil: {
                benar: Object.keys(state.answers).length,
                total_soal: state.questions.length,
                nilai: Math.round((Object.keys(state.answers).length / state.questions.length) * 100)
            }
        });
    }
}

function showResult(resultData) {
    // Update result screen
    document.getElementById('result-nama').textContent = state.student.nama;
    document.getElementById('result-kelas').textContent = state.student.kelas;
    document.getElementById('result-mapel').textContent = state.examData?.mapel || '-';
    document.getElementById('result-total-soal').textContent = state.questions.length;
    document.getElementById('result-dijawab').textContent = `${Object.keys(state.answers).length} soal`;
    
    if (resultData.hasil) {
        document.getElementById('result-nilai').textContent = 
            `${resultData.hasil.nilai || 0} (${resultData.hasil.benar || 0} benar)`;
    } else {
        document.getElementById('result-nilai').textContent = 'Tidak tersedia';
    }
    
    showScreen('screen-result');
}

function showPenutup() {
    const container = document.getElementById('penutup-container');
    const message = document.getElementById('penutup-message');
    const tabInfo = document.getElementById('tab-switch-info');
    
    // Update container class
    container.className = 'penutup-container green';
    
    // Update message dengan format baru
    message.innerHTML = `
        <strong>Selamat ${state.student.nama},</strong><br>
        Anda telah selesai mengerjakan <strong>Mata Pelajaran ${state.examData?.mapel || '-'}</strong><br>
        sebanyak <strong>${state.questions.length} soal</strong> selama <strong>${state.waktuDigunakan || 'tidak tercatat'}</strong>.<br>
        Semoga mendapatkan nilai yang terbaik.<br><br>
        <strong>Tunjukkan halaman ini kepada Guru Pengawas</strong><br>
        sebagai bukti Anda sudah menyelesaikan ujian.
    `;
    
    // Sembunyikan tab switch info
    tabInfo.style.display = 'none';
    
    showScreen('screen-penutup');
}
    
    // Update container classes
    container.className = `penutup-container ${bgColor}`;
    
    // Update message
    message.innerHTML = `
        <strong>Selamat ${state.student.nama} (${state.student.kelas}),</strong><br><br>
        Anda telah selesai mengerjakan <strong>Mata Pelajaran ${state.examData?.mapel || '-'}</strong><br>
        sebanyak <strong>${state.questions.length} soal</strong> dengan durasi <strong>${state.examData?.durasi || 0} menit</strong>.<br><br>
        Semoga mendapat nilai yang terbaik.<br><br>
        <strong>Tunjukkan halaman ini ke pengawas,</strong><br>
        sebagai bukti Anda sudah menyelesaikan ujian.
    `;
    
    // Update tab switch info
    tabInfo.className = `tab-switch-info ${tabColor}`;
    tabInfo.textContent = tabMessage;
    
    showScreen('screen-penutup');
}

function keluarAplikasi() {
    // Clear all data
    clearExamData();
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset form
    document.getElementById('nama').value = '';
    document.getElementById('jenjang').value = '';
    document.getElementById('kelas').innerHTML = '<option value="">Pilih Jenjang terlebih dahulu</option>';
    document.getElementById('kelas').disabled = true;
    document.getElementById('token').value = '';
    
    // Go back to login
    showScreen('screen-login');
}

function clearExamData() {
    state = {
        sessionId: null,
        sessionSeed: null,
        examData: null,
        questions: [],
        currentIndex: 0,
        answers: {},
        startTime: null,
        timerInterval: null,
        remainingTime: 0,
        tabSwitchCount: 0,
        isExamActive: false,
        examSubmitted: false,
        student: {
            nama: '',
            jenjang: '',
            kelas: '',
            token: ''
        }
    };
}

// ==================== BROWSER PROTECTION ====================
// Prevent accidental refresh/close during exam
window.addEventListener('beforeunload', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        e.returnValue = 'Jawaban Anda belum disimpan. Yakin ingin meninggalkan halaman?';
        return e.returnValue;
    }
});

// Prevent context menu selama ujian
document.addEventListener('contextmenu', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        alert('Klik kanan tidak diizinkan selama ujian!');
        return false;
    }
});

// Prevent copy-paste selama ujian
document.addEventListener('copy', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        alert('Copy tidak diizinkan selama ujian!');
        return false;
    }
});

document.addEventListener('paste', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        alert('Paste tidak diizinkan selama ujian!');
        return false;
    }
});

document.addEventListener('cut', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        alert('Cut tidak diizinkan selama ujian!');
        return false;
    }
});

// Prevent keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        // Block F5, Ctrl+R, Ctrl+Shift+R, Ctrl+F5 (refresh)
        if (e.key === 'F5' || 
            e.key === 'F12' ||
            (e.ctrlKey && e.key === 'r') || 
            (e.ctrlKey && e.shiftKey && e.key === 'R') ||
            (e.ctrlKey && e.key === 'F5')) {
            e.preventDefault();
            alert('Refresh tidak diizinkan selama ujian!');
            return false;
        }
        
        // Block print (Ctrl+P, Ctrl+Shift+P)
        if ((e.ctrlKey && e.key === 'p') || (e.ctrlKey && e.shiftKey && e.key === 'P')) {
            e.preventDefault();
            alert('Print tidak diizinkan selama ujian!');
            return false;
        }
        
        // Block save (Ctrl+S)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            alert('Save tidak diizinkan selama ujian!');
            return false;
        }
        
        // Block view source (Ctrl+U)
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            alert('View source tidak diizinkan selama ujian!');
            return false;
        }
        
        // Block inspect element (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
        if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c'))) {
            e.preventDefault();
            alert('Developer tools tidak diizinkan selama ujian!');
            return false;
        }
    }
});

// Prevent drag and drop
document.addEventListener('dragstart', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        return false;
    }
});

document.addEventListener('drop', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        return false;
    }
});

// Prevent selection selama ujian
document.addEventListener('selectstart', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        return false;
    }
});

// Disable right click on images
document.addEventListener('contextmenu', function(e) {
    if (state.isExamActive && !state.examSubmitted && e.target.tagName === 'IMG') {
        e.preventDefault();
        return false;
    }
}, false);

// Blur on tab/window switch
window.addEventListener('blur', function() {
    if (state.isExamActive && !state.examSubmitted) {
        // Bisa tambahkan logika penalti atau warning
        console.log('Window/tab kehilangan fokus');
    }
});

// Fullscreen detection
document.addEventListener('fullscreenchange', function() {
    if (state.isExamActive && !state.examSubmitted && !document.fullscreenElement) {
        alert('Mode fullscreen tidak boleh dinonaktifkan selama ujian!');
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Fullscreen error:', err);
        });
    }
});

// Force fullscreen pada saat mulai ujian
function forceFullScreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('Fullscreen request failed:', err);
        });
    }
}



