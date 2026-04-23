
# Sprint 7 — Log Analyzer (Telemetri Köprüsü)

Sadece Log Analyzer. Guided Maintenance ve Manager Dashboard backlog'da.

## Ne yapacak

Saha teknisyeni makinenin PLC/HMI panelinden indirdiği log dosyasını (.txt / .csv / .log) makine ekranından yükler. AI dosyayı okur, alarm/uyarı örüntülerini çıkarır, **aynı makinenin geçmiş loglarıyla karşılaştırır** ("3 hafta önce de aynı titreşim örüntüsü vardı") ve önerilen aksiyonları listeler. Sonuç kalıcı saklanır, makine sayfasında geçmiş analizler görünür.

## Mimari (mevcut Video → SOP modeline birebir paralel)

```text
[MachineDetail.tsx]
   └─ <LogAnalyzerPanel/>
        ├─ Dosya seç (kamera değil, file picker)
        ├─ Storage'a yükle  ──►  bucket: machine-logs (private)
        ├─ INSERT machine_logs (status='uploaded')
        ├─ invoke('log_analyzer', { log_id })
        │     └─ edge fn:
        │         1. signed URL al, dosyayı indir (text)
        │         2. aynı machine_id için son 5 'ready' log'u çek (önceki findings)
        │         3. Gemini'ye gönder (tool call) → findings + recurring_match
        │         4. UPDATE machine_logs (status='ready', findings, ...)
        └─ Poll (3 sn) → 'ready' olunca sonuç kartı render
```

## Veritabanı

Yeni tablo `machine_logs`:
- `id uuid pk`
- `machine_id uuid` (zorunlu — tarihsel eşleştirme için)
- `wo_id uuid null`
- `storage_path text` (machine-logs bucket içinde `{user_id}/{uuid}.txt`)
- `file_name text`, `file_size int`
- `status text` ('uploaded' | 'processing' | 'ready' | 'failed')
- `summary text` — 1-2 cümlelik özet
- `findings jsonb` — `[{ severity: 'info'|'warn'|'critical', code: 'H-201', message: '...', count: 12, first_seen: '...', last_seen: '...' }]`
- `recurring_match jsonb` — `{ matched_log_id, matched_date, similarity_pct, note }` (nullable)
- `recommendations jsonb` — `[string]`
- `error_msg text null`
- `region region_t`
- `created_by uuid`, `created_at`, `updated_at`

RLS: `repair_videos` ile aynı kalıp (auth read all, auth insert own, owner update).

Storage bucket: `machine-logs` (private). RLS: kullanıcı sadece kendi `{auth.uid()}/...` klasörüne yazıp okur.

## Edge function: `log_analyzer`

- Input: `{ log_id }`
- Akış:
  1. `machine_logs` satırını al, status='processing' yap
  2. Storage'dan signed URL → dosyayı text olarak indir (max ~500KB; üstü ise ilk 500KB + son 50KB kırpılır)
  3. Aynı `machine_id` için son 5 `ready` kayıttaki `findings`'i context olarak topla
  4. Gemini `google/gemini-3-flash-preview` + tool call (`log_analysis_response` şeması: `summary`, `findings[]`, `recurring_match`, `recommendations[]`)
  5. Sonucu `machine_logs`'a yaz, status='ready'
  6. Hata → status='failed', error_msg
- Hata mesajları: 429 (rate limit) ve 402 (kredi) Türkçe çevrilip dönülür

## UI

**Yeni komponent**: `src/components/LogAnalyzerPanel.tsx`
- Üst: `<input type="file" accept=".txt,.csv,.log,.json">` + "Logu Analiz Et" butonu
- Yükleme: progress + "AI inceliyor…" durumu (status polling)
- Sonuç kartı:
  - Özet bandı
  - Findings listesi (severity'e göre renkli rozet: kritik=kırmızı, uyarı=sarı, info=gri)
  - Recurring match (varsa) — vurgulu kutu: "Bu örüntü {tarih} tarihindeki log ile %{x} eşleşiyor"
  - Öneriler (madde listesi)
- Altta: "Bu makinenin geçmiş analizleri" — kronolojik küçük liste, tıklayınca detay açılır

**`src/pages/MachineDetail.tsx`**: "Risk Analizi" bölümünün altına `<LogAnalyzerPanel machineId={machine.id} region={machine.region} />` eklenir. Mevcut "Risk Analizi" sabit metni kalır (sonradan finding'lerden beslenebilir, şimdi değil).

**`src/types/db.ts`**: `MachineLog` interface eklenir.

## Dokunulan/oluşturulan dosyalar

- **Yeni migration**: `machine_logs` tablosu + RLS + `machine-logs` storage bucket + bucket RLS
- **Yeni**: `supabase/functions/log_analyzer/index.ts`
- **Yeni**: `src/components/LogAnalyzerPanel.tsx`
- **Düzenleme**: `src/pages/MachineDetail.tsx` (panel mount)
- **Düzenleme**: `src/types/db.ts` (MachineLog tipi)

## Yapmadığım/yapmayacağım şeyler (net)

- Guided Maintenance — backlog
- Manager Dashboard / bilgi boşluğu raporu — backlog
- ROI calculator — backlog
- Çoklu dil — backlog
- Compliance/ISG checklist — backlog
- ffmpeg/binary log parsing — şimdilik sadece **text log** (PLC export'u zaten text/csv'dir)

## Maliyet/risk notu

Log dosyaları büyük olabilir. 500KB cap + tool calling ile token kontrolü. Aynı makineden tarihsel context yalnız `findings` jsonb'sinden gelir (ham log değil) → token şişmesi olmaz. Lovable AI gateway, mevcut `LOVABLE_API_KEY` ile çalışır, ek secret yok.

## Onay sonrası sıra

1. Migration (tablo + bucket + RLS)
2. `log_analyzer` edge function
3. `MachineLog` tipi
4. `LogAnalyzerPanel` komponenti
5. `MachineDetail.tsx` entegrasyonu

Onaylarsan kodlamaya geçerim.
