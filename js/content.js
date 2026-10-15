// tresc gry: NPC, questy, bossowie sal. Same dane i dwie funkcje skladajace spotkanie w sali.
// Postacie sa fikcyjne.

// --- NPC z questami (slot = id z mapa.json -> npc_slots) -------------------------------------
const NPC_DEFS = {
  woznik: { name: 'Woźny Heniek', slot: 'npc-0-02', color: '#7a4bd1', voice: { pitch: 140 }, quests: ['bugi'],
    idle: ['* Szkoła nie sprząta się sama.{p} A szkoda.'], idleRepeat: [['* Znowu Ty?{p} Pytaj, o co chcesz.'], ['* Idź już, {p}mam co robić.']] },
  sekretarka: { name: 'Pani Sekretarka', slot: 'npc-0-01', color: '#d1684b', voice: { pitch: 360 }, quests: ['pieczatka'],
    idle: ['* Wszystko wymaga pieczątki.{p} Wszystko.'], idleRepeat: [['* Pieczątka sama się nie znajdzie.']] },
  uczen: { name: 'Uczeń z 3B', slot: 'npc-1-02', color: '#4bb0d1', voice: { pitch: 260 }, quests: ['liscik'],
    idle: ['* Nie mam czasu,{p} kartkówka!'], idleRepeat: [['* Jeszcze tu jesteś?']] },
  bibliotekarka: { name: 'Pani Bibliotekarka', slot: 'npc-1-05', color: '#4bd183', voice: { pitch: 380 }, quests: [],
    idle: ['* Ciii.{p} To biblioteka.{p} No, prawie.'], idleRepeat: [['* {shake}Ciii!{/shake}']] },
  dyrektor: { name: 'Pani Dyrektor', slot: 'npc-3-03', color: '#d1b04b', voice: { pitch: 200 }, quests: ['klucz'],
    idle: ['* Słucham?'], idleRepeat: [['* Jeśli to nie pilne,{p} wróć później.']] },
};

// gadajace tla na pozostalych slotach (kolejnosc = kolejnosc slotow)
const FLAVOR_NPCS = [
  { name: 'Uczennica z 1A', color: '#c25a9c', voice: { pitch: 320 }, idle: ['* Słyszałaś o bugach w holu?{p} Podobno gryzą.'] },
  { name: 'Uczeń z 2C', color: '#5a7cc2', voice: { pitch: 230 }, idle: ['* Na drugim piętrze jest {c:yellow}pieczątka{/c}.{p} Ktoś ją schował za ławką.'] },
  { name: 'Kolega z klasy', color: '#8aa14b', voice: { pitch: 190 }, idle: ['* Aula jest zamknięta.{p} Dyrektorka ma klucz.'] },
  { name: 'Pani od matematyki', color: '#a14b4b', voice: { pitch: 300 }, idle: ['* Sprawdzian jutro.{p} {shake}Jutro!{/shake}'] },
  { name: 'Ochroniarz', color: '#555f6e', voice: { pitch: 110 }, idle: ['* Nic tu nie ma.{p} Idź dalej.'] },
  { name: 'Uczeń z 4D', color: '#c2a04b', voice: { pitch: 210 }, idle: ['* Sale są pełne dziwnych potworów.{p} Wejdź w drzwi, {p}jeśli się nie boisz.'] },
  { name: 'Praktykant', color: '#4bc2b0', voice: { pitch: 280 }, idle: ['* Pierwszy dzień.{p} Wszystko mnie przeraża.'] },
  { name: 'Pani Woźna', color: '#a1704b', voice: { pitch: 340 }, idle: ['* Nie deptać po umytym!'] },
];

// --- questy (silnik: js/quests.js). Pola dodatkowe: onAccept / onDone obsluguje game.js ---------
const QUEST_DEFS = {
  bugi: { id: 'bugi', title: 'Bugi w korytarzu', type: 'kill', giver: 'woznik', zone: 'f0-corridor', zoneName: 'Korytarz', count: 5,
    offerLines: [{ text: '* Słuchaj,{p} mamy {c:red}problem{/c}.', face: 'sad' }, '* Po korytarzu biegają {shake}bugi{/shake}.{p} Gryzą kable i uczniów.',
      '* Weź ten {c:yellow}pistolet{/c}.{p} Wyczyść korytarz i oddaj mi broń.'],
    activeLines: ['* Jeszcze nie skończyłeś.{p} Bugi biegają po korytarzu.'], doneLines: [{ text: '* Czysto!{p} Dziękuję.', face: 'smile' }, '* Broń zabieram.{p} Szkoła ma swoje zasady.'],
    onAccept: { weapon: true, ammo: 40, spawn: { floor: 0, zone: 'f0-corridor', type: 'bug', count: 5 } }, onDone: { weapon: false }, reward: { xp: 60 } },
  pieczatka: { id: 'pieczatka', title: 'Zaginiona pieczątka', type: 'fetch', giver: 'sekretarka', item: 'pieczatka', itemName: 'Pieczątka (II piętro)', requires: ['bugi'],
    offerLines: ['* Bez pieczątki nie wydam żadnego dokumentu.', '* Ktoś zostawił ją na {c:yellow}drugim piętrze{/c}.{p} Przyniesiesz?'],
    activeLines: ['* Pieczątka.{p} Drugie piętro.{p} Szukaj przy ławkach.'], doneLines: [{ text: '* Jest!{p} Dziękuję.', face: 'smile' }], reward: { xp: 50 } },
  liscik: { id: 'liscik', title: 'Liścik do bibliotekarki', type: 'talk', giver: 'uczen', to: 'bibliotekarka',
    offerLines: ['* Mogłabyś zanieść ten liścik {p}Pani Bibliotekarce?', '* Ja się {shake}wstydzę{/shake}.'], deliverLines: ['* Liścik od ucznia?{p} Jakie to słodkie.'], deliverLabel: 'Podaj liścik',
    activeLines: ['* Poszło?'], doneLines: ['* Super!{p} Jesteś wielki.'], reward: { xp: 40 } },
  klucz: { id: 'klucz', title: 'Klucz do auli', type: 'talk', giver: 'dyrektor', to: 'woznik', requires: ['bugi', 'pieczatka', 'liscik'],
    offerLines: [{ text: '* Słyszałam o Twoich wyczynach.', face: 'smile' }, '* W auli zalęgło się coś {c:red}dużego{/c}.{p} Klucz ma Woźny Heniek na parterze.', '* Idź do niego i powiedz,{p} że ja Cię przysyłam.'],
    deliverLines: ['* Dyrektorka Cię przysłała?{p} No dobrze.{p} Masz {c:yellow}klucz do auli{/c}.'], deliverLabel: 'Powiedz o kluczu',
    activeLines: ['* Woźny Heniek ma klucz.{p} Parter.'], doneLines: [{ text: '* Klucz masz.{p} Powodzenia w auli.', face: 'smile' }], reward: { xp: 100, unlock: ['drzwi-auli'] } },
};

// przedmioty do znalezienia w swiecie
const ITEM_PLACE = [{ item: 'pieczatka', name: 'Pieczątka', floor: 2, x: 44.5, y: 27.5 }];
const FOOD_PLACE = [[0, 20.5, 29.5], [0, 60.5, 26.5], [1, 20.5, 29.5], [1, 62.5, 26.5], [2, 20.5, 29.5], [2, 60.5, 29.5], [3, 22.5, 26.5], [3, 62.5, 29.5]];

// --- sale z bossami -----------------------------------------------------------------------------
const FINAL_ROOM = 'f1-aula';
const FINAL_BOSS = {
  name: 'Dyrektor Bugów', hp: 120, xp: 250, look: { color: '#2e2e3a', head: '#ff4d4d' }, turnTicks: 420,
  intro: '* Dyrektor Bugów blokuje scenę w auli.', check: '* DYREKTOR BUGÓW. Zbudowany z każdego błędu, który zgłosił uczeń.',
  killText: '* Dyrektor Bugów rozsypuje się w stos zielonych bugów.', spareText: '* Dyrektor Bugów podpisuje Ci świadectwo i odchodzi.',
  flavor: ['* Aula drży.', '* Z każdego rzędu wyłażą bugi.', '* Dyrektor Bugów rzuca zgłoszeniem w powietrze.'],
  acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'fix', label: 'Zgłoś poprawkę', mercy: 25, text: '* Zgłaszasz poprawkę.{p} Dyrektor Bugów na chwilę się zawiesza.' },
    { id: 'merge', label: 'Połącz gałęzie', mercy: 25, text: '* Merge bez konfliktów.{p} Dyrektor patrzy z niedowierzaniem.' },
    { id: 'thanks', label: 'Podziękuj', mercy: 25, text: '* Dziękujesz mu za wszystkie bugi.{p} Coś w nim pęka.' },
    { id: 'rage', label: 'Krzyknij', mercy: -30, text: '* Krzyczysz.{p} Pętla zaczyna się od nowa.' }],
  patterns: [{ type: 'wall', rate: 50, speed: 1.5, dmg: 7 }, { type: 'rain', rate: 5, speed: 1.9, dmg: 5 }, { type: 'side', rate: 14, speed: 2.4, dmg: 6 }],
};

const BOSS_TEMPLATES = [
  { name: 'Szalona Powtórka', hp: 36, xp: 60, look: { color: '#c0507a', head: '#f0a0c0' }, turnTicks: 300,
    intro: '* Szalona Powtórka {p}powtarza intro.{p} Powtarza intro.', check: '* SZALONA POWTÓRKA. Powtarza ostatnie zdanie.',
    killText: '* Powtórka rozsypuje się na pojedyncze zdania.', spareText: '* Powtórka wreszcie milknie.',
    flavor: ['* Powtórka powtarza swoje słowa.', '* Echo wraca z każdej ściany.'],
    acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'listen', label: 'Wysłuchaj', mercy: 40, text: '* Słuchasz do końca.{p} Powtórka się rozpromienia.' },
      { id: 'echo', label: 'Powtórz za nią', mercy: 35, text: '* Powtarzasz jej słowa.{p} Jest zadowolona.' }, { id: 'shout', label: 'Krzyknij', mercy: -20, text: '* Powtórka powtarza krzyk.' }],
    patterns: [{ type: 'rain', rate: 7, speed: 1.5, dmg: 5 }, { type: 'side', rate: 20, speed: 2.1, dmg: 6 }, { type: 'wall', rate: 70, speed: 1.3, dmg: 8 }] },
  { name: 'Kserokopiarka Zagłady', hp: 44, xp: 70, look: { color: '#8a8a99', head: '#c9c9d9' }, turnTicks: 330,
    intro: '* Kserokopiarka Zagłady szumi i warczy.', check: '* KSEROKOPIARKA. Zacięty papier, zero cierpliwości.',
    killText: '* Kserokopiarka wydaje ostatni szum.', spareText: '* Kserokopiarka przechodzi w tryb uśpienia.',
    flavor: ['* Papier leci ze wszystkich stron.', '* Toner pachnie spalenizną.'],
    acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'jam', label: 'Wyjmij zacięty papier', mercy: 50, text: '* Wyjmujesz zmięty arkusz.{p} Maszyna wzdycha.' },
      { id: 'toner', label: 'Wymień toner', mercy: 50, text: '* Nowy toner.{p} Kserokopiarka mruczy.' }],
    patterns: [{ type: 'wall', rate: 55, speed: 1.5, dmg: 8 }, { type: 'rain', rate: 5, speed: 1.8, dmg: 5 }] },
  { name: 'Zawieszony Projektor', hp: 40, xp: 65, look: { color: '#3a6ea5', head: '#8fc1f5' }, turnTicks: 320,
    intro: '* Zawieszony Projektor miga niebieskim ekranem.', check: '* PROJEKTOR. Wyświetla tylko komunikaty o błędach.',
    killText: '* Projektor gaśnie z trzaskiem.', spareText: '* Projektor wyświetla w końcu prezentację.',
    flavor: ['* Ekran miga: BRAK SYGNAŁU.', '* Wentylator wyje.'],
    acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'reboot', label: 'Zrestartuj', mercy: 45, text: '* Restart. {p}Projektor budzi się z westchnieniem.' },
      { id: 'cable', label: 'Podłącz kabel', mercy: 45, text: '* Kabel HDMI.{p} Obraz wraca.' }],
    patterns: [{ type: 'side', rate: 16, speed: 2.2, dmg: 6 }, { type: 'rain', rate: 6, speed: 1.6, dmg: 5 }] },
  { name: 'Kartkówka-Widmo', hp: 34, xp: 60, look: { color: '#e6e6e6', head: '#ffffff' }, turnTicks: 300,
    intro: '* Kartkówka-Widmo unosi się nad ławkami.', check: '* KARTKÓWKA-WIDMO. Pojawia się bez zapowiedzi.',
    killText: '* Kartkówka-Widmo rozwiewa się jak dym.', spareText: '* Kartkówka-Widmo wraca do segregatora.',
    flavor: ['* Ktoś szepcze: ściągnąć?', '* Długopis sam pisze.'],
    acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'learn', label: 'Powtórz materiał', mercy: 50, text: '* Powtarzasz materiał.{p} Widmo blednie.' },
      { id: 'cheat', label: 'Ściągnij', mercy: -25, text: '* Widmo wszystko widzi.' }, { id: 'calm', label: 'Uspokój', mercy: 40, text: '* Spokojnie.{p} To tylko kartkówka.' }],
    patterns: [{ type: 'wall', rate: 65, speed: 1.4, dmg: 7 }, { type: 'rain', rate: 8, speed: 1.7, dmg: 5 }] },
  { name: 'Nieskończona Pętla', hp: 42, xp: 70, look: { color: '#3f8f5a', head: '#7be09a' }, turnTicks: 330,
    intro: '* Nieskończona Pętla zawija się wokół własnego ogona.', check: '* PĘTLA. while (true) { atakuj(); }',
    killText: '* Pętla w końcu wychodzi z pętli.', spareText: '* Pętla zatrzymuje się na warunku.',
    flavor: ['* Pętla wykonuje kolejną iterację.', '* Licznik rośnie bez końca.'],
    acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'break', label: 'Wstaw break', mercy: 50, text: '* Wstawiasz break.{p} Pętla się waha.' },
      { id: 'cond', label: 'Zmień warunek', mercy: 50, text: '* i < 10.{p} Pętla widzi światło.' }],
    patterns: [{ type: 'rain', rate: 6, speed: 1.6, dmg: 5 }, { type: 'wall', rate: 60, speed: 1.4, dmg: 8 }, { type: 'side', rate: 18, speed: 2, dmg: 6 }] },
  { name: 'Błąd 404', hp: 38, xp: 65, look: { color: '#a14b4b', head: '#e08a8a' }, turnTicks: 310,
    intro: '* Błąd 404 nie może znaleźć tej sali.', check: '* BŁĄD 404. Nie znaleziono strony, nie znaleziono sensu.',
    killText: '* Błąd 404 zmienia się w 200 OK.', spareText: '* Błąd 404 przekierowuje Cię grzecznie dalej.',
    flavor: ['* Nie znaleziono.', '* Spróbuj ponownie później.'],
    acts: [{ id: 'check', label: 'Sprawdź', mercy: 0 }, { id: 'search', label: 'Poszukaj', mercy: 40, text: '* Szukasz.{p} Coś się znajduje.' },
      { id: 'sorry', label: 'Przeproś serwer', mercy: 40, text: '* Przepraszasz.{p} Błąd łagodnieje.' }],
    patterns: [{ type: 'side', rate: 18, speed: 2, dmg: 6 }, { type: 'wall', rate: 62, speed: 1.4, dmg: 8 }] },
];

const TEACHERS = [
  { name: 'Pan Kowalski', color: '#4bb0d1', pitch: 160 }, { name: 'Pani Nowak', color: '#d1684b', pitch: 340 }, { name: 'Pan Wiśniewski', color: '#7a9a4b', pitch: 140 },
  { name: 'Pani Zielińska', color: '#c25a9c', pitch: 320 }, { name: 'Pan Lewandowski', color: '#5a7cc2', pitch: 170 }, { name: 'Pani Kamińska', color: '#d1b04b', pitch: 300 },
];

const hashStr = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// spotkanie w sali: zalezy od strefy (sali) i pietra, deterministycznie
function roomEncounter(zone, floorIdx) {
  if (zone.id === FINAL_ROOM) {
    return { id: zone.id, name: zone.name, final: true, teacher: { name: 'Pani Dyrektor', voice: { pitch: 200 }, look: { color: '#d1b04b' },
      intro: [{ text: '* Dotarłeś.{p} Dobrze.', face: 'smile' }, '* To {c:red}on{/c} jest źródłem wszystkich bugów w szkole.', '* Pokonaj go.{p} Albo przekonaj.{p} Wybór należy do Ciebie.'],
      outro: { killed: ['* Koniec bugów.{p} Szkoła jest uratowana.'], spared: ['* Przekonałeś go.{p} Nie spodziewałam się.{p} Szkoła jest uratowana.'], lost: ['* Odpocznij.'] } },
      boss: FINAL_BOSS, reward: { xp: 0, unlock: [] } };
  }
  const h = hashStr(zone.id), t = TEACHERS[h % TEACHERS.length], tpl = BOSS_TEMPLATES[(h >>> 3) % BOSS_TEMPLATES.length], scale = 1 + 0.3 * floorIdx;
  return {
    id: zone.id, name: zone.name,
    teacher: { name: t.name, voice: { pitch: t.pitch }, look: { color: t.color },
      intro: [{ text: '* Dobrze, że jesteś.{p} Potrzebuję {c:yellow}pomocy{/c}.', face: 'sad' },
        `* W sali ${zone.number || ''} ${zone.name} zalęgło się {shake}coś dziwnego{/shake}.`,
        { text: '* Nikt nie może prowadzić lekcji.{p} Spróbuj to uspokoić...{p} albo pokonać.', face: 'smile' }],
      outro: { killed: ['* Cisza.{p} Aż za cicho.{p} Dziękuję.'], spared: [{ text: '* Uspokoiłeś to.{p} Nie spodziewałem się.', face: 'smile' }, '* Dziękuję.'], lost: ['* Nic Ci nie jest?'] } },
    boss: { ...tpl, hp: Math.round(tpl.hp * scale), xp: Math.round(tpl.xp * scale) }, reward: { xp: 20 + 10 * floorIdx, unlock: [] },
  };
}

// wyglad postaci (sprite NPC): rozne fryzury, kolory skory i wlosow, okulary, spodnice, czapki
const NPC_LOOKS = {
  woznik: { head: 'cap', body: 'pants', hair: '#6b6b6b', skin: '#e0b48c', bottom: '#3a4a6a', acc: '#4a5568', scale: 0.88 },
  sekretarka: { head: 'bun', body: 'skirt', hair: '#8a5a3a', skin: '#f0c8a4', bottom: '#444a5a', acc: '#2a2a2a', glasses: true, scale: 0.86 },
  uczen: { head: 'short', body: 'pants', hair: '#2a1e18', skin: '#e8c0a0', bottom: '#2f3d6a', acc: '#e8e8e8', scale: 0.8 },
  bibliotekarka: { head: 'long', body: 'skirt', hair: '#b8b8c0', skin: '#f0cfae', bottom: '#5a3a5a', acc: '#3a2a2a', glasses: true, scale: 0.85 },
  dyrektor: { head: 'bun', body: 'coat', hair: '#2a2a30', skin: '#e8c0a0', bottom: '#2c2c3a', acc: '#2a2a2a', scale: 0.92 },
};
const FLAVOR_LOOKS = [
  { head: 'long', body: 'skirt', hair: '#d8b860', skin: '#ffd9b8', bottom: '#3a5a8a', acc: '#e8e8e8', scale: 0.8 },
  { head: 'short', body: 'pants', hair: '#b0452a', skin: '#f0cfae', bottom: '#4a4a52', acc: '#e8e8e8', scale: 0.82 },
  { head: 'cap', body: 'pants', hair: '#2a1e18', skin: '#c68a60', bottom: '#2f3d6a', acc: '#c0392b', scale: 0.84 },
  { head: 'bun', body: 'coat', hair: '#9a9aa6', skin: '#f0cfae', bottom: '#3a3a4a', acc: '#2a2a2a', glasses: true, scale: 0.88 },
  { head: 'hat', body: 'pants', hair: '#2a2a30', skin: '#8d5a3a', bottom: '#20242c', acc: '#20242c', scale: 0.95 },
  { head: 'short', body: 'pants', hair: '#3a6ad0', skin: '#e8c0a0', bottom: '#5a2f2f', acc: '#e8e8e8', glasses: true, scale: 0.84 },
  { head: 'bald', body: 'pants', hair: '#000000', skin: '#d8a478', bottom: '#2a3a2a', acc: '#2a2a30', scale: 0.8 },
  { head: 'long', body: 'skirt', hair: '#6a3a22', skin: '#e0b48c', bottom: '#7a4a2a', acc: '#e8e8e8', scale: 0.86 },
];
