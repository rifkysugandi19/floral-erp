/* Modul Marketing & Event — Portal Floral.id
   data = baris module_data untuk modul_group 'event'
     event.feed   -> [blok, d1, d2, d3, d4, metrik, nilai]   (uang dalam ribu rupiah)
     event.detail -> [event_id, nama, penyelenggara, lokasi, kota, mulai, selesai,
                      durasi, hari berdata, total(Rp), rata2/hari(Rp), tertinggi(Rp),
                      terendah(Rp), total file asli(Rp), selisih(Rp)]
     event.hari   -> [tanggal, event_id, nama, penyelenggara, kota, hari ke,
                      nama hari, tipe hari, pendapatan(Rp), status]
   Catatan: file sumber hanya memuat OMSET. Biaya event belum ada, jadi halaman ini
   bukan laba kontribusi. */

let A, F = {}, EVENT = [], HARI = [], META = {};
let FY = "all", FM = "all", HAL = "ringkasan";
let wadah = null;

const HALAMAN = [
  ["ringkasan", "Ringkasan"],
  ["eo",        "Penyelenggara & Kota"],
  ["kurva",     "Kurva Hari"],
  ["daftar",    "Daftar Event"],
  ["harian",    "Rincian Harian"],
  ["data",      "Kualitas Data"]
];
const BLN = {"01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"Mei","06":"Jun",
             "07":"Jul","08":"Ags","09":"Sep","10":"Okt","11":"Nov","12":"Des"};
const labelYm = s => (BLN[String(s).slice(5,7)] || String(s).slice(5,7)) + " " + String(s).slice(0,4);
const tglPanjang = s => (String(s).length < 10) ? (s || "—")
  : parseInt(String(s).slice(8,10),10) + " " + (BLN[String(s).slice(5,7)] || "") + " " + String(s).slice(0,4);

const cocok = ym => (FY === "all" || String(ym).slice(0,4) === FY) &&
                    (FM === "all" || String(ym).slice(0,7) === FM);
const detCocok = tgl => cocok(String(tgl).slice(0,7));

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
const urutAngka = peta => Object.entries(peta).sort((a,b) => (+a[0]||0) - (+b[0]||0));

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
      <input type="search" class="det-cari" data-id="${id}" placeholder="Cari nama event, penyelenggara, kota…">
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
      if (c.f === "rp0") v = A.rp((+v||0)/1000);
      else if (c.f === "sel") {
        const n = +v || 0;
        v = n ? `<span class="pill p-crit">${A.rp(n/1000)}</span>` : '<span class="pill p-ok">cocok</span>';
      }
      else if (c.f === "tgl") v = tglPanjang(v);
      else if (c.f === "n") v = A.fmt(v);
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
  const pendapatan = jml("BULAN", "pendapatan_rb", r => cocok(r.d1));
  const hari = jml("BULAN", "hari", r => cocok(r.d1));
  const perBulan = grup("BULAN", "pendapatan_rb", r => r.d1, r => cocok(r.d1));
  const hariBulan = grup("BULAN", "hari", r => r.d1, r => cocok(r.d1));
  const ev = EVENT.filter(r => detCocok(r[5]));
  const tipeP = grup("TIPE", "pendapatan_rb", r => r.d1);
  const tipeH = grup("TIPE", "hari", r => r.d1);
  const wd = tipeH["Weekday"] ? tipeP["Weekday"] / tipeH["Weekday"] : 0;
  const we = tipeH["Weekend"] ? tipeP["Weekend"] / tipeH["Weekend"] : 0;

  return `<div class="kpis">
      ${kpi("Omset event", A.rp(pendapatan), A.fmt(hari) + " hari jualan")}
      ${kpi("Rata-rata per hari", A.rp(hari ? pendapatan / hari : 0), "seluruh hari jualan")}
      ${kpi("Jumlah event", A.fmt(ev.length), "event yang mulai pada periode ini")}
      ${kpi("Weekend vs weekday", we && wd ? (we > wd ? "+" : "") + Math.round((we/wd - 1) * 100) + "%" : "—",
            we && wd ? A.rp(we) + " vs " + A.rp(wd) + " per hari" : "", we > wd ? "good" : "")}
    </div>
    <div class="note" style="margin-bottom:16px">Angka di modul ini <b>hanya omset</b>. Biaya event — sewa booth, crew, transport, penginapan — belum ada di file sumber, jadi belum bisa dibaca sebagai laba.</div>
    <div class="panel"><h3>Omset per bulan</h3><p class="sub">Dihitung dari tanggal jualan, bukan tanggal event dimulai.</p>
      ${Object.keys(perBulan).length
        ? bar(urut(perBulan, false).map(p => [labelYm(p[0]), p[1]]), true)
        : '<div class="note">Tidak ada data pada filter ini.</div>'}
    </div>
    <div class="panel"><h3>Per bulan</h3><p class="sub">Omset, hari jualan, dan rata-rata hariannya.</p>
      ${tabel([{t:"Bulan"},{t:"Hari",n:1},{t:"Omset",n:1},{t:"Rata-rata/hari",n:1}],
        urut(perBulan, false).map(p => [labelYm(p[0]), A.fmt(hariBulan[p[0]]||0), A.rp(p[1]),
          A.rp(p[1] / (hariBulan[p[0]] || 1))]),
        ["Total", A.fmt(hari), A.rp(pendapatan), A.rp(hari ? pendapatan/hari : 0)])}
    </div>`;
}

function pEo() {
  const eoP = grup("EO", "pendapatan_rb", r => r.d1, r => cocok(r.d2));
  const eoH = grup("EO", "hari", r => r.d1, r => cocok(r.d2));
  const kotaP = grup("KOTA", "pendapatan_rb", r => r.d1, r => cocok(r.d2));
  const kotaH = grup("KOTA", "hari", r => r.d1, r => cocok(r.d2));
  const total = Object.values(eoP).reduce((a,b) => a+b, 0);
  const uEo = urut(eoP, true), uKota = urut(kotaP, true);

  return `<div class="kpis">
      ${kpi("Penyelenggara", A.fmt(uEo.length), "EO yang pernah diikuti")}
      ${kpi("EO terbesar", uEo.length ? uEo[0][0] : "—",
            uEo.length ? A.pct(uEo[0][1], total) + "% dari omset" : "")}
      ${kpi("Kota", A.fmt(uKota.length), "lokasi jualan")}
      ${kpi("Kota terbesar", uKota.length ? uKota[0][0] : "—",
            uKota.length ? A.rp(uKota[0][1]) : "")}
    </div>
    <div class="grid2">
      <div class="panel"><h3>Penyelenggara</h3><p class="sub">Urut omset. Rata-rata per hari menunjukkan kualitas trafiknya.</p>
        ${uEo.length ? tabel([{t:"Penyelenggara"},{t:"Hari",n:1},{t:"Omset",n:1},{t:"Rata/hari",n:1}],
          uEo.map(p => [A.esc(p[0]), A.fmt(eoH[p[0]]||0), A.rp(p[1]), A.rp(p[1]/(eoH[p[0]]||1))]))
          : '<div class="note">Tidak ada data.</div>'}</div>
      <div class="panel"><h3>Kota</h3><p class="sub">Di mana event itu digelar.</p>
        ${uKota.length ? tabel([{t:"Kota"},{t:"Hari",n:1},{t:"Omset",n:1},{t:"Rata/hari",n:1}],
          uKota.map(p => [A.esc(p[0]), A.fmt(kotaH[p[0]]||0), A.rp(p[1]), A.rp(p[1]/(kotaH[p[0]]||1))]))
          : '<div class="note">Tidak ada data.</div>'}</div>
    </div>`;
}

function pKurva() {
  const keP = grup("HARIKE", "pendapatan_rb", r => r.d1);
  const keH = grup("HARIKE", "hari", r => r.d1);
  const hariP = grup("HARI", "pendapatan_rb", r => r.d1);
  const hariH = grup("HARI", "hari", r => r.d1);
  const tipeP = grup("TIPE", "pendapatan_rb", r => r.d1);
  const tipeH = grup("TIPE", "hari", r => r.d1);
  const ke = urutAngka(keP);
  const rataKe = ke.map(p => ["Hari ke-" + p[0], keH[p[0]] ? p[1] / keH[p[0]] : 0]);
  const URUT_HARI = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  const rataHari = URUT_HARI.filter(h => hariH[h]).map(h => [h, hariP[h] / hariH[h]]);

  return `<div class="kpis">
      ${kpi("Hari terbaik dalam event", rataKe.length ? rataKe.slice().sort((a,b)=>b[1]-a[1])[0][0] : "—",
            rataKe.length ? A.rp(rataKe.slice().sort((a,b)=>b[1]-a[1])[0][1]) + " rata-rata" : "")}
      ${kpi("Weekday", A.rp(tipeH["Weekday"] ? tipeP["Weekday"]/tipeH["Weekday"] : 0),
            A.fmt(tipeH["Weekday"]||0) + " hari")}
      ${kpi("Weekend", A.rp(tipeH["Weekend"] ? tipeP["Weekend"]/tipeH["Weekend"] : 0),
            A.fmt(tipeH["Weekend"]||0) + " hari", "good")}
    </div>
    <div class="panel"><h3>Rata-rata omset per hari ke-n event</h3>
      <p class="sub">Dipakai memutuskan berapa hari sebaiknya ikut satu event. Ekor yang landai berarti hari-hari terakhir tidak menutup biaya.</p>
      ${rataKe.length ? bar(rataKe, true) : '<div class="note">Tidak ada data.</div>'}
    </div>
    <div class="panel"><h3>Rata-rata per hari dalam minggu</h3><p class="sub">Rata-rata, bukan total — supaya jumlah hari tidak mengecoh.</p>
      ${rataHari.length ? bar(rataHari, true) : '<div class="note">Tidak ada data.</div>'}
    </div>`;
}

function pDaftar() {
  const baris = EVENT.filter(r => detCocok(r[5]));
  const total = baris.reduce((a,r) => a + (+r[9]||0), 0) / 1000;
  const beda = baris.filter(r => Math.abs(+r[14]||0) > 0);
  const kolom = [
    { t: "ID", i: 0 }, { t: "Nama event", i: 1 }, { t: "Penyelenggara", i: 2 },
    { t: "Kota", i: 4 }, { t: "Mulai", i: 5, f: "tgl" }, { t: "Durasi", i: 7, n: 1, f: "n" },
    { t: "Hari berdata", i: 8, n: 1, f: "n" }, { t: "Omset", i: 9, n: 1, f: "rp0" },
    { t: "Rata/hari", i: 10, n: 1, f: "rp0" }, { t: "Selisih vs file asli", i: 14, n: 1, f: "sel" }
  ];
  return `<div class="kpis">
      ${kpi("Event", A.fmt(baris.length), "pada periode ini")}
      ${kpi("Omset", A.rp(total), "dari seluruh event terpilih")}
      ${kpi("Tidak cocok dengan file asli", A.fmt(beda.length), "perlu dicek tim event", beda.length ? "warn" : "good")}
    </div>
    ${tabelDetail("det-event", "Daftar event", "Klik judul kolom tidak mengurutkan; pakai kotak cari untuk menyaring.",
      kolom, baris, "daftar-event-floralid")}`;
}

function pHarian() {
  const baris = HARI.filter(r => detCocok(r[0]));
  const total = baris.reduce((a,r) => a + (+r[8]||0), 0) / 1000;
  const nol = baris.filter(r => !(+r[8]||0));
  const kolom = [
    { t: "Tanggal", i: 0, f: "tgl" }, { t: "Event", i: 2 }, { t: "Penyelenggara", i: 3 },
    { t: "Kota", i: 4 }, { t: "Hari ke", i: 5, n: 1, f: "n" }, { t: "Hari", i: 6 },
    { t: "Tipe", i: 7 }, { t: "Omset", i: 8, n: 1, f: "rp0" }, { t: "Status", i: 9 }
  ];
  return `<div class="kpis">
      ${kpi("Hari jualan", A.fmt(baris.length), "baris harian pada periode ini")}
      ${kpi("Omset", A.rp(total), "dari rincian harian")}
      ${kpi("Hari beromset nol", A.fmt(nol.length), "perlu dicek: libur atau lupa diisi", nol.length ? "warn" : "good")}
    </div>
    ${tabelDetail("det-hari", "Rincian harian", "Satu baris per hari jualan per event.",
      kolom, baris, "rincian-harian-event-floralid")}`;
}

function pData() {
  const q = k => jml("KUALITAS", "baris", r => r.d1 === k);
  const qv = k => jml("KUALITAS", "nilai_rb", r => r.d1 === k);
  const jenis = [...new Set((F.KUALITAS || []).map(r => r.d1))];
  const tertinggal = META.ubah_file_tim && META.ubah_database && META.ubah_file_tim > META.ubah_database;

  return `<div class="kpis">
      ${kpi("Jenis temuan", A.fmt(jenis.length), "pada seluruh periode")}
      ${kpi("File tim vs DATABASE", tertinggal ? "Tertinggal" : "Sinkron",
            tertinggal ? "file mentah tim lebih baru" : "DATABASE sudah terbaru",
            tertinggal ? "bad" : "good")}
      ${kpi("Event tercatat", A.fmt(META.event || EVENT.length), "di DATABASE")}
    </div>
    <div class="panel"><h3>Temuan kualitas data</h3>
      <p class="sub">Dihitung atas seluruh periode. Filter tidak berlaku di halaman ini.</p>
      ${jenis.length ? tabel([{t:"Temuan"},{t:"Baris",n:1},{t:"Nilai",n:1}],
        jenis.map(k => [A.esc(k), A.fmt(q(k)), qv(k) ? A.rp(qv(k)) : "—"]))
        : '<div class="note">Tidak ada temuan.</div>'}
    </div>
    <div class="panel"><h3>Yang perlu dibereskan</h3><div class="stack">
      ${tertinggal ? temuan("crit", "DATABASE tertinggal dari file mentah tim",
        "Tim masih mengisi file blok-per-event, lalu disalin ke DATABASE. Selama dua file berjalan paralel, angka di sini selalu bisa ketinggalan. Perbaikannya: isi langsung ke format tabular.")
        : temuan("info", "DATABASE sudah lebih baru dari file tim", "Tidak ada yang perlu disalin ulang saat ini.")}
      ${temuan("warn", "Biaya event belum ada",
        "File sumber hanya memuat pendapatan. Tanpa sewa booth, crew, transport, dan penginapan, event yang omsetnya besar belum tentu untung. Rate standarnya ada di TO-DO-LIST BAZAAR 2026 dan bisa disambungkan.")}
    </div></div>`;
}

const GAMBAR = { ringkasan: pRingkasan, eo: pEo, kurva: pKurva,
                 daftar: pDaftar, harian: pHarian, data: pData };

/* ---------- analisa vertikal & horizontal ---------- */
const rpRb = v => A.rp(v);
const barisDari = peta => urut(peta, true).map(([label, nilai]) => ({ label, nilai }));
const seriBulan = metrik => urut(grup("BULAN", metrik, r => r.d1, r => cocok(r.d1)), false);

const VHDEF = {
  ringkasan: () => ({
    v: { judul: "Analisa vertikal — omset per penyelenggara", labelKolom: "Penyelenggara", fmt: rpRb,
         sub: "Seberapa bergantung omset event pada satu EO.",
         baris: barisDari(grup("EO", "pendapatan_rb", r => r.d1, r => cocok(r.d2))) },
    h: { judul: "Analisa horizontal — omset per bulan", fmt: rpRb,
         sub: "Pergerakan omset event antar bulan.",
         seri: seriBulan("pendapatan_rb") }
  }),
  eo: () => ({
    v: { judul: "Analisa vertikal — omset per kota", labelKolom: "Kota", fmt: rpRb,
         sub: "Sebaran omset menurut lokasi jualan.",
         baris: barisDari(grup("KOTA", "pendapatan_rb", r => r.d1, r => cocok(r.d2))) },
    h: { judul: "Analisa horizontal — hari jualan per bulan", fmt: v => A.fmt(v),
         sub: "Jumlah hari ikut event tiap bulan — pembanding beban tim.",
         seri: seriBulan("hari") }
  }),
  kurva: () => {
    const keP = grup("HARIKE", "pendapatan_rb", r => r.d1);
    const keH = grup("HARIKE", "hari", r => r.d1);
    const rata = {};
    urutAngka(keP).forEach(p => { if (keH[p[0]]) rata["Hari ke-" + p[0]] = p[1] / keH[p[0]]; });
    return {
      v: { judul: "Analisa vertikal — porsi omset per hari ke-n", labelKolom: "Hari ke-n", fmt: rpRb,
           sub: "Berapa besar sumbangan tiap hari event terhadap total omset.",
           baris: barisDari(grup("HARIKE", "pendapatan_rb", r => "Hari ke-" + r.d1)) },
      h: { judul: "Analisa horizontal — rata-rata omset menurut hari ke-n", fmt: rpRb,
           sub: "Dibaca sebagai kurva: di hari keberapa omset mulai tidak sepadan dengan biaya ikut.",
           seri: Object.entries(rata) }
    };
  },
  daftar: () => {
    const per = {};
    EVENT.forEach(r => { if (detCocok(r[5])) per[String(r[1] || r[0])] = (+r[9]||0) / 1000; });
    return {
      v: { judul: "Analisa vertikal — omset per event", labelKolom: "Event", fmt: rpRb,
           sub: "Event mana yang benar-benar menghasilkan, dan berapa yang hanya menambah kerjaan.",
           baris: barisDari(per) },
      h: { judul: "Analisa horizontal — omset per bulan", fmt: rpRb,
           sub: "Pembanding waktu untuk daftar event di atas.",
           seri: seriBulan("pendapatan_rb") }
    };
  },
  harian: () => {
    const perHari = {}, perBulan = {};
    HARI.forEach(r => {
      if (!detCocok(r[0])) return;
      const n = (+r[8]||0) / 1000;
      const nama = String(r[6] || "(tanpa hari)");
      perHari[nama] = (perHari[nama] || 0) + n;
      const ym = String(r[0]).slice(0,7);
      perBulan[ym] = (perBulan[ym] || 0) + n;
    });
    return {
      v: { judul: "Analisa vertikal — omset per nama hari", labelKolom: "Hari", fmt: rpRb,
           sub: "Total omset menurut hari dalam minggu.",
           baris: barisDari(perHari) },
      h: { judul: "Analisa horizontal — omset harian per bulan", fmt: rpRb,
           sub: "Dihitung ulang dari rincian harian, bukan dari agregat.",
           seri: urut(perBulan, false) }
    };
  },
  data: () => ({
    v: { judul: "Analisa vertikal — temuan kualitas data", labelKolom: "Jenis temuan", fmt: v => A.fmt(v),
         sub: "Jenis masalah mana yang paling banyak menyentuh baris data.",
         baris: barisDari(grup("KUALITAS", "baris", r => r.d1)) },
    h: { judul: "Analisa horizontal — hari jualan per bulan", fmt: v => A.fmt(v),
         sub: "Pembanding volume, supaya jumlah temuan dibaca relatif terhadap besarnya data.",
         seri: seriBulan("hari") }
  })
};

function konteksAI() {
  const def = VHDEF[HAL] ? VHDEF[HAL]() : null;
  const nama = (HALAMAN.find(h => h[0] === HAL) || [, HAL])[1];
  return {
    judul: nama,
    data: {
      modul: "Marketing & Event",
      halaman: nama,
      filter: { tahun: FY, bulan: FM },
      catatan: "nilai dalam ribuan rupiah; hanya OMSET, biaya event belum tersedia",
      ringkas: {
        omset_rb: Math.round(jml("BULAN", "pendapatan_rb", r => cocok(r.d1))),
        hari: jml("BULAN", "hari", r => cocok(r.d1)),
        event: EVENT.filter(r => detCocok(r[5])).length
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
            ` · ${A.fmt(META.hari || HARI.length)} hari jualan · diperbarui ${META.generated || "—"} WIB`);
}

function opsiFilter() {
  const yms = {};
  (F.BULAN || []).forEach(r => { if (r.d1) yms[r.d1] = 1; });
  const tahun = {}; Object.keys(yms).forEach(k => tahun[String(k).slice(0,4)] = 1);
  return { tahun: Object.keys(tahun).sort(), bulan: Object.keys(yms).sort() };
}

export function render(el, data, api) {
  A = api; wadah = el;
  F = {}; EVENT = []; HARI = []; META = {};
  for (const d of data) {
    if (d.key === "event.feed") {
      for (const r of (d.payload || [])) {
        (F[r[0]] = F[r[0]] || []).push({
          d1: String(r[1] ?? ""), d2: String(r[2] ?? ""), d3: String(r[3] ?? ""),
          d4: String(r[4] ?? ""), m: String(r[5] ?? ""), v: +r[6] || 0
        });
      }
    } else if (d.key === "event.detail") EVENT = d.payload || [];
    else if (d.key === "event.hari")     HARI = d.payload || [];
  }
  (F.META || []).forEach(r => META[r.d1] = (r.m === "teks") ? r.d2 : r.v);

  const o = opsiFilter();
  el.innerHTML = `
    <div class="subtab" role="tablist">
      ${HALAMAN.map(h => `<button role="tab" data-h="${h[0]}" aria-selected="${h[0] === HAL}">${h[1]}</button>`).join("")}
    </div>
    <div class="modfilter">
      <label>Tahun<select id="e-year"><option value="all">Semua</option>${o.tahun.map(y => `<option value="${y}">${y}</option>`).join("")}</select></label>
      <label>Bulan<select id="e-month"><option value="all">Semua</option>${o.bulan.map(m => `<option value="${m}">${labelYm(m)}</option>`).join("")}</select></label>
      <button class="reset" id="e-reset" type="button">Reset</button>
    </div>
    <div id="mod-isi"></div>`;

  el.querySelectorAll(".subtab button").forEach(b =>
    b.addEventListener("click", () => { HAL = b.dataset.h; gambar(); }));
  el.querySelector("#e-year").addEventListener("change", e => { FY = e.target.value; sinkronBulan(el); gambar(); });
  el.querySelector("#e-month").addEventListener("change", e => { FM = e.target.value; gambar(); });
  el.querySelector("#e-reset").addEventListener("click", () => {
    FY = FM = "all";
    el.querySelector("#e-year").value = "all";
    el.querySelector("#e-month").value = "all";
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
  const fm = el.querySelector("#e-month");
  Array.from(fm.options).forEach(o => {
    o.hidden = !(o.value === "all" || FY === "all" || String(o.value).slice(0,4) === FY);
  });
  if (FM !== "all" && FY !== "all" && String(FM).slice(0,4) !== FY) { FM = "all"; fm.value = "all"; }
}
