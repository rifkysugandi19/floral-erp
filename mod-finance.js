/* Modul Finance / Cashflow — Portal Floral.id
   data = baris module_data untuk modul_group 'finance'
     finance.feed -> [blok, d1, d2, d3, d4, metrik, nilai]   (uang dalam ribu rupiah)
     finance.kas  -> [tanggal, rekening, grup, kategori, deskripsi, klasifikasi, sub, nilai(Rp), catatan]
                     nilai bertanda: positif = uang masuk, negatif = uang keluar */

let A, F = {}, KAS = [], META = {};
let FY = "all", FM = "all", HAL = "ringkasan";
let wadah = null;

const HALAMAN = [
  ["ringkasan", "Ringkasan"],
  ["terima",    "Penerimaan"],
  ["biaya",     "Biaya"],
  ["rekening",  "Rekening & Saldo"],
  ["peta",      "Peta Klasifikasi"],
  ["transaksi", "Transaksi"]
];
const BLN = {"01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"Mei","06":"Jun",
             "07":"Jul","08":"Ags","09":"Sep","10":"Okt","11":"Nov","12":"Des"};
const labelYm = s => (BLN[String(s).slice(5,7)] || String(s).slice(5,7)) + " " + String(s).slice(0,4);
const tglPanjang = s => (String(s).length < 10) ? (s || "—")
  : parseInt(String(s).slice(8,10),10) + " " + (BLN[String(s).slice(5,7)] || "") + " " + String(s).slice(0,4);

/* ---------- query agregat ---------- */
const cocok = ym => (FY === "all" || String(ym).slice(0,4) === FY) &&
                    (FM === "all" || String(ym).slice(0,7) === FM);

function jml(blok, metrik, pred) {
  let s = 0;
  for (const r of (F[blok] || [])) {
    if (r.m !== metrik) continue;
    if (pred && !pred(r)) continue;
    s += r.v;
  }
  return s;
}
function grup(blok, metrik, kunci, pred) {
  const peta = {};
  for (const r of (F[blok] || [])) {
    if (r.m !== metrik) continue;
    if (pred && !pred(r)) continue;
    const k = kunci(r);
    peta[k] = (peta[k] || 0) + r.v;
  }
  return peta;
}
const urut = (peta, desc) => Object.entries(peta)
  .sort((a,b) => desc ? b[1]-a[1] : (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const BIAYA = ["HPP", "Opex"];
const detCocok = tgl => cocok(String(tgl).slice(0,7));

/* ---------- komponen ---------- */
const kpi = (l, v, n, cls) =>
  `<div class="kpi${cls ? " " + cls : ""}"><span class="l">${A.esc(l)}</span>` +
  `<span class="v">${v}</span><span class="n">${n || ""}</span></div>`;

function tabel(head, baris, foot) {
  let h = '<div class="tblwrap"><table><thead><tr>';
  head.forEach(c => h += `<th${c.n ? ' class="n"' : ""}>${A.esc(c.t)}</th>`);
  h += "</tr></thead><tbody>";
  baris.forEach(r => {
    h += "<tr>";
    r.forEach((c,i) => h += `<td${head[i] && head[i].n ? ' class="n"' : ""}>${c}</td>`);
    h += "</tr>";
  });
  if (foot) {
    h += "</tbody><tfoot><tr class='tot'>";
    foot.forEach((c,i) => h += `<td${head[i] && head[i].n ? ' class="n"' : ""}>${c}</td>`);
    h += "</tr></tfoot>";
  } else h += "</tbody>";
  return h + "</table></div>";
}

function bar(pasangan, uang) {
  let maks = 0;
  pasangan.forEach(p => { if (Math.abs(p[1]) > maks) maks = Math.abs(p[1]); });
  if (!maks) maks = 1;
  let h = '<div class="tblwrap"><table><tbody>';
  pasangan.forEach(p => {
    h += `<tr><td style="max-width:320px">${A.esc(p[0])}</td>` +
         `<td style="width:46%"><div class="mbar"><span style="width:${(Math.abs(p[1])/maks*100).toFixed(1)}%"></span></div></td>` +
         `<td class="n">${uang ? A.rp(p[1]) : A.fmt(p[1])}</td></tr>`;
  });
  return h + "</tbody></table></div>";
}

function temuan(cls, judul, isi) {
  return `<div class="find ${cls}"><b>${A.esc(judul)}</b><p>${isi}</p></div>`;
}

/* ---------- tabel detail ---------- */
const DET = {};
function tabelDetail(id, judul, sub, kolom, baris, namaFile) {
  DET[id] = { kolom, baris, namaFile, cari: "", hal: 0 };
  return `<div class="panel" id="${id}"><h3>${A.esc(judul)}</h3><p class="sub">${sub}</p>
    <div class="detbar">
      <input type="search" class="det-cari" data-id="${id}" placeholder="Cari deskripsi, kategori, rekening…">
      <span class="det-info" id="${id}-info"></span>
      <button class="det-unduh" data-id="${id}" type="button">Unduh CSV</button>
    </div>
    <div id="${id}-isi"></div>
    <div class="detnav">
      <button class="det-prev" data-id="${id}" type="button">‹ Sebelumnya</button>
      <button class="det-next" data-id="${id}" type="button">Berikutnya ›</button>
    </div></div>`;
}
const PER_HAL = 50;
const saringDetail = d => {
  const q = d.cari.trim().toLowerCase();
  return q ? d.baris.filter(r => r.some(c => String(c).toLowerCase().includes(q))) : d.baris;
};
function gambarDetail(id) {
  const d = DET[id]; if (!d) return;
  const data = saringDetail(d);
  const maxHal = Math.max(0, Math.ceil(data.length / PER_HAL) - 1);
  if (d.hal > maxHal) d.hal = maxHal;
  const potong = data.slice(d.hal * PER_HAL, d.hal * PER_HAL + PER_HAL);
  let h = '<div class="tblwrap"><table><thead><tr>';
  d.kolom.forEach(c => h += `<th${c.n ? ' class="n"' : ""}>${A.esc(c.t)}</th>`);
  h += "</tr></thead><tbody>";
  potong.forEach(r => {
    h += "<tr>";
    d.kolom.forEach(c => {
      let v = r[c.i];
      if (c.f === "rp0") v = `<span class="${(+v||0) < 0 ? "vh-turun" : "vh-naik"}">${A.rp((+v||0)/1000)}</span>`;
      else if (c.f === "tgl") v = tglPanjang(v);
      else v = A.esc(v == null ? "" : v);
      h += `<td${c.n ? ' class="n"' : ""}>${v}</td>`;
    });
    h += "</tr>";
  });
  h += "</tbody></table></div>";
  if (!data.length) h = '<div class="note">Tidak ada baris yang cocok.</div>';
  document.getElementById(id + "-isi").innerHTML = h;
  document.getElementById(id + "-info").textContent =
    A.fmt(data.length) + " baris" + (data.length > PER_HAL ? ` · halaman ${d.hal+1} dari ${maxHal+1}` : "");
}
function csvDetail(id) {
  const d = DET[id], data = saringDetail(d);
  const e = v => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const baris = [d.kolom.map(c => e(c.t)).join(";")];
  data.forEach(r => baris.push(d.kolom.map(c => e(r[c.i])).join(";")));
  const blob = new Blob(["﻿" + baris.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = d.namaFile + "-" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- halaman ---------- */

function pRingkasan() {
  const masuk  = jml("BULAN", "masuk_rb",  r => cocok(r.d1));
  const keluar = jml("BULAN", "keluar_rb", r => cocok(r.d1));
  const perGrupM = grup("BULAN", "masuk_rb",  r => r.d2, r => cocok(r.d1));
  const perGrupK = grup("BULAN", "keluar_rb", r => r.d2, r => cocok(r.d1));
  const grupSemua = [...new Set([...Object.keys(perGrupM), ...Object.keys(perGrupK)])].sort();
  const netBulan = {};
  (F.BULAN || []).forEach(r => {
    if (!cocok(r.d1)) return;
    netBulan[r.d1] = (netBulan[r.d1] || 0) + (r.m === "masuk_rb" ? r.v : r.m === "keluar_rb" ? -r.v : 0);
  });
  const mutasiNet = (perGrupM["Transfer internal"] || 0) - (perGrupK["Transfer internal"] || 0);
  const belum = (perGrupM["Belum terklasifikasi"] || 0) + (perGrupK["Belum terklasifikasi"] || 0);

  return `<div class="kpis">
      ${kpi("Uang masuk", A.rp(masuk), "arus kotor periode ini")}
      ${kpi("Uang keluar", A.rp(keluar), "arus kotor periode ini")}
      ${kpi("Arus bersih", A.rp(masuk - keluar), masuk - keluar >= 0 ? "surplus" : "defisit",
            masuk - keluar >= 0 ? "good" : "bad")}
      ${kpi("Transfer internal net", A.rp(mutasiNet), "harusnya mendekati nol", Math.abs(mutasiNet) > masuk * 0.02 ? "warn" : "")}
      ${kpi("Belum terklasifikasi", A.rp(belum), "arus tanpa label yang bisa dibaca", belum ? "warn" : "")}
    </div>
    <div class="panel"><h3>Arus bersih per bulan</h3>
      <p class="sub">Masuk dikurangi keluar, termasuk transfer internal. Batang memakai nilai mutlak.</p>
      ${Object.keys(netBulan).length
        ? bar(urut(netBulan, false).map(p => [labelYm(p[0]) + (p[1] < 0 ? " (defisit)" : ""), p[1]]), true)
        : '<div class="note">Tidak ada data pada filter ini.</div>'}
    </div>
    <div class="panel"><h3>Per kelompok</h3><p class="sub">Penerimaan, HPP, Opex, Investasi, Pendanaan, dan sisanya.</p>
      ${tabel([{t:"Kelompok"},{t:"Masuk",n:1},{t:"Keluar",n:1},{t:"Bersih",n:1}],
        grupSemua.map(g => [A.esc(g), A.rp(perGrupM[g]||0), A.rp(perGrupK[g]||0),
          A.rp((perGrupM[g]||0) - (perGrupK[g]||0))]),
        ["Total", A.rp(masuk), A.rp(keluar), A.rp(masuk - keluar)])}
    </div>
    ${Math.abs(mutasiNet) > masuk * 0.02 ? `<div class="panel"><h3>Yang perlu dicek</h3><div class="stack">
      ${temuan("warn", "Transfer internal tidak berpasangan",
        `Mutasi antar rekening net <b>${A.rp(mutasiNet)}</b>. Kalau benar sekadar pindah rekening, masuk dan keluarnya harus saling meniadakan. Selisih sebesar ini biasanya pencairan marketplace yang belum dicatat sebagai penerimaan.`)}
    </div></div>` : ""}`;
}

function pTerima() {
  const kat = grup("KATEGORI", "masuk_rb", r => r.d1, r => r.d2 === "Penerimaan" && cocok(r.d3));
  const total = Object.values(kat).reduce((a,b) => a+b, 0);
  const balik = jml("KATEGORI", "keluar_rb", r => r.d2 === "Penerimaan" && cocok(r.d3));
  const urutKat = urut(kat, true);
  return `<div class="kpis">
      ${kpi("Total penerimaan", A.rp(total), "arus masuk berlabel penerimaan")}
      ${kpi("Kategori terbesar", urutKat.length ? urutKat[0][0] : "—",
            urutKat.length ? A.pct(urutKat[0][1], total) + "% dari penerimaan" : "")}
      ${kpi("Penerimaan tapi uang keluar", A.rp(balik), "baris berlabel penerimaan yang justru keluar", balik ? "warn" : "")}
    </div>
    <div class="panel"><h3>Penerimaan per kategori</h3>
      <p class="sub">Label berasal dari kolom klasifikasi di file kas, bukan tebakan dari teks deskripsi.</p>
      ${urutKat.length ? bar(urutKat, true) : '<div class="note">Tidak ada data.</div>'}
    </div>`;
}

function pBiaya() {
  const kat = grup("KATEGORI", "keluar_rb", r => BIAYA.includes(r.d2) && cocok(r.d3) ? r.d1 : null,
                   r => BIAYA.includes(r.d2) && cocok(r.d3));
  delete kat["null"];
  const urutKat = urut(kat, true);
  const total = Object.values(kat).reduce((a,b) => a+b, 0);
  const terima = jml("BULAN", "masuk_rb", r => r.d2 === "Penerimaan" && cocok(r.d1));
  const cari = kata => urutKat.filter(p => p[0].toLowerCase().includes(kata)).reduce((a,b) => a+b[1], 0);
  const gaji = cari("gaji"), sewa = cari("sewa");
  const hpp = jml("BULAN", "keluar_rb", r => r.d2 === "HPP" && cocok(r.d1));
  const opex = jml("BULAN", "keluar_rb", r => r.d2 === "Opex" && cocok(r.d1));

  const patok = (nama, nilai) => {
    const p = terima ? nilai / terima * 100 : 0;
    const lolos = p <= 15;
    return [`${nama} <span class="pill ${lolos ? "p-ok" : "p-crit"}">${lolos ? "di bawah patokan" : "lewat patokan"}</span>`,
            A.rp(nilai), (Math.round(p*10)/10).toLocaleString("id-ID") + "%", "≤ 15%"];
  };

  return `<div class="kpis">
      ${kpi("Total biaya", A.rp(total), "HPP + Opex")}
      ${kpi("HPP", A.rp(hpp), terima ? A.pct(hpp, terima) + "% dari penerimaan" : "")}
      ${kpi("Opex", A.rp(opex), terima ? A.pct(opex, terima) + "% dari penerimaan" : "")}
      ${kpi("Biaya terbesar", urutKat.length ? urutKat[0][0] : "—",
            urutKat.length ? A.rp(urutKat[0][1]) : "")}
    </div>
    <div class="panel"><h3>Patokan internal</h3>
      <p class="sub">Patokan Rifky: gaji maksimal 15% dan sewa maksimal 15% dari penerimaan.</p>
      ${terima ? tabel([{t:"Komponen"},{t:"Nilai",n:1},{t:"% penerimaan",n:1},{t:"Patokan",n:1}],
        [patok("Gaji", gaji), patok("Sewa", sewa)])
        : '<div class="note">Belum ada penerimaan pada filter ini, jadi rasionya tidak bisa dihitung.</div>'}
    </div>
    <div class="panel"><h3>Biaya per kategori</h3><p class="sub">HPP dan Opex digabung, urut dari yang terbesar.</p>
      ${urutKat.length ? bar(urutKat, true) : '<div class="note">Tidak ada data.</div>'}
    </div>`;
}

function pRekening() {
  const masuk  = grup("AKUN", "masuk_rb",  r => r.d1, r => cocok(r.d2));
  const keluar = grup("AKUN", "keluar_rb", r => r.d1, r => cocok(r.d2));
  const rek = [...new Set([...Object.keys(masuk), ...Object.keys(keluar)])].sort();
  /* saldo: ambil ym terakhir yang tersedia per rekening */
  const saldoAkhir = {}, ymAkhir = {};
  (F.SALDO || []).forEach(r => {
    if (r.m !== "saldo_rb" || !cocok(r.d2)) return;
    if (!ymAkhir[r.d1] || r.d2 > ymAkhir[r.d1]) { ymAkhir[r.d1] = r.d2; saldoAkhir[r.d1] = r.v; }
  });
  const totSaldo = Object.values(saldoAkhir).reduce((a,b) => a+b, 0);
  const saldoBulan = grup("SALDO", "saldo_rb", r => r.d2, r => cocok(r.d2));

  return `<div class="kpis">
      ${kpi("Saldo gabungan", A.rp(totSaldo), Object.keys(saldoAkhir).length + " rekening")}
      ${kpi("Rekening terbesar", urut(saldoAkhir, true).length ? urut(saldoAkhir, true)[0][0] : "—",
            urut(saldoAkhir, true).length ? A.rp(urut(saldoAkhir, true)[0][1]) : "")}
      ${kpi("Rekening dipakai", A.fmt(rek.length), "punya mutasi pada periode ini")}
    </div>
    <div class="panel"><h3>Mutasi per rekening</h3><p class="sub">Arus kotor masuk dan keluar, bukan saldo.</p>
      ${rek.length ? tabel([{t:"Rekening"},{t:"Masuk",n:1},{t:"Keluar",n:1},{t:"Bersih",n:1},{t:"Saldo terakhir",n:1}],
        rek.map(k => [A.esc(k), A.rp(masuk[k]||0), A.rp(keluar[k]||0),
          A.rp((masuk[k]||0)-(keluar[k]||0)),
          saldoAkhir[k] == null ? "—" : A.rp(saldoAkhir[k])]))
        : '<div class="note">Tidak ada data.</div>'}
    </div>
    <div class="panel"><h3>Saldo gabungan per bulan</h3><p class="sub">Jumlah saldo seluruh rekening di tiap akhir bulan.</p>
      ${Object.keys(saldoBulan).length ? bar(urut(saldoBulan, false).map(p => [labelYm(p[0]), p[1]]), true)
        : '<div class="note">Tidak ada data.</div>'}
    </div>`;
}

function pPeta() {
  const baris = {};
  (F.PETA || []).forEach(r => {
    const k = r.d1 + "||" + r.d2;
    (baris[k] = baris[k] || { label: r.d1, tujuan: r.d2, baris: 0, masuk: 0, keluar: 0 });
    if (r.m === "baris") baris[k].baris += r.v;
    if (r.m === "masuk_rb") baris[k].masuk += r.v;
    if (r.m === "keluar_rb") baris[k].keluar += r.v;
  });
  const daftar = Object.values(baris).sort((a,b) => (b.masuk+b.keluar) - (a.masuk+a.keluar));
  const belum = daftar.filter(d => /Belum terklasifikasi/i.test(d.tujuan));
  const kolom = [
    { t: "Label sumber (klasifikasi >> sub)", i: 0 },
    { t: "Dipetakan ke", i: 1 },
    { t: "Baris", i: 2, n: 1 },
    { t: "Masuk (rb)", i: 3, n: 1 },
    { t: "Keluar (rb)", i: 4, n: 1 }
  ];
  const data = daftar.map(d => [d.label, d.tujuan, d.baris, Math.round(d.masuk), Math.round(d.keluar)]);

  return `<div class="kpis">
      ${kpi("Pasangan label", A.fmt(daftar.length), "kombinasi klasifikasi + sub yang ada di file")}
      ${kpi("Belum terpetakan", A.fmt(belum.length), "masuk kelompok Belum terklasifikasi", belum.length ? "warn" : "good")}
    </div>
    <div class="note" style="margin-bottom:16px">Tabel ini untuk tim FAT: setiap label yang dipakai di file kas, dan ke kelompok mana dashboard memetakannya. Kalau ada baris yang salah tempat, perbaiki labelnya di file sumber — dashboard tidak menebak dari teks deskripsi.</div>
    ${tabelDetail("det-peta", "Peta klasifikasi", "Cari label untuk memeriksa pemetaannya.", kolom, data, "peta-klasifikasi-floralid")}`;
}

function pTransaksi() {
  const baris = KAS.filter(r => detCocok(r[0]));
  const masuk = baris.filter(r => (+r[7]||0) > 0).reduce((a,r) => a + (+r[7]||0), 0) / 1000;
  const keluar = baris.filter(r => (+r[7]||0) < 0).reduce((a,r) => a - (+r[7]||0), 0) / 1000;
  const kolom = [
    { t: "Tanggal", i: 0, f: "tgl" }, { t: "Rekening", i: 1 }, { t: "Kelompok", i: 2 },
    { t: "Kategori", i: 3 }, { t: "Deskripsi", i: 4 }, { t: "Klasifikasi", i: 5 },
    { t: "Sub", i: 6 }, { t: "Nilai", i: 7, n: 1, f: "rp0" }, { t: "Catatan", i: 8 }
  ];
  return `<div class="kpis">
      ${kpi("Transaksi tercatat", A.fmt(baris.length), "hanya ≥ Rp 5 jt dan baris bermasalah")}
      ${kpi("Masuk", A.rp(masuk), "dari transaksi besar")}
      ${kpi("Keluar", A.rp(keluar), "dari transaksi besar")}
    </div>
    ${tabelDetail("det-kas", "Transaksi besar dan baris bermasalah",
      "Berisi transaksi ≥ Rp 5 juta ditambah semua baris bermasalah berapa pun nilainya.",
      kolom, baris, "transaksi-kas-floralid")}`;
}

const GAMBAR = { ringkasan: pRingkasan, terima: pTerima, biaya: pBiaya,
                 rekening: pRekening, peta: pPeta, transaksi: pTransaksi };

/* ---------- analisa vertikal & horizontal ---------- */
const rpRb = v => A.rp(v);
const barisDari = peta => urut(peta, true).map(([label, nilai]) => ({ label, nilai }));
const seriBulan = (metrik, pred) =>
  urut(grup("BULAN", metrik, r => r.d1, r => cocok(r.d1) && (!pred || pred(r))), false);

function seriNetBulan() {
  const n = {};
  (F.BULAN || []).forEach(r => {
    if (!cocok(r.d1)) return;
    n[r.d1] = (n[r.d1] || 0) + (r.m === "masuk_rb" ? r.v : r.m === "keluar_rb" ? -r.v : 0);
  });
  return urut(n, false);
}

const VHDEF = {
  ringkasan: () => ({
    v: { judul: "Analisa vertikal — pengeluaran per kelompok", labelKolom: "Kelompok", fmt: rpRb,
         sub: "Ke mana uang keluar pada periode ini, dan seberapa terpusat.",
         baris: barisDari(grup("BULAN", "keluar_rb", r => r.d2, r => cocok(r.d1))) },
    h: { judul: "Analisa horizontal — arus kas bersih per bulan", fmt: rpRb,
         sub: "Masuk dikurangi keluar tiap bulan, lengkap dengan perbandingan tahun lalu.",
         seri: seriNetBulan() }
  }),
  terima: () => ({
    v: { judul: "Analisa vertikal — penerimaan per kategori", labelKolom: "Kategori", fmt: rpRb,
         sub: "Sumber uang masuk mana yang menopang, dan seberapa bergantung pada satu kanal.",
         baris: barisDari(grup("KATEGORI", "masuk_rb", r => r.d1, r => r.d2 === "Penerimaan" && cocok(r.d3))) },
    h: { judul: "Analisa horizontal — penerimaan per bulan", fmt: rpRb,
         sub: "Pergerakan uang masuk antar bulan.",
         seri: seriBulan("masuk_rb", r => r.d2 === "Penerimaan") }
  }),
  biaya: () => ({
    v: { judul: "Analisa vertikal — biaya per kategori", labelKolom: "Kategori", fmt: rpRb,
         sub: "HPP dan Opex digabung; dipakai menilai apakah ada satu pos yang mendominasi.",
         baris: barisDari(grup("KATEGORI", "keluar_rb", r => r.d1, r => BIAYA.includes(r.d2) && cocok(r.d3))) },
    h: { judul: "Analisa horizontal — biaya per bulan", fmt: rpRb,
         sub: "Apakah biaya tumbuh lebih cepat daripada penerimaan.",
         seri: seriBulan("keluar_rb", r => BIAYA.includes(r.d2)) }
  }),
  rekening: () => ({
    v: { judul: "Analisa vertikal — mutasi keluar per rekening", labelKolom: "Rekening", fmt: rpRb,
         sub: "Rekening mana yang paling banyak dipakai membayar.",
         baris: barisDari(grup("AKUN", "keluar_rb", r => r.d1, r => cocok(r.d2))) },
    h: { judul: "Analisa horizontal — saldo gabungan per bulan", fmt: rpRb,
         sub: "Arah saldo seluruh rekening dari bulan ke bulan.",
         seri: urut(grup("SALDO", "saldo_rb", r => r.d2, r => cocok(r.d2)), false) }
  }),
  peta: () => ({
    v: { judul: "Analisa vertikal — baris per kelompok tujuan", labelKolom: "Dipetakan ke", fmt: v => A.fmt(v),
         sub: "Berapa banyak baris yang jatuh ke tiap kelompok — termasuk yang belum terklasifikasi.",
         baris: barisDari(grup("PETA", "baris", r => String(r.d2).split(" / ")[0] || "(tanpa tujuan)")) },
    h: { judul: "Analisa horizontal — arus keluar per bulan", fmt: rpRb,
         sub: "Pembanding volume, supaya jumlah label dibaca relatif terhadap besarnya arus.",
         seri: seriBulan("keluar_rb") }
  }),
  transaksi: () => {
    const perKat = {}, perBulan = {};
    KAS.forEach(r => {
      if (!detCocok(r[0])) return;
      const n = (+r[7] || 0) / 1000;
      if (n < 0) {
        const k = String(r[3] || "").trim() || "(tanpa kategori)";
        perKat[k] = (perKat[k] || 0) - n;
      }
      const ym = String(r[0]).slice(0,7);
      perBulan[ym] = (perBulan[ym] || 0) + n;
    });
    return {
      v: { judul: "Analisa vertikal — pengeluaran besar per kategori", labelKolom: "Kategori", fmt: rpRb,
           sub: "Hanya dari transaksi yang masuk daftar ini (≥ Rp 5 juta dan baris bermasalah).",
           baris: barisDari(perKat) },
      h: { judul: "Analisa horizontal — nilai bersih transaksi besar per bulan", fmt: rpRb,
           sub: "Masuk dikurangi keluar dari transaksi besar saja.",
           seri: urut(perBulan, false) }
    };
  }
};

function konteksAI() {
  const def = VHDEF[HAL] ? VHDEF[HAL]() : null;
  const nama = (HALAMAN.find(h => h[0] === HAL) || [, HAL])[1];
  return {
    judul: nama,
    data: {
      modul: "Finance / Cashflow",
      halaman: nama,
      filter: { tahun: FY, bulan: FM },
      catatan: "semua nilai dalam ribuan rupiah; patokan internal gaji <=15% dan sewa <=15% dari penerimaan",
      ringkas: {
        masuk_rb: Math.round(jml("BULAN", "masuk_rb", r => cocok(r.d1))),
        keluar_rb: Math.round(jml("BULAN", "keluar_rb", r => cocok(r.d1))),
        penerimaan_rb: Math.round(jml("BULAN", "masuk_rb", r => r.d2 === "Penerimaan" && cocok(r.d1))),
        biaya_rb: Math.round(jml("BULAN", "keluar_rb", r => BIAYA.includes(r.d2) && cocok(r.d1)))
      },
      vertikal: def ? { judul: def.v.judul, baris: def.v.baris.slice(0,15).map(b => [b.label, Math.round(b.nilai)]) } : null,
      horizontal: def ? { judul: def.h.judul, seri: def.h.seri.map(([k,v]) => [k, Math.round(v)]) } : null
    }
  };
}

/* ---------- kerangka modul ---------- */
function gambar() {
  const def = VHDEF[HAL] ? VHDEF[HAL]() : null;
  const nama = (HALAMAN.find(h => h[0] === HAL) || [, HAL])[1];
  wadah.querySelector("#mod-isi").innerHTML = GAMBAR[HAL]()
    + (def ? A.duaAnalisa(def.v, def.h) : "")
    + A.kartuAI(HAL, "Analisa AI — " + nama,
        "Gemini membaca angka halaman ini beserta kedua tabel analisa di atas, lalu merangkum komposisi, pergerakan, dan tindakan yang perlu diambil.");
  A.pasangAI(wadah, A, () => konteksAI());
  wadah.querySelectorAll(".subtab button").forEach(b =>
    b.setAttribute("aria-selected", b.dataset.h === HAL ? "true" : "false"));
  Object.keys(DET).forEach(id => { if (document.getElementById(id)) gambarDetail(id); });
  A.setMeta(`Periode ${FM !== "all" ? labelYm(FM) : FY !== "all" ? "Tahun " + FY : (META.awal || "—") + " – " + (META.akhir || "—")}` +
            ` · ${A.fmt(META.baris || 0)} baris kas · diperbarui ${META.generated || "—"} WIB`);
}

function opsiFilter() {
  const yms = {};
  (F.BULAN || []).forEach(r => { if (r.d1) yms[r.d1] = 1; });
  const tahun = {}; Object.keys(yms).forEach(k => tahun[String(k).slice(0,4)] = 1);
  return { tahun: Object.keys(tahun).sort(), bulan: Object.keys(yms).sort() };
}

export function render(el, data, api) {
  A = api; wadah = el;
  F = {}; KAS = []; META = {};
  for (const d of data) {
    if (d.key === "finance.feed") {
      for (const r of (d.payload || [])) {
        (F[r[0]] = F[r[0]] || []).push({
          d1: String(r[1] ?? ""), d2: String(r[2] ?? ""), d3: String(r[3] ?? ""),
          d4: String(r[4] ?? ""), m: String(r[5] ?? ""), v: +r[6] || 0
        });
      }
    } else if (d.key === "finance.kas") KAS = d.payload || [];
  }
  (F.META || []).forEach(r => META[r.d1] = (r.m === "teks") ? r.d2 : r.v);

  const o = opsiFilter();
  el.innerHTML = `
    <div class="subtab" role="tablist">
      ${HALAMAN.map(h => `<button role="tab" data-h="${h[0]}" aria-selected="${h[0] === HAL}">${h[1]}</button>`).join("")}
    </div>
    <div class="modfilter">
      <label>Tahun<select id="c-year"><option value="all">Semua</option>${o.tahun.map(y => `<option value="${y}">${y}</option>`).join("")}</select></label>
      <label>Bulan<select id="c-month"><option value="all">Semua</option>${o.bulan.map(m => `<option value="${m}">${labelYm(m)}</option>`).join("")}</select></label>
      <button class="reset" id="c-reset" type="button">Reset</button>
    </div>
    <div id="mod-isi"></div>`;

  el.querySelectorAll(".subtab button").forEach(b =>
    b.addEventListener("click", () => { HAL = b.dataset.h; gambar(); }));
  el.querySelector("#c-year").addEventListener("change", e => { FY = e.target.value; sinkronBulan(el); gambar(); });
  el.querySelector("#c-month").addEventListener("change", e => { FM = e.target.value; gambar(); });
  el.querySelector("#c-reset").addEventListener("click", () => {
    FY = FM = "all";
    el.querySelector("#c-year").value = "all";
    el.querySelector("#c-month").value = "all";
    sinkronBulan(el); gambar();
  });
  el.addEventListener("click", ev => {
    const u = ev.target.closest(".det-unduh"); if (u) return csvDetail(u.dataset.id);
    const p = ev.target.closest(".det-prev");  if (p) { const d = DET[p.dataset.id]; if (d.hal > 0) { d.hal--; gambarDetail(p.dataset.id); } return; }
    const n = ev.target.closest(".det-next");  if (n) { const d = DET[n.dataset.id]; d.hal++; gambarDetail(n.dataset.id); }
  });
  el.addEventListener("input", ev => {
    const c = ev.target.closest(".det-cari");
    if (c) { const d = DET[c.dataset.id]; d.cari = c.value; d.hal = 0; gambarDetail(c.dataset.id); }
  });
  gambar();
}

function sinkronBulan(el) {
  const fm = el.querySelector("#c-month");
  Array.from(fm.options).forEach(o => {
    o.hidden = !(o.value === "all" || FY === "all" || String(o.value).slice(0,4) === FY);
  });
  if (FM !== "all" && FY !== "all" && String(FM).slice(0,4) !== FY) { FM = "all"; fm.value = "all"; }
}
