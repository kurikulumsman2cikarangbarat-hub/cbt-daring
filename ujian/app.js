// ==================== KONFIGURASI ====================
const API_URL = "https://ujian-baru.kurikulum-sman2cikarangbarat.workers.dev";
const APP_VERSION = "1.0.0";

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
    examMetadata: null,
    studentInfo: null
};

// ==================== KELAS DATA ====================
const kelasData = {
    'X': ['X-A', 'X-B', 'X-C', 'X-D', 'X-E', 'X-F'],
    'XI': ['XI-A', 'XI-B', 'XI-C', 'XI-D', 'XI-E', 'XI-F', 'XI-G'],
    'XII': ['XII-A', 'XII-B', 'XII-C', 'XII-D', 'XII-E', 'XII-F', 'XII-G']
};

// ==================== DOM ELEMENTS ====================
const elements = {
    screens: {},
    buttons: {},
    inputs: {},
    containers: {}
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    clearExamData();
});

function initializeElements() {
    // Screens
    elements.screens = {
        login: document.getElementById('screen-login'),
        loading: document.getElementById('screen-loading'),
        exam: document.getElementById('screen-exam'),
        result: document.getElementById('screen-result'),
        penutup: document.getElementById('screen-penutup')
    };

    // Buttons
    elements.buttons = {
        login: document.getElementById('btn-login'),
        prev: document.getElementById('btn-prev'),
        next: document.getElementById('btn-next'),
        submit: document.getElementById('btn-submit'),
        showResult: document.getElementById('btn-show-result'),
        showPenutup: document.getElementById('btn-show-penutup'),
        keluar: document.getElementById('btn-keluar')
    };

    // Inputs
    elements.inputs = {
        nama: document.getElementById('nama'),
        jenjang: document.getElementById('jenjang'),
        kelas: document.getElementById('kelas'),
        token: document.getElementById('token')
    };

    // Containers
    elements.containers = {
        questionGrid: document.getElementById('question-grid'),
        optionsContainer: document.getElementById('options-container'),
        questionNav: document.getElementById('question-nav')
    };

    // Other elements
    elements.loadingMessage = document.getElementById('loading-message');
    elements.questionText = document.getElementById('question-text');
    elements.questionImage = document.getElementById('question-image');
    elements.examTimer = document.getElementById('exam-timer');
    elements.examProgress = document.getElementById('exam-progress');
    elements.examHeader = document.getElementById('exam-header');
    elements.progressInfo = document.getElementById('progress-info');
    elements.loginError = document.getElementById('login-error');
}

function setupEventListeners() {
    // Jenjang dropdown
    if (elements.inputs.jenjang) {
        elements.inputs.jenjang.addEventListener('change', function() {
            updateKelasDropdown(this.value);
        });
    }

    // Token input - Enter key
    if (elements.inputs.token) {
        elements.inputs.token.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });
    }

    // Button event listeners
    if (elements.buttons.login) {
        elements.buttons.login.onclick = handleLogin;
    }
    
    if (elements.buttons.prev) {
        elements.buttons.prev.onclick = prevQuestion;
    }
    
    if (elements.buttons.next) {
        elements.buttons.next.onclick = nextQuestion;
    }
    
    if (elements.buttons.submit) {
        elements.buttons.submit.onclick = submitExam;
    }
    
    if (elements.buttons.showResult) {
        elements.buttons.showResult.onclick = showResultScreen;
    }
    
    if (elements.buttons.showPenutup) {
        elements.buttons.showPenutup.onclick = showPenutup;
    }
    
    if (elements.buttons.keluar) {
        elements.buttons.keluar.onclick = keluarAplikasi;
    }
}

// ==================== SCREEN MANAGEMENT ====================
function showScreen(screenId) {
    Object.values(elements.screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    
    if (elements.screens[screenId]) {
        elements.screens[screenId].classList.add('active');
    }
}

// ==================== ERROR & NOTIFICATION ====================
function showError(message, isLoginError = true) {
    if (isLoginError && elements.loginError) {
        elements.loginError.textContent = message;
        elements.loginError.style.display = 'block';
        elements.loginError.style.animation = 'none';
    } else {
        showNotification(message, 'error');
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        error: 'exclamation-circle',
        success: 'check-circle',
        info: 'info-circle',
        warning: 'exclamation-triangle'
    };
    
    notification.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    // Close function
    notification.querySelector('.notification-close').onclick = () => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    };
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ==================== FORM HANDLERS ====================
function updateKelasDropdown(jenjang) {
    if (!elements.inputs.kelas) return;
    
    if (!jenjang) {
        elements.inputs.kelas.innerHTML = '<option value="">Pilih Jenjang terlebih dahulu</option>';
        elements.inputs.kelas.disabled = true;
        return;
    }
    
    elements.inputs.kelas.innerHTML = '<option value="">Pilih Kelas</option>';
    kelasData[jenjang]?.forEach(kelas => {
        const option = document.createElement('option');
        option.value = kelas;
        option.textContent = kelas;
        elements.inputs.kelas.appendChild(option);
    });
    
    elements.inputs.kelas.disabled = false;
}

// ==================== LOGIN HANDLER ====================
async function handleLogin() {
    const nama = elements.inputs.nama?.value.trim() || '';
    const jenjang = elements.inputs.jenjang?.value || '';
    const kelas = elements.inputs.kelas?.value || '';
    const token = elements.inputs.token?.value.trim() || '';
    
    // Validation
    if (!validateLoginInput(nama, jenjang, kelas, token)) {
        return;
    }
    
    // Save student data
    state.student = { 
        nama, 
        jenjang,
        kelas,
        token 
    };
    
    showScreen('screen-loading');
    
    try {
        await loginProcess(nama, jenjang, kelas, token);
    } catch (error) {
        handleLoginError(error);
    }
}

function validateLoginInput(nama, jenjang, kelas, token) {
    if (!nama || !jenjang || !kelas || !token) {
        showError('Harap isi semua data dengan lengkap');
        return false;
    }
    
    if (nama.length < 3 || nama.length > 100) {
        showError('Nama harus 3-100 karakter');
        return false;
    }
    
    if (token.length < 3) {
        showError('Token tidak valid');
        return false;
    }
    
    return true;
}

async function loginProcess(nama, jenjang, kelas, token) {
    // 1. Check token validity
    updateLoadingMessage('Memeriksa token ujian...');
    await checkToken(token);
    
    // 2. Login to system
    updateLoadingMessage('Login ke sistem...');
    const loginData = await performLogin(nama, jenjang, kelas, token);
    
    // 3. Check if already taken exam
    if (loginData.error?.includes('sudah mengikuti ujian')) {
        handleAlreadyTakenExam(loginData);
        return;
    }
    
    // 4. Validate exam data
    validateExamData(loginData);
    
    // 5. Get questions
    updateLoadingMessage('Mengambil soal ujian...');
    const soalData = await getQuestions(token);
    
    // 6. Setup exam state
    setupExamState(soalData);
    
    // 7. Setup exam screen
    setupExamScreen();
    
    // 8. Show exam screen
    showScreen('screen-exam');
    
    // 9. Start timer
    startTimer();
    
    // 10. Show first question
    showQuestion(0);
    
    // 11. Enter fullscreen
    setTimeout(() => enterFullscreen(), 500);
    
    // 12. Start tab switch tracking
    startTabSwitchTracking();
    
    // 13. Show success notification
    showNotification('Ujian dimulai. Selamat mengerjakan!', 'success');
    
    console.log('Login successful:', {
        student: state.studentInfo,
        exam: state.examData,
        metadata: state.examMetadata,
        sessionId: state.sessionId
    });
}

async function checkToken(token) {
    const checkRes = await fetch(`${API_URL}/api/check-token?token=${encodeURIComponent(token)}`);
    
    if (!checkRes.ok) {
        throw new Error(`HTTP ${checkRes.status}: Gagal memeriksa token`);
    }
    
    const checkData = await checkRes.json();
    
    if (!checkData.success) {
        throw new Error(checkData.error || 'Gagal memeriksa token');
    }
    
    if (!checkData.exists) {
        throw new Error('Token ujian tidak ditemukan');
    }
    
    if (!checkData.active) {
        throw new Error('Ujian tidak aktif. Silakan hubungi guru.');
    }
    
    return checkData;
}

async function performLogin(nama, jenjang, kelas, token) {
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
        let errorMessage = `HTTP ${loginRes.status}: Gagal login ke sistem`;
        
        try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
            // If not JSON, use the text
        }
        
        throw new Error(errorMessage);
    }
    
    const loginData = await loginRes.json();
    
    if (!loginData.success) {
        throw new Error(loginData.error || 'Gagal login ke sistem');
    }
    
    // Save session data
    state.sessionId = loginData.session?.id || loginData.session_id;
    state.sessionSeed = loginData.session?.seed || loginData.session_seed;
    state.examData = loginData.ujian;
    state.studentInfo = loginData.student;
    state.waktuMulai = new Date();
    
    return loginData;
}

function handleAlreadyTakenExam(loginData) {
    showScreen('screen-login');
    
    let errorMsg = loginData.error;
    if (loginData.restriction) {
        errorMsg += `<br><small>${loginData.restriction}</small>`;
    }
    if (loginData.previous_attempt) {
        errorMsg += `<br><small>Nilai sebelumnya: ${loginData.previous_attempt.nilai}</small>`;
    }
    if (loginData.time_remaining) {
        errorMsg += `<br><small>Bisa mencoba lagi dalam: ${loginData.time_remaining}</small>`;
    }
    
    showError(errorMsg, true);
}

function validateExamData(loginData) {
    if (!state.examData || !state.examData.durasi) {
        throw new Error('Data ujian tidak lengkap');
    }
    
    if (!state.sessionId) {
        throw new Error('Session ID tidak valid');
    }
}

async function getQuestions(token) {
    const soalRes = await fetch(
        `${API_URL}/api/soal?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(state.sessionId)}`
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
    
    return soalData;
}

function setupExamState(soalData) {
    state.questions = soalData.soal;
    state.startTime = new Date();
    state.remainingTime = state.examData.durasi * 60;
    state.isExamActive = true;
    
    state.examMetadata = {
        jumlah_soal_total: soalData.jumlah_soal_total || 0,
        jumlah_soal_ditampilkan: soalData.jumlah_soal_ditampilkan || soalData.soal.length,
        limit_soal: soalData.limit_soal || soalData.soal.length,
        session_seed: soalData.session_seed
    };
}

function updateLoadingMessage(message) {
    if (elements.loadingMessage) {
        elements.loadingMessage.textContent = message;
    }
}

function handleLoginError(error) {
    console.error('Login error:', error);
    
    let errorMessage = error.message;
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
    }
    
    if (errorMessage.includes('Token') || errorMessage.includes('token')) {
        if (errorMessage.includes('tidak ditemukan')) {
            errorMessage = 'Token ujian tidak ditemukan. Pastikan token yang dimasukkan benar.';
        } else if (errorMessage.includes('tidak aktif')) {
            errorMessage = 'Ujian tidak aktif. Silakan hubungi guru.';
        }
    }
    
    showScreen('screen-login');
    showError(errorMessage);
}

// ==================== EXAM SETUP ====================
function setupExamScreen() {
    if (!state.questions || state.questions.length === 0) {
        showError('Tidak ada soal untuk ditampilkan');
        return;
    }
    
    // Update exam info
    updateExamHeader();
    
    // Setup question navigation
    setupQuestionNavigation();
    
    // Setup question grid
    setupQuestionGrid();
    
    updateProgress();
}

function updateExamHeader() {
    if (elements.examHeader && state.examData && state.studentInfo) {
        elements.examHeader.innerHTML = `
            <div class="exam-info">
                <div><strong>Mata Pelajaran:</strong> ${state.examData.mapel || 'Tidak diketahui'}</div>
                <div><strong>Guru:</strong> ${state.examData.nama_guru || 'Tidak diketahui'}</div>
                <div><strong>Siswa:</strong> ${state.studentInfo.nama || state.student.nama} (${state.studentInfo.kelas || state.student.kelas})</div>
            </div>
            <div class="exam-stats">
                <div><strong>Soal:</strong> ${state.currentIndex + 1}/${state.questions.length}</div>
                <div><strong>Durasi:</strong> ${state.examData.durasi} menit</div>
                <div><strong>Token:</strong> ${state.examData.token}</div>
            </div>
        `;
    }
}

function setupQuestionNavigation() {
    if (!elements.containers.questionNav) return;
    
    elements.containers.questionNav.innerHTML = '';
    
    state.questions.forEach((_, index) => {
        const btn = document.createElement('button');
        btn.className = 'question-nav-btn';
        btn.textContent = index + 1;
        btn.onclick = () => showQuestion(index);
        elements.containers.questionNav.appendChild(btn);
    });
}

function setupQuestionGrid() {
    if (!elements.containers.questionGrid) return;
    
    elements.containers.questionGrid.innerHTML = '';
    
    for (let i = 0; i < state.questions.length; i++) {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.textContent = i + 1;
        item.onclick = () => showQuestion(i);
        elements.containers.questionGrid.appendChild(item);
    }
}

function updateProgress() {
    const total = state.questions.length;
    const current = state.currentIndex + 1;
    const answered = Object.keys(state.answers).length;
    
    if (elements.examProgress) {
        elements.examProgress.textContent = `${current}/${total}`;
    }
    
    if (elements.buttons.prev) {
        elements.buttons.prev.classList.toggle('hidden', state.currentIndex === 0);
    }
    
    if (elements.buttons.next) {
        elements.buttons.next.classList.toggle('hidden', state.currentIndex === total - 1);
    }
    
    if (elements.buttons.submit) {
        elements.buttons.submit.classList.toggle('hidden', answered !== total);
    }
    
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
    
    // Update navigation buttons
    const navButtons = document.querySelectorAll('.question-nav-btn');
    navButtons.forEach((btn, index) => {
        btn.classList.toggle('answered', state.answers[index] !== undefined);
        btn.classList.toggle('current', index === state.currentIndex);
    });
    
    // Update progress info
    if (elements.progressInfo) {
        elements.progressInfo.textContent = `Terjawab: ${answered}/${total}`;
    }
}

// ==================== QUESTION DISPLAY ====================
function showQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    
    state.currentIndex = index;
    const question = state.questions[index];
    
    // Update question text
    if (elements.questionText) {
        elements.questionText.textContent = question.soal;
    }
    
    // Update question image
    updateQuestionImage(question, index);
    
    // Update options
    updateQuestionOptions(question, index);
    
    updateProgress();
}

function updateQuestionImage(question, index) {
    if (!elements.questionImage) return;
    
    if (question.img_link && question.img_link.trim() !== '') {
        const imageId = question.img_link.trim();
        const viewableUrl = getViewableImageUrl(imageId);
        
        elements.questionImage.src = viewableUrl;
        elements.questionImage.style.display = 'block';
        elements.questionImage.alt = "Gambar Soal " + (index + 1);
        
        elements.questionImage.onerror = function() {
            const alternativeUrl = `https://drive.google.com/thumbnail?id=${imageId}&sz=w1000`;
            elements.questionImage.src = alternativeUrl;
            
            elements.questionImage.onerror = function() {
                elements.questionImage.style.display = 'none';
                showNotification('Gambar soal tidak dapat dimuat', 'info');
            };
        };
    } else {
        elements.questionImage.style.display = 'none';
    }
}

function updateQuestionOptions(question, index) {
    if (!elements.containers.optionsContainer) return;
    
    elements.containers.optionsContainer.innerHTML = '';
    
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
        
        elements.containers.optionsContainer.appendChild(optionDiv);
    });
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

// ==================== TIMER ====================
function startTimer() {
    clearInterval(state.timerInterval);
    
    state.timerInterval = setInterval(() => {
        state.remainingTime--;
        
        const minutes = Math.floor(state.remainingTime / 60);
        const seconds = state.remainingTime % 60;
        
        if (elements.examTimer) {
            elements.examTimer.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Change color when time is running out
            if (state.remainingTime <= 300) {
                elements.examTimer.style.background = '#e74c3c';
            } else if (state.remainingTime <= 600) {
                elements.examTimer.style.background = '#ff9800';
            }
        }
        
        // Time's up
        if (state.remainingTime <= 0) {
            clearInterval(state.timerInterval);
            submitExam();
        }
    }, 1000);
}

// ==================== FULLSCREEN HANDLER ====================
function enterFullscreen() {
    const elem = document.documentElement;
    
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
            console.log('Fullscreen error:', err);
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

// ==================== TAB SWITCH TRACKING ====================
function startTabSwitchTracking() {
    state.tabSwitchCount = 0;
    
    document.addEventListener('visibilitychange', () => {
        if (!state.isExamActive || state.examSubmitted) return;
        
        if (document.hidden) {
            state.tabSwitchCount++;
            showNotification('Anda meninggalkan halaman ujian! Aktivitas telah dicatat.', 'error');
        }
    });
}

// ==================== SUBMIT EXAM ====================
async function submitExam() {
    if (state.examSubmitted) return;
    
    state.examSubmitted = true;
    state.isExamActive = false;
    state.waktuSelesai = new Date();
    
    clearInterval(state.timerInterval);
    
    // Exit fullscreen
    exitFullscreen();
    
    showScreen('screen-loading');
    updateLoadingMessage('Mengirim jawaban...');
    
    try {
        await submitAnswers();
    } catch (error) {
        console.error('Submit error:', error);
        showResultScreen();
    }
}

async function submitAnswers() {
    // Prepare answers
    let jawabanArray = [];
    
    for (let i = 0; i < state.questions.length; i++) {
        const answer = state.answers[i] || '-';
        jawabanArray.push(answer);
    }
    
    // Submit answers
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
    showResultScreen(submitData);
}

// ==================== RESULT HANDLERS ====================
function showResultScreen(resultData = null) {
    // Calculate working time
    let waktuPengerjaan = 0;
    if (state.waktuMulai && state.waktuSelesai) {
        const diffMs = state.waktuSelesai - state.waktuMulai;
        waktuPengerjaan = Math.floor(diffMs / 1000 / 60);
    } else {
        waktuPengerjaan = Math.max(0, (state.examData?.durasi || 0) - Math.floor(state.remainingTime / 60));
    }
    
    // Update result screen
    const resultElements = {
        nama: document.getElementById('result-nama'),
        kelas: document.getElementById('result-kelas'),
        mapel: document.getElementById('result-mapel'),
        totalSoal: document.getElementById('result-total-soal'),
        dijawab: document.getElementById('result-dijawab'),
        nilai: document.getElementById('result-nilai')
    };
    
    if (resultElements.nama) resultElements.nama.textContent = state.student.nama;
    if (resultElements.kelas) resultElements.kelas.textContent = state.student.kelas;
    if (resultElements.mapel) resultElements.mapel.textContent = state.examData?.mapel || '-';
    if (resultElements.totalSoal) resultElements.totalSoal.textContent = state.questions.length;
    if (resultElements.dijawab) resultElements.dijawab.textContent = `${Object.keys(state.answers).length} soal`;
    if (resultElements.nilai) resultElements.nilai.textContent = `${waktuPengerjaan} menit`;
    
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
                
                <p style="color: #2e7d32; font-weight: 600; padding: 15px; background: #e8f5e9; border-radius: 8px;">
                    <i class="fas fa-check-circle"></i> Tunjukkan bukti ini kepada pengawas ujian
                </p>
            </div>
        `;
    }
    
    if (tabInfo) {
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
    }
    
    showScreen('screen-penutup');
}

// ==================== APPLICATION CONTROL ====================
function keluarAplikasi() {
    clearExamData();
    
    // Reset form
    if (elements.inputs.nama) elements.inputs.nama.value = '';
    if (elements.inputs.jenjang) elements.inputs.jenjang.value = '';
    if (elements.inputs.kelas) {
        elements.inputs.kelas.innerHTML = '<option value="">Pilih Jenjang terlebih dahulu</option>';
        elements.inputs.kelas.disabled = true;
    }
    if (elements.inputs.token) elements.inputs.token.value = '';
    
    // Hide login error
    if (elements.loginError) {
        elements.loginError.style.display = 'none';
    }
    
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
        examMetadata: null,
        studentInfo: null
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

// Fullscreen handler
document.addEventListener('fullscreenchange', function() {
    if (state.isExamActive && !state.examSubmitted && !document.fullscreenElement) {
        enterFullscreen();
        showNotification('Harap tetap dalam mode fullscreen selama ujian', 'error');
    }
});

// Prevent context menu during exam
document.addEventListener('contextmenu', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        showNotification('Klik kanan tidak diizinkan selama ujian!', 'error');
        return false;
    }
});

// Prevent copy-paste during exam
['copy', 'paste', 'cut'].forEach(eventType => {
    document.addEventListener(eventType, function(e) {
        if (state.isExamActive && !state.examSubmitted) {
            e.preventDefault();
            showNotification(`${eventType.charAt(0).toUpperCase() + eventType.slice(1)} tidak diizinkan selama ujian!`, 'error');
            return false;
        }
    });
});

// Prevent selection during exam
document.addEventListener('selectstart', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        e.preventDefault();
        return false;
    }
});

// Prevent drag and drop during exam
['dragstart', 'drop'].forEach(eventType => {
    document.addEventListener(eventType, function(e) {
        if (state.isExamActive && !state.examSubmitted) {
            e.preventDefault();
            return false;
        }
    });
});

// Prevent keyboard shortcuts during exam
document.addEventListener('keydown', function(e) {
    if (state.isExamActive && !state.examSubmitted) {
        const blockedShortcuts = {
            'F5': 'Refresh',
            'F12': 'Developer Tools',
            'r': 'Refresh (Ctrl+R)',
            'R': 'Refresh (Ctrl+Shift+R)',
            'p': 'Print (Ctrl+P)',
            'P': 'Print (Ctrl+Shift+P)',
            's': 'Save (Ctrl+S)',
            'u': 'View Source (Ctrl+U)',
            'I': 'Developer Tools (Ctrl+Shift+I)',
            'i': 'Developer Tools (Ctrl+Shift+I)',
            'J': 'Developer Tools (Ctrl+Shift+J)',
            'j': 'Developer Tools (Ctrl+Shift+J)',
            'C': 'Developer Tools (Ctrl+Shift+C)',
            'c': 'Developer Tools (Ctrl+Shift+C)'
        };
        
        const key = e.key;
        let isBlocked = false;
        let action = '';
        
        // Check F5, F12
        if (key === 'F5' || key === 'F12') {
            isBlocked = true;
            action = blockedShortcuts[key];
        }
        
        // Check Ctrl combinations
        if (e.ctrlKey) {
            if (blockedShortcuts[key.toLowerCase()]) {
                isBlocked = true;
                action = blockedShortcuts[key.toLowerCase()];
                
                // Special handling for Shift combinations
                if (e.shiftKey && (key === 'R' || key === 'P' || key === 'I' || key === 'J' || key === 'C')) {
                    action = blockedShortcuts[key];
                }
            }
        }
        
        if (isBlocked) {
            e.preventDefault();
            showNotification(`${action} tidak diizinkan selama ujian!`, 'error');
            return false;
        }
    }
});
