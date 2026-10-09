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

all_parsed = []
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

    # Match Kecamatan LPS at end of front
    matched_kec_lps = None
    for k in sorted(kecamatan_list, key=len, reverse=True):
        if front.upper().endswith(k):
            matched_kec_lps = k
            front = front[:-len(k)].strip()
            break

    # Match Kelurahan LPS at end of front
    matched_kel_lps = None
    for kel in sorted(kelurahan_list, key=len, reverse=True):
        if front.upper().endswith(kel):
            matched_kel_lps = kel
            front = front[:-len(kel)].strip()
            break

    # Now front contains:
    # no_sk, tgl_sk, kec, nama_lps, no_permohonan, tgl_permohonan, nama_lps_2, nama_ketua, alamat_lps
    # Match nama_ketua
    matched_ketua = None
    alamat_lps = None
    for ketua in sorted(ketua_list, key=len, reverse=True):
        if ketua in front:
            matched_ketua = ketua
            pos = front.index(ketua)
            alamat_lps = front[pos + len(ketua):].strip()
            front_before_ketua = front[:pos].strip()
            break
    
    # In front_before_ketua:
    # Starts with: [no_sk] tgl_sk kec_lps nama_lps no_permohonan tgl_permohonan nama_lps_2
    all_parsed.append({
        "no": no_num,
        "nomor_izin": no_izin,
        "jenis_armada": jenis_armada,
        "nomor_polisi": no_polisi,
        "plate_normalized": no_polisi.replace(" ", ""),
        "wilayah_kerja": wilayah_kerja,
        "lokasi_tps": "HARAPAN JAYA",
        "tanggal_terbit_izin": tgl_terbit,
        "lampiran_camat": lampiran_camat,
        "kecamatan_lps": matched_kec_lps,
        "kelurahan_lps": matched_kel_lps,
        "nama_ketua_lps": matched_ketua,
        "alamat_lps": alamat_lps,
        "front_before_ketua": front_before_ketua
    })

print(f"Parsed {len(all_parsed)} items.")
for i in range(5):
    print(all_parsed[i])

# Check any missing ketua or kelurahan
for idx, r in enumerate(all_parsed):
    if not r['nama_ketua_lps']:
        print(f"Missing ketua row {idx+1} (No {r['no']}): {r['front_before_ketua']}")
    if not r['kelurahan_lps']:
        print(f"Missing kelurahan row {idx+1} (No {r['no']})")
