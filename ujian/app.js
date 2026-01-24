// ==================== KONFIGURASI ====================
// PERBAIKAN: Hapus slash di akhir URL
const API_URL = "https://ujian-baru.kurikulum-sman2cikarangbarat.workers.dev";

// ==================== STATE MANAGEMENT ====================
let state = {
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
    },
    waktuMulai: null,
    waktuSelesai: null,
    limitSoal: 0,
    totalSoalDiBank: 0
};

// ==================== KELAS DATA ====================
const kelasData = {
    'X': ['X-A', 'X-B', 'X-C', 'X-D', 'X-E', 'X-F'],
    'XI': ['XI-A', 'XI-B', 'XI-C', 'XI-D', 'XI-E', 'XI-F', 'XI-G'],
    'XII': ['XII-A', 'XII-B', 'XII-C', 'XII-D', 'XII-E', 'XII-F', 'XII-G']
};

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
        errorBox.style.animation = 'none';
        setTimeout(() => {
            errorBox.style.animation = '';
        }, 10);
        
        // Hapus tombol test sebelumnya jika ada
        const existingBtn = errorBox.querySelector('button');
        if (existingBtn) existingBtn.remove();
    } else {
        showNotification(message, 'error');
    }
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    notification.querySelector('.notification-close').onclick = () => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    };
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
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

// ==================== FULLSCREEN HANDLER ====================
function enterFullscreen() {
    const elem = document.documentElement;
    
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
            console.log('Fullscreen error:', err);
            showNotification('Mode fullscreen tidak didukung di browser ini', 'warning');
        });
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
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

// ==================== IMAGE HELPER ====================
function getViewableImageUrl(imageId) {
    if (!imageId) return '';
    
    imageId = imageId.trim();
    
    if (imageId.match(/^[a-zA-Z0-9_-]+$/)) {
        return `https://lh3.googleusercontent.com/d/${imageId}`;
    }
    
    let idMatch = imageId.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                  imageId.match(/id=([a-zA-Z0-9_-]+)/) ||
                  imageId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    
    if (idMatch && idMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
    
    return imageId;
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    const jenjangSelect = document.getElementById('jenjang');
    if (jenjangSelect) {
        jenjangSelect.addEventListener('change', function() {
            updateKelasDropdown(this.value);
        });
    }
    
    // PERBAIKAN: Tambah enter key untuk semua input
    const loginInputs = ['nama', 'jenjang', 'kelas', 'token'];
    loginInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handleLogin();
                }
            });
        }
    });
    
    clearExamData();
});

// ==================== LOGIN HANDLER ====================
async function handleLogin() {
    const nama = document.getElementById('nama').value.trim();
    const jenjang = document.getElementById('jenjang').value;
    const kelas = document.getElementById('kelas').value;
    const token = document.getElementById('token').value.trim().toUpperCase();
    
    if (!nama || !jenjang || !kelas || !token) {
        showError('Harap isi semua data dengan lengkap');
        return;
    }
    
    if (nama.length < 3) {
        showError('Nama minimal 3 karakter');
        return;
    }
    
    state.student = { 
        nama: nama, 
        jenjang: jenjang,
        kelas: kelas,
        token: token 
    };
    
    showScreen('screen-loading');
    
    try {
        // Check token
        document.getElementById('loading-message').textContent = 'Memeriksa token ujian...';
        
        const checkRes = await fetch(`${API_URL}/api/check-token?token=${encodeURIComponent(token)}`);
        
        if (!checkRes.ok) {
            throw new Error(`HTTP ${checkRes.status}: Gagal memeriksa token`);
        }
        
        const checkData = await checkRes.json();
        
        if (!checkData.success || !checkData.exists) {
            throw new Error('Token ujian tidak ditemukan atau sudah kadaluarsa');
        }
        
        // Login - PERBAIKAN: Sesuai dengan struktur di worker
        document.getElementById('loading-message').textContent = 'Login ke sistem...';
        
        // PERHATIAN: Sesuaikan dengan struktur yang diharapkan oleh worker
        // Worker mengharapkan: { nama, kelas, rombel, token }
        // Dimana: 'kelas' = jenjang (X/XI/XII), 'rombel' = kelas (X-A/XI-B/XI-C)
        
        const loginRes = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                nama: nama,
                kelas: jenjang,     // PERBAIKAN: Field 'kelas' diisi dengan jenjang
                rombel: kelas,      // PERBAIKAN: Field 'rombel' diisi dengan kelas
                token: token
            })
        });
        
        if (!loginRes.ok) {
            // Coba dapatkan detail error
            let errorText = '';
            try {
                const errorData = await loginRes.json();
                errorText = JSON.stringify(errorData, null, 2);
                
                // Jika error spesifik tentang field yang dibutuhkan
                if (errorData.error === "Data tidak lengkap" && errorData.required) {
                    errorText = `Field yang diperlukan: ${errorData.required.join(', ')}`;
                }
            } catch (e) {
                errorText = await loginRes.text();
            }
            
            throw new Error(`HTTP ${loginRes.status}: Gagal login ke sistem\n${errorText}`);
        }
        
        const loginData = await loginRes.json();
        
        if (!loginData.success) {
            throw new Error(loginData.error || 'Gagal login ke sistem');
        }
        
        state.sessionId = loginData.session_id;
        state.sessionSeed = loginData.session_seed;
        state.examData = loginData.ujian;
        state.waktuMulai = new Date();
        
        // Get questions WITH LIMIT
        document.getElementById('loading-message').textContent = 'Mengambil soal ujian...';
        
        const soalRes = await fetch(
            `${API_URL}/api/soal?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(state.sessionId)}`
        );
        
        if (!soalRes.ok) {
            throw new Error(`HTTP ${soalRes.status}: Gagal mengambil soal`);
        }
        
        const soalData = await soalRes.json();
        
        if (!soalData.success || !soalData.soal || soalData.soal.length === 0) {
            throw new Error('Tidak ada soal yang tersedia untuk ujian ini');
        }
        
        state.questions = soalData.soal;
        state.limitSoal = soalData.limit_soal || soalData.soal.length;
        state.totalSoalDiBank = soalData.jumlah_soal_total || soalData.soal.length;
        state.startTime = new Date();
        state.remainingTime = state.examData.durasi * 60;
        state.isExamActive = true;
        
        // Setup exam screen
        setupExamScreen();
        showScreen('screen-exam');
        startTimer();
        showQuestion(0);
        
        // Enter fullscreen
        setTimeout(() => {
            enterFullscreen();
        }, 500);
        
        // Start tab switch tracking
        startTabSwitchTracking();
        
        // Show limit information
        if (state.limitSoal < state.totalSoalDiBank) {
            showNotification(
                `Ujian ini menampilkan ${state.limitSoal} soal acak dari total ${state.totalSoalDiBank} soal di bank.`,
                'info'
            );
        }
        
        showNotification('Ujian dimulai. Selamat mengerjakan!', 'success');
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = error.message;
        
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            errorMessage = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
        }
        
        if (errorMessage.includes('Token') || errorMessage.includes('token')) {
            errorMessage = 'Token ujian tidak valid. Pastikan token yang dimasukkan benar.';
        }
        
        showScreen('screen-login');
        showError(errorMessage);
    }
}
// ==================== FUNCTION UNTUK TEST LOGIN REQUEST ====================
async function testLoginRequest() {
    const nama = document.getElementById('nama').value.trim() || 'Nama Siswa Test';
    const jenjang = document.getElementById('jenjang').value || 'X';
    const kelas = document.getElementById('kelas').value || 'X-A';
    const token = document.getElementById('token').value.trim().toUpperCase() || 'TEST123';
    
    showNotification('Menguji request login...', 'info');
    
    const requestData = {
        nama: nama,
        kelas: jenjang,    // PERBAIKAN: 'kelas' = jenjang
        rombel: kelas,     // PERBAIKAN: 'rombel' = kelas
        token: token
    };
    
    console.log('Request Data untuk test:', requestData);
    
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        let result = `Status: ${response.status}\n`;
        result += `Status Text: ${response.statusText}\n`;
        result += `URL: ${API_URL}/api/login\n`;
        result += `Request Body:\n${JSON.stringify(requestData, null, 2)}\n\n`;
        
        if (response.ok) {
            try {
                const data = await response.json();
                result += `Response Success: ${JSON.stringify(data, null, 2)}`;
                showNotification('Login request berhasil!', 'success');
            } catch (jsonError) {
                result += `Error parsing JSON: ${jsonError.message}`;
                showNotification('Response bukan JSON valid', 'warning');
            }
        } else {
            try {
                const errorData = await response.json();
                result += `Error Response:\n${JSON.stringify(errorData, null, 2)}`;
            } catch (e) {
                const textResponse = await response.text();
                result += `Error Response (text):\n${textResponse}`;
            }
            showNotification(`Login failed: ${response.status}`, 'error');
        }
        
        console.log('Login Test Result:', result);
        alert('Hasil test login:\n\n' + result);
        
    } catch (error) {
        console.error('Test Login Error:', error);
        alert('Error testing login:\n\n' + error.message);
    }
}
// ==================== EXAM SETUP ====================
function setupExamScreen() {
    // Update exam info with limit data
    document.getElementById('exam-kelas').textContent = state.student.kelas;
    document.getElementById('exam-mapel').textContent = state.examData?.mapel || '-';
    document.getElementById('exam-guru').textContent = state.examData?.nama_guru || '-';
    
    // Show limit info if applicable
    const limitInfo = document.getElementById('limit-info');
    if (state.limitSoal < state.totalSoalDiBank) {
        limitInfo.innerHTML = `
            <span style="background: #e3f2fd; padding: 3px 8px; border-radius: 4px; font-size: 0.8em;">
                <i class="fas fa-info-circle"></i> 
                ${state.limitSoal} soal dari ${state.totalSoalDiBank} soal di bank
            </span>
        `;
        limitInfo.style.display = 'inline';
    } else {
        limitInfo.style.display = 'none';
    }
    
    // Setup question grid - only for displayed questions
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
    
    document.getElementById('exam-progress').textContent = `${current}/${total}`;
    
    // Update button visibility
    document.getElementById('btn-prev').classList.toggle('hidden', state.currentIndex === 0);
    document.getElementById('btn-next').classList.toggle('hidden', state.currentIndex === total - 1);
    document.getElementById('btn-submit').classList.toggle('hidden', answered !== total);
    
    // Update grid items
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
    
    // Update progress bar
    const progressPercent = total > 0 ? (answered / total) * 100 : 0;
    document.getElementById('exam-progress-bar').style.width = `${progressPercent}%`;
}

function showQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    
    state.currentIndex = index;
    const question = state.questions[index];
    
    // Update question text
    document.getElementById('question-text').textContent = question.soal || '[Tidak ada teks soal]';
    
    // Update image
    const imgElement = document.getElementById('question-image');
    if (question.img_link && question.img_link.trim() !== '') {
        const imageId = question.img_link.trim();
        const viewableUrl = getViewableImageUrl(imageId);
        
        imgElement.src = viewableUrl;
        imgElement.style.display = 'block';
        imgElement.alt = "Gambar Soal " + (index + 1);
        
        imgElement.onerror = function() {
            const alternativeUrl = `https://drive.google.com/thumbnail?id=${imageId}&sz=w1000`;
            imgElement.src = alternativeUrl;
            
            imgElement.onerror = function() {
                imgElement.style.display = 'none';
                showNotification('Gambar soal tidak dapat dimuat', 'info');
            };
        };
    } else {
        imgElement.style.display = 'none';
    }
    
    // Update options
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    
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
    
    // Auto-next setelah 500ms
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
        
        const timerElement = document.getElementById('exam-timer');
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when time is running out
        if (state.remainingTime <= 300) {
            timerElement.style.background = '#e74c3c';
            if (state.remainingTime === 300) {
                showNotification('Waktu tersisa 5 menit!', 'error');
            }
        } else if (state.remainingTime <= 600) {
            timerElement.style.background = '#ff9800';
        } else {
            timerElement.style.background = '#4caf50';
        }
        
        // Time's up
        if (state.remainingTime <= 0) {
            clearInterval(state.timerInterval);
            timerElement.textContent = '00:00';
            timerElement.style.background = '#e74c3c';
            submitExam();
        }
    }, 1000);
}

// ==================== TAB SWITCH TRACKING ====================
function startTabSwitchTracking() {
    state.tabSwitchCount = 0;
    
    document.addEventListener('visibilitychange', () => {
        if (!state.isExamActive || state.examSubmitted) return;
        
        if (document.hidden) {
            state.tabSwitchCount++;
            showNotification(`Anda meninggalkan halaman ujian! (${state.tabSwitchCount}x). Aktivitas telah dicatat.`, 'error');
            
            // Log tab switch to server
            logTabSwitch();
        }
    });
}

async function logTabSwitch() {
    try {
        await fetch(`${API_URL}/api/log-tab-switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: state.sessionId,
                tab_switch_count: state.tabSwitchCount
            })
        });
    } catch (error) {
        console.error('Log tab switch error:', error);
    }
}

// ==================== SUBMIT EXAM ====================
async function submitExam() {
    if (state.examSubmitted) return;
    
    // Tambah konfirmasi sebelum submit
    if (!confirm('Apakah Anda yakin ingin mengirim jawaban? Pastikan semua soal sudah dijawab.')) {
        return;
    }
    
    state.examSubmitted = true;
    state.isExamActive = false;
    state.waktuSelesai = new Date();
    
    clearInterval(state.timerInterval);
    
    // Keluar dari fullscreen
    exitFullscreen();
    
    showScreen('screen-loading');
    document.getElementById('loading-message').textContent = 'Mengirim jawaban...';
    
    try {
        // Siapkan jawaban
        let jawabanArray = [];
        
        for (let i = 0; i < state.questions.length; i++) {
            const answer = state.answers[i] || '-';
            jawabanArray.push(answer);
        }
        
        // Submit jawaban
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
        showResult(submitData);
        
    } catch (error) {
        console.error('Submit error:', error);
        // Beri opsi retry jika gagal
        if (confirm('Gagal mengirim jawaban ke server. Coba lagi?')) {
            state.examSubmitted = false;
            state.isExamActive = true;
            submitExam();
        } else {
            showResult({ success: false, error: error.message });
        }
    }
}

function showResult(resultData) {
    // Hitung waktu pengerjaan
    let waktuPengerjaan = 0;
    if (state.waktuMulai && state.waktuSelesai) {
        const diffMs = state.waktuSelesai - state.waktuMulai;
        waktuPengerjaan = Math.floor(diffMs / 1000 / 60);
    } else {
        waktuPengerjaan = Math.max(0, (state.examData?.durasi || 0) - Math.floor(state.remainingTime / 60));
    }
    
    // PERBAIKAN: Perbaiki ID elemen untuk waktu pengerjaan
    document.getElementById('result-nama').textContent = state.student.nama;
    document.getElementById('result-kelas').textContent = state.student.kelas;
    document.getElementById('result-mapel').textContent = state.examData?.mapel || '-';
    document.getElementById('result-total-soal').textContent = `${state.questions.length} soal (dari ${state.totalSoalDiBank} soal di bank)`;
    document.getElementById('result-dijawab').textContent = `${Object.keys(state.answers).length} soal`;
    // PERBAIKAN: Ganti result-nilai menjadi result-waktu
    const waktuElement = document.getElementById('result-waktu') || document.getElementById('result-nilai');
    if (waktuElement) {
        waktuElement.textContent = `${waktuPengerjaan} menit`;
    }
    
    // Add limit info if applicable
    const limitInfoElement = document.getElementById('result-limit-info');
    if (state.limitSoal < state.totalSoalDiBank) {
        limitInfoElement.innerHTML = `
            <div style="background: #e3f2fd; padding: 10px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #2196f3;">
                <i class="fas fa-info-circle"></i> 
                Anda mengerjakan ${state.limitSoal} soal acak dari total ${state.totalSoalDiBank} soal di bank.
            </div>
        `;
        limitInfoElement.style.display = 'block';
    } else {
        limitInfoElement.style.display = 'none';
    }
    
    showScreen('screen-result');
    showNotification('Ujian berhasil diselesaikan!', 'success');
}

function showPenutup() {
    // Hitung waktu pengerjaan
    let waktuPengerjaan = 0;
    if (state.waktuMulai && state.waktuSelesai) {
        const diffMs = state.waktuSelesai - state.waktuMulai;
        waktuPengerjaan = Math.floor(diffMs / 1000 / 60);
    }
    
    const message = document.getElementById('penutup-message');
    const tabInfo = document.getElementById('tab-switch-info');
    
    // Update message dengan info limit
    message.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h3 style="color: #1a73e8; margin-bottom: 20px;">
                <i class="fas fa-certificate"></i> Bukti Penyelesaian Ujian
            </h3>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
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
                        ${state.questions.length} soal (dari ${state.totalSoalDiBank} soal di bank)
                    </p>
                    
                    <p style="margin-bottom: 10px;">
                        <strong>Waktu Pengerjaan:</strong><br>
                        ${waktuPengerjaan} menit
                    </p>
                    
                    <p style="color: #666; font-size: 0.95rem; margin-top: 15px;">
                        <i class="fas fa-clock"></i> Selesai: ${state.waktuSelesai ? state.waktuSelesai.toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}
                    </p>
                </div>
            </div>
            
            ${state.limitSoal < state.totalSoalDiBank ? `
            <div style="background: #e8f5e9; padding: 10px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4caf50;">
                <i class="fas fa-random"></i> 
                <strong>Catatan:</strong> Soal diacak dari bank ${state.totalSoalDiBank} soal
            </div>
            ` : ''}
            
            <p style="color: #2e7d32; font-weight: 600; padding: 15px; background: #e8f5e9; border-radius: 8px;">
                <i class="fas fa-check-circle"></i> Tunjukkan bukti ini kepada pengawas ujian
            </p>
        </div>
    `;
    
    // Update tab switch info
    if (state.tabSwitchCount > 0) {
        tabInfo.innerHTML = `
            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #ff9800;">
                <i class="fas fa-exclamation-triangle" style="color: #ff9800;"></i> 
                <strong style="color: #e65100;">Catatan:</strong> 
                Terdapat <strong>${state.tabSwitchCount} kali</strong> aktivitas berpindah tab/window selama ujian.
            </div>
        `;
        tabInfo.style.display = 'block';
    } else {
        tabInfo.style.display = 'none';
    }
    
    showScreen('screen-penutup');
}

function keluarAplikasi() {
    // Tambah konfirmasi sebelum keluar
    if (state.isExamActive && !state.examSubmitted) {
        if (!confirm('Ujian belum selesai. Yakin ingin keluar?')) {
            return;
        }
    }
    
    clearExamData();
    
    // Reset form
    document.getElementById('nama').value = '';
    document.getElementById('jenjang').value = '';
    document.getElementById('kelas').innerHTML = '<option value="">Pilih Jenjang terlebih dahulu</option>';
    document.getElementById('kelas').disabled = true;
    document.getElementById('token').value = '';
    
    // Reset error message
    document.getElementById('login-error').style.display = 'none';
    
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
        },
        waktuMulai: null,
        waktuSelesai: null,
        limitSoal: 0,
        totalSoalDiBank: 0
    };
}

// ==================== BROWSER PROTECTION ====================
window.addEventListener('beforeunload', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        e.returnValue = 'Jawaban Anda belum disimpan. Yakin ingin meninggalkan halaman?';
        return e.returnValue;
    }
});

// Handler untuk fullscreen
document.addEventListener('fullscreenchange', function() {
    if (state.isExamActive && !state.examSubmitted && !document.fullscreenElement) {
        // Delay sedikit sebelum kembali ke fullscreen
        setTimeout(() => {
            if (state.isExamActive && !state.examSubmitted && !document.fullscreenElement) {
                enterFullscreen();
                showNotification('Harap tetap dalam mode fullscreen selama ujian', 'error');
            }
        }, 100);
    }
});

// Prevent context menu selama ujian
document.addEventListener('contextmenu', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        showNotification('Klik kanan tidak diizinkan selama ujian!', 'error');
        return false;
    }
});

// Prevent copy-paste selama ujian
document.addEventListener('copy', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        showNotification('Copy tidak diizinkan selama ujian!', 'error');
        return false;
    }
});

document.addEventListener('paste', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        showNotification('Paste tidak diizinkan selama ujian!', 'error');
        return false;
    }
});

document.addEventListener('cut', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        showNotification('Cut tidak diizinkan selama ujian!', 'error');
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
            showNotification('Refresh tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        // Block print (Ctrl+P, Ctrl+Shift+P)
        if ((e.ctrlKey && e.key === 'p') || (e.ctrlKey && e.shiftKey && e.key === 'P')) {
            e.preventDefault();
            showNotification('Print tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        // Block save (Ctrl+S)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            showNotification('Save tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        // Block view source (Ctrl+U)
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            showNotification('View source tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        // Block inspect element (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
        if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c'))) {
            e.preventDefault();
            showNotification('Developer tools tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        // Block escape key untuk keluar fullscreen
        if (e.key === 'Escape' && document.fullscreenElement) {
            e.preventDefault();
            showNotification('Tidak dapat keluar dari fullscreen selama ujian!', 'error');
            return false;
        }
    }
});

// Prevent selection selama ujian
document.addEventListener('selectstart', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        return false;
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

// PERBAIKAN TAMBAHAN: Debug fungsi
function debugAPI() {
    console.log('=== DEBUG API ===');
    console.log('API_URL:', API_URL);
    console.log('Full URLs:');
    console.log('- Check Token:', `${API_URL}/api/check-token?token=TEST`);
    console.log('- Login:', `${API_URL}/api/login`);
    console.log('- Soal:', `${API_URL}/api/soal`);
    console.log('- Nilai:', `${API_URL}/api/nilai`);
    console.log('================');
}

// Tambah ke window untuk debugging
if (typeof window !== 'undefined') {
    window.debugAPI = debugAPI;
    window.appState = state;
}


