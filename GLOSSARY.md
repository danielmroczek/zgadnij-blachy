# Glosariusz

**Pole odpowiedzi**:
Przycisk w siatce odpowiedzi (`.answer`), klikalna opcja pytania; ma stałą
wysokość: 2 linie etykiety + 1 linia etykiety województwa + pady —
niezależnie od długości treści; liczby (wysokości w px, progi breakpointów)
żyją w `public/style.css`, a zgodność etykiet weryfikuje probe
`script/probe-odpowiedzi.js`.
_Avoid_: opcja, przycisk odpowiedzi

**Etykieta odpowiedzi**:
Tekst w polu odpowiedzi, tworzony przez `formatAnswer` — siedziba powiatu +
rozróżnienie `(miasto)`/`(p. …)`; skończony zbiór 380 etykiet (wszystkie powiaty,
tożsamość = województwo + nazwa, więc duplikaty nazw między województwami są osobne).
_Avoid_: odpowiedź, nazwa dystraktora

**Województwo tablicy**:
Województwo, do którego należy bieżąca tablica; gracz uczy się go z etykiety
województwa na karcie poprawnej odpowiedzi (na wąskich ekranach to jedyne
miejsce jego wystąpienia — nie jest dublowane pod tablicą).
_Avoid_: region, woj. tablicy