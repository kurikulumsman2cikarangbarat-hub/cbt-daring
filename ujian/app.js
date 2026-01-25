// ==============================================
// CBT SMAN 2 Cikarang Barat - Worker API (Client Only)
// File: worker.js - FIXED (aktif -> status)
// ==============================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://cbt-daring.pages.dev',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID, X-Client-Hash',
      'Access-Control-Max-Age': '86400',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // API ROOT
      if (path === '/' && request.method === 'GET') {
        return jsonResponse({
          service: 'CBT SMAN 2 Cikarang Barat API',
          version: '2.4',
          timestamp: new Date().toISOString(),
          endpoints: [
            'GET  /api/ujian?token=TOKEN',
            'GET  /api/soal?token=TOKEN&session_id=SESSION_ID',
            'POST /api/login',
            'POST /api/nilai',
            'GET  /api/check-token?token=TOKEN'
          ]
        }, 200, corsHeaders);
      }
      
      // ============ PUBLIC ENDPOINTS ============
      if (path === '/api/ujian' && request.method === 'GET') {
        return await handleGetUjian(request, env, corsHeaders);
      }
      
      if (path === '/api/soal' && request.method === 'GET') {
        return await handleGetSoal(request, env, corsHeaders);
      }
      
      if (path === '/api/login' && request.method === 'POST') {
        return await handleLogin(request, env, corsHeaders);
      }
      
      if (path === '/api/nilai' && request.method === 'POST') {
        return await handleSubmitNilai(request, env, corsHeaders);
      }
      
      if (path === '/api/check-token' && request.method === 'GET') {
        return await handleCheckToken(request, env, corsHeaders);
      }
      
      return jsonResponse({ 
        error: 'Endpoint not found',
        path: path
      }, 404, corsHeaders);
      
    } catch (error) {
      console.error('Worker Error:', error);
      return jsonResponse({ 
        error: 'Internal Server Error',
        message: error.message
      }, 500, corsHeaders);
    }
  }
};

// ==================== UTILITY FUNCTIONS ====================

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== MAPPING SYSTEM ====================

function stringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function deterministicShuffle(array, seed) {
    const shuffled = [...array];
    const random = mulberry32(seed);
    
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
}

// ==================== HANDLERS ====================

async function handleGetUjian(request, env, corsHeaders) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) {
    return jsonResponse({ error: 'Token diperlukan' }, 400, corsHeaders);
  }
  
  try {
    // PERBAIKAN: ganti aktif -> status
    const ujian = await env.DB.prepare(
      `SELECT id, token, mapel, nama_guru, durasi, status, created_at 
       FROM ujian 
       WHERE token = ? AND status = 1`
    ).bind(token).first();
    
    if (!ujian) {
      return jsonResponse({ 
        error: 'Ujian tidak ditemukan atau tidak aktif',
        token: token 
      }, 404, corsHeaders);
    }
    
    return jsonResponse({
      success: true,
      data: ujian
    }, 200, corsHeaders);
    
  } catch (error) {
    console.error('Get ujian error:', error);
    return jsonResponse({ 
      error: 'Gagal mengambil data ujian',
      details: error.message 
    }, 500, corsHeaders);
  }
}

async function handleGetSoal(request, env, corsHeaders) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const sessionId = searchParams.get('session_id');
  
  if (!token) {
    return jsonResponse({ error: 'Token diperlukan' }, 400, corsHeaders);
  }
  
  try {
    // PERBAIKAN: ganti aktif -> status
    const ujian = await env.DB.prepare(
      "SELECT id, durasi, mapel, nama_guru, jml_soal FROM ujian WHERE token = ? AND status = 1"
    ).bind(token).first();
    
    if (!ujian) {
      return jsonResponse({ 
        error: 'Token ujian tidak valid atau ujian tidak aktif',
        token: token 
      }, 400, corsHeaders);
    }
    
    // PERBAIKAN: ganti aktif -> status
    const soalResult = await env.DB.prepare(
      `SELECT id, soal, img_link, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, kunci
       FROM bank_soal 
       WHERE token = ? AND status = 1`
    ).bind(token).all();
    
    if (soalResult.results.length === 0) {
      return jsonResponse({ 
        error: 'Tidak ada soal untuk ujian ini',
        token: token 
      }, 404, corsHeaders);
    }
    
    // =========== APLIKASI LIMIT jml_soal ===========
    const jumlahSoalDitampilkan = Math.min(ujian.jml_soal, soalResult.results.length);
    let soalUntukDiproses = soalResult.results;
    
    if (ujian.jml_soal < soalResult.results.length) {
      const sessionSeed = sessionId ? stringHash(sessionId) : Date.now();
      const random = mulberry32(sessionSeed);
      
      const shuffled = [...soalResult.results];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      soalUntukDiproses = shuffled.slice(0, ujian.jml_soal);
    }
    
    // Generate seed
    let sessionSeed;
    if (sessionId) {
      sessionSeed = stringHash(sessionId);
    } else {
      sessionSeed = Date.now();
    }
    
    // Acak soal
    const shuffledSoal = deterministicShuffle(soalUntukDiproses, sessionSeed);
    
    // Proses soal untuk client
    const processedSoal = shuffledSoal.map((soal, index) => {
      // Sederhanakan: hanya kirim data yang diperlukan client
      const result = {
        id: soal.id,
        soal: soal.soal,
        img_link: soal.img_link,
        nomor_soal: index + 1,
        opsi_a: soal.opsi_a,
        opsi_b: soal.opsi_b,
        opsi_c: soal.opsi_c,
        opsi_d: soal.opsi_d
      };
      
      if (soal.opsi_e && soal.opsi_e.trim() !== '') {
        result.opsi_e = soal.opsi_e;
      }
      
      return result;
    });
    
    return jsonResponse({ 
      success: true,
      jumlah_soal_total: soalResult.results.length,
      jumlah_soal_ditampilkan: jumlahSoalDitampilkan,
      limit_soal: ujian.jml_soal,
      durasi: ujian.durasi,
      mapel: ujian.mapel,
      nama_guru: ujian.nama_guru,
      session_seed: sessionSeed.toString(),
      soal: processedSoal
    }, 200, corsHeaders);
    
  } catch (error) {
    console.error('Get soal error:', error);
    return jsonResponse({ 
      error: 'Gagal mengambil soal',
      details: error.message 
    }, 500, corsHeaders);
  }
}

async function handleLogin(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { nama, kelas, rombel, token } = data;

    // Validasi
    if (!nama || !kelas || !rombel || !token) {
      return jsonResponse({
        error: 'Data tidak lengkap',
        required: ['nama', 'kelas', 'rombel', 'token']
      }, 400, corsHeaders);
    }

    // Validasi token ujian
    const ujian = await env.DB.prepare(
      `SELECT id, token, mapel, nama_guru, durasi, status, jml_soal 
       FROM ujian 
       WHERE token = ?`
    ).bind(token).first();

    if (!ujian) {
      return jsonResponse({
        error: 'Token ujian tidak ditemukan'
      }, 404, corsHeaders);
    }

    // PERBAIKAN: ganti aktif -> status
    if (ujian.status !== 1) {
      return jsonResponse({
        error: 'Ujian tidak aktif',
        details: 'Ujian ini tidak aktif. Silakan hubungi guru.'
      }, 400, corsHeaders);
    }

    // Cek soal tersedia
    const soalCount = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bank_soal WHERE token = ? AND status = 1`
    ).bind(token).first();

    if (!soalCount || soalCount.count === 0) {
      return jsonResponse({
        error: 'Ujian belum siap',
        details: 'Belum ada soal yang tersedia'
      }, 400, corsHeaders);
    }

    // Generate session
    const sessionId = generateSessionId();
    const startedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (ujian.durasi + 30) * 60000);

    // Simpan session
    await env.DB.prepare(
      `INSERT INTO sessions (session_id, student_data, exam_token, expires_at, is_active, started_at)
       VALUES (?, ?, ?, ?, 1, ?)`
    ).bind(
      sessionId,
      JSON.stringify({
        nama: nama.trim(),
        kelas: kelas.trim(),
        rombel: rombel.trim(),
        token: token.trim(),
        ujian_id: ujian.id
      }),
      token,
      expiresAt.toISOString(),
      startedAt
    ).run();

    // Response
    return jsonResponse({
      success: true,
      message: 'Login berhasil',
      session: {
        id: sessionId,
        expires_at: expiresAt.toISOString(),
        time_limit: ujian.durasi
      },
      ujian: {
        id: ujian.id,
        token: ujian.token,
        mapel: ujian.mapel,
        nama_guru: ujian.nama_guru,
        durasi: ujian.durasi,
        jumlah_soal: ujian.jml_soal
      },
      student: {
        nama: nama.trim(),
        kelas: kelas.trim(),
        rombel: rombel.trim()
      }
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({
      error: 'Login gagal',
      details: error.message
    }, 500, corsHeaders);
  }
}

async function handleSubmitNilai(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { session_id, jawaban, tab_switch_count = 0 } = data;
    
    if (!session_id) {
      return jsonResponse({ 
        error: 'Session ID diperlukan' 
      }, 400, corsHeaders);
    }
    
    // Validasi session
    const session = await env.DB.prepare(
      `SELECT * FROM sessions 
       WHERE session_id = ? AND is_active = 1`
    ).bind(session_id).first();
    
    if (!session) {
      return jsonResponse({ 
        error: 'Session tidak valid atau sudah disubmit' 
      }, 401, corsHeaders);
    }
    
    const studentData = JSON.parse(session.student_data);
    
    // Ambil soal untuk penilaian
    const soalResult = await env.DB.prepare(
      `SELECT id, kunci FROM bank_soal WHERE token = ? AND status = 1 ORDER BY id`
    ).bind(studentData.token).all();
    
    if (soalResult.results.length === 0) {
      return jsonResponse({ 
        error: 'Tidak ada soal untuk ujian ini' 
      }, 404, corsHeaders);
    }
    
    // Konversi jawaban ke array
    let jawabanArray = [];
    if (typeof jawaban === 'string') {
      jawabanArray = jawaban.split('');
    } else if (Array.isArray(jawaban)) {
      jawabanArray = jawaban;
    } else {
      jawabanArray = Array(soalResult.results.length).fill('-');
    }
    
    // Penilaian sederhana
    let benar = 0;
    let detailJawaban = [];
    
    for (let i = 0; i < soalResult.results.length; i++) {
      const soal = soalResult.results[i];
      const jawabanSiswa = jawabanArray[i] || '-';
      const isCorrect = jawabanSiswa === soal.kunci;
      
      if (isCorrect) benar++;
      
      detailJawaban.push({
        soal_id: soal.id,
        jawaban_siswa: jawabanSiswa,
        kunci: soal.kunci,
        benar: isCorrect
      });
    }
    
    const totalSoal = soalResult.results.length;
    const nilai = totalSoal > 0 ? Math.round((benar / totalSoal) * 100) : 0;
    
    // Simpan nilai
    const result = await env.DB.prepare(
      `INSERT INTO nilai (
        nama_siswa, token, mapel, kelas, id_kelas,
        jml_benar, jml_salah, nilai, jawaban,
        wkt_diberikan, wkt_digunakan, session_id,
        submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      studentData.nama,
      studentData.token,
      session.mapel || 'Umum',
      session.kelas || '-',
      session.rombel || '-',
      benar,
      totalSoal - benar,
      nilai,
      jawabanArray.join(''),
      session.durasi || '0 Menit',
      Math.floor((new Date() - new Date(session.started_at)) / 60000) + " Menit",
      session_id,
      new Date().toISOString()
    ).run();
    
    // Nonaktifkan session
    await env.DB.prepare(
      "UPDATE sessions SET is_active = 0 WHERE session_id = ?"
    ).bind(session_id).run();
    
    return jsonResponse({
      success: true,
      message: 'Jawaban berhasil disimpan',
      hasil: {
        benar: benar,
        salah: totalSoal - benar,
        nilai: nilai,
        total_soal: totalSoal
      }
    }, 200, corsHeaders);
    
  } catch (error) {
    console.error('Submit error:', error);
    return jsonResponse({ 
      error: 'Gagal menyimpan jawaban',
      details: error.message
    }, 500, corsHeaders);
  }
}

async function handleCheckToken(request, env, corsHeaders) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) {
    return jsonResponse({ 
      error: 'Token diperlukan',
      exists: false 
    }, 400, corsHeaders);
  }
  
  try {
    const existing = await env.DB.prepare(
      "SELECT id, token, mapel, status FROM ujian WHERE token = ?"
    ).bind(token).first();
    
    return jsonResponse({
      success: true,
      exists: !!existing,
      data: existing || null,
      active: existing?.status === 1
    }, 200, corsHeaders);
    
  } catch (error) {
    console.error('Check token error:', error);
    return jsonResponse({ 
      error: 'Gagal mengecek token',
      exists: false
    }, 500, corsHeaders);
  }
}
