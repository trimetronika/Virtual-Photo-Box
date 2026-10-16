# Roadmap & Peningkatan Produk: Korean Photobooth Modern & Playful (Life4Cuts Inspired)

Rencana peningkatan produk dari perspektif Project Manager (PM) dan R&D untuk menghadirkan pengalaman photobox virtual ala Korean Photobooth (Life4Cuts / Haru Film) yang interaktif, menyenangkan, dan estetik dengan panduan pose dinamis, variasi template strip baru, dan koleksi stiker kreatif.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Keputusan Produk yang Telah Dikonfirmasi**:
> 1. **Prioritas Pengembangan**: Integrasi pengalaman pose capture interaktif serta ekspansi variasi template strip, frame estetik, dan stiker kreatif.
> 2. **Arah Desain & UI/UX**: Estetika Korean Photobooth modern & playful (soft pastel palette `#FFF5F5`, `#F0F4FF`, lavender `#FAF5FF`, rounded pill-shaped button accents, clean card framing tanpa visual clutter).
> 3. **Fitur Kunci Baru**: *Dynamic Pose Guide & Inspo Deck* (kartu referensi pose dengan pilihan tema: Bestie, Couple, Cute Idol, Silly/Funny, Y2K) yang tersinkronisasi antar partner saat pemotretan duo.

---

## 1. Overview & Core Concept

- **Apa yang Dibangun**: Transformasi photobox virtual menjadi studio foto interaktif bertema **Korean Photobooth Studio** yang memandu pengguna dari awal hingga akhir dengan pose inspiratif, countdown interaktif, kustomisasi strip foto kaya variasi (Haru Film sky blue, Life4Cuts classic white, Rose pastel, Film grain), serta studio dekorasi dengan stiker cute dan stamp Hangul.
- **Target Persona**: Gen-Z, pasangan LDR (Long Distance Relationship), sahabat karib, serta kreator konten yang ingin mengabadikan momen berdua secara online dengan estetika photobooth Korea asli.
- **Nilai Tambah (Key Value)**:
  - Mengatasi kecanggungan saat berpose ("mati gaya") dengan panduan pose interaktif visual per slot foto.
  - Memperkaya hasil cetak akhir dengan template strip dan ornamen khas photobox populer.
  - Alur WebRTC yang stabil dengan feedback real-time yang jelas saat berfoto bersama teman.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Lobby & Room Setup**:
   - Tampilan lobby yang ramah dengan panduan cepat 3 langkah.
   - Pilihan mode foto yang jelas: Solo, Duo Split (kiri-kanan dalam 1 strip), Duo Alternate (gantian pose per slot).
   - Pengaturan hitungan mundur (3s, 5s, 10s) dan pilihan tema panduan pose.

2. **Interactive Booth & Pose Inspiration**:
   - Panel *Pose Guide Card* di samping kamera: Menampilkan ide pose lucu yang berubah otomatis per slot atau dapat di-shuffle pengguna.
   - Pada mode Duo: Host dan Guest melihat panduan pose yang selaras (misal: "Bentuk Setengah Hati dengan Tangan Kiri" & "Bentuk Setengah Hati dengan Tangan Kanan").
   - Indikator giliran yang jelas dan countdown bar melingkar dengan audio cue shutter.

3. **Decoration Studio & Korean Strip Customizer**:
   - Template Strip Presets: Classic Haru (Soft Sky Blue), Life4Cuts (Clean Crisp Ivory), Romantic Pastel (Blush Pink), Moody Y2K (Dark Night Film).
   - Stiker Pack Khas Korea: Hangul Stamps (대박, 귀여워, 하트, 최고), Sparkles, Cat/Bunny Ears, Ribbons, dan Doodles.
   - Toolbar dekorasi yang responsif, mudah digeser, diperbesar, diputar, dan dihapus.

4. **Export & Sharing**:
   - Preview strip resolusi tinggi 300 DPI siap cetak.
   - Fitur 1-click Download, Print langsung, Copy Image ke clipboard, serta Native Web Share untuk WhatsApp/Instagram Stories.

### Visual Identity & Theme Tokens

- **Warna & Palet (60-30-10 Rule)**:
  - Canvas (60%): `#FAF7F5` (Warm Cream Canvas) / `#FFFFFF` (Pure Card Surface).
  - Struktur & Border (30%): `#F1ECE7` (Soft Border Hairlines), `#64748B` (Muted Typography), `#1E293B` (Primary Text).
  - Aksen (10%): `#FF6B8B` (Korean Coral Pink Accent) & `#6366F1` (Indigo Focal Accent).
- **Tipografi**:
  - Headings: `Plus Jakarta Sans` / `Outfit` (Modern, playful geometric sans).
  - Body & UI Controls: `Plus Jakarta Sans` / `DM Sans` (Clean, legible 14-16px).
  - Strip Stamp & Watermark: Clean geometric sans dengan tabular numerals.

---

## 3. Key Product Decisions & Trade-Offs

### Keputusan 1: Pose Guide Card Engine
- **Solusi Terpilih**: Komponen *PoseInspirationBar* dengan koleksi referensi pose berbasis ilustrasi visual SVG dan teks aksi singkat yang sinkron per slot foto.
- **Rasional**: Ringan tanpa memerlukan download aset gambar berat eksternal, render instan, dan ramah kuota pengguna seluler.
- **Alternatif yang Ditolak**: Mengunduh foto referensi model eksternal berukuran besar yang berisiko lambat atau gagal dimuat pada koneksi lambat.

### Keputusan 2: Variasi Template Strip & Frame Engine
- **Solusi Terpilih**: Menambahkan sistem preset tema strip pada `canvasCompositor.ts` (Haru Blue, Blossom Pink, Classic Cream, Retro Charcoal, Lilac Dream) dengan header/footer khas Korea.
- **Rasional**: Memberikan variasi instan hanya dengan 1 klik tanpa membebani memori canvas.

### Keputusan 3: Stiker Pack Hangul & Cute Aesthetics
- **Solusi Terpilih**: Menambahkan kategori stiker baru: Hangul stamps (대박, 짱, 귀여워, 사랑해) dan Cute Doodles (Ribbon, Cloud, Heart Wings, Cat Whisker) menggunakan SVG vector shapes yang tajam di semua resolusi cetak.
- **Rasional**: Bebas artefak pikselasi saat dicetak ukuran besar.

---

## 4. Technical Architecture & Data Strategy

### System & Component Hierarchy

```
┌────────────────────────────────────────────────────────┐
│                        App.tsx                         │
│   (Socket State, Room Coordination, Active View Router)│
└──────────────────────────┬─────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  LobbyView   │  │CameraBooth   │  │Decoration    │
  │              │  │  View        │  │ StudioView   │
  └──────────────┘  └──────┬───────┘  └──────┬───────┘
                           │                 │
                ┌──────────┴──────────┐      ├──────────────┐
                ▼                     ▼      ▼              ▼
         ┌──────────────┐      ┌───────────┐ ┌───────────┐ ┌────────────┐
         │PoseGuideDeck │      │AntiBlink  │ │StickerPack│ │Canvas      │
         │(Sync Partner)│      │Capturer   │ │(Hangul/Cute│ │Compositor │
         └──────────────┘      └───────────┘ └───────────┘ └────────────┘
```

### Data Model & Pose Guide Schema

```typescript
export interface PoseSuggestion {
  id: string;
  category: 'cute' | 'bestie' | 'couple' | 'funny' | 'y2k';
  title: string;
  instructionA: string; // Instruksi untuk Host / Player A
  instructionB: string; // Instruksi untuk Guest / Player B (matching pose)
  iconType: string;
}

export interface StripThemePreset {
  id: string;
  name: string;
  bgHex: string;
  textColor: string;
  accentBorder: string;
  stampText: string;
}
```

### Interactive State Transitions

1. **Sinkronisasi Pose Guide**: Ketika Host berpindah ke slot berikutnya atau menekan tombol *Shuffle Pose*, event `room:pose_suggested` dikirimkan via WebRTC DataChannel sehingga layar Guest langsung menampilkan pose pasangannya.
2. **Koleksi Stiker Baru**: Pemilihan stiker Hangul/Cute langsung menempatkan elemen stiker di tengah preview strip dengan pegangan (handle) rotasi dan resize yang halus.
3. **Penyimpanan Draft Lokal**: State strip dan stiker tetap aman di memori lokal sehingga pengguna tidak kehilangan hasil dekorasi saat berpindah menu.
