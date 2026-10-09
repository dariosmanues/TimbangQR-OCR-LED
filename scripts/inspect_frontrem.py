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

print(f"Total lines: {len(harapan_lines)}")

kecamatan_list = [
    "TENAYAN RAYA", "KULIM", "BUKIT RAYA", "LIMA PULUH", "SAIL",
    "PEKANBARU KOTA", "MARPOYAN DAMAI", "SUKAJADI", "RUMBAI",
    "RUMBAI BARAT", "RUMBAI TIMUR", "PAYUNG SEKAKI", "BINAWIDYA", "TUAH MADANI", "SENAPELAN"
]

results = []
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

    # Kecamatan LPS at the end of front
    matched_kec_lps = None
    for k in sorted(kecamatan_list, key=len, reverse=True):
        if front.upper().endswith(k):
            matched_kec_lps = k
            front = front[:-len(k)].strip()
            break

    # Now front ends with kelurahan_lps
    # Let's inspect remaining front
    results.append({
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
        "front_rem": front
    })

for idx, r in enumerate(results):
    print(f"Row {idx+1:02d} (No {r['no']}):")
    print(f"   Plate: {r['nomor_polisi']} | Izin: {r['nomor_izin']} | Jenis: {r['jenis_armada']} | Kec: {r['kecamatan_lps']}")
    print(f"   FrontRem: {r['front_rem']}")
