/**
 * Traducoes: o proprio texto em ingles e a chave (`tr('NICE!')`). Placeholders: `{0}`, `{1}`...
 * Idiomas: pt, es, de; qualquer outro cai no ingles. O idioma vem do navegador (`navigator.languages`, o
 * primeiro suportado); para testar, abra a pagina com `?lang=pt|es|de|en`.
 */
import { Label, Node } from 'cc';

export type Lang = 'en' | 'pt' | 'es' | 'de';

const PT: Record<string, string> = {
    'Orders': 'Pedidos',
    // Combos
    'NICE!': 'LEGAL!', 'GREAT!': 'ÓTIMO!', 'AWESOME!': 'INCRÍVEL!', 'AMAZING!': 'SENSACIONAL!',
    'UNSTOPPABLE!': 'IMPARÁVEL!', 'LEGENDARY!': 'LENDÁRIO!', 'FAST COMBO x{0}': 'COMBO RÁPIDO x{0}',
    // Refeicoes
    'BREAKFAST': 'CAFÉ DA MANHÃ', 'LUNCH': 'ALMOÇO', 'DINNER': 'JANTAR',
    'BREAKFAST TIME!': 'HORA DO CAFÉ!', 'LUNCH TIME!': 'HORA DO ALMOÇO!', 'DINNER TIME!': 'HORA DA JANTA!',
    'PART {0} OF {1}': 'PARTE {0} DE {1}', 'PART {0} OF {1} - NEW FOODS!': 'PARTE {0} DE {1} - COMIDAS NOVAS!',
    // Golden Time
    'GOLDEN TIME!': 'GOLDEN TIME!', 'GOLDEN TIME': 'GOLDEN TIME', 'x2 COINS - GRAB THEM ALL!': 'MOEDAS x2 - PEGUE TODAS!',
    // Power-ups
    'Freeze Time': 'Congelar Tempo', 'Stops the level timer for 10s': 'Para o cronômetro da fase por 10s',
    'Freeze Orders': 'Congelar Pedidos', 'Stops all order timers for 10s': 'Para o tempo de todos os pedidos por 10s',
    '+15 Seconds': '+15 Segundos', 'Adds 15s to the level timer': 'Adiciona 15s ao cronômetro da fase',
    'Less Items': 'Menos Itens', 'Every product in every order drops to 1': 'Cada produto de cada pedido cai para 1',
    'Auto Select': 'Seleção Automática', 'Selects the foods of the next order': 'Seleciona as comidas do próximo pedido',
    'Focus': 'Foco', 'Highlights the foods of the next order': 'Destaca as comidas do próximo pedido',
    'Max Combo': 'Combo Máximo', 'Max combo for 10s': 'Combo máximo por 10s',
    'Double Coins': 'Moedas em Dobro', 'Coins x2 for 10s': 'Moedas x2 por 10s',
    'POWER-UPS': 'POWER-UPS', 'FREE': 'GRÁTIS',
    'Nothing to use it on right now': 'Nada para usar agora', 'Not enough coins': 'Moedas insuficientes',
    '+{0} random power-ups!': '+{0} power-ups aleatórios!', '+{0} coins': '+{0} moedas',
    // Comidas
    'Fries': 'Batata Frita', 'Burger': 'Hambúrguer', 'Ice Cream': 'Sorvete', 'Soda': 'Refrigerante',
    'Chicken': 'Frango', 'Pizza': 'Pizza', 'Hot Dog': 'Cachorro-Quente', 'Donut': 'Rosquinha', 'Taco': 'Taco',
    'Popcorn': 'Pipoca', 'Onion Rings': 'Anéis de Cebola', 'Sandwich': 'Sanduíche', 'Muffin': 'Muffin',
    'Cupcake': 'Cupcake', 'Milkshake': 'Milkshake',
    // Conquistas
    'ACHIEVEMENTS': 'CONQUISTAS', 'ACHIEVEMENT UNLOCKED!': 'CONQUISTA DESBLOQUEADA!', 'CLAIM': 'RESGATAR', 'DONE': 'FEITO',
    'First Steps': 'Primeiros Passos', 'Complete 1 level': 'Complete 1 nível',
    'Warming Up': 'Aquecendo', 'Complete 5 levels': 'Complete 5 níveis',
    'On a Roll': 'Embalado', 'Complete 10 levels': 'Complete 10 níveis',
    'Complete 25 levels': 'Complete 25 níveis', 'Master Chef': 'Mestre Cuca', 'Complete 50 levels': 'Complete 50 níveis',
    'Star Collector': 'Colecionador de Estrelas', 'Collect 15 stars': 'Colete 15 estrelas',
    'Star Hoarder': 'Acumulador de Estrelas', 'Collect 45 stars': 'Colete 45 estrelas', 'Collect 100 stars': 'Colete 100 estrelas',
    'Perfectionist': 'Perfeccionista', 'Finish a level with 3 stars': 'Termine um nível com 3 estrelas',
    'Triple Threat': 'Tripla Ameaça', 'Get 3 stars on 10 different levels': 'Consiga 3 estrelas em 10 níveis diferentes',
    'Climbing': 'Subindo', 'Reach level 10': 'Chegue ao nível 10', 'Summit': 'Topo', 'Reach level 30': 'Chegue ao nível 30',
    'Special Delivery': 'Entrega Especial', 'Finish a special level': 'Termine um nível especial',
    'Boss Slayer': 'Caçador de Chefões', 'Finish 5 special levels': 'Termine 5 níveis especiais',
    'Merge Rookie': 'Novato do Merge', 'Make 50 merges': 'Faça 50 merges',
    'Merge Master': 'Mestre do Merge', 'Make 500 merges': 'Faça 500 merges',
    'Order Up!': 'Pedido Saindo!', 'Deliver 25 orders': 'Entregue 25 pedidos', 'Deliver 100 orders on time': 'Entregue 100 pedidos no prazo',
    'Combo King': 'Rei do Combo', 'Reach the max combo 3 times': 'Alcance o combo máximo 3 vezes',
    'Power Player': 'Mestre dos Power-ups', 'Use 15 power-ups': 'Use 15 power-ups',
    // Fim de fase
    'NEXT': 'PRÓXIMO', 'RESTART': 'REINICIAR', 'x2 COINS': 'MOEDAS x2', 'DOUBLED!': 'EM DOBRO!',
    'CHECKPOINT': 'CHECKPOINT', 'CONTINUE': 'CONTINUAR',
    'Watch an ad to restart {0} from the beginning!': 'Assista a um anúncio para reiniciar {0} do começo!',
    'Watch an ad to keep playing from where you stopped!': 'Assista a um anúncio para continuar de onde parou!',
    // Seletor
    'PLAY': 'JOGAR', 'SELECT LEVEL': 'ESCOLHA O NÍVEL', 'CURRENT': 'ATUAL',
    // Ranking / perfil
    'RANKING': 'RANKING', 'PROFILE': 'PERFIL', 'WELCOME!': 'BEM-VINDO!', 'Choose your nickname': 'Escolha seu apelido',
    'Shown in the ranking': 'Aparece no ranking', 'LOGIN WITH POKI': 'ENTRAR COM POKI', 'Login cancelled': 'Login cancelado',
    'Please choose another nickname': 'Escolha outro apelido', 'Logged in as {0}': 'Conectado como {0}',
    'Save your progress on any device': 'Salve seu progresso em qualquer dispositivo',
    'Ranking unavailable.\nThe game id is not set.': 'Ranking indisponível.\nO ID do jogo não foi definido.',
    'No players yet. Be the first!': 'Ninguém no ranking ainda. Seja o primeiro!',
    'Your rank: #{0}   {1} stars': 'Sua posição: #{0}   {1} estrelas', 'Your stars: {0}': 'Suas estrelas: {0}',
    'Win a level to join the ranking!': 'Vença um nível para entrar no ranking!',
    'Could not load the ranking.\nTry again later.': 'Não foi possível carregar o ranking.\nTente novamente mais tarde.',
    '{0} (you)': '{0} (você)', 'Player': 'Jogador', 'Chef': 'Chef',
    // Tutorial
    'Touch to continue': 'Toque para continuar',
    'These are your ORDERS!\nCollect the exact amount before time runs out.': 'Estes são seus PEDIDOS!\nJunte a quantidade exata antes que o tempo acabe.',
    'Tap the highlighted foods!': 'Toque nas comidas destacadas!',
    "NOW IT'S": 'AGORA É', 'YOUR TURN!': 'A SUA VEZ!', "NOW IT'S YOUR TURN!": 'AGORA É A SUA VEZ!',
    'Your combo ran out!\nMAX COMBO fills it to the top.\nHere is one FREE: tap it now!': 'Seu combo acabou!\nCOMBO MÁXIMO enche a barra.\nAqui vai um GRÁTIS: toque agora!',
    'Time is running out!\n+15 SECONDS gives you extra time.\nHere is one FREE: tap it now!': 'O tempo está acabando!\n+15 SEGUNDOS dá tempo extra.\nAqui vai um GRÁTIS: toque agora!',
    'Need a breather?\nFREEZE TIME stops the clock for 10s.\nHere is one FREE: tap it now!': 'Precisa respirar?\nCONGELAR TEMPO para o relógio por 10s.\nAqui vai um GRÁTIS: toque agora!',
    'An order is about to expire!\nFREEZE ORDERS stops all order timers.\nHere is one FREE: tap it now!': 'Um pedido está quase vencendo!\nCONGELAR PEDIDOS para o tempo de todos.\nAqui vai um GRÁTIS: toque agora!',
    'Big orders? LESS ITEMS cuts every\nfood in every order down to 1.\nHere is one FREE: tap it now!': 'Pedidos grandes? MENOS ITENS reduz\ncada comida de cada pedido para 1.\nAqui vai um GRÁTIS: toque agora!',
    'Stuck? AUTO SELECT picks the foods\nof the next order for you.\nHere is one FREE: tap it now!': 'Travou? SELEÇÃO AUTOMÁTICA escolhe\nas comidas do próximo pedido.\nAqui vai um GRÁTIS: toque agora!',
    "Can't find the food? FOCUS highlights\nwhat you need for a few seconds.\nHere is one FREE: tap it now!": 'Não acha a comida? FOCO destaca\no que você precisa por alguns segundos.\nAqui vai um GRÁTIS: toque agora!',
    'Great combo!\nDOUBLE COINS doubles your coins.\nHere is one FREE: tap it now!': 'Ótimo combo!\nMOEDAS EM DOBRO dobra suas moedas.\nAqui vai um GRÁTIS: toque agora!',
    'Time is running low!\nIf it reaches ZERO, you FAIL.': 'O tempo está acabando!\nSe chegar a ZERO, você PERDE.',
    'This order is LATE!\nWhen you deliver it, the delay is\nSUBTRACTED from your total time.': 'Este pedido está ATRASADO!\nAo entregá-lo, o atraso é\nDESCONTADO do seu tempo total.',
    'Tap the highlighted power-up!': 'Toque no power-up destacado!',
    'GOLDEN TIME!\nEvery food is a COIN now!\nTap as many as you can!': 'GOLDEN TIME!\nToda comida virou MOEDA!\nToque em quantas puder!',
    'Those foods are not in your orders!\nYour first order needs {0}x {1}.\nPick the highlighted ones.': 'Essas comidas não estão nos seus pedidos!\nSeu primeiro pedido precisa de {0}x {1}.\nEscolha as destacadas.',
    'Wrong food?\nTap it in the tray to put it back!': 'Comida errada?\nToque nela na bandeja para devolvê-la!',
};

const ES: Record<string, string> = {
    'Orders': 'Pedidos',
    'NICE!': '¡BIEN!', 'GREAT!': '¡GENIAL!', 'AWESOME!': '¡INCREÍBLE!', 'AMAZING!': '¡ASOMBROSO!',
    'UNSTOPPABLE!': '¡IMPARABLE!', 'LEGENDARY!': '¡LEGENDARIO!', 'FAST COMBO x{0}': 'COMBO RÁPIDO x{0}',
    'BREAKFAST': 'DESAYUNO', 'LUNCH': 'ALMUERZO', 'DINNER': 'CENA',
    'BREAKFAST TIME!': '¡HORA DEL DESAYUNO!', 'LUNCH TIME!': '¡HORA DEL ALMUERZO!', 'DINNER TIME!': '¡HORA DE LA CENA!',
    'PART {0} OF {1}': 'PARTE {0} DE {1}', 'PART {0} OF {1} - NEW FOODS!': 'PARTE {0} DE {1} - ¡COMIDAS NUEVAS!',
    'GOLDEN TIME!': '¡GOLDEN TIME!', 'GOLDEN TIME': 'GOLDEN TIME', 'x2 COINS - GRAB THEM ALL!': 'MONEDAS x2 - ¡AGÁRRALAS TODAS!',
    'Freeze Time': 'Congelar Tiempo', 'Stops the level timer for 10s': 'Detiene el cronómetro del nivel 10s',
    'Freeze Orders': 'Congelar Pedidos', 'Stops all order timers for 10s': 'Detiene el tiempo de todos los pedidos 10s',
    '+15 Seconds': '+15 Segundos', 'Adds 15s to the level timer': 'Añade 15s al cronómetro del nivel',
    'Less Items': 'Menos Artículos', 'Every product in every order drops to 1': 'Cada producto de cada pedido baja a 1',
    'Auto Select': 'Selección Automática', 'Selects the foods of the next order': 'Selecciona las comidas del próximo pedido',
    'Focus': 'Enfoque', 'Highlights the foods of the next order': 'Resalta las comidas del próximo pedido',
    'Max Combo': 'Combo Máximo', 'Max combo for 10s': 'Combo máximo durante 10s',
    'Double Coins': 'Monedas Dobles', 'Coins x2 for 10s': 'Monedas x2 durante 10s',
    'POWER-UPS': 'POTENCIADORES', 'FREE': 'GRATIS',
    'Nothing to use it on right now': 'Nada en qué usarlo ahora', 'Not enough coins': 'Monedas insuficientes',
    '+{0} random power-ups!': '¡+{0} potenciadores al azar!', '+{0} coins': '+{0} monedas',
    'Fries': 'Papas Fritas', 'Burger': 'Hamburguesa', 'Ice Cream': 'Helado', 'Soda': 'Refresco',
    'Chicken': 'Pollo', 'Pizza': 'Pizza', 'Hot Dog': 'Perrito Caliente', 'Donut': 'Dona', 'Taco': 'Taco',
    'Popcorn': 'Palomitas', 'Onion Rings': 'Aros de Cebolla', 'Sandwich': 'Sándwich', 'Muffin': 'Muffin',
    'Cupcake': 'Cupcake', 'Milkshake': 'Batido',
    'ACHIEVEMENTS': 'LOGROS', 'ACHIEVEMENT UNLOCKED!': '¡LOGRO DESBLOQUEADO!', 'CLAIM': 'RECLAMAR', 'DONE': 'HECHO',
    'First Steps': 'Primeros Pasos', 'Complete 1 level': 'Completa 1 nivel',
    'Warming Up': 'Calentando', 'Complete 5 levels': 'Completa 5 niveles',
    'On a Roll': 'En Racha', 'Complete 10 levels': 'Completa 10 niveles',
    'Complete 25 levels': 'Completa 25 niveles', 'Master Chef': 'Maestro Cocinero', 'Complete 50 levels': 'Completa 50 niveles',
    'Star Collector': 'Coleccionista de Estrellas', 'Collect 15 stars': 'Reúne 15 estrellas',
    'Star Hoarder': 'Acumulador de Estrellas', 'Collect 45 stars': 'Reúne 45 estrellas', 'Collect 100 stars': 'Reúne 100 estrellas',
    'Perfectionist': 'Perfeccionista', 'Finish a level with 3 stars': 'Termina un nivel con 3 estrellas',
    'Triple Threat': 'Triple Amenaza', 'Get 3 stars on 10 different levels': 'Consigue 3 estrellas en 10 niveles distintos',
    'Climbing': 'Escalando', 'Reach level 10': 'Llega al nivel 10', 'Summit': 'Cima', 'Reach level 30': 'Llega al nivel 30',
    'Special Delivery': 'Entrega Especial', 'Finish a special level': 'Termina un nivel especial',
    'Boss Slayer': 'Cazajefes', 'Finish 5 special levels': 'Termina 5 niveles especiales',
    'Merge Rookie': 'Novato del Merge', 'Make 50 merges': 'Haz 50 merges',
    'Merge Master': 'Maestro del Merge', 'Make 500 merges': 'Haz 500 merges',
    'Order Up!': '¡Pedido Listo!', 'Deliver 25 orders': 'Entrega 25 pedidos', 'Deliver 100 orders on time': 'Entrega 100 pedidos a tiempo',
    'Combo King': 'Rey del Combo', 'Reach the max combo 3 times': 'Alcanza el combo máximo 3 veces',
    'Power Player': 'Maestro de Potenciadores', 'Use 15 power-ups': 'Usa 15 potenciadores',
    'NEXT': 'SIGUIENTE', 'RESTART': 'REINICIAR', 'x2 COINS': 'MONEDAS x2', 'DOUBLED!': '¡DOBLE!',
    'CHECKPOINT': 'CHECKPOINT', 'CONTINUE': 'CONTINUAR',
    'Watch an ad to restart {0} from the beginning!': '¡Mira un anuncio para reiniciar {0} desde el principio!',
    'Watch an ad to keep playing from where you stopped!': '¡Mira un anuncio para seguir donde lo dejaste!',
    'PLAY': 'JUGAR', 'SELECT LEVEL': 'ELIGE EL NIVEL', 'CURRENT': 'ACTUAL',
    'RANKING': 'CLASIFICACIÓN', 'PROFILE': 'PERFIL', 'WELCOME!': '¡BIENVENIDO!', 'Choose your nickname': 'Elige tu apodo',
    'Shown in the ranking': 'Se muestra en la clasificación', 'LOGIN WITH POKI': 'ENTRAR CON POKI', 'Login cancelled': 'Inicio de sesión cancelado',
    'Please choose another nickname': 'Elige otro apodo', 'Logged in as {0}': 'Sesión iniciada como {0}',
    'Save your progress on any device': 'Guarda tu progreso en cualquier dispositivo',
    'Ranking unavailable.\nThe game id is not set.': 'Clasificación no disponible.\nNo se definió el ID del juego.',
    'No players yet. Be the first!': 'Aún no hay jugadores. ¡Sé el primero!',
    'Your rank: #{0}   {1} stars': 'Tu puesto: #{0}   {1} estrellas', 'Your stars: {0}': 'Tus estrellas: {0}',
    'Win a level to join the ranking!': '¡Gana un nivel para entrar en la clasificación!',
    'Could not load the ranking.\nTry again later.': 'No se pudo cargar la clasificación.\nInténtalo más tarde.',
    '{0} (you)': '{0} (tú)', 'Player': 'Jugador', 'Chef': 'Chef',
    'Touch to continue': 'Toca para continuar',
    'These are your ORDERS!\nCollect the exact amount before time runs out.': '¡Estos son tus PEDIDOS!\nReúne la cantidad exacta antes de que se acabe el tiempo.',
    'Tap the highlighted foods!': '¡Toca las comidas resaltadas!',
    "NOW IT'S": 'AHORA ES', 'YOUR TURN!': '¡TU TURNO!', "NOW IT'S YOUR TURN!": '¡AHORA ES TU TURNO!',
    'Your combo ran out!\nMAX COMBO fills it to the top.\nHere is one FREE: tap it now!': '¡Se acabó tu combo!\nCOMBO MÁXIMO llena la barra.\nAquí tienes uno GRATIS: ¡tócalo ya!',
    'Time is running out!\n+15 SECONDS gives you extra time.\nHere is one FREE: tap it now!': '¡Se acaba el tiempo!\n+15 SEGUNDOS te da tiempo extra.\nAquí tienes uno GRATIS: ¡tócalo ya!',
    'Need a breather?\nFREEZE TIME stops the clock for 10s.\nHere is one FREE: tap it now!': '¿Necesitas un respiro?\nCONGELAR TIEMPO detiene el reloj 10s.\nAquí tienes uno GRATIS: ¡tócalo ya!',
    'An order is about to expire!\nFREEZE ORDERS stops all order timers.\nHere is one FREE: tap it now!': '¡Un pedido está por vencer!\nCONGELAR PEDIDOS detiene el tiempo de todos.\nAquí tienes uno GRATIS: ¡tócalo ya!',
    'Big orders? LESS ITEMS cuts every\nfood in every order down to 1.\nHere is one FREE: tap it now!': '¿Pedidos grandes? MENOS ARTÍCULOS baja\ncada comida de cada pedido a 1.\nAquí tienes uno GRATIS: ¡tócalo ya!',
    'Stuck? AUTO SELECT picks the foods\nof the next order for you.\nHere is one FREE: tap it now!': '¿Atascado? SELECCIÓN AUTOMÁTICA elige\nlas comidas del próximo pedido.\nAquí tienes uno GRATIS: ¡tócalo ya!',
    "Can't find the food? FOCUS highlights\nwhat you need for a few seconds.\nHere is one FREE: tap it now!": '¿No encuentras la comida? ENFOQUE resalta\nlo que necesitas unos segundos.\nAquí tienes uno GRATIS: ¡tócalo ya!',
    'Great combo!\nDOUBLE COINS doubles your coins.\nHere is one FREE: tap it now!': '¡Gran combo!\nMONEDAS DOBLES duplica tus monedas.\nAquí tienes uno GRATIS: ¡tócalo ya!',
    'Time is running low!\nIf it reaches ZERO, you FAIL.': '¡Queda poco tiempo!\nSi llega a CERO, PIERDES.',
    'This order is LATE!\nWhen you deliver it, the delay is\nSUBTRACTED from your total time.': '¡Este pedido va TARDE!\nAl entregarlo, el retraso se\nRESTA de tu tiempo total.',
    'Tap the highlighted power-up!': '¡Toca el potenciador resaltado!',
    'GOLDEN TIME!\nEvery food is a COIN now!\nTap as many as you can!': '¡GOLDEN TIME!\n¡Toda comida es una MONEDA!\n¡Toca todas las que puedas!',
    'Those foods are not in your orders!\nYour first order needs {0}x {1}.\nPick the highlighted ones.': '¡Esas comidas no están en tus pedidos!\nTu primer pedido necesita {0}x {1}.\nElige las resaltadas.',
    'Wrong food?\nTap it in the tray to put it back!': '¿Comida equivocada?\n¡Tócala en la bandeja para devolverla!',
};

const DE: Record<string, string> = {
    'Orders': 'Bestellungen',
    'NICE!': 'NETT!', 'GREAT!': 'SUPER!', 'AWESOME!': 'GENIAL!', 'AMAZING!': 'WAHNSINN!',
    'UNSTOPPABLE!': 'UNAUFHALTSAM!', 'LEGENDARY!': 'LEGENDÄR!', 'FAST COMBO x{0}': 'SCHNELLER COMBO x{0}',
    'BREAKFAST': 'FRÜHSTÜCK', 'LUNCH': 'MITTAGESSEN', 'DINNER': 'ABENDESSEN',
    'BREAKFAST TIME!': 'FRÜHSTÜCKSZEIT!', 'LUNCH TIME!': 'MITTAGSZEIT!', 'DINNER TIME!': 'ABENDESSENSZEIT!',
    'PART {0} OF {1}': 'TEIL {0} VON {1}', 'PART {0} OF {1} - NEW FOODS!': 'TEIL {0} VON {1} - NEUE SPEISEN!',
    'GOLDEN TIME!': 'GOLDEN TIME!', 'GOLDEN TIME': 'GOLDEN TIME', 'x2 COINS - GRAB THEM ALL!': 'MÜNZEN x2 - SCHNAPP SIE ALLE!',
    'Freeze Time': 'Zeit stoppen', 'Stops the level timer for 10s': 'Stoppt die Levelzeit für 10s',
    'Freeze Orders': 'Bestellungen stoppen', 'Stops all order timers for 10s': 'Stoppt alle Bestellzeiten für 10s',
    '+15 Seconds': '+15 Sekunden', 'Adds 15s to the level timer': 'Fügt der Levelzeit 15s hinzu',
    'Less Items': 'Weniger Items', 'Every product in every order drops to 1': 'Jedes Produkt jeder Bestellung sinkt auf 1',
    'Auto Select': 'Auto-Auswahl', 'Selects the foods of the next order': 'Wählt die Speisen der nächsten Bestellung',
    'Focus': 'Fokus', 'Highlights the foods of the next order': 'Hebt die Speisen der nächsten Bestellung hervor',
    'Max Combo': 'Max. Combo', 'Max combo for 10s': 'Max. Combo für 10s',
    'Double Coins': 'Doppelte Münzen', 'Coins x2 for 10s': 'Münzen x2 für 10s',
    'POWER-UPS': 'POWER-UPS', 'FREE': 'GRATIS',
    'Nothing to use it on right now': 'Gerade nichts zu tun', 'Not enough coins': 'Nicht genug Münzen',
    '+{0} random power-ups!': '+{0} zufällige Power-ups!', '+{0} coins': '+{0} Münzen',
    'Fries': 'Pommes', 'Burger': 'Burger', 'Ice Cream': 'Eis', 'Soda': 'Limo',
    'Chicken': 'Hähnchen', 'Pizza': 'Pizza', 'Hot Dog': 'Hotdog', 'Donut': 'Donut', 'Taco': 'Taco',
    'Popcorn': 'Popcorn', 'Onion Rings': 'Zwiebelringe', 'Sandwich': 'Sandwich', 'Muffin': 'Muffin',
    'Cupcake': 'Cupcake', 'Milkshake': 'Milchshake',
    'ACHIEVEMENTS': 'ERFOLGE', 'ACHIEVEMENT UNLOCKED!': 'ERFOLG FREIGESCHALTET!', 'CLAIM': 'ABHOLEN', 'DONE': 'ERLEDIGT',
    'First Steps': 'Erste Schritte', 'Complete 1 level': 'Schließe 1 Level ab',
    'Warming Up': 'Aufwärmen', 'Complete 5 levels': 'Schließe 5 Level ab',
    'On a Roll': 'Auf Kurs', 'Complete 10 levels': 'Schließe 10 Level ab',
    'Complete 25 levels': 'Schließe 25 Level ab', 'Master Chef': 'Meisterkoch', 'Complete 50 levels': 'Schließe 50 Level ab',
    'Star Collector': 'Sternesammler', 'Collect 15 stars': 'Sammle 15 Sterne',
    'Star Hoarder': 'Sternehorter', 'Collect 45 stars': 'Sammle 45 Sterne', 'Collect 100 stars': 'Sammle 100 Sterne',
    'Perfectionist': 'Perfektionist', 'Finish a level with 3 stars': 'Beende ein Level mit 3 Sternen',
    'Triple Threat': 'Dreifache Gefahr', 'Get 3 stars on 10 different levels': 'Erhalte 3 Sterne in 10 verschiedenen Leveln',
    'Climbing': 'Aufstieg', 'Reach level 10': 'Erreiche Level 10', 'Summit': 'Gipfel', 'Reach level 30': 'Erreiche Level 30',
    'Special Delivery': 'Speziallieferung', 'Finish a special level': 'Beende ein Spezial-Level',
    'Boss Slayer': 'Bossbezwinger', 'Finish 5 special levels': 'Beende 5 Spezial-Level',
    'Merge Rookie': 'Merge-Neuling', 'Make 50 merges': 'Mache 50 Merges',
    'Merge Master': 'Merge-Meister', 'Make 500 merges': 'Mache 500 Merges',
    'Order Up!': 'Bestellung fertig!', 'Deliver 25 orders': 'Liefere 25 Bestellungen', 'Deliver 100 orders on time': 'Liefere 100 Bestellungen pünktlich',
    'Combo King': 'Combo-König', 'Reach the max combo 3 times': 'Erreiche die max. Combo 3 Mal',
    'Power Player': 'Power-up-Profi', 'Use 15 power-ups': 'Nutze 15 Power-ups',
    'NEXT': 'WEITER', 'RESTART': 'NEUSTART', 'x2 COINS': 'MÜNZEN x2', 'DOUBLED!': 'VERDOPPELT!',
    'CHECKPOINT': 'CHECKPOINT', 'CONTINUE': 'WEITERSPIELEN',
    'Watch an ad to restart {0} from the beginning!': 'Sieh dir eine Werbung an, um {0} neu zu starten!',
    'Watch an ad to keep playing from where you stopped!': 'Sieh dir eine Werbung an und spiele dort weiter, wo du aufgehört hast!',
    'PLAY': 'SPIELEN', 'SELECT LEVEL': 'LEVEL WÄHLEN', 'CURRENT': 'AKTUELL',
    'RANKING': 'RANGLISTE', 'PROFILE': 'PROFIL', 'WELCOME!': 'WILLKOMMEN!', 'Choose your nickname': 'Wähle deinen Spitznamen',
    'Shown in the ranking': 'Wird in der Rangliste angezeigt', 'LOGIN WITH POKI': 'MIT POKI ANMELDEN', 'Login cancelled': 'Anmeldung abgebrochen',
    'Please choose another nickname': 'Bitte wähle einen anderen Namen', 'Logged in as {0}': 'Angemeldet als {0}',
    'Save your progress on any device': 'Speichere deinen Fortschritt auf jedem Gerät',
    'Ranking unavailable.\nThe game id is not set.': 'Rangliste nicht verfügbar.\nDie Spiel-ID ist nicht gesetzt.',
    'No players yet. Be the first!': 'Noch keine Spieler. Sei der Erste!',
    'Your rank: #{0}   {1} stars': 'Dein Rang: #{0}   {1} Sterne', 'Your stars: {0}': 'Deine Sterne: {0}',
    'Win a level to join the ranking!': 'Gewinne ein Level, um in die Rangliste zu kommen!',
    'Could not load the ranking.\nTry again later.': 'Rangliste konnte nicht geladen werden.\nVersuche es später erneut.',
    '{0} (you)': '{0} (du)', 'Player': 'Spieler', 'Chef': 'Koch',
    'Touch to continue': 'Tippen zum Fortfahren',
    'These are your ORDERS!\nCollect the exact amount before time runs out.': 'Das sind deine BESTELLUNGEN!\nSammle die genaue Menge, bevor die Zeit abläuft.',
    'Tap the highlighted foods!': 'Tippe auf die markierten Speisen!',
    "NOW IT'S": 'JETZT BIST', 'YOUR TURN!': 'DU DRAN!', "NOW IT'S YOUR TURN!": 'JETZT BIST DU DRAN!',
    'Your combo ran out!\nMAX COMBO fills it to the top.\nHere is one FREE: tap it now!': 'Dein Combo ist weg!\nMAX. COMBO füllt ihn auf.\nHier ist einer GRATIS: Tippe jetzt!',
    'Time is running out!\n+15 SECONDS gives you extra time.\nHere is one FREE: tap it now!': 'Die Zeit läuft ab!\n+15 SEKUNDEN gibt dir mehr Zeit.\nHier ist einer GRATIS: Tippe jetzt!',
    'Need a breather?\nFREEZE TIME stops the clock for 10s.\nHere is one FREE: tap it now!': 'Brauchst du eine Pause?\nZEIT STOPPEN hält die Uhr 10s an.\nHier ist einer GRATIS: Tippe jetzt!',
    'An order is about to expire!\nFREEZE ORDERS stops all order timers.\nHere is one FREE: tap it now!': 'Eine Bestellung läuft gleich ab!\nBESTELLUNGEN STOPPEN hält alle an.\nHier ist einer GRATIS: Tippe jetzt!',
    'Big orders? LESS ITEMS cuts every\nfood in every order down to 1.\nHere is one FREE: tap it now!': 'Große Bestellungen? WENIGER ITEMS senkt\njede Speise jeder Bestellung auf 1.\nHier ist einer GRATIS: Tippe jetzt!',
    'Stuck? AUTO SELECT picks the foods\nof the next order for you.\nHere is one FREE: tap it now!': 'Festgefahren? AUTO-AUSWAHL wählt die\nSpeisen der nächsten Bestellung.\nHier ist einer GRATIS: Tippe jetzt!',
    "Can't find the food? FOCUS highlights\nwhat you need for a few seconds.\nHere is one FREE: tap it now!": 'Findest du die Speise nicht? FOKUS markiert\nwas du brauchst für ein paar Sekunden.\nHier ist einer GRATIS: Tippe jetzt!',
    'Great combo!\nDOUBLE COINS doubles your coins.\nHere is one FREE: tap it now!': 'Toller Combo!\nDOPPELTE MÜNZEN verdoppelt deine Münzen.\nHier ist einer GRATIS: Tippe jetzt!',
    'Time is running low!\nIf it reaches ZERO, you FAIL.': 'Die Zeit wird knapp!\nBei NULL verlierst du.',
    'This order is LATE!\nWhen you deliver it, the delay is\nSUBTRACTED from your total time.': 'Diese Bestellung ist SPÄT!\nBei Lieferung wird die Verspätung\nvon deiner Gesamtzeit ABGEZOGEN.',
    'Tap the highlighted power-up!': 'Tippe auf das markierte Power-up!',
    'GOLDEN TIME!\nEvery food is a COIN now!\nTap as many as you can!': 'GOLDEN TIME!\nJede Speise ist jetzt eine MÜNZE!\nTippe so viele du kannst!',
    'Those foods are not in your orders!\nYour first order needs {0}x {1}.\nPick the highlighted ones.': 'Diese Speisen sind nicht in deinen Bestellungen!\nDeine erste Bestellung braucht {0}x {1}.\nWähle die markierten.',
    'Wrong food?\nTap it in the tray to put it back!': 'Falsche Speise?\nTippe sie im Tablett an, um sie zurückzulegen!',
};

const DICTS: Record<string, Record<string, string>> = { pt: PT, es: ES, de: DE };

const LANG_KEY = 'match3_lang_override';

function detect(): Lang {
    try {
        const g: any = typeof globalThis !== 'undefined' ? globalThis : {};
        const search: string = g.location && g.location.search ? g.location.search : '';
        const m = /[?&]lang=([a-zA-Z-]+)/.exec(search);
        const pick = (code: string): Lang | null => {
            const p = code.toLowerCase().split(/[-_]/)[0];
            return p === 'pt' || p === 'es' || p === 'de' || p === 'en' ? p : null;
        };
        if (m) { const l = pick(m[1]); if (l) return l; }
        try {
            const saved = g.localStorage ? g.localStorage.getItem(LANG_KEY) : null; // escolhido no botao de teste
            const l = saved ? pick(saved) : null;
            if (l) return l;
        } catch (e) { /* sem storage */ }
        const nav: any = g.navigator;
        const list: string[] = nav ? (nav.languages && nav.languages.length ? Array.from(nav.languages) : [nav.language]) : [];
        for (const code of list) {
            if (!code) continue;
            const l = pick(String(code));
            if (l) return l;
        }
    } catch (e) { /* ingles */ }
    return 'en';
}

export class I18n {
    public static readonly lang: Lang = detect();

    /** Traduz `en` (e troca {0}, {1}... pelos argumentos). Sem traducao, usa o proprio texto em ingles. */
    public static t(en: string, ...args: (string | number)[]): string {
        const dict = DICTS[this.lang];
        let s = (dict && dict[en]) || en;
        if (args.length) s = s.replace(/\{(\d+)\}/g, (_m, i) => (args[+i] !== undefined ? String(args[+i]) : ''));
        return s;
    }

    /**
     * Botao de teste de idioma (canto superior esquerdo): so aparece em localhost/rede local (ou com `?langbtn=1`),
     * nunca na build publicada. Cada toque passa ao proximo idioma, grava a escolha e recarrega a pagina.
     */
    public static installSwitcher() {
        try {
            const g: any = globalThis;
            const doc = g.document, loc = g.location;
            if (!doc || !loc || doc.getElementById('lang-switcher')) return;
            const host: string = loc.hostname || '';
            const local = host === 'localhost' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /[?&]langbtn=1/.test(loc.search || '');
            if (!local) return;
            const order: Lang[] = ['en', 'pt', 'es', 'de'];
            const btn = doc.createElement('button');
            btn.id = 'lang-switcher';
            btn.textContent = `🌐 ${this.lang.toUpperCase()}`;
            btn.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99998;padding:6px 10px;font:bold 14px sans-serif;'
                + 'border:2px solid #fff;border-radius:10px;background:rgba(20,30,70,.85);color:#fff;opacity:.85;';
            btn.onclick = (e: Event) => {
                e.stopPropagation();
                const next = order[(order.indexOf(this.lang) + 1) % order.length];
                try { g.localStorage.setItem(LANG_KEY, next); } catch (err) { /* sem storage */ }
                loc.href = loc.pathname; // recarrega sem o ?lang= (que teria prioridade)
            };
            doc.body.appendChild(btn);
        } catch (e) { /* so teste */ }
    }

    /** Traduz os textos fixos da cena (Labels cujo texto e uma chave do dicionario, como PLAY e SELECT LEVEL). */
    public static localizeTree(root: Node | null) {
        const dict = DICTS[this.lang];
        if (!root || !dict) return;
        root.getComponentsInChildren(Label).forEach(l => {
            const t = dict[l.string];
            if (t) l.string = t;
        });
    }
}

/** Atalho: `tr('NICE!')`, `tr('+{0} coins', n)`. */
export const tr = (en: string, ...args: (string | number)[]): string => I18n.t(en, ...args);
