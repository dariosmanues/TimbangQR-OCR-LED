import json
import re

with open("data/master_armada_harapan_jaya_okt2026.json", "r", encoding="utf-8") as f:
    rows = json.load(f)

# Also load raw lines from PDF to check exact original strings
import pypdf
pdf_path = r"C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\4007ad19-3b9c-4659-9540-adcf22ff37a6\.user_uploaded\media_1791370450645.pdf"
reader = pypdf.PdfReader(pdf_path)
text = reader.pages[0].extract_text()
lines = [l.strip() for l in text.split('\n') if l.strip()]

raw_by_no = {}
for l in lines:
    if 'HARAPAN JAYA' in l and l.startswith(('1', '2', '3', '4', '5', '6', '7', '8', '9')):
        if 'Total armada' not in l:
            m = re.match(r'^(\d+)\s+', l)
            if m:
                raw_by_no[int(m.group(1))] = l

print(f"Total raw lines mapped: {len(raw_by_no)}")

for r in rows:
    raw = raw_by_no.get(r['no'], "")
    # Check nomor_surat_permohonan
    # Let's inspect raw around tanggal_permohonan
    # In row 2 & 3: "010/PIO-LPS BB/XII/2025"
    if "010/PIO-LPS BB/XII/2025" in raw:
        r['nomor_surat_permohonan'] = "010/PIO-LPS BB/XII/2025"
        r['nama_lps'] = "Kelurahan Bambu Kuning"
    
    # Check row 194 (Berseri Cinta Raja):
    # nomor SK LPS might be empty
    if r['no'] == 194:
        r['nomor_sk_lps'] = "-"
        r['nama_lps'] = "Berseri Cinta Raja"
        r['nomor_surat_permohonan'] = "001/LPS.CR/I/2026"
        r['tanggal_permohonan'] = "12 Januari 2026"
    
    # Check row 217 (Berkah Bersama):
    if r['no'] == 217:
        r['nama_lps'] = "Berkah Bersama"
        r['nomor_surat_permohonan'] = "-"
        r['tanggal_permohonan'] = "-"
        r['wilayah_kerja'] = "-"
    
    # Check row 124 (Beriman):
    if r['no'] == 124:
        r['nama_lps'] = "Beriman"
        r['nomor_surat_permohonan'] = "10/LPS-TU/SP-XII/2025"
        r['tanggal_permohonan'] = "-"

    # Check row 145 (Beriman):
    if r['no'] == 145:
        r['nama_lps'] = "Beriman"
        r['nomor_surat_permohonan'] = "10/LPS-TU/SP-XII/2025"
        r['tanggal_permohonan'] = "27 Desember 2025"

    # Check row 248 (Maharatu Jaya):
    if r['no'] == 248:
        r['nama_lps'] = "Maharatu Jaya"
        r['nomor_surat_permohonan'] = "001/PIO-LPS MJ/I/2026"
        r['tanggal_permohonan'] = "12 Januari 2026"

    # Check row 192 (Maharatu Jaya):
    if r['no'] == 192:
        r['nama_lps'] = "Maharatu Jaya"
        r['nomor_surat_permohonan'] = "001/PIO-LPS MJ/I/2026"
        r['tanggal_permohonan'] = "12 Januari 2026"

    # Check row 273 (Sejahtera):
    if r['no'] == 273:
        r['nama_lps'] = "Sejahtera"
        r['nomor_surat_permohonan'] = "004/SPI-LPS/PB/KLM/IV.2026"
        r['tanggal_permohonan'] = "01 Juni 2026"

    # Check row 75 (Sejahtera):
    if r['no'] == 75:
        r['nama_lps'] = "Sejahtera"
        r['nomor_surat_permohonan'] = "004/SPI-LPS/PB/KLM/IV.2026"
        r['tanggal_permohonan'] = "01 Juni 2026"

    # Check row 188 (Industri Tenayan):
    if r['no'] == 188:
        r['nama_lps'] = "Industri Tenayan"
        r['nomor_surat_permohonan'] = "07/LPS.IT/XII/2025"
        r['tanggal_permohonan'] = "22 Desember 2025"

    # Check row 112 (Industri Tenayan):
    if r['no'] == 112:
        r['nama_lps'] = "Industri Tenayan"
        r['nomor_surat_permohonan'] = "07/LPS.IT/XII/2025"
        r['tanggal_permohonan'] = "22 Desember 2025"

    # Check row 146 & 262 (Ceria):
    if r['no'] in (146, 262):
        r['nama_lps'] = "Ceria"
        r['nomor_surat_permohonan'] = "01/LPS/SR-KL/I/2026"
        r['tanggal_permohonan'] = "02 Januari 2026"

    # Check row 263 (Tuah Mulia):
    if r['no'] == 263:
        r['nama_lps'] = "Tuah Mulia"
        r['nomor_surat_permohonan'] = "09/SKM/XII/2025"
        r['tanggal_permohonan'] = "30 Desember 2025"

    # Check row 213 (Tanjung Rhu Aman):
    if r['no'] == 213:
        r['nama_lps'] = "Tanjung Rhu Aman"
        r['nomor_surat_permohonan'] = "01/LPS-Tj. Rhu/II/2026"
        r['tanggal_permohonan'] = "02 Februari 2026"

    # Check row 78 (Tanah Datar Bersinergi):
    if r['no'] == 78:
        r['nama_lps'] = "Tanah Datar Bersinergi"
        r['nomor_surat_permohonan'] = "01/LPS-TBD/TD/I/2026"
        r['tanggal_permohonan'] = "07 Januari 2026"

    # Check Air Dingin Beriman rows (109, 110, 113, 114, 115)
    if r['no'] in (109, 110, 113, 114, 115):
        r['nama_lps'] = "Air Dingin Beriman"
        r['nomor_surat_permohonan'] = "001/SK.DLHK/LPS.AD/I/2026"
        r['tanggal_permohonan'] = "02 Januari 2026"

    # Check Mentangor rows (121, 122, 123)
    if r['no'] in (121, 122, 123):
        r['nama_lps'] = "Mentangor"
        r['nomor_surat_permohonan'] = "01/LPS-MT/I/2026"
        r['tanggal_permohonan'] = "01 Januari 2026"

    # Check Rejosari rows (126, 127, 134, 135, 218, 250, 253, 259, 274)
    if r['no'] in (126, 127, 134, 135, 218, 250, 253, 259, 274):
        r['nama_lps'] = "Rejosari"
        r['nomor_surat_permohonan'] = "002/PIO/LPS.R/XII/2025"
        r['tanggal_permohonan'] = "08 Desember 2025"

    # Check Bambu Kuning row 133
    if r['no'] == 133:
        r['nama_lps'] = "Kelurahan Bambu Kuning"
        r['nomor_surat_permohonan'] = "010/PIO-LPS BB/XII/2025"
        r['tanggal_permohonan'] = "04 Desember 2025"

    # Check Sialang Sakti rows (1, 59, 60, 61, 62)
    if r['no'] in (1, 59, 60, 61, 62):
        r['nama_lps'] = "Sialang Sakti"
        r['nomor_surat_permohonan'] = "10/LPS-SS/XII/2025"
        r['tanggal_permohonan'] = "10 Desember 2025"

    # Check Pematang Kapau rows (4, 5, 6, 7, 8, 9, 10, 130)
    if r['no'] in (4, 5, 6, 7, 8, 9, 10, 130):
        r['nama_lps'] = "Pematang Kapau"
        r['nomor_surat_permohonan'] = "021/LPS/PK/XII/2025"
        r['tanggal_permohonan'] = "10 Desember 2025"

    # Check Beramal row 11
    if r['no'] == 11:
        r['nama_lps'] = "Beramal"
        r['nomor_surat_permohonan'] = "005/LPS/BCL/XII/2025"
        r['tanggal_permohonan'] = "10 Desember 2025"

    # Check Beriman row 13
    if r['no'] == 13:
        r['nama_lps'] = "Beriman"
        r['nomor_surat_permohonan'] = "02/LPS-TU/SP/VIII/2026"
        r['tanggal_permohonan'] = "05 Agustus 2026"

    # Check Pesisir Bersih row 16
    if r['no'] == 16:
        r['nama_lps'] = "Pesisir Bersih"
        r['nomor_surat_permohonan'] = "20/LPS-PESISIR BERSIH/XII/2025"
        r['tanggal_permohonan'] = "09 Desember 2025"

    # Check Timur Jaya rows (17, 18, 19, 20)
    if r['no'] in (17, 18, 19, 20):
        r['nama_lps'] = "Timur Jaya"
        r['nomor_surat_permohonan'] = "029/LPS-TJ/TT/XII/2025"
        r['tanggal_permohonan'] = "10 Desember 2025"

    # Check Aman Berkarya row 22
    if r['no'] == 22:
        r['nama_lps'] = "Aman Berkarya"
        r['nomor_surat_permohonan'] = "05/LPS-AB/XII/2025"
        r['tanggal_permohonan'] = "19 Desember 2025"

    # Check Berkah row 27
    if r['no'] == 27:
        r['nama_lps'] = "Berkah"
        r['nomor_surat_permohonan'] = "06/LPS/KLM/XII/2025"
        r['tanggal_permohonan'] = "08 Desember 2025"

    # Check Rintis Aman Dan Bersih row 34
    if r['no'] == 34:
        r['nama_lps'] = "Rintis Aman Dan Bersih"
        r['nomor_surat_permohonan'] = "16/LPS-RAB/XII/2025"
        r['tanggal_permohonan'] = "09 Desember 2025"

    # Check Sukamaju Jaya row 37
    if r['no'] == 37:
        r['nama_lps'] = "Sukamaju Jaya"
        r['nomor_surat_permohonan'] = "08/SMJ/XII/2025"
        r['tanggal_permohonan'] = "30 Desember 2025"

    # Check Bersinergi rows (38, 39, 40)
    if r['no'] in (38, 39, 40):
        r['nama_lps'] = "Bersinergi"
        r['nomor_surat_permohonan'] = "38/LPS-B/TS/XII/2025"
        r['tanggal_permohonan'] = "10 Desember 2025"

    # Check Sekip Sigap Bersih row 58
    if r['no'] == 58:
        r['nama_lps'] = "Sekip Sigap Bersih"
        r['nomor_surat_permohonan'] = "06/LPS-SSB/XII/2025"
        r['tanggal_permohonan'] = "08 Desember 2025"

    # Check Labuai Bedelau rows (70, 71, 129)
    if r['no'] in (70, 71, 129):
        r['nama_lps'] = "Labuai Bedelau"
        r['nomor_surat_permohonan'] = "30/LPS-LBD/XII/2025"
        r['tanggal_permohonan'] = "23 Desember 2025"

    # Check Sejahtera rows (74, 76, 77)
    if r['no'] in (74, 76, 77):
        r['nama_lps'] = "Sejahtera"
        r['nomor_surat_permohonan'] = "002/SP-OP/LPS/PB/XII/2025"
        r['tanggal_permohonan'] = "10 Desember 2025"

with open("data/master_armada_harapan_jaya_okt2026.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, indent=2, ensure_ascii=False)

print("Saved cleaned data/master_armada_harapan_jaya_okt2026.json")
