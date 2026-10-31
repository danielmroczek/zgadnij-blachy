// Descriptive verdicts of the summary screen — SOURCE OF TRUTH (plaintext, easy to edit).
//
// Uwaga: ten plik NIE trafia na stronę. `npm run encode-verdicts` koduje zdania
// (XOR + base64) do public/js/verdicts-data.js, którego używa quiz.js — dzięki temu
// w źródłach strony nie widać od razu całej listy (best-effort zasłonięcie).
// Edytujesz TUTAJ, odpalasz encode-verdicts, gotowe.
//
// Struktura: VERDICTS[wynik] = tablica 3 wariantów dla wyników 0..10.
// Ton: lekki, sympatyczny, żartobliwy — bez krytykowania gracza,
// bez żargonu analitycznego (słowo „dystraktory" jest zakazane).

export const VERDICTS = [
  /* 0 */ [
    'Zero punktów — czyli wszystko przed Tobą! Następna runda może pisać historię.',
    'Każdy znawca tablic kiedyś zaczynał od pierwszej blachy. Jeszcze raz?',
    'Bez punktów, za to z gwarancją emocji. Od zera do bohatera — dawaj rewanż!',
  ],
  /* 1 */ [
    'Jeden punkt na start — trafienie już było, reszta jeszcze w drodze. Rozgrzewka zaliczona!',
    'Przynajmniej wiesz już, że euroband to nie ozdoba. Do boju!',
    'Pierwsza blacha odczytana poprawnie! Kolejne czekają — spróbuj jeszcze raz.',
  ],
  /* 2 */ [
    'Dwa punkty — coś Ci już mówi pierwsza litera. Teraz czas na drugą!',
    'Przeczuwasz więcej, niż strzeliłeś. Czas to zamienić na pewność.',
    'Para punktów do kolekcji. Polskie drogi czekają na Twój rewanż!',
  ],
  /* 3 */ [
    'Trzy punkty — stać Cię na więcej, a dobrego nosa do kodów już widać.',
    'Co trzecia tablica mówi Ci prawdę. Biegniesz dobrym kierunkiem!',
    'Solidna trójka. Jeszcze kilka rund i zaskoczysz sam siebie.',
  ],
  /* 4 */ [
    'Cztery punkty — do połowy już blisko, a nos do kodów to Twój rosnący atut.',
    'Połowa znajomości tablic już w kieszeni. Naprzód!',
    'Czworka! Coraz częściej zgadujesz, zanim pojawią się odpowiedzi, co?',
  ],
  /* 5 */ [
    'Pięć na dziesięć — równo i uczciwie. Jeszcze jedna runda i złapiesz szóstkę.',
    'Połowa drogi za Tobą. Prawie jak przeciętny kierowca, tylko świadomie.',
    'Półmetek! Przy tym tempie następnym razem zdejmiesz siódemkę.',
  ],
  /* 6 */ [
    'Nieźle! Wynik powyżej średniej — polskie tablice czytasz już z pewną swobodą.',
    'Tablice mówią do Ciebie coraz ciekawiej. Krok od bardzo dobrego wyniku!',
    'Sześć punktów — więcej niż trafia większości. Czas pomyśleć o własnym rekordzie!',
  ],
  /* 7 */ [
    'Siedem punktów — świetny wynik! Kody powiatów to już u Ciebie nawyk, nie przypadek.',
    'Niejeden kierowca pomachałby Ci z podziwem. Trzymaj tempo!',
    'Siódemka — wyróżniki już Cię nie przerastają. Coś pięknego się dzieje!',
  ],
  /* 8 */ [
    'Osiem punktów — mistrzowska kontrola nad tablicami. Rekord jest blisko!',
    'Prawie bezbłędnie. Jeszcze jedna runda i dopniesz do perfekcji.',
    'Ósemka! Powiaty same przychodzą Ci do głowy — właśnie o to chodzi.',
  ],
  /* 9 */ [
    'Dziewięć punktów — niemal bezbłędnie! Kody powiatów są Twoją specjalnością.',
    'Tylko jedna tablica Cię zaskoczyła. Pozostałe już się boją.',
    'Jeszcze jedna runda — może akurat tym razem 10/10?',
  ],
  /* 10 */ [
    'Komplet punktów — mistrz tablic! Polskie drogi nie mają przed Tobą tajemnic.',
    'Ani jednej pomyłki. Nic dodać, nic ująć. Gratulacje!',
    'Perfekcja! Dziesięć z dziesięciu — tak trzymać, Kapitanie Kodów!',
  ],
];
