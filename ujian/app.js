// ==================== KONFIGURASI ====================
const API_URL = "https://ujian-baru.kurikulum-sman2cikarangbarat.workers.dev";

// ==================== DEBUG CHECK ====================
function checkRequiredElements() {
    console.log('🔍 Checking required elements...');
    
    const requiredIds = [
        // Login screen
        'nama', 'jenjang', 'kelas', 'token', 'login-error',
        'screen-login',
        
        // Loading screen
        'screen-loading', 'loading-message',
        
        // Exam screen
        'screen-exam', 'exam-kelas', 'exam-mapel', 'exam-guru',
        'exam-timer', 'exam-progress-bar', 'exam-progress-text',
        'question-text', 'question-image', 'options-container',
        'question-grid', 'btn-prev', 'btn-next', 'btn-submit',
        
        // Result screen
        'screen-result', 'result-nama', 'result-kelas', 
        'result-mapel', 'result-total-soal', 'result-dijawab',
        'result-waktu', 'result-limit-info',
        
        // Penutup screen
        'screen-penutup', 'penutup-message', 'tab-switch-info'
    ];
    
    const missing = [];
    requiredIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) {
            missing.push(id);
            console.error(`❌ Missing element: ${id}`);
        }
    });
    
    if (missing.length > 0) {
        console.error(`Total ${missing.length} missing elements:`, missing);
    } else {
        console.log('✅ All elements found!');
    }
}

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
    console.log(`🖥️ Switching to screen: ${screenId}`);
    
    const targetScreen = document.getElementById(screenId);
    if (!targetScreen) {
        console.error(`❌ Screen ${screenId} not found in DOM!`);
        return;
    }
    
    const allScreens = document.querySelectorAll('.screen');
    if (allScreens.length === 0) {
        console.error('❌ No elements with class "screen" found!');
        return;
    }
    
    allScreens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    targetScreen.classList.add('active');
    console.log(`✅ Screen ${screenId} is now active`);
}

function showError(message, isLoginError = true) {
    if (isLoginError) {
        const errorBox = document.getElementById('login-error');
        if (errorBox) {
            errorBox.textContent = message;
            errorBox.style.display = 'block';
            errorBox.style.animation = 'none';
            setTimeout(() => {
                errorBox.style.animation = '';
            }, 10);
            
            const existingBtn = errorBox.querySelector('button');
            if (existingBtn) existingBtn.remove();
        } else {
            console.warn('login-error element not found');
        }
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
    
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        };
    }
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function updateKelasDropdown(jenjang) {
    const kelasSelect = document.getElementById('kelas');
    if (!kelasSelect) {
        console.warn('kelas element not found');
        return;
    }
    
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
    // Hanya exit jika dalam mode fullscreen
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
                console.log('Exit fullscreen error:', err);
            });
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
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
    console.log('📄 DOM Content Loaded');
    
    checkRequiredElements();
    
    const jenjangSelect = document.getElementById('jenjang');
    if (jenjangSelect) {
        jenjangSelect.addEventListener('change', function() {
            updateKelasDropdown(this.value);
        });
        console.log('✅ Jenjang dropdown initialized');
    } else {
        console.error('❌ Jenjang select element not found');
    }
    
    const loginInputs = ['nama', 'jenjang', 'kelas', 'token'];
    loginInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    console.log('Enter pressed on', inputId);
                    handleLogin();
                }
            });
        }
    });
    
    clearExamData();
    console.log('✅ Application initialized');
});

// ==================== LOGIN HANDLER ====================
async function handleLogin() {
    const nama = document.getElementById('nama')?.value.trim() || '';
    const jenjang = document.getElementById('jenjang')?.value || '';
    const kelas = document.getElementById('kelas')?.value || '';
    const token = document.getElementById('token')?.value.trim().toUpperCase() || '';
    
    console.log('Login attempt:', { nama, jenjang, kelas, token });
    
    if (!nama || !jenjang || !kelas || !token) {
        showError('Harap isi semua data dengan lengkap');
        return;
    }
    
    if (token.length < 3) {
        showError('Token minimal 3 karakter');
        return;
    }
    
    state.student = { 
        nama: nama, 
        jenjang: jenjang,
        kelas: kelas,
        token: token 
    };
    
    showScreen('screen-loading');
    
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = 'Memeriksa token...';
    }
    
    try {
        console.log('Checking token...');
        const checkRes = await fetch(`${API_URL}/api/check-token?token=${encodeURIComponent(token)}`);
        
        if (!checkRes.ok) {
            throw new Error(`HTTP ${checkRes.status}: Gagal memeriksa token`);
        }
        
        const checkData = await checkRes.json();
        
        if (!checkData.success) {
            throw new Error(checkData.message || 'Gagal memeriksa token');
        }
        
        if (!checkData.exists) {
            throw new Error('Token tidak ditemukan');
        }
        
        if (checkData.exists && !checkData.active) {
            throw new Error('Ujian tidak aktif');
        }
        
        if (loadingMessage) {
            loadingMessage.textContent = 'Login ke sistem...';
        }
        
        console.log('Logging in...');
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
            let errorDetail;
            
            try {
                errorDetail = JSON.parse(errorText);
            } catch (e) {
                errorDetail = { error: errorText };
            }
            
            throw new Error(errorDetail.error || `HTTP ${loginRes.status}: Gagal login`);
        }
        
        const loginData = await loginRes.json();
        
        if (!loginData.success) {
            throw new Error(loginData.error || 'Gagal login ke sistem');
        }
        
        console.log('Login successful:', loginData);
        
        state.sessionId = loginData.session_id;
        state.sessionSeed = loginData.session_seed;
        state.examData = loginData.ujian;
        state.waktuMulai = new Date();
        
        if (loadingMessage) {
            loadingMessage.textContent = 'Mengambil soal ujian...';
        }
        
        console.log('Getting questions...');
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
        
        console.log(`Got ${soalData.soal.length} questions`);
        
        state.questions = soalData.soal;
        state.limitSoal = soalData.limit_soal || soalData.soal.length;
        state.totalSoalDiBank = soalData.jumlah_soal_total || soalData.soal.length;
        state.startTime = new Date();
        state.remainingTime = (state.examData?.durasi || 90) * 60;
        state.isExamActive = true;
        
        setupExamScreen();
        showScreen('screen-exam');
        startTimer();
        showQuestion(0);
        
        setTimeout(() => {
            enterFullscreen();
        }, 500);
        
        startTabSwitchTracking();
        
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
        
        if (errorMessage.includes('Token tidak ditemukan')) {
            errorMessage = 'Token ujian tidak ditemukan. Pastikan token yang dimasukkan benar.';
        } else if (errorMessage.includes('Ujian tidak aktif')) {
            errorMessage = 'Ujian ini tidak aktif. Silakan hubungi guru.';
        } else if (errorMessage.includes('sudah mengikuti ujian')) {
            errorMessage = 'Anda sudah mengikuti ujian ini dalam 24 jam terakhir.';
        } else if (errorMessage.includes('Failed to fetch')) {
            errorMessage = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
        } else if (errorMessage.includes('Tidak ada soal')) {
            errorMessage = 'Belum ada soal untuk ujian ini.';
        }
        
        showScreen('screen-login');
        showError(errorMessage);
    }
}

// ==================== EXAM SETUP ====================
function setupExamScreen() {
    console.log('🔄 Setting up exam screen...');
    console.log('State:', {
        student: state.student,
        examData: state.examData,
        questions: state.questions?.length
    });
    
    const setTextSafe = (id, text) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text || '-';
            console.log(`Set ${id}: ${text}`);
        } else {
            console.warn(`Element ${id} not found`);
        }
    };
    
    // Update exam info
    setTextSafe('exam-kelas', state.student?.kelas);
    setTextSafe('exam-mapel', state.examData?.mapel);
    setTextSafe('exam-guru', state.examData?.nama_guru);
    
    // HAPUS bagian limit-info karena tidak ada di HTML
    // limit-info element tidak ada, jadi hapus kode yang mencoba mengaksesnya
    
    // Setup question grid
    const grid = document.getElementById('question-grid');
    if (grid) {
        grid.innerHTML = '';
        
        for (let i = 0; i < state.questions.length; i++) {
            const item = document.createElement('div');
            item.className = 'grid-item';
            item.textContent = i + 1;
            item.onclick = () => showQuestion(i);
            grid.appendChild(item);
        }
        console.log(`Created ${state.questions.length} grid items`);
    } else {
        console.error('question-grid element not found!');
    }
    
    updateProgress();
}

// ==================== PROGRESS BAR FUNCTION ====================
function updateProgress() {
    const total = state.questions.length;
    const current = state.currentIndex + 1;
    const answered = Object.keys(state.answers).length;
    
    // Update progress text di progress bar
    const progressText = document.getElementById('exam-progress-text');
    if (progressText) {
        progressText.textContent = `${answered}/${total}`;
    }
    
    // Update progress bar visual
    const progressBar = document.getElementById('exam-progress-bar');
    if (progressBar) {
        const progressPercent = total > 0 ? (answered / total) * 100 : 0;
        progressBar.style.width = `${progressPercent}%`;
        
        // Ubah warna berdasarkan progress
        if (progressPercent === 100) {
            progressBar.style.background = 'linear-gradient(90deg, #27ae60 0%, #219653 100%)';
        } else if (progressPercent >= 75) {
            progressBar.style.background = 'linear-gradient(90deg, #3498db 0%, #2980b9 100%)';
        } else if (progressPercent >= 50) {
            progressBar.style.background = 'linear-gradient(90deg, #1a73e8 0%, #0d47a1 100%)';
        } else if (progressPercent >= 25) {
            progressBar.style.background = 'linear-gradient(90deg, #2196f3 0%, #1976d2 100%)';
        } else {
            progressBar.style.background = 'linear-gradient(90deg, #64b5f6 0%, #42a5f5 100%)';
        }
    }
    
    // Update buttons
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnSubmit = document.getElementById('btn-submit');
    
    if (btnPrev) btnPrev.classList.toggle('hidden', state.currentIndex === 0);
    if (btnNext) btnNext.classList.toggle('hidden', state.currentIndex === total - 1);
    if (btnSubmit) btnSubmit.classList.toggle('hidden', answered !== total);
    
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
}

function showQuestion(index) {
    if (index < 0 || index >= state.questions.length) {
        console.error(`Invalid index: ${index}, questions length: ${state.questions.length}`);
        return;
    }
    
    state.currentIndex = index;
    const question = state.questions[index];
    console.log(`Showing question ${index + 1}`);
    
    const questionTextEl = document.getElementById('question-text');
    if (questionTextEl) {
        questionTextEl.textContent = question?.soal || '[Tidak ada teks soal]';
    } else {
        console.error('question-text element not found!');
    }
    
    const imgElement = document.getElementById('question-image');
    if (imgElement) {
        if (question?.img_link && question.img_link.trim() !== '') {
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
    } else {
        console.warn('question-image element not found');
    }
    
    const container = document.getElementById('options-container');
    if (container) {
        container.innerHTML = '';
        
        const options = [
            { letter: 'A', text: question?.opsi_a || '' },
            { letter: 'B', text: question?.opsi_b || '' },
            { letter: 'C', text: question?.opsi_c || '' },
            { letter: 'D', text: question?.opsi_d || '' }
        ];
        
        if (question?.opsi_e && question.opsi_e.trim() !== '') {
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
        
        console.log(`Created ${options.length} options`);
    } else {
        console.error('options-container element not found!');
    }
    
    updateProgress();
}

function selectAnswer(answer) {
    const currentIndex = state.currentIndex;
    state.answers[currentIndex] = answer;
    
    const options = document.querySelectorAll('.option');
    options.forEach(opt => opt.classList.remove('selected'));
    
    options.forEach(opt => {
        if (opt.querySelector('.option-letter').textContent === answer) {
            opt.classList.add('selected');
        }
    });
    
    updateProgress();
    
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
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
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
            
            if (state.remainingTime <= 0) {
                clearInterval(state.timerInterval);
                timerElement.textContent = '00:00';
                timerElement.style.background = '#e74c3c';
                submitExam();
            }
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
            
            // Catat di console saja, tidak perlu API call
            console.log(`Tab switched ${state.tabSwitchCount} times`);
        }
    });
}

// ==================== SUBMIT EXAM ====================
async function submitExam() {
    if (state.examSubmitted) return;
    
    if (!confirm('Apakah Anda yakin ingin mengirim jawaban? Pastikan semua soal sudah dijawab.')) {
        return;
    }
    
    state.examSubmitted = true;
    state.isExamActive = false;
    state.waktuSelesai = new Date();
    
    clearInterval(state.timerInterval);
    
    // Keluar dari fullscreen hanya jika masih dalam fullscreen
    exitFullscreen();
    
    showScreen('screen-loading');
    
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = 'Mengirim jawaban...';
    }
    
    try {
        let jawabanArray = [];
        
        for (let i = 0; i < state.questions.length; i++) {
            const answer = state.answers[i] || '-';
            jawabanArray.push(answer);
        }
        
        console.log('Submitting answers:', jawabanArray);
        
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
            let errorDetail = `HTTP ${submitRes.status}: Gagal mengirim jawaban`;
            try {
                const errorData = await submitRes.json();
                errorDetail = errorData.error || errorData.message || errorDetail;
            } catch (e) {
                // Tetap gunakan error default
            }
            throw new Error(errorDetail);
        }
        
        const submitData = await submitRes.json();
        
        if (!submitData.success) {
            throw new Error(submitData.error || 'Gagal mengirim jawaban');
        }
        
        console.log('Submit successful:', submitData);
        
        showResult(submitData);
        
    } catch (error) {
        console.error('Submit error:', error);
        
        // Jika error 500, tampilkan hasil lokal saja tanpa konfirmasi
        if (error.message.includes('500') || error.message.includes('404')) {
            console.log('Server error, showing local result...');
            showResult({ success: false, serverError: true, message: 'Tampilan hasil lokal (server error)' });
        } else {
            if (confirm(`Gagal mengirim jawaban ke server: ${error.message}\n\nCoba lagi?`)) {
                state.examSubmitted = false;
                state.isExamActive = true;
                submitExam();
            } else {
                showResult({ success: false, error: error.message });
            }
        }
    }
}

function showResult(resultData) {
    console.log('Showing result:', resultData);
    
    let waktuPengerjaan = 0;
    if (state.waktuMulai && state.waktuSelesai) {
        const diffMs = state.waktuSelesai - state.waktuMulai;
        waktuPengerjaan = Math.floor(diffMs / 1000 / 60);
    } else {
        waktuPengerjaan = Math.max(0, (state.examData?.durasi || 0) - Math.floor(state.remainingTime / 60));
    }
    
    const setTextSafe = (id, text) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text || '-';
        }
    };
    
    setTextSafe('result-nama', state.student.nama);
    setTextSafe('result-kelas', state.student.kelas);
    setTextSafe('result-mapel', state.examData?.mapel || '-');
    setTextSafe('result-total-soal', `${state.questions.length} soal`);
    setTextSafe('result-dijawab', `${Object.keys(state.answers).length} soal`);
    setTextSafe('result-waktu', `${waktuPengerjaan} menit`);
    
    // Update result-limit-info jika ada
    const limitInfoElement = document.getElementById('result-limit-info');
    if (limitInfoElement && state.limitSoal < state.totalSoalDiBank) {
        limitInfoElement.innerHTML = `
            <div style="background: #e3f2fd; padding: 10px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196f3;">
                <i class="fas fa-info-circle"></i> 
                Anda mengerjakan ${state.limitSoal} soal acak dari total ${state.totalSoalDiBank} soal di bank.
            </div>
        `;
        limitInfoElement.style.display = 'block';
    } else if (limitInfoElement) {
        limitInfoElement.style.display = 'none';
    }
    
    // Tambahkan status server ke tampilan
    const serverStatusDiv = document.createElement('div');
    serverStatusDiv.className = 'result-row';
    serverStatusDiv.style.marginTop = '10px';
    serverStatusDiv.style.paddingTop = '10px';
    serverStatusDiv.style.borderTop = '1px dashed #ccc';
    
    if (resultData.serverError) {
        serverStatusDiv.innerHTML = `
            <span class="result-label">Status Server:</span>
            <span class="result-value" style="color: #ff9800;">
                <i class="fas fa-exclamation-triangle"></i> Tampilan Hasil Lokal
            </span>
        `;
    } else if (resultData.success) {
        serverStatusDiv.innerHTML = `
            <span class="result-label">Status Server:</span>
            <span class="result-value" style="color: #27ae60;">
                <i class="fas fa-check-circle"></i> Terhubung ke Server
            </span>
        `;
    } else {
        serverStatusDiv.innerHTML = `
            <span class="result-label">Status Server:</span>
            <span class="result-value" style="color: #e74c3c;">
                <i class="fas fa-times-circle"></i> Gagal Terhubung
            </span>
        `;
    }
    
    const resultDetails = document.querySelector('.result-details');
    if (resultDetails) {
        // Cek apakah sudah ada status server
        const existingStatus = resultDetails.querySelector('.result-row:last-child');
        if (existingStatus && existingStatus.textContent.includes('Status Server')) {
            existingStatus.remove();
        }
        resultDetails.appendChild(serverStatusDiv);
    }
    
    showScreen('screen-result');
    showNotification('Ujian berhasil diselesaikan!', 'success');
}

function showPenutup() {
    let waktuPengerjaan = 0;
    if (state.waktuMulai && state.waktuSelesai) {
        const diffMs = state.waktuSelesai - state.waktuMulai;
        waktuPengerjaan = Math.floor(diffMs / 1000 / 60);
    }
    
    const message = document.getElementById('penutup-message');
    const tabInfo = document.getElementById('tab-switch-info');
    
    if (message) {
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
                            ${state.questions.length} soal
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
    }
    
    if (tabInfo && state.tabSwitchCount > 0) {
        tabInfo.innerHTML = `
            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #ff9800;">
                <i class="fas fa-exclamation-triangle" style="color: #ff9800;"></i> 
                <strong style="color: #e65100;">Catatan:</strong> 
                Terdapat <strong>${state.tabSwitchCount} kali</strong> aktivitas berpindah tab/window selama ujian.
            </div>
        `;
        tabInfo.style.display = 'block';
    } else if (tabInfo) {
        tabInfo.style.display = 'none';
    }
    
    showScreen('screen-penutup');
}

function keluarAplikasi() {
    if (state.isExamActive && !state.examSubmitted) {
        if (!confirm('Ujian belum selesai. Yakin ingin keluar?')) {
            return;
        }
    }
    
    clearExamData();
    
    const namaInput = document.getElementById('nama');
    const jenjangSelect = document.getElementById('jenjang');
    const kelasSelect = document.getElementById('kelas');
    const tokenInput = document.getElementById('token');
    
    if (namaInput) namaInput.value = '';
    if (jenjangSelect) jenjangSelect.value = '';
    if (kelasSelect) {
        kelasSelect.innerHTML = '<option value="">Pilih Jenjang terlebih dahulu</option>';
        kelasSelect.disabled = true;
    }
    if (tokenInput) tokenInput.value = '';
    
    const errorBox = document.getElementById('login-error');
    if (errorBox) errorBox.style.display = 'none';
    
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

document.addEventListener('fullscreenchange', function() {
    if (state.isExamActive && !state.examSubmitted && !document.fullscreenElement) {
        setTimeout(() => {
            if (state.isExamActive && !state.examSubmitted && !document.fullscreenElement) {
                enterFullscreen();
                showNotification('Harap tetap dalam mode fullscreen selama ujian', 'error');
            }
        }, 100);
    }
});

document.addEventListener('contextmenu', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        showNotification('Klik kanan tidak diizinkan selama ujian!', 'error');
        return false;
    }
});

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

document.addEventListener('keydown', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        if (e.key === 'F5' || 
            e.key === 'F12' ||
            (e.ctrlKey && e.key === 'r') || 
            (e.ctrlKey && e.shiftKey && e.key === 'R') ||
            (e.ctrlKey && e.key === 'F5')) {
            e.preventDefault();
            showNotification('Refresh tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        if ((e.ctrlKey && e.key === 'p') || (e.ctrlKey && e.shiftKey && e.key === 'P')) {
            e.preventDefault();
            showNotification('Print tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            showNotification('Save tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            showNotification('View source tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c'))) {
            e.preventDefault();
            showNotification('Developer tools tidak diizinkan selama ujian!', 'error');
            return false;
        }
        
        if (e.key === 'Escape' && document.fullscreenElement) {
            e.preventDefault();
            showNotification('Tidak dapat keluar dari fullscreen selama ujian!', 'error');
            return false;
        }
    }
});

document.addEventListener('selectstart', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        return false;
    }
});

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

// Debug fungsi
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
