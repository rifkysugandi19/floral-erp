/* Modul Sales & Operasional — Portal Floral.id
   Dipanggil oleh index.html: render(wadah, data, API)
   data = baris module_data untuk modul_group 'sales'
          sales.feed    -> [blok, d1, d2, d3, d4, metrik, nilai]
          sales.antrian -> [no, tgl, plat, resi, eksp, deadline, telat, kelas, item, qty, nilai, rincian]
          sales.retur   -> [no, tgl, plat, resi, jenis, action, alasan, eksp, item, qty, nilai, rincian] */

let A, F = {}, ANTRIAN = [], RETUR = [], META = {};
let FY = "all", FM = "all", FP = "all", HAL = "ringkasan";
let wadah = null;

const HALAMAN = [
  ["ringkasan", "Ringkasan"],
  ["jual",      "Penjualan & Produk"],
  ["antrian",   "Antrian Kirim"],
  ["retur",     "Retur"],
  ["beban",     "Beban Harian"],
  ["data",      "Kualitas Data"]
];
const BLN = {"01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"Mei","06":"Jun",
             "07":"Jul","08":"Ags","09":"Sep","10":"Okt","11":"Nov","12":"Des"};
const HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const labelYm = s => (BLN[s.slice(5, 7)] || s.slice(5, 7)) + " " + s.slice(0, 4);
const tglPanjang = s => (String(s).length < 10) ? (s || "—")
  : parseInt(s.slice(8, 10), 10) + " " + (BLN[s.slice(5, 7)] || "") + " " + s.slice(0, 4);

/* ---------- query agregat ---------- */
const cocok = (ym, pl) =>
  (FY === "all" || ym.slice(0, 4) === FY) &&
  (FM === "all" || ym.slice(0, 7) === FM) &&
  (FP === "all" || pl === FP);

function jml(blok, metrik, pred) {
  let s = 0;
  for (const r of (F[blok] || [])) {
    if (r.m !== metrik) continue;
    if (pred && !pred(r)) continue;
    s += r.v;
  }
  return s;
}
const bul = m => jml("BULAN", m, r => cocok(r.d1, r.d2));
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
  .sort((a, b) => desc ? b[1] - a[1] : (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

/* ---------- filter baris detail ---------- */
function detCocok(tgl, plat) {
  const ym = String(tgl).slice(0, 7);
  return (FY === "all" || ym.slice(0, 4) === FY) &&
         (FM === "all" || ym === FM) &&
         (FP === "all" || plat === FP);
}

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
    r.forEach((c, i) => h += `<td${head[i] && head[i].n ? ' class="n"' : ""}>${c}</td>`);
    h += "</tr>";
  });
  if (foot) {
    h += "</tbody><tfoot><tr class='tot'>";
    foot.forEach((c, i) => h += `<td${head[i] && head[i].n ? ' class="n"' : ""}>${c}</td>`);
    h += "</tr></tfoot>";
  } else h += "</tbody>";
  return h + "</table></div>";
}

function bar(pasangan, uang) {
  let maks = 0;
  pasangan.forEach(p => { if (p[1] > maks) maks = p[1]; });
  if (!maks) maks = 1;
  let h = '<div class="tblwrap"><table><tbody>';
  pasangan.forEach(p => {
    h += `<tr><td style="max-width:360px">${A.esc(p[0])}</td>` +
         `<td style="width:46%"><div class="mbar"><span style="width:${(p[1] / maks * 100).toFixed(1)}%"></span></div></td>` +
         `<td class="n">${uang ? A.rp(p[1]) : A.fmt(p[1])}</td></tr>`;
  });
  return h + "</tbody></table></div>";
}

function tumpuk(bagian) {
  const tot = bagian.reduce((a, b) => a + b.v, 0);
  if (!tot) return '<div class="note">Tidak ada data pada filter ini.</div>';
  let h = '<div class="seg">';
  bagian.forEach(p => h += `<div style="width:${(p.v / tot * 100).toFixed(2)}%;background:${p.c}"></div>`);
  h += '</div><div class="legend">';
  bagian.forEach(p => h += `<span><i style="background:${p.c}"></i>${A.esc(p.l)} · ${A.fmt(p.v)} (${A.pct(p.v, tot)}%)</span>`);
  return h + "</div>";
}

function temuan(cls, judul, isi) {
  return `<div class="find ${cls}"><b>${A.esc(judul)}</b><p>${isi}</p></div>`;
}

/* ---------- tabel detail dengan cari, halaman, unduh ---------- */
const DET = {};
function tabelDetail(id, judul, sub, kolom, baris, namaFile) {
  DET[id] = { kolom, baris, namaFile, cari: "", hal: 0, buka: null };
  return `<div class="panel" id="${id}"><h3>${A.esc(judul)}</h3><p class="sub">${sub}</p>
    <div class="detbar">
      <input type="search" class="det-cari" data-id="${id}" placeholder="Cari nomor pesanan, resi, produk…">
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
function saringDetail(d) {
  const q = d.cari.trim().toLowerCase();
  if (!q) return d.baris;
  return d.baris.filter(r => r.some(c => String(c).toLowerCase().includes(q)));
}

function gambarDetail(id) {
  const d = DET[id];
  if (!d) return;
  const data = saringDetail(d);
  const maxHal = Math.max(0, Math.ceil(data.length / PER_HAL) - 1);
  if (d.hal > maxHal) d.hal = maxHal;
  const potong = data.slice(d.hal * PER_HAL, d.hal * PER_HAL + PER_HAL);

  let h = '<div class="tblwrap"><table><thead><tr><th></th>';
  d.kolom.forEach(c => h += `<th${c.n ? ' class="n"' : ""}>${A.esc(c.t)}</th>`);
  h += "</tr></thead><tbody>";
  potong.forEach((r, i) => {
    const idx = d.hal * PER_HAL + i;
    const rincian = r[r.length - 1];
    h += `<tr class="det-baris" data-id="${id}" data-i="${idx}">` +
         `<td class="det-tanda">${rincian ? "▸" : ""}</td>`;
    d.kolom.forEach((c, j) => {
      let v = r[c.i];
      if (c.f === "rp") v = A.rp(v);
      else if (c.f === "rp0") v = A.rp((+v || 0) / 1000);   // tabel detail menyimpan rupiah penuh
      else if (c.f === "n") v = A.fmt(v);
      else if (c.f === "tgl") v = tglPanjang(v);
      else if (c.f === "kelas") v = pilKelas(v);
      else v = A.esc(v == null ? "" : v);
      h += `<td${c.n ? ' class="n"' : ""}>${v}</td>`;
    });
    h += "</tr>";
    if (d.buka === idx && rincian) {
      h += `<tr class="det-rinci"><td></td><td colspan="${d.kolom.length}">` +
           String(rincian).split(" | ").map(x => `<span class="chip">${A.esc(x)}</span>`).join("") +
           "</td></tr>";
    }
  });
  h += "</tbody></table></div>";
  if (!data.length) h = '<div class="note">Tidak ada baris yang cocok.</div>';
  document.getElementById(id + "-isi").innerHTML = h;
  document.getElementById(id + "-info").textContent =
    A.fmt(data.length) + " baris" + (data.length > PER_HAL ? ` · halaman ${d.hal + 1} dari ${maxHal + 1}` : "");
}

function pilKelas(k) {
  if (k === "done_tapi_belum") return '<span class="pill p-ok">sudah terkirim?</span>';
  if (k === "tak_diketahui")   return '<span class="pill p-warn">perlu dicek</span>';
  if (k === "retur")           return '<span class="pill p-crit">retur</span>';
  if (k === "refund")          return '<span class="pill p-warn">refund</span>';
  return `<span class="pill p-mute">${A.esc(k)}</span>`;
}

function csvDetail(id) {
  const d = DET[id];
  const data = saringDetail(d);
  const esc = v => {
    const s = String(v == null ? "" : v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const baris = [d.kolom.map(c => esc(c.t)).join(";")];
  data.forEach(r => baris.push(d.kolom.map(c => esc(r[c.i])).join(";")));
  const blob = new Blob(["﻿" + baris.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = d.namaFile + "-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- halaman ---------- */

function pRingkasan() {
  const gmv = bul("gmv_rb"), orders = bul("orders"), items = bul("items");
  const retur = bul("retur"), refund = bul("refund"), cancel = bul("cancel");
  const returRp = bul("retur_rb") + bul("refund_rb");
  const antrian = bul("antrian_tak_diketahui") + bul("antrian_perlu_kirim");
  const od = bul("overdue_nyata"), odRp = bul("overdue_nyata_rb");

  const perBulan = grup("BULAN", "gmv_rb", r => r.d1, r => cocok(r.d1, r.d2));
  const bulanUrut = urut(perBulan, false);
  const ordB = grup("BULAN", "orders", r => r.d1, r => cocok(r.d1, r.d2));

  return `<div class="kpis">
      ${kpi("Nilai penjualan", A.rp(gmv), A.fmt(orders) + " pesanan")}
      ${kpi("Rata-rata per pesanan", A.rp(gmv / (orders || 1)), A.fmt(items) + " item")}
      ${kpi("Perlu dicek & dikirim", A.fmt(antrian), "pesanan belum tercatat terkirim", antrian ? "warn" : "")}
      ${kpi("Lewat deadline", A.fmt(od), A.rp(odRp) + " tertahan", od ? "bad" : "")}
      ${kpi("Pesanan bermasalah", A.fmt(retur + refund + cancel), A.pct(retur + refund + cancel, orders) + "% dari pesanan", "warn")}
      ${kpi("Nilai retur & refund", A.rp(returRp), "potensi hilang", returRp ? "bad" : "")}
    </div>
    <div class="panel"><h3>Tren bulanan</h3>
      <p class="sub">Nilai penjualan per bulan order. Angka mengikuti filter di atas.</p>
      ${bulanUrut.length ? bar(bulanUrut.map(p => [labelYm(p[0]), p[1]]), true) : '<div class="note">Tidak ada data.</div>'}
    </div>
    <div class="grid2">
      <div class="panel"><h3>Per bulan</h3><p class="sub">Pesanan, nilai, dan rata-rata.</p>
        ${tabel([{ t: "Bulan" }, { t: "Pesanan", n: 1 }, { t: "Nilai", n: 1 }, { t: "Rata-rata", n: 1 }],
          bulanUrut.map(p => [labelYm(p[0]), A.fmt(ordB[p[0]] || 0), A.rp(p[1]),
            A.rp(p[1] / (ordB[p[0]] || 1))]),
          ["Total", A.fmt(orders), A.rp(gmv), A.rp(gmv / (orders || 1))])}
      </div>
      <div class="panel"><h3>Per platform</h3><p class="sub">Filter platform tidak dipakai di panel ini supaya keduanya bisa dibandingkan.</p>
        ${tabel([{ t: "Platform" }, { t: "Pesanan", n: 1 }, { t: "Nilai", n: 1 }, { t: "Retur", n: 1 }],
          ["shopee", "tiktok"].map(pl => {
            const f = r => r.d2 === pl && (FY === "all" || r.d1.slice(0, 4) === FY) && (FM === "all" || r.d1 === FM);
            return [pl === "tiktok" ? "TikTok" : "Shopee",
              A.fmt(jml("BULAN", "orders", f)), A.rp(jml("BULAN", "gmv_rb", f)), A.fmt(jml("BULAN", "retur", f))];
          }))}
      </div>
    </div>`;
}

function pJual() {
  const prod = urut(grup("PRODUK", "gmv_rb", r => r.d1, r => FP === "all" || r.d2 === FP), true);
  const prodQty = grup("PRODUK", "qty", r => r.d1, r => FP === "all" || r.d2 === FP);
  const prodRet = grup("PRODUK", "retur_qty", r => r.d1, r => FP === "all" || r.d2 === FP);
  const sku = urut(grup("SKU", "gmv_rb", r => r.d1, r => FP === "all" || r.d2 === FP), true);
  const skuQty = grup("SKU", "qty", r => r.d1, r => FP === "all" || r.d2 === FP);
  const kat = urut(grup("KATEGORI", "gmv_rb", r => r.d1, r => cocok(r.d3, r.d2)), true);
  const totKat = kat.reduce((a, b) => a + b[1], 0);

  const top10 = prod.slice(0, 10).reduce((a, b) => a + b[1], 0);
  const totProd = prod.reduce((a, b) => a + b[1], 0);

  return `<div class="kpis">
      ${kpi("Produk terlaris", prod.length ? A.rp(prod[0][1]) : "—", prod.length ? prod[0][0].slice(0, 46) : "")}
      ${kpi("Konsentrasi 10 teratas", A.pct(top10, totProd) + "%", "dari nilai penjualan", A.pct(top10, totProd) > 50 ? "warn" : "")}
      ${kpi("Jenis produk terpantau", A.fmt(prod.length), "150 teratas + sisanya digabung")}
      ${kpi("Kategori terbesar", kat.length ? kat[0][0] : "—", kat.length ? A.pct(kat[0][1], totKat) + "% dari nilai" : "")}
    </div>
    <div class="panel"><h3>Kategori</h3>
      <p class="sub">Kategori ditebak dari nama produk, bukan kolom resmi — perlakukan sebagai ancar-ancar.</p>
      ${kat.length ? bar(kat, true) : '<div class="note">Tidak ada data.</div>'}
    </div>
    <div class="panel"><h3>Produk paling laku</h3>
      <p class="sub">Urut nilai penjualan. Kolom retur memakai data silang-cek dari database retur, bukan kolom status.</p>
      ${prod.length ? tabel([{ t: "Produk" }, { t: "Qty", n: 1 }, { t: "Nilai", n: 1 }, { t: "Retur (qty)", n: 1 }, { t: "% retur", n: 1 }],
        prod.slice(0, 40).map(p => [A.esc(p[0]), A.fmt(prodQty[p[0]] || 0), A.rp(p[1]),
          A.fmt(prodRet[p[0]] || 0), A.pct(prodRet[p[0]] || 0, prodQty[p[0]] || 0) + "%"]))
        : '<div class="note">Tidak ada data.</div>'}
    </div>
    <div class="panel"><h3>SKU paling laku</h3><p class="sub">Dipakai saat pengambilan barang di rak.</p>
      ${sku.length ? tabel([{ t: "SKU" }, { t: "Qty", n: 1 }, { t: "Nilai", n: 1 }],
        sku.slice(0, 40).map(p => [A.esc(p[0]), A.fmt(skuQty[p[0]] || 0), A.rp(p[1])]))
        : '<div class="note">Tidak ada data.</div>'}
    </div>`;
}

function pAntrian() {
  const baris = ANTRIAN.filter(r => detCocok(r[1], r[2]));
  const nyata = baris.filter(r => r[7] !== "done_tapi_belum");
  const telat = nyata.filter(r => (+r[6] || 0) > 0);
  const nilaiTelat = telat.reduce((a, r) => a + (+r[10] || 0), 0) / 1000;
  const lama = nyata.filter(r => (+r[6] || 0) > 30);

  const EMBER = [["Belum jatuh tempo", r => (+r[6] || 0) <= 0, "var(--ok)"],
                 ["Telat 1–7 hari",  r => (+r[6] || 0) > 0 && +r[6] <= 7, "var(--warn)"],
                 ["Telat 8–14 hari", r => +r[6] > 7 && +r[6] <= 14, "var(--warn)"],
                 ["Telat 15–30 hari",r => +r[6] > 14 && +r[6] <= 30, "var(--crit)"],
                 ["Telat >30 hari",  r => +r[6] > 30, "var(--crit)"]];

  const kolom = [
    { t: "No pesanan", i: 0 }, { t: "Tanggal", i: 1, f: "tgl" }, { t: "Platform", i: 2 },
    { t: "No resi", i: 3 }, { t: "Ekspedisi", i: 4 }, { t: "Deadline", i: 5 },
    { t: "Telat", i: 6, n: 1, f: "n" }, { t: "Status", i: 7, f: "kelas" },
    { t: "Qty", i: 9, n: 1, f: "n" }, { t: "Nilai", i: 10, n: 1, f: "rp0" }
  ];

  return `<div class="kpis">
      ${kpi("Perlu dicek", A.fmt(nyata.length), "status marketplace masih ???")}
      ${kpi("Lewat deadline", A.fmt(telat.length), A.rp(nilaiTelat) + " tertahan", telat.length ? "bad" : "")}
      ${kpi("Menunggak >30 hari", A.fmt(lama.length), A.pct(lama.length, nyata.length) + "% dari antrian", lama.length ? "bad" : "")}
      ${kpi("Kemungkinan sudah terkirim", A.fmt(baris.length - nyata.length), "status marketplace sudah done", "good")}
    </div>
    <div class="panel"><h3>Isi antrian sebenarnya</h3>
      <p class="sub">Kolom <i>status pengiriman</i> bilang belum dikirim. Kolom <i>status</i> dari marketplace sering bilang sebaliknya. Pisahkan dulu sebelum dikerjakan.</p>
      ${tumpuk([{ l: "Perlu dicek", v: nyata.length, c: "var(--warn)" },
                { l: "Kemungkinan sudah terkirim", v: baris.length - nyata.length, c: "var(--ok)" }])}
      <div class="note" style="margin-top:14px">Daftar kerja yang masuk akal adalah <b>${A.fmt(nyata.length)} pesanan</b>, bukan ${A.fmt(baris.length)}. Sisanya sudah <i>done</i> di marketplace — itu pekerjaan pencatatan, bukan pekerjaan gudang.</div>
    </div>
    <div class="panel"><h3>Umur keterlambatan</h3><p class="sub">Hanya antrian yang perlu dicek.</p>
      ${tumpuk(EMBER.map(e => ({ l: e[0], v: nyata.filter(e[1]).length, c: e[2] })))}
      <div style="margin-top:14px">${tabel([{ t: "Kelompok umur" }, { t: "Pesanan", n: 1 }, { t: "%", n: 1 }, { t: "Nilai", n: 1 }],
        EMBER.map(e => {
          const s = nyata.filter(e[1]);
          return [e[0], A.fmt(s.length), A.pct(s.length, nyata.length) + "%",
            A.rp(s.reduce((a, r) => a + (+r[10] || 0), 0) / 1000)];
        }))}</div>
    </div>
    ${tabelDetail("det-antrian", "Daftar pesanan yang harus dikejar",
      "Diurut dari yang paling telat. Klik satu baris untuk melihat isi pesanannya.",
      kolom, nyata, "antrian-kirim-floralid")}`;
}

function pRetur() {
  const baris = RETUR.filter(r => detCocok(r[1], r[2]));
  const nilai = baris.reduce((a, r) => a + (+r[10] || 0), 0) / 1000;
  const qty = baris.reduce((a, r) => a + (+r[9] || 0), 0);
  const jenis = {};
  baris.forEach(r => jenis[r[4]] = (jenis[r[4]] || 0) + 1);
  const alasan = {};
  baris.forEach(r => { const a2 = (r[6] || "(tidak diisi)").trim() || "(tidak diisi)"; alasan[a2] = (alasan[a2] || 0) + 1; });
  const gmv = bul("gmv_rb");

  const kolom = [
    { t: "No pesanan", i: 0 }, { t: "Tanggal", i: 1, f: "tgl" }, { t: "Platform", i: 2 },
    { t: "No resi", i: 3 }, { t: "Jenis", i: 4, f: "kelas" }, { t: "Alasan", i: 6 },
    { t: "Ekspedisi", i: 7 }, { t: "Qty", i: 9, n: 1, f: "n" }, { t: "Nilai", i: 10, n: 1, f: "rp0" }
  ];

  return `<div class="kpis">
      ${kpi("Potensi hilang", A.rp(nilai), A.fmt(baris.length) + " pesanan kembali", nilai ? "bad" : "")}
      ${kpi("Potongan dari penjualan", A.pct(nilai, gmv) + "%", "dari nilai penjualan periode ini", "warn")}
      ${kpi("Barang kembali", A.fmt(qty), "potong")}
      ${kpi("Rata-rata per retur", A.rp(nilai / (baris.length || 1)), "nilai order")}
    </div>
    <div class="grid2">
      <div class="panel"><h3>Jenis</h3><p class="sub">Dari kolom <i>action plan</i> di database retur.</p>
        ${bar(urut(jenis, true))}</div>
      <div class="panel"><h3>Alasan pengembalian</h3><p class="sub">10 terbanyak. Teks bebas, jadi variasinya banyak.</p>
        ${bar(urut(alasan, true).slice(0, 10))}</div>
    </div>
    ${tabelDetail("det-retur", "Daftar retur",
      "Diurut dari yang terbaru. Klik satu baris untuk melihat isi pesanannya.",
      kolom, baris, "retur-floralid")}`;
}

function pBeban() {
  const pred = r => {
    const ym = r.d1.slice(0, 7);
    return (FY === "all" || r.d1.slice(0, 4) === FY) &&
           (FM === "all" || ym === FM) &&
           (FP === "all" || r.d2 === FP);
  };
  const perHari = grup("HARIAN", "orders", r => r.d1, pred);
  const perItem = grup("HARIAN", "items", r => r.d1, pred);
  const hari = urut(perHari, false);
  let totO = 0, puncak = ["", 0];
  hari.forEach(p => { totO += p[1]; if (p[1] > puncak[1]) puncak = p; });
  const totI = Object.values(perItem).reduce((a, b) => a + b, 0);
  const rata = hari.length ? totO / hari.length : 0;

  const dow = {};
  Object.keys(perHari).forEach(d => {
    const k = new Date(d + "T00:00:00").getDay() || 7;
    (dow[k] = dow[k] || { n: 0, h: 0 }).n += perHari[d];
    dow[k].h++;
  });
  const dowPair = [];
  for (let k = 1; k <= 7; k++) if (dow[k]) dowPair.push([HARI[k], Math.round(dow[k].n / dow[k].h)]);

  const W = 820, H = 170, pad = 28;
  let maks = 1; hari.forEach(p => { if (p[1] > maks) maks = p[1]; });
  const bw = hari.length ? (W - pad * 2) / hari.length : 1;
  const batang = hari.map((p, i) => {
    const t = (p[1] / maks) * (H - 40);
    return `<rect x="${(pad + i * bw).toFixed(1)}" y="${(H - 20 - t).toFixed(1)}" width="${Math.max(bw - 1, .6).toFixed(2)}" height="${t.toFixed(1)}" fill="var(--brand)" rx="1"><title>${A.esc(p[0])}: ${A.fmt(p[1])} pesanan</title></rect>`;
  }).join("");

  return `<div class="kpis">
      ${kpi("Rata-rata per hari", A.fmt(rata), "pesanan masuk")}
      ${kpi("Hari tersibuk", A.fmt(puncak[1]), puncak[0] ? tglPanjang(puncak[0]) : "—", "warn")}
      ${kpi("Total pesanan", A.fmt(totO), hari.length + " hari aktif")}
      ${kpi("Item per pesanan", (totO ? totI / totO : 0).toFixed(2).replace(".", ","), "rata-rata baris barang")}
    </div>
    <div class="panel"><h3>Pesanan masuk per hari</h3>
      <p class="sub">Dipakai mengatur shift packing. Arahkan kursor ke batang untuk melihat tanggalnya.</p>
      <div class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Grafik pesanan per hari">
        <text x="${pad}" y="14">maks ${A.fmt(maks)}</text>${batang}</svg></div>
    </div>
    <div class="grid2">
      <div class="panel"><h3>Rata-rata per hari dalam minggu</h3><p class="sub">Rata-rata, bukan total.</p>
        ${dowPair.length ? bar(dowPair) : '<div class="note">Tidak ada data.</div>'}</div>
      <div class="panel"><h3>10 hari tersibuk</h3><p class="sub">Puncak beban yang harus diantisipasi kapasitas packing.</p>
        ${tabel([{ t: "Tanggal" }, { t: "Hari" }, { t: "Pesanan", n: 1 }, { t: "Item", n: 1 }],
          urut(perHari, true).slice(0, 10).map(p => [tglPanjang(p[0]),
            HARI[new Date(p[0] + "T00:00:00").getDay() || 7], A.fmt(p[1]), A.fmt(perItem[p[0]] || 0)]))}</div>
    </div>`;
}

function pData() {
  const q = k => jml("KUALITAS", "orders", r => r.d1 === k);
  const qr = k => jml("KUALITAS", "gmv_rb", r => r.d1 === k);
  const orders = META.orders || 0;
  const ITEM = [
    ["status_kosong", "Status marketplace kosong / ???", "crit", "Ini yang membuat antrian tidak bisa dipastikan."],
    ["done_belum_kirim", "Status done tapi pengiriman belum", "crit", "Dua kolom bertentangan. Hampir pasti sudah terkirim, catatannya tertinggal."],
    ["retur_tercatat_terkirim", "Retur tapi tercatat terkirim", "crit", "Ada di database retur, tapi Database Order bilang sudah sampai."],
    ["settle_nol", "Settlement nol atau kosong", "warn", "Tidak bisa dipakai merekonsiliasi uang masuk."],
    ["sku_kosong_antrian", "Baris antrian tanpa SKU", "warn", "Barang tidak bisa dicari di rak."],
    ["deadline_invalid", "Deadline kirim tidak valid", "warn", "Kosong, #REF!, atau bertahun 1899."],
    ["settle_negatif", "Settlement negatif", "info", "Umumnya potongan refund."],
    ["settle_lebih", "Settlement melebihi nilai order", "info", "Perlu dicek: salah tempel atau pembayaran gabungan."]
  ];
  const kritis = q("status_kosong") + q("done_belum_kirim") + q("retur_tercatat_terkirim");

  return `<div class="kpis">
      ${kpi("Pesanan terpantau", A.fmt(orders), "Jan 2025 – " + tglPanjang(META.cutoff))}
      ${kpi("Masalah kritis", A.fmt(kritis), "menghalangi pemantauan operasional", "bad")}
      ${kpi("Status kosong", A.fmt(q("status_kosong")), A.pct(q("status_kosong"), orders) + "% dari pesanan", "warn")}
      ${kpi("Resi di database retur", A.fmt(META.retur_resi || 0), "dipakai menimpa kolom status")}
    </div>
    <div class="panel"><h3>Temuan kualitas data</h3>
      <p class="sub">Dihitung di tingkat pesanan atas seluruh periode. Filter tidak berlaku di halaman ini.</p>
      ${tabel([{ t: "Temuan" }, { t: "Pesanan", n: 1 }, { t: "% order", n: 1 }, { t: "Nilai", n: 1 }],
        ITEM.map(it => [
          `<span class="pill ${it[2] === "crit" ? "p-crit" : it[2] === "warn" ? "p-warn" : "p-mute"}">` +
          (it[2] === "crit" ? "Kritis" : it[2] === "warn" ? "Perhatian" : "Catatan") + "</span> " + A.esc(it[1]),
          A.fmt(q(it[0])), A.pct(q(it[0]), orders) + "%", qr(it[0]) ? A.rp(qr(it[0])) : "—"]))}
    </div>
    <div class="panel"><h3>Urutan perbaikan</h3><p class="sub">Menentukan apakah angka di halaman lain bisa dipercaya.</p>
      <div class="stack">
        ${temuan("crit", "Tutup tunggakan status dulu, jangan pasang KPI dulu",
          `Selama ${A.fmt(q("status_kosong"))} pesanan masih berstatus <i>???</i>, KPI ketepatan kirim akan menghasilkan angka buruk yang tidak bisa diperbaiki siapa pun. Impor status dari marketplace lebih dulu.`)}
        ${temuan("warn", "Satukan pencatatan retur",
          `${A.fmt(q("retur_tercatat_terkirim"))} pesanan ada di database retur tapi Database Order bilang terkirim. Selama dua file ini terpisah, angka retur akan selalu bergantung pada file mana yang dibaca.`)}
        ${temuan("info", "Baru setelah itu angkanya layak dipakai menilai orang",
          "Sebelum itu, pakai modul ini untuk melihat beban dan menyiapkan barang — bukan untuk menilai kinerja.")}
      </div>
    </div>`;
}

const GAMBAR = { ringkasan: pRingkasan, jual: pJual, antrian: pAntrian, retur: pRetur, beban: pBeban, data: pData };

/* ---------- analisa vertikal & horizontal (bentuknya sama di semua halaman) ---------- */
const rpRb = v => A.rp(v);
const barisDari = peta => urut(peta, true).map(([label, nilai]) => ({ label, nilai }));
const seriBulan = metrik => urut(grup("BULAN", metrik, r => r.d1, r => cocok(r.d1, r.d2)), false);

function hitungDetail(sumber, iTgl, iPlat, iKunci, iNilai) {
  const peta = {};
  for (const r of sumber) {
    if (!detCocok(r[iTgl], r[iPlat])) continue;
    const k = String(r[iKunci] || "").trim() || "(tidak diisi)";
    peta[k] = (peta[k] || 0) + (iNilai == null ? 1 : (+r[iNilai] || 0));
  }
  return peta;
}

const VHDEF = {
  ringkasan: () => ({
    v: { judul: "Analisa vertikal — GMV per platform", labelKolom: "Platform", fmt: rpRb,
         sub: "Porsi tiap platform terhadap total GMV pada periode yang difilter.",
         baris: barisDari(grup("BULAN", "gmv_rb", r => r.d2, r => cocok(r.d1, r.d2))) },
    h: { judul: "Analisa horizontal — GMV per bulan", fmt: rpRb,
         sub: "Pergerakan GMV antar bulan, termasuk perbandingan dengan bulan yang sama tahun lalu.",
         seri: seriBulan("gmv_rb") }
  }),
  jual: () => ({
    v: { judul: "Analisa vertikal — GMV per kategori", labelKolom: "Kategori", fmt: rpRb,
         sub: "Kategori mana yang menopang penjualan, dan seberapa terkonsentrasi.",
         baris: barisDari(grup("KATEGORI", "gmv_rb", r => r.d1, r => cocok(r.d3, r.d2))) },
    h: { judul: "Analisa horizontal — jumlah pesanan per bulan", fmt: v => A.fmt(v),
         sub: "Volume pesanan antar bulan — dipakai untuk melihat apakah GMV naik karena harga atau karena jumlah.",
         seri: seriBulan("orders") }
  }),
  antrian: () => ({
    v: { judul: "Analisa vertikal — antrian per kelas status", labelKolom: "Kelas", fmt: v => A.fmt(v),
         sub: "Komposisi pesanan yang masih nyangkut di antrian kirim.",
         baris: barisDari(hitungDetail(ANTRIAN, 1, 2, 7, null)) },
    h: { judul: "Analisa horizontal — pesanan per bulan", fmt: v => A.fmt(v),
         sub: "Beban pesanan yang masuk tiap bulan, sebagai pembanding besarnya antrian.",
         seri: seriBulan("orders") }
  }),
  retur: () => ({
    v: { judul: "Analisa vertikal — nilai retur per alasan", labelKolom: "Alasan retur", fmt: v => A.rp(v / 1000),
         sub: "Alasan mana yang paling mahal, bukan sekadar paling sering.",
         baris: barisDari(hitungDetail(RETUR, 1, 2, 6, 10)) },
    h: { judul: "Analisa horizontal — jumlah retur per bulan", fmt: v => A.fmt(v),
         sub: "Apakah retur membaik atau memburuk dari bulan ke bulan.",
         seri: seriBulan("retur") }
  }),
  beban: () => ({
    v: { judul: "Analisa vertikal — pesanan per hari", labelKolom: "Hari", fmt: v => A.fmt(v),
         sub: "Sebaran beban kerja gudang sepanjang minggu.",
         baris: barisDari(grup("HARIAN", "orders",
           r => HARI[new Date(r.d1 + "T00:00:00").getDay() || 7] || r.d1,
           r => {
             const ym = r.d1.slice(0, 7);
             return (FY === "all" || r.d1.slice(0, 4) === FY) &&
                    (FM === "all" || ym === FM) &&
                    (FP === "all" || r.d2 === FP);
           })) },
    h: { judul: "Analisa horizontal — pesanan per bulan", fmt: v => A.fmt(v),
         sub: "Tren beban bulanan yang harus ditanggung tim packing.",
         seri: seriBulan("orders") }
  }),
  data: () => ({
    v: { judul: "Analisa vertikal — temuan kualitas data", labelKolom: "Jenis temuan", fmt: v => A.fmt(v),
         sub: "Jenis masalah data mana yang paling banyak menyentuh pesanan.",
         baris: barisDari(grup("KUALITAS", "orders", r => r.d1)) },
    h: { judul: "Analisa horizontal — pesanan per bulan", fmt: v => A.fmt(v),
         sub: "Pembanding volume, supaya jumlah temuan dibaca relatif terhadap besarnya data.",
         seri: seriBulan("orders") }
  })
};

function konteksAI() {
  const def = VHDEF[HAL] ? VHDEF[HAL]() : null;
  const nama = (HALAMAN.find(h => h[0] === HAL) || [, HAL])[1];
  return {
    judul: nama,
    data: {
      modul: "Sales & Operasional",
      halaman: nama,
      filter: { tahun: FY, bulan: FM, platform: FP },
      catatan: "nilai berakhiran _rb dalam ribuan rupiah",
      ringkas: { pesanan: bul("orders"), gmv_rb: bul("gmv_rb"), retur: bul("retur") },
      vertikal: def ? { judul: def.v.judul, baris: def.v.baris.slice(0, 15).map(b => [b.label, Math.round(b.nilai)]) } : null,
      horizontal: def ? { judul: def.h.judul, seri: def.h.seri.map(([k, v]) => [k, Math.round(v)]) } : null
    }
  };
}

/* ---------- kerangka modul ---------- */
function gambar() {
  const def = VHDEF[HAL] ? VHDEF[HAL]() : null;
  const nama = (HALAMAN.find(h => h[0] === HAL) || [, HAL])[1];
  const isi = GAMBAR[HAL]()
    + (def ? A.duaAnalisa(def.v, def.h) : "")
    + A.kartuAI(HAL, "Analisa AI — " + nama,
        "Gemini membaca angka halaman ini beserta kedua tabel analisa di atas, lalu merangkum komposisi, pergerakan, dan tindakan yang perlu diambil.");
  wadah.querySelector("#mod-isi").innerHTML = isi;
  A.pasangAI(wadah, A, () => konteksAI());
  wadah.querySelectorAll(".subtab button").forEach(b =>
    b.setAttribute("aria-selected", b.dataset.h === HAL ? "true" : "false"));
  Object.keys(DET).forEach(id => { if (document.getElementById(id)) gambarDetail(id); });
  A.setMeta(`Periode ${FM !== "all" ? labelYm(FM) : FY !== "all" ? "Tahun " + FY : "Jan 2025 – " + tglPanjang(META.cutoff)}` +
            ` · ${A.fmt(bul("orders"))} pesanan terpilih · diperbarui ${META.generated || "—"} WIB`);
}

function opsiFilter() {
  const yms = {}, plats = {};
  (F.BULAN || []).forEach(r => { if (r.d1) yms[r.d1] = 1; if (r.d2) plats[r.d2] = 1; });
  const tahun = {}; Object.keys(yms).forEach(k => tahun[k.slice(0, 4)] = 1);
  return {
    tahun: Object.keys(tahun).sort(),
    bulan: Object.keys(yms).sort(),
    plat: Object.keys(plats).sort()
  };
}

export function render(el, data, api) {
  A = api; wadah = el;
  F = {}; ANTRIAN = []; RETUR = []; META = {};

  for (const d of data) {
    if (d.key === "sales.feed") {
      for (const r of (d.payload || [])) {
        (F[r[0]] = F[r[0]] || []).push({
          d1: String(r[1] ?? ""), d2: String(r[2] ?? ""), d3: String(r[3] ?? ""),
          d4: String(r[4] ?? ""), m: String(r[5] ?? ""), v: +r[6] || 0
        });
      }
    } else if (d.key === "sales.antrian") ANTRIAN = d.payload || [];
    else if (d.key === "sales.retur")     RETUR = d.payload || [];
  }
  (F.META || []).forEach(r => META[r.d1] = (r.m === "teks") ? r.d2 : r.v);

  const o = opsiFilter();
  el.innerHTML = `
    <div class="subtab" role="tablist">
      ${HALAMAN.map(h => `<button role="tab" data-h="${h[0]}" aria-selected="${h[0] === HAL}">${h[1]}</button>`).join("")}
    </div>
    <div class="modfilter">
      <label>Tahun<select id="s-year"><option value="all">Semua</option>${o.tahun.map(y => `<option value="${y}">${y}</option>`).join("")}</select></label>
      <label>Bulan<select id="s-month"><option value="all">Semua</option>${o.bulan.map(m => `<option value="${m}">${labelYm(m)}</option>`).join("")}</select></label>
      <label>Platform<select id="s-plat"><option value="all">Semua</option>${o.plat.map(p => `<option value="${p}">${p === "tiktok" ? "TikTok" : p === "shopee" ? "Shopee" : p}</option>`).join("")}</select></label>
      <button class="reset" id="s-reset" type="button">Reset</button>
    </div>
    <div id="mod-isi"></div>`;

  el.querySelectorAll(".subtab button").forEach(b =>
    b.addEventListener("click", () => { HAL = b.dataset.h; gambar(); }));
  el.querySelector("#s-year").addEventListener("change", e => { FY = e.target.value; sinkronBulan(el); gambar(); });
  el.querySelector("#s-month").addEventListener("change", e => { FM = e.target.value; gambar(); });
  el.querySelector("#s-plat").addEventListener("change", e => { FP = e.target.value; gambar(); });
  el.querySelector("#s-reset").addEventListener("click", () => {
    FY = FM = FP = "all";
    el.querySelector("#s-year").value = "all";
    el.querySelector("#s-month").value = "all";
    el.querySelector("#s-plat").value = "all";
    sinkronBulan(el); gambar();
  });

  el.addEventListener("click", ev => {
    const u = ev.target.closest(".det-unduh");   if (u) return csvDetail(u.dataset.id);
    const p = ev.target.closest(".det-prev");    if (p) { const d = DET[p.dataset.id]; if (d.hal > 0) { d.hal--; gambarDetail(p.dataset.id); } return; }
    const n = ev.target.closest(".det-next");    if (n) { const d = DET[n.dataset.id]; d.hal++; gambarDetail(n.dataset.id); return; }
    const b = ev.target.closest(".det-baris");
    if (b) { const d = DET[b.dataset.id]; const i = +b.dataset.i; d.buka = (d.buka === i) ? null : i; gambarDetail(b.dataset.id); }
  });
  el.addEventListener("input", ev => {
    const c = ev.target.closest(".det-cari");
    if (c) { const d = DET[c.dataset.id]; d.cari = c.value; d.hal = 0; d.buka = null; gambarDetail(c.dataset.id); }
  });

  gambar();
}

function sinkronBulan(el) {
  const fm = el.querySelector("#s-month");
  Array.from(fm.options).forEach(o => {
    o.hidden = !(o.value === "all" || FY === "all" || o.value.slice(0, 4) === FY);
  });
  if (FM !== "all" && FY !== "all" && FM.slice(0, 4) !== FY) { FM = "all"; fm.value = "all"; }
}
