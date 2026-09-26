# Etkileşimli Tramvay Sergisi Taslağı — kullanım

## Açılış

Sunumu başka bilgisayara taşımak için **bu taslak klasörünü bütünüyle** kopyalayın. Klasör içindeki `index.html` dosyasını güncel Chrome veya Edge ile açın. İnternet, hesap, API anahtarı, kurulum ve sunucu gerekmez. Nötr örnek videolar, 3B kod ve örnek işaret klasör içindedir. Açılış videosu, tramvay sergisi, açılan son kapı ve kapanış videosu tek sayfada yukarı/aşağı kaydırılarak gezilir.

## Proje görsellerini ekleme

Sağ üstteki **Koleksiyonu Düzenle** düğmesinden 10 durağın görsellerini ve açıklamalarını ekleyin. Görseller JPG, PNG veya WebP olabilir; tek dosya üst sınırı 20 MB'dır. Kaydedilen içerikler yalnız o bilgisayarın tarayıcı deposunda tutulur. Başka bilgisayara taşımak veya yedeklemek için **JSON Yedeği İndir** seçeneğini kullanın. Hedef bilgisayarda aynı `index.html` dosyasını açıp **JSON Aç** ile bu dosyayı içe aktarın. JSON, görselleri de içerir. Tarayıcı verisi silinirse JSON yedeğiyle geri yüklenebilir.

## Sunum tekniği

- Açılış ve kapanış videosunda kaydırma konumu video zamanını kontrol eder; kaydırmayı tersine çevirmek videoyu geri sarar.
- Orta bölümde kaydırma, tramvay içindeki kamerayı ilerletir. Sağdaki 01–10 durak çizelgesinden veya alttaki oklardan durak seçilebilir.
- Bilgisayarda **Serbest Gezinti** düğmesine basınca fareyle 360° bakılır; `W/A/S/D` ile koridor içinde yürünür. Fare kilidi açılamazsa sahne üzerinde sürükleyerek bakılabilir. `E` bakılan yakın projeyi açar. `Esc` serbest moddan sunuma döner. Kaydırma son kapı geçişine geldiğinde serbest mod kapanır.
- Onuncu duraktan sonra kaydırma, kapıya yaklaşır; iki kapı kanadı açılır ve **Yeni Fikirleri Keşfedin** örnek başlığı görünür. Daha aşağı kaydırınca kapanış videosu başlar.
- Görünür proje çerçevesine tıklamak ayrıntı panelini açar. `Esc` paneli kapatır.
- WebGL kullanılamayan cihazlarda proje listesi açılır.

## Dosyalar ve sınırlar

Bu klasör yalnızca yerel inceleme için hazırlanmış ayrı adaydır; özgün projenin üzerine yazmaz. `assets/*-placeholder.mp4` dosyaları orijinal görüntüler yerine kullanılan aynı süreli hareketli renkli yer tutuculardır. `src/` ve `vendor/` geliştirme dosyaları, `app.js` ise çevrimdışı kullanıma hazır paketlenmiş koddur. İç mekân, tramvay temasına uygun **sunum konseptidir**; onaylı araç ölçüsü, işletme tasarımı veya mevcut tramvayın birebir dijital ikizi değildir. On proje örnek içeriktir; gerçek proje görsel ve metinleri eklenmemiştir.
