/* Analisa vertikal, analisa horizontal, dan Analisa AI — dipakai semua modul Portal Floral.id.
   Tiap modul cukup menyiapkan angkanya; bentuk tabel dan kalimat temuannya dibuat di sini
   supaya semua halaman memakai definisi yang sama.

   vertikal()  — komposisi: porsi tiap komponen terhadap total pada SATU periode (common size + Pareto)
   horizontal() — pergerakan: nilai yang sama dibandingkan ANTAR periode (Δ, %, indeks, YoY)
   kartuAI()/pasangAI() — tombol "Analisa AI" yang mengirim ringkasan angka ke Gemini */

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n1 = x => (Math.round(x * 10) / 10).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct1 = x => (x >= 0 ? "+" : "−") + n1(Math.abs(x)) + "%";
const BLN = { "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Mei", "06": "Jun",
              "07": "Jul", "08": "Ags", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Des" };
const labelYm = s => /^\d{4}-\d{2}$/.test(s) ? (BLN[s.slice(5, 7)] || s.slice(5, 7)) + " " + s.slice(0, 4) : s;

/* ============================ ANALISA VERTIKAL ============================ */
/* o = { judul, sub, baris:[{label, nilai, catatan}], fmt, maxBaris, labelKolom } */
export function vertikal(o) {
  const fmt = o.fmt || (v => Math.round(v).toLocaleString("id-ID"));
  const semua = (o.baris || []).filter(b => b && isFinite(b.nilai)).slice()
    .sort((a, b) => b.nilai - a.nilai);
  const total = semua.reduce((s, b) => s + b.nilai, 0);
  if (!semua.length || !total) {
    return panel(o.judul || "Analisa vertikal", o.sub,
      '<div class="note">Belum ada angka yang bisa dibandingkan pada filter ini.</div>');
  }
  const batas = o.maxBaris || 12;
  let tampil = semua, sisa = null;
  if (semua.length > batas) {
    tampil = semua.slice(0, batas);
    const sv = semua.slice(batas).reduce((s, b) => s + b.nilai, 0);
    sisa = { label: `Lainnya (${semua.length - batas} item)`, nilai: sv };
  }
  const maks = Math.max(...tampil.map(b => Math.abs(b.nilai)), 1);

  let kum = 0, n80 = 0, kum80 = 0;
  for (const b of semua) { kum80 += b.nilai; n80++; if (kum80 / total >= 0.8) break; }

  const baris = tampil.concat(sisa ? [sisa] : []).map(b => {
    kum += b.nilai;
    const p = b.nilai / total * 100;
    return `<tr><td>${esc(b.label)}${b.catatan ? ` <span class="vh-note">${esc(b.catatan)}</span>` : ""}</td>` +
      `<td class="n">${fmt(b.nilai)}</td>` +
      `<td class="n">${n1(p)}%</td>` +
      `<td class="n">${n1(kum / total * 100)}%</td>` +
      `<td class="vh-barcell"><div class="mbar"><span style="width:${Math.max(1, Math.abs(b.nilai) / maks * 100)}%"></span></div></td></tr>`;
  }).join("");

  const tabel =
    `<div class="tblwrap"><table><thead><tr>` +
    `<th>${esc(o.labelKolom || "Komponen")}</th><th class="n">Nilai</th>` +
    `<th class="n">% dari total</th><th class="n">Kumulatif</th><th class="vh-barhead">Porsi</th>` +
    `</tr></thead><tbody>${baris}</tbody>` +
    `<tfoot><tr class="tot"><td>Total</td><td class="n">${fmt(total)}</td>` +
    `<td class="n">100,0%</td><td class="n"></td><td></td></tr></tfoot></table></div>` +
    `<div class="vh-temu"><b>Konsentrasi.</b> ${n80} dari ${semua.length} komponen sudah menutup 80% total` +
    (semua.length ? ` — terbesar <b>${esc(semua[0].label)}</b> di ${n1(semua[0].nilai / total * 100)}%.` : ".") +
    `</div>`;
  return panel(o.judul || "Analisa vertikal (komposisi)",
    o.sub || "Porsi tiap komponen terhadap total pada periode yang sedang difilter.", tabel);
}

/* ============================ ANALISA HORIZONTAL ============================ */
/* o = { judul, sub, seri:[[label, nilai], ...] urut periode, fmt, basisLabel } */
export function horizontal(o) {
  const fmt = o.fmt || (v => Math.round(v).toLocaleString("id-ID"));
  const seri = (o.seri || []).filter(r => r && isFinite(r[1]));
  if (seri.length < 2) {
    return panel(o.judul || "Analisa horizontal", o.sub,
      '<div class="note">Perlu minimal dua periode untuk membandingkan pergerakan. Longgarkan filter bulan.</div>');
  }
  const bulanan = seri.every(r => /^\d{4}-\d{2}$/.test(r[0]));
  const petaYm = {}; seri.forEach(r => petaYm[r[0]] = r[1]);
  const basis = seri[0][1] || 0;
  const maks = Math.max(...seri.map(r => Math.abs(r[1])), 1);

  const tumbuh = [];
  const baris = seri.map((r, i) => {
    const prev = i ? seri[i - 1][1] : null;
    const d = prev == null ? null : r[1] - prev;
    const dp = (prev == null || !prev) ? null : d / Math.abs(prev) * 100;
    if (dp != null && isFinite(dp)) tumbuh.push(dp);
    let yoy = null;
    if (bulanan) {
      const lalu = petaYm[(parseInt(r[0].slice(0, 4), 10) - 1) + r[0].slice(4)];
      if (lalu) yoy = (r[1] - lalu) / Math.abs(lalu) * 100;
    }
    const kelas = d == null ? "" : d > 0 ? "vh-naik" : d < 0 ? "vh-turun" : "";
    return `<tr><td>${esc(labelYm(r[0]))}</td>` +
      `<td class="n">${fmt(r[1])}</td>` +
      `<td class="n ${kelas}">${d == null ? "—" : (d > 0 ? "+" : "−") + fmt(Math.abs(d))}</td>` +
      `<td class="n ${kelas}">${dp == null ? "—" : pct1(dp)}</td>` +
      (bulanan ? `<td class="n ${yoy == null ? "" : yoy >= 0 ? "vh-naik" : "vh-turun"}">${yoy == null ? "—" : pct1(yoy)}</td>` : "") +
      `<td class="n">${basis ? n1(r[1] / basis * 100) : "—"}</td>` +
      `<td class="vh-barcell"><div class="mbar"><span style="width:${Math.max(1, Math.abs(r[1]) / maks * 100)}%"></span></div></td></tr>`;
  }).join("");

  const awal = seri[0], akhir = seri[seri.length - 1];
  const totalUbah = awal[1] ? (akhir[1] - awal[1]) / Math.abs(awal[1]) * 100 : null;
  const rata = tumbuh.length ? tumbuh.reduce((a, b) => a + b, 0) / tumbuh.length : null;
  const naik = tumbuh.filter(x => x > 0).length;
  const tertinggi = seri.slice().sort((a, b) => b[1] - a[1])[0];
  const terendah = seri.slice().sort((a, b) => a[1] - b[1])[0];

  const tabel =
    `<div class="tblwrap"><table><thead><tr>` +
    `<th>Periode</th><th class="n">Nilai</th><th class="n">Δ</th><th class="n">Δ%</th>` +
    (bulanan ? `<th class="n">YoY</th>` : "") +
    `<th class="n">Indeks</th><th class="vh-barhead">Tren</th>` +
    `</tr></thead><tbody>${baris}</tbody></table></div>` +
    `<div class="vh-temu"><b>Pergerakan.</b> ` +
    (totalUbah == null ? "" : `${esc(labelYm(awal[0]))} → ${esc(labelYm(akhir[0]))} ${pct1(totalUbah)}. `) +
    (rata == null ? "" : `Rata-rata per periode ${pct1(rata)}, naik di ${naik} dari ${tumbuh.length} periode. `) +
    `Tertinggi ${esc(labelYm(tertinggi[0]))} (${fmt(tertinggi[1])}), terendah ${esc(labelYm(terendah[0]))} (${fmt(terendah[1])}).` +
    `<br><span class="vh-note">Indeks: periode pertama = 100.</span></div>`;
  return panel(o.judul || "Analisa horizontal (pergerakan)",
    o.sub || "Nilai yang sama dibandingkan antar periode — selisih, persentase, dan indeks.", tabel);
}

/* Dua analisa berdampingan */
export function duaAnalisa(v, h) {
  return `<div class="vh-dua">${vertikal(v)}${horizontal(h)}</div>`;
}

function panel(judul, sub, isi) {
  return `<section class="panel vh-panel"><h3>${esc(judul)}</h3>` +
    (sub ? `<p class="sub">${esc(sub)}</p>` : "") + isi + `</section>`;
}

/* ================================ ANALISA AI ================================ */
/* Tombolnya ada di tiap halaman; konteks dikumpulkan saat diklik supaya selalu
   memakai angka yang sedang tampil (ikut filter tahun/bulan/platform). */
export function kartuAI(id, judul, sub) {
  return `<section class="panel ai-panel" id="ai-${esc(id)}">
    <div class="ai-head">
      <div><h3>${esc(judul || "Analisa AI")}</h3>
        <p class="sub">${esc(sub || "Gemini membaca angka yang sedang tampil di halaman ini lalu merangkum temuan dan saran tindakan.")}</p></div>
      <button class="ai-btn" data-ai="${esc(id)}" type="button">Analisa dengan AI</button>
    </div>
    <div class="ai-out" data-aiout="${esc(id)}" hidden></div>
  </section>`;
}

/* wadah = elemen halaman, A = API dari index.html, ambil = fn(id) -> {judul, data} */
export function pasangAI(wadah, A, ambil) {
  wadah.querySelectorAll("[data-ai]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.ai;
      const out = wadah.querySelector(`[data-aiout="${CSS.escape(id)}"]`);
      if (!out) return;
      const ctx = ambil(id) || {};
      out.hidden = false;
      out.innerHTML = '<div class="ai-tunggu">Gemini sedang membaca angkanya…</div>';
      btn.disabled = true;
      const teksAsli = btn.textContent;
      btn.textContent = "Menganalisa…";
      try {
        const teks = await A.ai(ctx.judul || id, ctx.data || {});
        out.innerHTML = `<div class="ai-teks">${markdown(teks)}</div>` +
          `<div class="ai-kaki">Dirangkum Gemini dari angka yang tampil. Periksa sebelum dipakai untuk keputusan.</div>`;
      } catch (e) {
        out.innerHTML = `<div class="note">Analisa AI gagal: ${esc(e.message || e)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = teksAsli;
      }
    });
  });
}

/* markdown seperlunya — AI hanya diminta menulis judul, paragraf, daftar, dan tebal */
function markdown(t) {
  const baris = String(t || "").replace(/\r/g, "").split("\n");
  let h = "", listTerbuka = null;
  const inline = s => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  const tutup = () => { if (listTerbuka) { h += `</${listTerbuka}>`; listTerbuka = null; } };
  for (const b of baris) {
    const s = b.trim();
    if (!s) { tutup(); continue; }
    let m;
    if ((m = s.match(/^#{1,6}\s+(.*)$/))) { tutup(); h += `<h4>${inline(m[1])}</h4>`; }
    else if ((m = s.match(/^[-*•]\s+(.*)$/))) {
      if (listTerbuka !== "ul") { tutup(); h += "<ul>"; listTerbuka = "ul"; }
      h += `<li>${inline(m[1])}</li>`;
    } else if ((m = s.match(/^\d+[.)]\s+(.*)$/))) {
      if (listTerbuka !== "ol") { tutup(); h += "<ol>"; listTerbuka = "ol"; }
      h += `<li>${inline(m[1])}</li>`;
    } else { tutup(); h += `<p>${inline(s)}</p>`; }
  }
  tutup();
  return h;
}

export const bantu = { esc, n1, pct1, labelYm };
