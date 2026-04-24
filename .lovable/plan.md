
# ToolA: HTML Prototip Tasarımını React'e Port Etme

## Amaç
Ekteki `toola-v4_sonindirdim.html` dosyasının görsel tasarımını ve kullanıcı akışını React projesine **birebir** taşımak. Backend (Supabase), edge function'lar (`diagnose`, `voice_to_workorder`, `log_analyzer`, `video_to_sop`), `useAuth`, `useSyncQueue`, `LogAnalyzerPanel`'in iç mantığı **hiç değişmeyecek** — sadece görünüm ve UX akışı.

## Anlaştığımız Sınırlar (DOKUNULMAYACAK)
- `src/integrations/supabase/*` (otomatik yönetilir)
- `supabase/functions/*` — tüm edge function kodu
- `src/hooks/useAuth.tsx`, `src/hooks/useSyncQueue.ts` — iç mantık
- Edge function çağrı şekilleri (URL, payload, response handling)
- Veritabanı şeması, RLS politikaları, profil/rol yapısı
- `Auth.tsx` (demo girişi zaten çalışıyor — sadece renk değişkenleri otomatik güncellenecek)

## Yapılacaklar

### 1. Tasarım Sistemi — `src/index.css`
HTML'deki `:root` değişkenlerini birebir port et. Mevcut `--primary: 152 78% 27%` zaten yeşil (#0f7a4a) ile uyumlu, ama tüm tonları HTML ile eşitle:

```text
--bg            → #ffffff
--bg-2          → #f6f7f8
--bg-3          → #eceef0
--border        → #e3e5e8
--border-strong → #c9ccd1
--text          → #111418
--text-2        → #4a5058
--text-3        → #8a9099
--accent        → #0f7a4a   (primary)
--accent-2      → #0c6240   (primary hover)
--accent-bg     → #e6f3ec   (primary-bg)
--danger        → #c42d20   (destructive)
--danger-bg     → #fce9e7
--warn          → #a56e00
--warn-bg       → #faefd4
--shell-bg      → #d8dbe0   (telefon kabuğu gri)
```

HTML'deki şu component sınıflarını `@layer components` altına taşı (bazıları zaten var, eksik olanları ekle):
- `.thinking`, `.think-step`, `.think-dot` + `@keyframes spin-dot`
- `.steps-wrap`, `.step`, `.step.done`, `.step-num`, `.step-text`, `.step-ref`, `.step-expected`
- `.conflict-card`, `.conflict-row`, `.conflict-win`
- `.safety`, `.safety-list`
- `.confidence-row`, `.confidence-num`, `.alt`
- `.cat-chips`, `.cat`, `.cat.active`
- `.voice-call`, `.voice-call.filled`, `.voice-mic-sm`
- `.listen-overlay`, `.listen-sheet`, `.waveform`, `.wave-bar` + `@keyframes wave/blink/slide-up`
- `.transcript`, `.cursor-blink`
- `.field-block`, `.field-label`, `.field-input`, `.field-area`, `.ai-fill`
- `.bubble-user`, `.bubble-ai`, `.bubble-typing` + `@keyframes typing`
- `.success-modal`, `.success-card`, `.success-icon` + `@keyframes pop/fadeIn`
- `.depth-toggle`, `.depth-panel`, `.depth-arrow.open`
- `.feedback-row`, `.feedback-btn`
- `.sources-wrap`, `.source`, `.source-tag.p/k/s`
- `.toast`
- `.mic-compact`, `.mic-huge` + `@keyframes ping`

### 2. `Diagnosis.tsx` — Teşhis Ekranı
Mevcut state yönetimi ve `supabase.functions.invoke('diagnose', …)` çağrısı **olduğu gibi kalacak**. Sadece JSX yeniden yazılacak.

**Yeni yapı:**
1. **Hero (boş durum):** `mic-huge` butonu + `mic-hint` + `chips` (Hata kodu sor / Bakım planı / Parça uyumu gibi hızlı sorular).
2. **Soru gönderildi → Düşünme animasyonu (thinkingBox):**
   - `<ThinkingSteps />` adında yeni bileşen.
   - Adımlar: "Hata kodu analiz ediliyor", "Kılavuz taranıyor", "Saha verileri eşleştiriliyor", "Çelişkiler kontrol ediliyor".
   - Her adım `pending → active (spin-dot animasyon) → done (✓)` geçişi (her adım ~600 ms; toplam diagnose çağrısı bitince hepsi `done` olur).
   - Çağrı bitince thinking gizlenir, sonuç gösterilir.
3. **Sonuç ekranı:**
   - `safety` bloğu (varsa güvenlik uyarıları kırmızı kutu).
   - `steps-wrap` — adım adım checklist: her adım kart (`<StepCard />`), tıklanınca `done` toggle (üstü çizilir, opaklık 0.65).
   - `steps-counter` (X / Y tamamlandı), `steps-read-btn` (sesli okuma — şimdilik UI; TTS bağlantısı opsiyonel).
   - `depth-toggle` (Detay göster / gizle) — açılınca:
     - **Conflict cards:** Edge function response'unda `conflicts` alanı varsa her biri için `<ConflictCard />` (Kılavuz: ... / Saha: ... / Kazanan: ...).
     - **Confidence:** Güven skoru + alternatif teşhisler.
     - **Patterns / Tips:** Saha kalıpları, ipuçları.
   - `sources-wrap` — kaynak listesi (P=PDF kılavuz, K=Bilgi tabanı, S=Saha raporu rozeti).
   - `feedback-row` (👍 / 👎) — feedback'i mevcut tabloya yazmaya devam et.

**Veri eşleme:** `diagnose` edge function response'u zaten `{ steps, safety, conflicts?, confidence?, alternatives?, sources?, ... }` formatında dönüyor (mevcut kod bunu okuyor). Sadece UI bileşenlerine prop olarak geçirilecek; eksik alanlar olursa o blok gizlenir.

### 3. `CloseWO.tsx` — İş Emri Kapatma
Mevcut `voice_to_workorder` edge function çağrısı **olduğu gibi kalacak**. UI yeniden düzenlenecek.

**Yeni yapı:**
1. **Topbar:** Geri butonu + "İş Emri Kapat" başlığı + sağda WO referansı.
2. **Context row:** Makine / Lokasyon / WO numarası tek satır.
3. **Kategori chipleri (`cat-chips`):** Arıza · Bakım · Parça Değişimi · Kontrol · Diğer. Tıklandığında `active` (yeşil dolgu) olur, kategori state'e yazılır → AI doldurma promptuna eklenir.
4. **Voice-call CTA:**
   - İlk hâl: Yeşil kutu, "Sesle anlat — formu otomatik dolduralım" + mikrofon ikonu.
   - Tıklayınca `listen-overlay` açılır (alt sheet, slide-up).
   - Overlay içinde: "DİNLENİYOR" rozeti + canlı `waveform` (8 çubuk, wave animasyon) + `transcript` alanı (cursor-blink) + "Bitir" / "İptal" butonları.
   - Web Speech API (mevcut implementasyon varsa korunacak) ile transkript canlı yazılır.
   - "Bitir" → transkript + kategori → `voice_to_workorder` edge function çağrılır → response'taki alanlar form alanlarına yazılır.
   - Voice-call kutusu `filled` state'ine geçer (kesik çizgili gri, "✓ AI doldurdu — istersen düzenle").
5. **Form alanları (AI dolduruldu işareti):** Açıklama, Yapılan iş, Kullanılan parça, Süre. AI tarafından dolduran alanlarda `field-label` üstünde küçük yeşil "AI DOLDURDU" rozeti (`.ai-fill.on`), input'ta hafif yeşil arkaplan (`.field-block.filled`).
6. **Bottom-bar:** "Taslak kaydet" (secondary) + "İş Emrini Kapat" (primary). Submit zaten Supabase'e yazıyor — değişmeyecek.
7. **Success modal:** Kapatma başarılı olunca pop animasyonlu yeşil ✓ kart + WO numarası.

### 4. `Home.tsx` — Ana Ekran
Mevcut veri kaynağı (Supabase'den jobs/machines) korunur. UI:
- Üst: "Merhaba {profile.name}" + alt başlıkta atanan iş sayısı.
- `home-tabs`: **İşlerim** | **Bölgem** (sayaç rozetli, aktif tab altında yeşil çubuk).
- **İşlerim** sekmesi: `.job` kartları (HTML'deki gibi başlık + badge urgent/active/scheduled + lokasyon + açıklama + WO ref).
- **Bölgem** sekmesi: region-summary stat kartları + arama input + filtre chipleri (region-chip, warn/danger varyantları) + şehre göre gruplu makine listesi (`.machine` kart, `.ms-badge` ok/busy/fault/service).
- Quick-ask CTA (yeşil büyük buton) — "Bir şey sor" → /diagnosis'a yönlendirir.

### 5. `MachineDetail.tsx` & `JobDetail.tsx`
- `topbar` (geri + ortalı başlık).
- `detail-top` (büyük isim + meta info satırı).
- `risk-card`'lar (HTML'deki "Risk analizi" yapısı — ikon + başlık + yüzde + detay).
- `section`'lar (parça listesi `part-check` checkbox'larıyla, log geçmişi).
- `bottom-bar` sticky (Geçmiş / Teşhis / Kapat butonları).

### 6. `PhoneShell.tsx`
HTML'deki `.device` çerçevesini birebir uygula (max 440px, dvh, gölge, kenarda yuvarlak telefon kabuğu hissi). Header (`ToolA` logo + müşteri + online/offline badge) + scroll-area + alt `tabbar` (3 sekme: Ana / Sor / Profil). Mevcut `tabbar` zaten var — sadece HTML'in `.tab-btn` stiline göre revize.

### 7. Yeni paylaşılan bileşenler (`src/components/`)
Tekrar kullanılabilirlik için:
- `ThinkingSteps.tsx` — adım adım düşünme animasyonu.
- `StepCard.tsx` — checklist kartı.
- `ConflictCard.tsx` — kılavuz/saha çelişkisi.
- `VoiceListenOverlay.tsx` — sesli giriş alt-sheet (waveform + transkript).
- `SuccessModal.tsx` — başarı pop'u.
- `Toast.tsx` — alt bildirim balonu (zaten `sonner` var, oradan stillenecek).

### 8. Auth & Brain — DEĞİŞMEYECEK
- `useAuth`, `Auth.tsx` (demo girişi dahil) ve tüm edge function akışı **dokunulmaz**.
- Sadece `Auth.tsx`'deki Tailwind sınıfları yeni renk değişkenlerini kullandığı için otomatik olarak yeni yeşil tona geçer.

## Teknik Detaylar
- Tüm renkler HSL formatında `index.css` `:root` içinde, Tailwind `tailwind.config.ts`'deki `colors` mapping'i zaten HSL değişkenlerini okuyor — config'e dokunmaya gerek yok.
- Animasyonlar Tailwind `keyframes` yerine `index.css` `@layer components` içinde global olarak tanımlanır (HTML'deki keyframe isimlerini koruyalım: `ping`, `spin-dot`, `wave`, `blink`, `slide-up`, `pop`, `fadeIn`, `typing`).
- Mevcut shadcn `button.tsx`, `card.tsx`, `input.tsx` vb. korunur; sadece sayfa-spesifik özel bileşenler yeni CSS sınıflarını kullanır.
- Tüm metin Türkçe (HTML ile aynı).
- Mobil ilk (max-width 440px) — masaüstünde ortalanmış telefon kabuğu görünümü.

## Onay Sonrası İlk Adım
1. `index.css` — renk + tüm component sınıfları + keyframe'ler.
2. `Diagnosis.tsx` — ThinkingSteps + StepCard + ConflictCard ile yeniden yaz.
3. `CloseWO.tsx` — kategori chipleri + VoiceListenOverlay ile yeniden yaz.
4. `Home.tsx`, `MachineDetail.tsx`, `JobDetail.tsx`, `PhoneShell.tsx` — HTML görseline göre güncelle.
5. Backend, edge function, auth tarafına HİÇBİR dokunuş yok.

Anlaştık mı? Onay verirsen yukarıdaki sırayla uygulamaya geçerim.
