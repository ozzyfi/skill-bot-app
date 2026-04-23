

# ToolA 2.0 Yol Haritası — 5 Özellik, Mevcut Kod Üzerine

## Mevcut durum analizi (önce ne var, ne yok)

| Özellik | Var olan | Eksik / yapılacak |
|---|---|---|
| 1. Usta Profili | `USTA_PROFILES` **edge function içinde sabit kodlu** (Marmara/Ege/İç Anadolu, 3 usta). `technicians` tablosu var ama ayrı. | Veritabanına taşınacak (`master_profiles`). work.md + persona.md iki katman. Profil ekranı yönetimi. |
| 2. Aktif Correction | `corrections` tablosu var, kayıt aktif çalışıyor (Diagnosis.tsx satır 79–90). Edge function `corrections`'ı son 8 kayıt olarak prompt'a basıyor (satır 47–52). | "Aktif kural" katmanı yok. Şu an sadece düz metin enjeksiyonu. Kural tipi, sahne eşleştirme, devre dışı bırakma yok. |
| 3. Voice → İş Emri | CloseWO'da Web Speech API var **ama** transkripti **tek alana dökümpe ediyor** (satır 132–140 `autofillFromTranscript`). | AI parser yok. Transkript → JSON form alanları (Şikayet/Neden/Düzeltme/Parça/Süre) yapay zekayla bölünecek. |
| 4. Video → SOP | Hiç yok. Storage bucket yok. | Yeni bucket, video upload, Gemini Vision ile çerçeve analizi → adımlar → `learning_cases`. |
| 5. Güven + Kaynak Rozeti | `result.sources` ve `confidence` zaten edge function'dan geliyor. UI'da var ama **sadece bubble dibinde toplu liste** (Diagnosis.tsx 274–285). | Her **adımın yanında** rozet (kaynak + güven %). Adım bazlı kaynak için step şemasına `confidence` ve `source_ref` eklenecek. |

**Önemli karar**: 5 özelliği üç sprint'e bölelim — her sprint kendi başına çalışır, biri bitmeden öbürünü inşa etmek mantıksız çünkü 1 numara diğer 4'ünün altyapısı.

---

## Sprint 4 — Usta Profili (Foundation) + Güven/Kaynak Rozeti UI

**Neden birlikte**: Güven rozeti UI işi 1–2 saatlik, ek backend gerektirmiyor (mevcut alanları kullanıyor). Sprint 4'e eklemek ekonomik.

### Yapılacaklar

**A. Yeni tablo: `master_profiles`**
- Alanlar: `id`, `name`, `region`, `domain` (örn. "hidrolik"), `experience_years`, `city`, `work_md` (text — teknik bilgi), `persona_md` (text — 5 katman), `is_active`, `version`, `created_at`
- RLS: herkes okur (authenticated), sadece admin yazar — şimdilik admin role yok, `created_by = auth.uid()` ile own-write yeterli, sonra admin role eklenebilir
- Seed: edge function'daki 3 ustayı (Kemal, Ahmet, Murat) work.md + persona.md formatında tabloya taşı

**B. Edge function `diagnose` güncellemesi**
- `USTA_PROFILES` sabitinden `master_profiles` tablosundan okumaya geç
- Eşleştirme mantığı: önce `region` ile filtre, varsa `domain` (hidrolik/elektrik/mekanik) ile en uygun
- `buildSystemPrompt` work_md + persona_md'yi olduğu gibi sisteme enjekte eder
- Geri dönüş: `usta` objesine `id`, `domain` da eklenir

**C. Güven + Kaynak Rozeti (her adım yanında)**
- Edge function'daki `TOOL` şemasında `steps` item'ına opsiyonel iki alan ekle: `source_ref` (string — örn. "Hidrolik_Manuel.pdf · sf.42") ve `confidence` (number 0–100)
- Sistem prompt'a kural ekle: "Her adımda mümkünse kaynak ve güven belirt"
- `Diagnosis.tsx` AssistantBubble step render'ında sağ alt köşede küçük rozet:
  ```
  [Kaynak: Hidrolik_Manuel sf.42] [%87]
  ```
- Mevcut alt-bölüm "Kaynaklar" toplu listesi kalır (genel kaynaklar için)

**D. Profile sayfası — "Usta'm" sekmesi**
- Profile.tsx'e bölge için aktif master profile'ı oku, work_md/persona_md önizleme göster (read-only şimdilik)
- "Bu cevap kimden geldi?" şeffaflığı

**Çıktı**: Marmara'dan biri "H-201" sorduğunda Kemal Usta cevap veriyor, her adımın yanında kaynak + güven görünüyor, profil ekranında "Bu cevapları Kemal Usta veriyor" yazıyor.

**Sprint 4 dokunduğu dosyalar**: yeni migration, `supabase/functions/diagnose/index.ts`, `src/pages/Diagnosis.tsx` (AssistantBubble), `src/pages/Profile.tsx`. Yeni: `src/types/db.ts` (MasterProfile tipi).

---

## Sprint 5 — Aktif Correction Döngüsü + Voice → İş Emri

**Neden birlikte**: İkisi de orta-büyük iş, ikisi de mevcut bir özelliğin "akıllılaştırılması". Yeni tablo + yeni edge function birlikte deploy edilir.

### Yapılacaklar

**A. Aktif Correction katmanı**
- Yeni tablo: `correction_rules`
  - Alanlar: `id`, `master_profile_id` (fk), `region`, `scene_pattern` (text — eşleşecek anahtar kelimeler/regex), `wrong`, `correct`, `lesson`, `is_active`, `applied_count`, `created_at`, `created_by`
- Mevcut `corrections` tablosu kalır (ham kayıt için), ama 👎 → correction_learned dönüşünde **otomatik olarak** `correction_rules`'a da eklenir
- `diagnose` edge function:
  - Mevcut "son 8 correction" yerine: aktif kuralları çek, **sahne eşleşmesi** yapanları seç (basit: scene_pattern keywords içeren soru), system prompt'a "ZORUNLU UYULACAK KURALLAR" başlığıyla enjekte et
  - Her uygulama sonrası `applied_count++`
- Profile / Admin sayfada: "Bu bölgede öğrenilmiş kurallar" listesi (sayı + son uygulama)

**B. Voice → İş Emri (AI parser)**
- Yeni edge function: `voice_to_workorder`
  - Input: `{ transcript: string, category: "ariza"|"bakim"|"parca"|"diger" }`
  - Lovable AI gateway'e tool calling ile çağrı: kategori şemasına göre alanları çıkart
  - Model: `google/gemini-3-flash-preview` (hızlı, ucuz, Türkçe iyi)
  - Output: `{ values: { ariza: "...", neden: "...", yapilan: "...", sure: "45" } }`
- `CloseWO.tsx` `autofillFromTranscript` fonksiyonu:
  - Eski "tek alana dök" mantığını sil
  - Web Speech API transkripti tamamlandığında → `voice_to_workorder` çağır → dönen `values`'ı tek tek `setValues` ile yerleştir
  - Loading state: "Anlatılanı alanlara yerleştiriyorum…"
- Deepgram **eklenmiyor** — Web Speech API yeterli (zaten çalışıyor) + Gemini parsing yeni değer ekleyen kısım. Deepgram parası vs ek karmaşıklık şimdilik gereksiz; ihtiyaç olursa Sprint 6+ya bırakırız.
- Offline için: çevrimdışıysa eski heuristic fallback (textarea'ya ham transkripti koy) çalışmaya devam eder

**Çıktı**: Usta 👎 verdiğinde "Yağ filtresinden önce hortumu kontrol etmeliydim" dediğinde, bir sonraki "H-201 düşük basınç" sorusunda AI otomatik o kuralı uyguluyor. /close ekranında mikrofona "Filtre tıkalıydı, değiştirdim, 45 dk" dediğinde 4 alan tek seferde dolu.

**Sprint 5 dokunduğu dosyalar**: yeni migration, yeni `supabase/functions/voice_to_workorder/index.ts`, `supabase/functions/diagnose/index.ts` (kural enjeksiyonu), `src/pages/Diagnosis.tsx` (correction → rule dönüşümü), `src/pages/CloseWO.tsx` (autofill yeniden yaz), `src/pages/Profile.tsx` (kurallar listesi).

---

## Sprint 6 — Video → SOP

**Neden tek başına**: Storage, video processing, Gemini Vision ayrı bir bağımlılık zinciri. Diğerleri hayata geçtikten sonra bunu eklemek daha güvenli.

### Yapılacaklar

**A. Storage + tablo**
- Yeni bucket: `repair-videos` (public değil, signed URL ile erişim)
- Yeni tablo: `repair_videos` — `id`, `learning_case_id` (fk nullable), `wo_id` (fk), `storage_path`, `duration_sec`, `sop_steps` (jsonb — adımlar), `transcript`, `status` ("uploaded"|"processing"|"ready"|"failed"), `created_by`, `created_at`
- RLS: own-write, region-read

**B. Edge function `video_to_sop`**
- Input: `{ video_id, storage_path, wo_context }`
- İşleyiş:
  1. Storage'dan signed URL al
  2. Video'dan ffmpeg ile her N saniyede bir frame çıkar (Deno + ffmpeg WASM **karmaşık** — alternatif: Gemini 2.5-flash zaten video URL kabul ediyor, doğrudan video URL'sini multimodal mesaj olarak gönder)
  3. Tool call ile `sop_response` şemasında `steps[]` ve `summary` döndür
  4. `repair_videos` satırını güncelle, `learning_cases`'e link

**C. UI**
- `CloseWO.tsx` ve `JobDetail.tsx`'a "Video Çek" butonu — `<input type="file" accept="video/*" capture="environment">` ile mobil kamera açar
- Upload progress, "AI işliyor…" durumu (poll ile status kontrolü)
- Hazır olduğunda `learning_cases` üzerinden o makinenin geçmişinde görünür, yeni iş emri açıldığında benzer şikayetlerde "İlgili video: …" önerisi

**Çıktı**: Usta tamir esnasında 90 saniye video çeker, 30 saniye sonra adım adım yazılı prosedür sahasına yazar.

**Sprint 6 dokunduğu dosyalar**: yeni migration (bucket + tablo + RLS), yeni `supabase/functions/video_to_sop/index.ts`, `src/pages/CloseWO.tsx` (upload buton), `src/pages/JobDetail.tsx` (video önerisi).

---

## Önerilen sıra ve gerekçe

1. **Sprint 4** önce (3–5 saatlik iş): Usta profilini koddan tabloya taşımak diğer her şeyin altyapısı. Güven rozeti küçük ama görsel etki yüksek, beraber ekonomik.
2. **Sprint 5** (5–7 saat): Hem öğrenme döngüsü hem ses-form. İkisi en yüksek "saha değeri" katan özellikler. Voice parsing bittiğinde demo etkisi büyük.
3. **Sprint 6** (4–6 saat): Video. Diğerleri çalıştıktan sonra. Mobil kamera + storage + AI vision en kırılgan zincir, en sona.

## Teknik notlar / dikkat noktaları

- **`technicians` tablosu**: zaten var ama persona/work-md alanı yok. Ya bu tabloyu genişletip yeniden kullanırız (kolonlar ekleriz) ya da yeni `master_profiles` tablosu açıp `technicians`'ı sade bir lookup olarak bırakırız. **Öneri**: yeni `master_profiles` tablosu — `technicians` 4 alanlık basit liste, master profile çok daha zengin; karıştırmak kafa karıştırır.
- **Edge function'da hardcoded `USTA_PROFILES`**: silinmiyor hemen, fallback olarak kalabilir (DB boşsa). 1 hafta sonra kaldırılır.
- **`corrections` tablosu**: silinmiyor. Aktif kural katmanı **üstüne** eklenir; ham veri tarihsel olarak kalır.
- **Lovable AI gateway**: Hem `voice_to_workorder` hem `video_to_sop` aynı `LOVABLE_API_KEY`'i kullanır, ek secret yok. Maliyet izlenmeli (özellikle video).
- **Yönetici dashboard'u**: Sen dedin "yönetici tarafı için önemli" — bu listede yok ama Sprint 4'ün master_profiles tablosu ile Sprint 5'in correction_rules tablosu hazırsa, dashboard ileride ayrı bir build (Sprint 7) olarak inşa edilir.

## Şimdi karar

Bu yol haritası mantıklı geldiyse **Sprint 4** ile başlayalım — Usta profili tabloya taşınır + güven/kaynak rozeti her adımın yanına eklenir. Onayını verirsen kodlama moduna geçip migration ve dosya değişikliklerini yaparım.

