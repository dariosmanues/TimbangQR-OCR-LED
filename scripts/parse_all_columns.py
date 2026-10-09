import pypdf
import re
import json

pdf_path = r"C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\4007ad19-3b9c-4659-9540-adcf22ff37a6\.user_uploaded\media_1791370450645.pdf"
reader = pypdf.PdfReader(pdf_path)
text = reader.pages[0].extract_text()
lines = [l.strip() for l in text.split('\n') if l.strip()]

harapan_lines = []
for l in lines:
    if 'HARAPAN JAYA' in l and l.startswith(('1', '2', '3', '4', '5', '6', '7', '8', '9')):
        if 'Total armada' not in l:
            if l not in harapan_lines:
                harapan_lines.append(l)

kecamatan_list = [
    "TENAYAN RAYA", "KULIM", "BUKIT RAYA", "LIMA PULUH", "SAIL",
    "PEKANBARU KOTA", "MARPOYAN DAMAI", "SUKAJADI", "RUMBAI",
    "RUMBAI BARAT", "RUMBAI TIMUR", "PAYUNG SEKAKI", "BINAWIDYA", "TUAH MADANI", "SENAPELAN"
]

kelurahan_list = [
    "SIALANG SAKTI", "BAMBU KUNING", "PEMATANG KAPAU", "BENCAH LESUNG",
    "TANGKERANG UTARA", "PESISIR", "TANGKERANG TIMUR", "SIMPANG TIGA",
    "KULIM", "RINTIS", "SUKAMAJU", "TANGKERANG SELATAN", "SEKIP",
    "TANGKERANG LABUAI", "PEBATUAN", "TANAH DATAR", "AIR DINGIN",
    "INDUSTRI TENAYAN", "MENTANGOR", "REJOSARI", "SIALANG RAMPAI",
    "MAHARATU", "CINTA RAJA", "TANJUNG RHU", "KAMPUNG TENGAH", "SUKAMULIA"
]

ketua_list = [
    "H. JERRY YUZAR, SH", "PURNAWAN CONDRO GUNO", "ALFISON, S.Sos",
    "DEDDI YASRIL RANGKUTI", "HANDOKO SUJARWADI", "SULAIMAN ST",
    "SAHARUDDIN NUR, SE", "SAPTA KARTAJAYA", "SURATNO", "INDRA, SH",
    "MUZERMAN", "EDWIN SYARIF", "AGUS FAISAL", "MOH AMINULLAH",
    "ALI IMRAN TANJUNG, SH", "WENDRI", "KASAN", "ABDUL LATIF",
    "ZULHELMI", "JULIADI", "AMRIS", "GUSDIANTO", "HELMI RACHMAN",
    "SYAIFULLAH ROZIKIN", "HASMAIDAR. H", "ADRIAN, S.Sos"
]

all_rows = []
for idx, line in enumerate(harapan_lines):
    m_start = re.match(r'^(\d+)\s+(\d{1,3}/DLHK/I-OPS/I/2026)\s+(.*)$', line)
    no_num = int(m_start.group(1))
    no_izin = m_start.group(2)
    rest = m_start.group(3)

    m_end = re.search(r'HARAPAN JAYA\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s+(.+)$', rest)
    tgl_terbit = m_end.group(1).strip()
    lampiran_camat = m_end.group(2).strip()
    middle = rest[:m_end.start()].strip()

    m_plate = re.search(r'(PICKUP|BENTOR)\s+((?:BM|BA)\s+\d{3,4}\s+[A-Z]{2,3})(?:\s+(.*))?$', middle)
    jenis_armada = m_plate.group(1).strip()
    no_polisi = m_plate.group(2).strip()
    wilayah_kerja = (m_plate.group(3) or '').strip()
    front = middle[:m_plate.start()].strip()

    # Kecamatan LPS at end of front
    matched_kec_lps = None
    for k in sorted(kecamatan_list, key=len, reverse=True):
        if front.upper().endswith(k):
            matched_kec_lps = k
            front = front[:-len(k)].strip()
            break

    # Kelurahan LPS at end of front
    matched_kel_lps = None
    for kel in sorted(kelurahan_list, key=len, reverse=True):
        if front.upper().endswith(kel):
            matched_kel_lps = kel
            front = front[:-len(kel)].strip()
            break

    # Ketua LPS
    matched_ketua = None
    alamat_lps = None
    front_before_ketua = front
    for ketua in sorted(ketua_list, key=len, reverse=True):
        if ketua in front:
            matched_ketua = ketua
            pos = front.index(ketua)
            alamat_lps = front[pos + len(ketua):].strip()
            front_before_ketua = front[:pos].strip()
            break

    fb = front_before_ketua

    # Parse no_sk and tgl_sk from fb
    # Patterns for tgl_sk: \d{2}/\d{2}/\d{4} or \d{1,2}\s+[A-Za-z]+\s+\d{4}
    m_tgl_sk = re.search(r'(\d{2}/\d{2}/\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})', fb)
    if m_tgl_sk:
        tgl_sk = m_tgl_sk.group(1)
        no_sk = fb[:m_tgl_sk.start()].strip()
        after_tgl_sk = fb[m_tgl_sk.end():].strip()
    else:
        tgl_sk = ""
        no_sk = ""
        after_tgl_sk = fb

    # after_tgl_sk contains: kecamatan nama_lps no_permohonan tgl_permohonan nama_lps_2
    # Kecamatan asal
    matched_kec_asal = None
    for k in sorted(kecamatan_list, key=len, reverse=True):
        if after_tgl_sk.upper().startswith(k):
            matched_kec_asal = k
            after_tgl_sk = after_tgl_sk[len(k):].strip()
            break

    # Check for tgl_permohonan: \d{1,2}\s+[A-Za-z]+\s+\d{4}
    # Notice some might not have tgl_permohonan (like row 46 / no 124, row 60 / no 217)
    m_tgl_perm = re.search(r'(\d{1,2}\s+[A-Za-z]+\s+\d{4})', after_tgl_sk)
    if m_tgl_perm:
        tgl_permohonan = m_tgl_perm.group(1)
        before_tgl_perm = after_tgl_sk[:m_tgl_perm.start()].strip()
        nama_lps_2 = after_tgl_sk[m_tgl_perm.end():].strip()
        # before_tgl_perm contains: nama_lps no_permohonan
        # no_permohonan usually looks like: \S+/\S+ or 002/PIO/... or 10/LPS...
        m_no_perm = re.search(r'([A-Za-z0-9._-]+/[A-Za-z0-9._/-]+)', before_tgl_perm)
        if m_no_perm:
            no_permohonan = m_no_perm.group(1)
            nama_lps = before_tgl_perm[:m_no_perm.start()].strip()
        else:
            no_permohonan = ""
            nama_lps = before_tgl_perm
    else:
        tgl_permohonan = ""
        # Check if there is no_permohonan
        m_no_perm = re.search(r'([A-Za-z0-9._-]+/[A-Za-z0-9._/-]+)', after_tgl_sk)
        if m_no_perm:
            no_permohonan = m_no_perm.group(1)
            nama_lps = after_tgl_sk[:m_no_perm.start()].strip()
            nama_lps_2 = after_tgl_sk[m_no_perm.end():].strip()
        else:
            no_permohonan = ""
            # maybe just nama_lps nama_lps_2
            tokens = after_tgl_sk.split()
            mid_pt = len(tokens) // 2
            nama_lps = " ".join(tokens[:mid_pt])
            nama_lps_2 = " ".join(tokens[mid_pt:])

    all_rows.append({
        "no": no_num,
        "nomor_izin": no_izin,
        "nomor_sk_lps": no_sk,
        "tanggal_sk_lps": tgl_sk,
        "kecamatan": matched_kec_asal or "",
        "nama_lps": nama_lps,
        "nomor_surat_permohonan": no_permohonan,
        "tanggal_permohonan": tgl_permohonan,
        "nama_lps_2": nama_lps_2,
        "nama_ketua_lps": matched_ketua or "",
        "alamat_lps": alamat_lps or "",
        "kelurahan_lps": matched_kel_lps or "",
        "kecamatan_lps": matched_kec_lps or "",
        "jenis_armada": jenis_armada,
        "nomor_polisi": no_polisi,
        "plate_normalized": no_polisi.replace(" ", ""),
        "wilayah_kerja": wilayah_kerja,
        "lokasi_tps": "HARAPAN JAYA",
        "tanggal_terbit_izin": tgl_terbit,
        "lampiran_camat": lampiran_camat
    })

print(f"Parsed all {len(all_rows)} rows cleanly!")
with open("data/master_armada_harapan_jaya_okt2026.json", "w", encoding="utf-8") as f:
    json.dump(all_rows, f, indent=2, ensure_ascii=False)

for r in all_rows[:10]:
    print(r["no"], "|", r["nomor_izin"], "|", r["nama_lps"], "|", r["nomor_polisi"], "|", r["wilayah_kerja"])
