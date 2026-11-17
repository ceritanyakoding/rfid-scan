REKAP RFID PALLET

1. Ekstrak seluruh file ZIP ke satu folder.
2. Buka index.html di Chrome atau Edge.
3. Atur handheld ke mode Keyboard Wedge / HID dan tambahkan suffix Enter.
4. Pilih tanggal dan area SHIPPING, EMPTY, atau CUSTOMER.
5. Scan tag saat kolom RFID aktif. Jika kolom kehilangan fokus, ketuk kolom
   itu terlebih dahulu. Untuk uji manual, ketik 0000000700010826 lalu tekan Enter.
6. Pilih tanggal yang ingin ditinjau lalu klik Ekspor Excel.

Satu RFID mempunyai satu posisi untuk setiap tanggal. Scan ulang di area
yang sama tidak menambah jumlah. Scan di area berbeda memperbarui posisi
pada tanggal itu. Kode disimpan sebagai teks, termasuk angka nol di depan.
Data tersimpan pada browser dan perangkat yang digunakan. Ekspor rekap untuk
menyimpan salinan. Jika browser memblokir penyimpanan saat membuka file secara
langsung, jalankan folder melalui server web statis, misalnya dengan
python3 -m http.server 8000, lalu buka http://localhost:8000.

Pilih 05/10/2026 untuk melihat enam baris rekap yang sudah dimasukkan.
Nomor pallet dan type untuk keenam RFID tersebut terisi otomatis.
Untuk RFID lain, buka Detail pallet / customer sebelum scan bila ingin
menambahkan nomor pallet, type, atau nama customer. Nama customer dapat
digunakan untuk scan area CUSTOMER dan dipakai hingga area diganti.

BULK SCAN
Pilih tanggal dan area, aktifkan Bulk Scan, lalu pindai tag berurutan.
Setiap kode harus diakhiri Enter. Kode ganda di antrean hanya dihitung
sekali. Hapus tag yang salah atau kosongkan antrean, lalu pilih Simpan
semua. Tanggal dan area terkunci selama antrean berisi tag. Antrean
bersifat sementara hingga disimpan. Untuk handheld yang mengirim EPC
gabungan tanpa Enter per tag, diperlukan penyesuaian sesuai model reader.
