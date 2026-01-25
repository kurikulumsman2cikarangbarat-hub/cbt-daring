// app.js - Versi SUPER SIMPLE
const API_URL = "https://ujian-baru.kurikulum-sman2cikarangbarat.workers.dev";

let state = {
    sessionId: null,
    token: ''
};

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

async function handleLogin() {
    const nama = document.getElementById('nama').value.trim();
    const jenjang = document.getElementById('jenjang').value;
    const kelas = document.getElementById('kelas').value;
    const token = document.getElementById('token').value.trim();

    if (!nama || !jenjang || !kelas || !token) {
        alert('Harap isi semua data');
        return;
    }

    state.token = token;
    showScreen('screen-loading');

    try {
        // 1. Coba login dulu
        const loginRes = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama: nama,
                kelas: jenjang,
                rombel: kelas,
                token: token
            })
        });

        if (!loginRes.ok) {
            throw new Error(`Login gagal: ${loginRes.status}`);
        }

        const loginData = await loginRes.json();
        
        if (!loginData.success) {
            throw new Error(loginData.error || 'Login gagal');
        }

        state.sessionId = loginData.session?.id;
        
        if (!state.sessionId) {
            throw new Error('Session ID tidak didapat');
        }

        // 2. Coba ambil soal (ini yang error 500)
        console.log('Mengambil soal dengan:', {
            token: state.token,
            session_id: state.sessionId
        });

        const soalUrl = `${API_URL}/api/soal?token=${encodeURIComponent(state.token)}&session_id=${encodeURIComponent(state.sessionId)}`;
        console.log('URL:', soalUrl);
        
        const soalRes = await fetch(soalUrl);
        
        if (!soalRes.ok) {
            const errorText = await soalRes.text();
            console.error('Error response:', errorText);
            throw new Error(`Gagal ambil soal: ${soalRes.status} - ${errorText.substring(0, 100)}`);
        }

        const soalData = await soalRes.json();
        console.log('Soal data:', soalData);
        
        if (!soalData.success) {
            throw new Error(soalData.error || 'Tidak dapat soal');
        }

        // 3. Jika berhasil, lanjutkan
        alert(`Berhasil! Mendapatkan ${soalData.soal?.length || 0} soal`);
        showScreen('screen-login');

    } catch (error) {
        console.error('ERROR DETAIL:', error);
        showScreen('screen-login');
        alert(`ERROR: ${error.message}\n\nIni masalah SERVER (worker API).\nPeriksa Cloudflare Worker.`);
    }
}

// Setup dropdown
document.addEventListener('DOMContentLoaded', function() {
    const kelasData = {
        'X': ['X-A','X-B','X-C','X-D','X-E','X-F'],
        'XI': ['XI-A','XI-B','XI-C','XI-D','XI-E','XI-F','XI-G'],
        'XII': ['XII-A','XII-B','XII-C','XII-D','XII-E','XII-F','XII-G']
    };
    
    const jenjangSelect = document.getElementById('jenjang');
    jenjangSelect.addEventListener('change', function() {
        const kelasSelect = document.getElementById('kelas');
        const jenjang = this.value;
        
        kelasSelect.innerHTML = '<option value="">Pilih Kelas</option>';
        if (jenjang && kelasData[jenjang]) {
            kelasData[jenjang].forEach(kelas => {
                const option = document.createElement('option');
                option.value = kelas;
                option.textContent = kelas;
                kelasSelect.appendChild(option);
            });
            kelasSelect.disabled = false;
        } else {
            kelasSelect.disabled = true;
        }
    });
});

function keluarAplikasi() {
    state = { sessionId: null, token: '' };
    showScreen('screen-login');
}
