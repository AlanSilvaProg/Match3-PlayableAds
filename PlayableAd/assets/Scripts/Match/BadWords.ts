/**
 * Filtro de palavroes para apelidos (base: lista da Poki; ampliada com termos em ingles, portugues, espanhol, frances
 * e alemao, ofensas, odio e conteudo adulto). Para acrescentar palavras, basta editar a lista abaixo.
 *
 * Regras de correspondencia (rigorosas, mas sem bloquear palavras comuns como "Hello" ou "Glasses"):
 *  - letras trocadas por numeros/simbolos sao normalizadas (5h1t -> shit, b!tch -> bitch);
 *  - uma palavra da lista e bloqueada quando aparece como PALAVRA INTEIRA do apelido (separada por espaco, _, -, .);
 *  - palavras SEVERAS (SEVERE) e palavras de 5+ letras tambem sao bloqueadas DENTRO de outras palavras
 *    ("xfuckx", "Scunthorpe") e com letras separadas ("f u c k") ou repetidas ("fuuuck");
 *  - palavras curtas ou comuns (ass, hell, balls, cock...) so valem como palavra inteira, para nao bloquear nomes
 *    inocentes (Assassin, Hello, Snowballs, Peacock). O preco de ser rigoroso: nomes como "Scunthorpe" ainda caem.
 */
const RAW_LIST: string[] = ["4r5e", "5h1t", "5hit", "a55", "anal", "anus", "ar5e", "arrse", "arse", "ass", "ass-fucker", "asses", "assfucker", "assfukka", "asshole", "assholes", "asswhole", "a_s_s", "b!tch", "b00bs", "b17ch", "b1tch", "ballbag", "balls", "ballsack", "bastard", "beastial", "beastiality", "bellend", "bestial", "bestiality", "bi+ch", "biatch", "bitch", "bitcher", "bitchers", "bitches", "bitchin", "bitching", "bloody", "blow job", "blowjob", "blowjobs", "boiolas", "bollock", "bollok", "boner", "boob", "boobs", "booobs", "boooobs", "booooobs", "booooooobs", "breasts", "buceta", "bugger", "bum", "bunny fucker", "butt", "butthole", "buttmuch", "buttplug", "c0ck", "c0cksucker", "carpet muncher", "cawk", "chink", "cipa", "cl1t", "clit", "clitoris", "clits", "cnut", "cock", "cock-sucker", "cockface", "cockhead", "cockmunch", "cockmuncher", "cocks", "cocksuck", "cocksucked", "cocksucker", "cocksucking", "cocksucks", "cocksuka", "cocksukka", "cok", "cokmuncher", "coksucka", "coon", "cox", "crap", "cum", "cummer", "cumming", "cums", "cumshot", "cunilingus", "cunillingus", "cunnilingus", "cunt", "cuntlick", "cuntlicker", "cuntlicking", "cunts", "cyalis", "cyberfuc", "cyberfuck", "cyberfucked", "cyberfucker", "cyberfuckers", "cyberfucking", "d1ck", "damn", "dick", "dickhead", "dildo", "dildos", "dink", "dinks", "dirsa", "dlck", "dog-fucker", "doggin", "dogging", "donkeyribber", "doosh", "duche", "dyke", "ejaculate", "ejaculated", "ejaculates", "ejaculating", "ejaculatings", "ejaculation", "ejakulate", "f u c k", "f u c k e r", "f4nny", "fag", "fagging", "faggitt", "faggot", "faggs", "fagot", "fagots", "fags", "fanny", "fannyflaps", "fannyfucker", "fanyy", "fatass", "fcuk", "fcuker", "fcuking", "feck", "fecker", "felching", "fellate", "fellatio", "fingerfuck", "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking", "fingerfucks", "fistfuck", "fistfucked", "fistfucker", "fistfuckers", "fistfucking", "fistfuckings", "fistfucks", "flange", "fook", "fooker", "fuck", "fucka", "fucked", "fucker", "fuckers", "fuckhead", "fuckheads", "fuckin", "fucking", "fuckings", "fuckingshitmotherfucker", "fuckme", "fucks", "fuckwhit", "fuckwit", "fudge packer", "fudgepacker", "fuk", "fuker", "fukker", "fukkin", "fuks", "fukwhit", "fukwit", "fux", "fux0r", "f_u_c_k", "gangbang", "gangbanged", "gangbangs", "gaylord", "gaysex", "goatse", "God", "god-dam", "god-damned", "goddamn", "goddamned", "hardcoresex", "hell", "heshe", "hoar", "hoare", "hoer", "homo", "hore", "horniest", "horny", "hotsex", "jack-off", "jackoff", "jap", "jerk-off", "jism", "jiz", "jizm", "jizz", "kawk", "knob", "knobead", "knobed", "knobend", "knobhead", "knobjocky", "knobjokey", "kock", "kondum", "kondums", "kum", "kummer", "kumming", "kums", "kunilingus", "l3i+ch", "l3itch", "labia", "lust", "lusting", "m0f0", "m0fo", "m45terbate", "ma5terb8", "ma5terbate", "masochist", "master-bate", "masterb8", "masterbat*", "masterbat3", "masterbate", "masterbation", "masterbations", "masturbate", "mo-fo", "mof0", "mofo", "mothafuck", "mothafucka", "mothafuckas", "mothafuckaz", "mothafucked", "mothafucker", "mothafuckers", "mothafuckin", "mothafucking", "mothafuckings", "mothafucks", "mother fucker", "motherfuck", "motherfucked", "motherfucker", "motherfuckers", "motherfuckin", "motherfucking", "motherfuckings", "motherfuckka", "motherfucks", "muff", "mutha", "muthafecker", "muthafuckker", "muther", "mutherfucker", "n1gga", "n1gger", "nazi", "nigg3r", "nigg4h", "nigga", "niggah", "niggas", "niggaz", "nigger", "niggers", "nob", "nob jokey", "nobhead", "nobjocky", "nobjokey", "numbnuts", "nutsack", "orgasim", "orgasims", "orgasm", "orgasms", "p0rn", "pawn", "pecker", "penis", "penisfucker", "phonesex", "phuck", "phuk", "phuked", "phuking", "phukked", "phukking", "phuks", "phuq", "pigfucker", "pimpis", "piss", "pissed", "pisser", "pissers", "pisses", "pissflaps", "pissin", "pissing", "pissoff", "poop", "porn", "porno", "pornography", "pornos", "prick", "pricks", "pron", "pube", "pusse", "pussi", "pussies", "pussy", "pussys", "rectum", "retard", "rimjaw", "rimming", "s hit", "s.o.b.", "sadist", "schlong", "screwing", "scroat", "scrote", "scrotum", "semen", "sex", "sh!+", "sh!t", "sh1t", "shag", "shagger", "shaggin", "shagging", "shemale", "shi+", "shit", "shitdick", "shite", "shited", "shitey", "shitfuck", "shitfull", "shithead", "shiting", "shitings", "shits", "shitted", "shitter", "shitters", "shitting", "shittings", "shitty", "skank", "slut", "sluts", "smegma", "smut", "snatch", "son-of-a-bitch", "spac", "spunk", "s_h_i_t", "t1tt1e5", "t1tties", "teets", "teez", "testical", "testicle", "tit", "titfuck", "tits", "titt", "tittie5", "tittiefucker", "titties", "tittyfuck", "tittywank", "titwank", "tosser", "turd", "tw4t", "twat", "twathead", "twatty", "twunt", "twunter", "v14gra", "v1gra", "vagina", "viagra", "vulva", "w00se", "wang", "wank", "wanker", "wanky", "whoar", "whore", "willies", "willy", "xrated", "xxx", "porra", "caralho", "caralhos", "cacete", "puta", "putas", "puto", "putos", "putaria", "putinha", "viado", "viada", "veado", "bicha", "bichona", "cuzao", "cuzona", "merda", "merdas", "bosta", "foda", "fodase", "foder", "fodido", "fodida", "fodeu", "punheta", "punheteiro", "piroca", "pirocas", "rola", "xoxota", "xota", "xereca", "periquita", "pepeca", "bucetas", "vagabunda", "vagabundo", "arrombado", "arrombada", "babaca", "otario", "otaria", "corno", "corna", "escroto", "escrota", "desgraca", "desgracado", "filhodaputa", "vsf", "vtnc", "pqp", "cuzinho", "bundao", "tarado", "tarada", "estuprador", "estupro", "pedofilo", "negrinho", "macaco", "macaca", "crioulo", "retardado", "mongoloide", "aidetico", "safado", "safada", "trouxa", "punheteira", "gozada", "gozar", "siririca", "boquete", "chupa", "chupar", "mierda", "joder", "jodete", "coño", "cono", "pendejo", "pendeja", "cabron", "cabrona", "verga", "chingar", "chingada", "chingadera", "chingatumadre", "culero", "culera", "marica", "maricon", "zorra", "perra", "hijodeputa", "hdp", "gilipollas", "capullo", "follar", "polla", "pollas", "pinche", "mamon", "mamona", "pajero", "pajera", "concha", "conchatumadre", "carajo", "boludo", "pelotudo", "sudaca", "merde", "putain", "connard", "connasse", "salope", "salaud", "encule", "enculer", "nique", "niquer", "ntm", "batard", "couille", "couilles", "foutre", "pute", "tapette", "bordel", "branleur", "petasse", "trouduc", "scheisse", "scheiße", "scheiss", "arschloch", "arsch", "fotze", "hurensohn", "wichser", "schwuchtel", "fick", "ficken", "ficker", "scheisskerl", "miststueck", "nutte", "schlampe", "neger", "hure", "kacke", "pimmel", "tranny", "trannie", "kike", "spic", "spick", "wetback", "gook", "paki", "raghead", "towelhead", "negro", "retarded", "rapist", "rapists", "raping", "rape", "raped", "molest", "molester", "pedo", "paedo", "pedophile", "paedophile", "pedophilia", "incest", "hitler", "heilhitler", "kkk", "whitepower", "whitepride", "isis", "jihad", "terrorist", "suicide", "killyourself", "kys", "bollocks", "slag", "bint", "minger", "whorish", "hooker", "hookers", "pimp", "nude", "nudes", "naked", "boobies", "nipple", "nipples", "erotic", "fetish", "bdsm", "hentai", "orgy", "threesome", "handjob", "rimjob", "vibrator", "cumslut", "creampie", "bukkake", "deepthroat", "anilingus", "sodomy", "sodomize", "sexy", "sexual", "sexxx", "onlyfans", "milf", "dilf", "cocaine", "heroin", "crackhead", "methhead", "douche", "douchebag", "dumbass", "jackass", "badass", "smartass", "wanking", "wankers", "bullshit", "horseshit", "chickenshit", "dipshit", "shithole", "shitstain", "arsehole", "arseholes", "fuckface", "fuckboy", "fuckup", "fuckoff", "cumdump", "cumbucket", "faggy", "lesbo", "gayass", "sandnigger", "porchmonkey", "jungle bunny", "cottonpicker", "coonass", "beaner", "chinaman", "chingchong", "slanteye", "zipperhead", "redskin", "injun", "squaw", "gypsy", "tard", "mongoloid", "spaz", "spastic", "cripple", "downie", "moron", "imbecile", "asshat", "asswipe", "assclown", "dickwad", "dickface", "dickweed", "twatwaffle", "clusterfuck", "goddamnit", "jesusfuck", "sonofabitch", "bitchass", "bitchy", "slutty", "skanky", "thot", "thots", "whoreson", "cuck", "cuckold", "incel", "cu", "tomarnocu", "tomanocu", "vaipraputaquepariu", "putaquepariu", "fck", "fvck", "fvk", "fuq", "dik", "pusy", "shyt", "btch", "cnt", "azz"];

/** Bloqueadas mesmo dentro de outra palavra (nunca aparecem em palavras comuns). */
const SEVERE: string[] = ['fuck', 'shit', 'cunt', 'piss', 'slut', 'twat', 'wank', 'nigg', 'porn', 'whore', 'bitch', 'nigga', 'faggot',
    'caralho', 'buceta', 'merda', 'porra', 'scheiss', 'hurensohn', 'mierda', 'putain', 'pedophile', 'paedophile', 'hitler'];

/** De 5+ letras, mas podem aparecer em palavras inocentes: so valem como palavra inteira. */
const WHOLE_WORD_ONLY: string[] = [
    'balls', 'asses', 'cocks', 'bloody', 'willy', 'willies', 'rapist', 'rapists', 'pedo', 'sexual', 'naked', 'nipple',
    'nipples', 'moron', 'sexy', 'hooker', 'hookers', 'gypsy', 'heroin', 'terrorist', 'suicide', 'masterbat', 'knobs',
    'cockroach', 'tranny', 'redskin', 'pinche', 'macaco', 'macaca', 'chupar', 'gozar', 'concha', 'conchatumadre', 'carajo',
    'nutte', 'hure', 'imbecile', 'cripple', 'badass', 'jackass', 'dumbass', 'smartass', 'boobies', 'flange', 'bugger', 'boner',
    'pecker', 'spunk', 'snatch', 'nique', 'niquer', 'putas', 'puto', 'putos', 'corno', 'corna', 'otario', 'otaria', 'verga',
    'polla', 'pollas', 'arsch', 'spick', 'negro', 'nudes', 'jihad'
];

const LEET: { [k: string]: string } = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
    '@': 'a', '$': 's', '!': 'i', '+': 't', '|': 'i',
};

/** minusculas + troca de leet; ainda com separadores (espaco, _, -, .). */
function leetNormalize(text: string): string {
    let out = '';
    for (const ch of text.toLowerCase()) out += LEET[ch] ?? ch;
    return out;
}

/** Remove acentos e fica so com letras a-z. */
function compact(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

/** Reduz letras repetidas ("fuuuck" -> "fuck"). */
function squeeze(text: string): string {
    return text.replace(/(.)\1+/g, '$1');
}

const norm = (w: string) => compact(leetNormalize(w.replace(/\*/g, '')));
const WORDS: string[] = Array.from(new Set(RAW_LIST.map(norm).filter(w => w.length >= 2)));
const WORD_SET = new Set(WORDS);
const WHOLE_ONLY = new Set(WHOLE_WORD_ONLY.map(norm));
const SEVERE_N = SEVERE.map(norm);
const SUBSTRING_WORDS = Array.from(new Set([...WORDS.filter(w => w.length >= 5 && !WHOLE_ONLY.has(w)), ...SEVERE_N]));
const SQUEEZED_SUBSTRING = Array.from(new Set(SUBSTRING_WORDS.map(squeeze))).filter(w => w.length >= 4);

/** O texto contem palavrao? (confira tambem o texto digitado antes de remover simbolos). */
export function isProfane(name: string): boolean {
    const normalized = leetNormalize(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tokens = normalized.split(/[^a-z]+/).filter(t => t.length > 0);
    const flat = compact(normalized);
    if (!flat) return false;

    // 1) palavra inteira (qualquer tamanho), tambem sem letras repetidas
    for (const t of tokens) {
        if (WORD_SET.has(t) || WORD_SET.has(squeeze(t))) return true;
    }
    // 2) texto todo junto ("f u c k", "x_fuck_x"): severas e palavras de 5+ letras em qualquer posicao
    for (const w of SUBSTRING_WORDS) {
        if (flat.indexOf(w) !== -1) return true;
    }
    // 3) repeticao exagerada ("fuuuuck")
    const flatSqueezed = squeeze(flat);
    for (const w of SQUEEZED_SUBSTRING) {
        if (flatSqueezed.indexOf(w) !== -1) return true;
    }
    // 4) letras soltas formando uma palavra curta inteira ("a s s")
    return WORD_SET.has(flat);
}
