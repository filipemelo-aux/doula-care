// Dados semanais da gestação (1-40). Conteúdo educativo e emocional para a visitante.
// Tamanhos e pesos são aproximações médicas amplamente aceitas.

// Importação de imagens — Vite resolve em URLs otimizadas
const imageModules = import.meta.glob("@/assets/pregnancy/week-*.webp", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function imageFor(week: number): string {
  const key = `/src/assets/pregnancy/week-${String(week).padStart(2, "0")}.webp`;
  return imageModules[key] ?? "";
}

export type Trimester = "1º trimestre" | "2º trimestre" | "3º trimestre";

export interface WeekInfo {
  week: number;
  trimester: Trimester;
  fruit_name: string;
  fruit_emoji: string;
  baby_size_cm: string;
  baby_weight: string;
  /** Texto curto/emocional para o carrossel */
  description: string;
  /** Texto longo/educativo para a página de detalhes */
  full_description: string;
  /** Tópicos de desenvolvimento do bebê nessa fase */
  development: string[];
  /** Dica curta */
  tip: string;
  baby_image?: string;
}

function trimesterFor(week: number): Trimester {
  if (week <= 13) return "1º trimestre";
  if (week <= 27) return "2º trimestre";
  return "3º trimestre";
}

const DEVELOPMENT_BY_WEEK: Record<number, string[]> = {
  1: ["Corpo se prepara para a ovulação", "Endométrio começa a se espessar", "Hormônios em ajuste"],
  2: ["Ovulação acontece nesta semana", "Óvulo desce pelas trompas", "Janela fértil aberta"],
  3: ["Fecundação ocorre", "Células começam a se multiplicar", "Início da viagem até o útero"],
  4: ["Implantação no útero", "Formação do saco gestacional", "Início da produção de hCG"],
  5: ["Tubo neural se forma", "Coração primitivo começa a bater", "Brotos dos braços aparecem"],
  6: ["Coração já bate (~110 bpm)", "Olhos e ouvidos se formam", "Pequenos brotos de membros"],
  7: ["Bracinhos e perninhas brotam", "Cérebro se desenvolve rapidamente", "Rosto começa a se desenhar"],
  8: ["Dedinhos começam a se formar", "Movimentos espontâneos iniciam", "Órgãos internos em formação"],
  9: ["Traços faciais ganham forma", "Cauda embrionária desaparece", "Aparência mais humana"],
  10: ["Órgãos vitais formados", "Fim do período embrionário", "Bebê agora é chamado de feto"],
  11: ["Abre e fecha as mãos", "Cabelinho e unhas surgem", "Genitália começa a se diferenciar"],
  12: ["Reflexos ativos", "Rins produzem urina", "Enjoos costumam diminuir"],
  13: ["Início do 2º trimestre", "Cordas vocais se formam", "Energia volta para a mãe"],
  14: ["Faz caretas e boceja", "Suga o dedo", "Pele ainda translúcida"],
  15: ["Escuta sua voz", "Ossinhos endurecem", "Movimentos mais coordenados"],
  16: ["Primeiros movimentos perceptíveis", "Sistema nervoso amadurece", "Pode ouvir sons externos"],
  17: ["Esqueleto endurecendo", "Treina engolir líquido amniótico", "Acumula primeira gordura"],
  18: ["Audição funcionando", "Bocejos e soluços", "Sexo visível no ultrassom"],
  19: ["Vernix caseoso recobre a pele", "Ciclos de sono e vigília", "Sentidos se desenvolvem"],
  20: ["Metade do caminho! 🎉", "Reconhece sua voz", "Movimentos bem perceptíveis"],
  21: ["Movimentos mais fortes", "Pode até ver a barriga mexer", "Sistema digestivo treina"],
  22: ["Sobrancelhas e cílios formados", "Pele enrugada e avermelhada", "Cara de neném!"],
  23: ["Pulmões em maturação", "Ganho de peso acelera", "Movimentos rítmicos"],
  24: ["Marco da viabilidade fetal", "Rosto bem definido", "Audição muito apurada"],
  25: ["Responde à voz dos pais", "Mãos e dedos coordenados", "Pele menos enrugada"],
  26: ["Olhinhos começam a abrir", "Reage a luzes brilhantes", "Padrões de respiração"],
  27: ["Início do 3º trimestre", "Treina sucção e soluço", "Cérebro em desenvolvimento intenso"],
  28: ["Pisca os olhos", "Cílios bem definidos", "Movimentos mais visíveis"],
  29: ["Músculos e pulmões amadurecem", "Acumula gordura corporal", "Cabeça cresce rapidamente"],
  30: ["Já tem cabelinho", "Ganho de peso acelerado", "Líquido amniótico atinge o pico"],
  31: ["Cinco sentidos ativos", "Enxerga, ouve, sente, prova e cheira", "Rotina de sono mais regular"],
  32: ["Geralmente já está cabeça para baixo", "Unhas chegam à ponta dos dedos", "Pele mais lisa e rosada"],
  33: ["Ossos endurecendo", "Crânio ainda flexível para nascer", "Sistema imune em ativação"],
  34: ["Pulmões quase prontos", "Treino respiratório intenso", "Pesa o suficiente para nascer com segurança"],
  35: ["Pouco espaço no útero", "Movimentos menores e mais fortes", "Encaixe começa a acontecer"],
  36: ["Quase a termo", "Ganho de ~28 g por dia", "Anticorpos da mãe são transferidos"],
  37: ["A termo precoce", "Pronto para nascer", "Pulmões maduros"],
  38: ["Lanugem desaparece", "Vernix se reduz", "Encaixe na pelve"],
  39: ["A termo completo", "Pode nascer a qualquer momento", "Reflexos prontos para a vida fora"],
  40: ["Bebê pronto para nascer 💗", "Posição final na pelve", "Encontro tão esperado se aproxima"],
};

function fullDescriptionFor(week: number, base: string): string {
  if (week <= 4) {
    return `${base} Nesta fase muito inicial, o seu corpo está realizando ajustes hormonais profundos para receber e nutrir uma nova vida. Mesmo que você ainda não sinta grandes mudanças, muita coisa está acontecendo internamente — desde a preparação do endométrio até a possível implantação do embrião na parede uterina.`;
  }
  if (week <= 12) {
    return `${base} Esta é uma fase de formação intensa: estruturas fundamentais como o tubo neural, o coração e os primeiros órgãos estão se desenhando. Cuide bem da sua alimentação, descanse, e mantenha o pré-natal em dia. Cada semana traz uma evolução visível.`;
  }
  if (week <= 27) {
    return `${base} O segundo trimestre costuma ser o mais leve da gestação: os enjoos diminuem, a energia volta e a barriga começa a aparecer. Seu bebê já interage com o ambiente, ouvindo sua voz e respondendo a estímulos. É um ótimo momento para fortalecer o vínculo afetivo.`;
  }
  return `${base} A reta final exige preparo físico e emocional. Seu bebê está acumulando reservas, amadurecendo pulmões e se posicionando para o nascimento. Confie no seu corpo, esteja perto da sua doula e do seu plano de parto. O encontro está cada vez mais próximo. 💗`;
}



export const PREGNANCY_WEEKS: WeekInfo[] = [
  { week: 1, fruit_name: "grão de pólen", fruit_emoji: "🌱", baby_size_cm: "—", baby_weight: "—", description: "A jornada começa! Seu corpo está se preparando para uma das experiências mais transformadoras da vida.", tip: "Comece a tomar ácido fólico se ainda não toma — ele é essencial nas primeiras semanas." },
  { week: 2, fruit_name: "semente de sésamo", fruit_emoji: "🌾", baby_size_cm: "—", baby_weight: "—", description: "A ovulação acontece por volta desta semana. O encontro mágico entre o óvulo e o espermatozoide pode ocorrer agora.", tip: "Mantenha uma alimentação rica em nutrientes e hidrate-se bem." },
  { week: 3, fruit_name: "drupleta de framboesa", fruit_emoji: "🍇", baby_size_cm: "0,1 mm", baby_weight: "<1 g", description: "A fecundação aconteceu! Um pequeno conjunto de células já começa a se dividir e descer pelas trompas.", tip: "Evite álcool e cigarro — mesmo antes de confirmar a gravidez." },
  { week: 4, fruit_name: "groselha vermelha", fruit_emoji: "🍒", baby_size_cm: "0,4 mm", baby_weight: "<1 g", description: "O embrião se implanta no útero. Algumas mulheres já sentem leves cólicas ou um pequeno sangramento.", tip: "É hora de fazer o teste de gravidez se houve atraso menstrual." },
  { week: 5, fruit_name: "grão de pimenta preta", fruit_emoji: "⚫", baby_size_cm: "1,5 mm", baby_weight: "<1 g", description: "O coraçãozinho começa a se formar! Os primeiros sistemas do bebê estão sendo desenhados.", tip: "Marque sua primeira consulta de pré-natal." },
  { week: 6, fruit_name: "semente de ervilha de cheiro", fruit_emoji: "🌱", baby_size_cm: "4 mm", baby_weight: "<1 g", description: "O coração já bate! Pode ser visto no ultrassom transvaginal nesta fase.", tip: "Enjoos podem aparecer — coma pequenas porções ao longo do dia." },
  { week: 7, fruit_name: "mirtilo", fruit_emoji: "🫐", baby_size_cm: "1 cm", baby_weight: "1 g", description: "Bracinhos e perninhas começam a brotar. O cérebro se desenvolve rapidamente.", tip: "Descanse sempre que possível. O cansaço é totalmente normal." },
  { week: 8, fruit_name: "cereja pequena", fruit_emoji: "🍒", baby_size_cm: "1,6 cm", baby_weight: "1 g", description: "Início do estágio fetal! Articulações como cotovelos e joelhos já estão visíveis e os dedinhos totalmente formados.", tip: "Evite alimentos crus e mal cozidos. Atenção à higiene dos alimentos." },
  { week: 9, fruit_name: "azeitona", fruit_emoji: "🫒", baby_size_cm: "2,3 cm", baby_weight: "2 g", description: "Os traços faciais ganham forma. O bebê já tem aparência mais humana e menos de embrião.", tip: "Hidrate bem a pele da barriga — ela vai esticar bastante!" },
  { week: 10, fruit_name: "morango", fruit_emoji: "🍓", baby_size_cm: "3,1 cm", baby_weight: "4 g", description: "Órgãos vitais já estão formados e começam a funcionar. Fim do período embrionário!", tip: "Comemore: o risco de aborto cai significativamente a partir daqui." },
  { week: 11, fruit_name: "figo", fruit_emoji: "🌰", baby_size_cm: "4,1 cm", baby_weight: "7 g", description: "O bebê já abre e fecha as mãos. Cabelinho e unhas começam a aparecer.", tip: "Hora do ultrassom morfológico do primeiro trimestre." },
  { week: 12, fruit_name: "ameixa", fruit_emoji: "🟣", baby_size_cm: "5,4 cm", baby_weight: "14 g", description: "O bebê já se movimenta bastante e tem reflexos. Os enjoos começam a diminuir.", tip: "Acompanhamento mais frequente começa agora — converse com sua doula." },
  { week: 13, fruit_name: "vagem", fruit_emoji: "🫛", baby_size_cm: "7,4 cm", baby_weight: "23 g", description: "Bem-vinda ao segundo trimestre! Energia volta e a barriga começa a aparecer.", tip: "Aproveite essa fase de mais disposição para se exercitar levemente." },
  { week: 14, fruit_name: "limão siciliano", fruit_emoji: "🍋", baby_size_cm: "8,7 cm", baby_weight: "43 g", description: "O bebê já faz caretas, suga o dedo e até bocejos. A pele ainda é translúcida.", tip: "Comece a conversar com seu bebê — ele já reconhece sons." },
  { week: 15, fruit_name: "maçã", fruit_emoji: "🍎", baby_size_cm: "10,1 cm", baby_weight: "70 g", description: "O bebê escuta sua voz! Música suave pode acalmar tanto você quanto ele.", tip: "Inicie um diário da gestação para registrar essa fase mágica." },
  { week: 16, fruit_name: "abacate", fruit_emoji: "🥑", baby_size_cm: "11,6 cm", baby_weight: "100 g", description: "Você pode começar a sentir os primeiros movimentos — como borboletinhas na barriga.", tip: "Anote o momento dos primeiros movimentos. É inesquecível!" },
  { week: 17, fruit_name: "pera", fruit_emoji: "🍐", baby_size_cm: "13 cm", baby_weight: "140 g", description: "O esqueleto vai endurecendo. O bebê treina engolir e respirar com líquido amniótico.", tip: "Use roupas confortáveis e calçados sem salto alto." },
  { week: 18, fruit_name: "pimentão", fruit_emoji: "🫑", baby_size_cm: "14,2 cm", baby_weight: "190 g", description: "Os ouvidos estão funcionando! Cantar para o bebê cria conexões emocionais.", tip: "Já dá para descobrir o sexo no ultrassom morfológico." },
  { week: 19, fruit_name: "tomate", fruit_emoji: "🍅", baby_size_cm: "15,3 cm", baby_weight: "240 g", description: "O bebê tem ciclos de sono e vigília bem definidos.", tip: "Fique atenta à pressão arterial nas consultas." },
  { week: 20, fruit_name: "banana", fruit_emoji: "🍌", baby_size_cm: "25,6 cm", baby_weight: "300 g", description: "Metade do caminho! O bebê pode reconhecer sua voz e responder a estímulos.", tip: "Ultrassom morfológico detalhado — momento muito esperado." },
  { week: 21, fruit_name: "cenoura", fruit_emoji: "🥕", baby_size_cm: "26,7 cm", baby_weight: "360 g", description: "Os movimentos ficam mais fortes. Você pode até ver a barriga mexer!", tip: "Compartilhe os chutinhos com seu parceiro — momento mágico." },
  { week: 22, fruit_name: "abóbora pequena", fruit_emoji: "🎃", baby_size_cm: "27,8 cm", baby_weight: "430 g", description: "Sobrancelhas e cílios já estão formados. O bebê tem cara de neném!", tip: "Massagens leves na barriga ajudam na conexão e relaxamento." },
  { week: 23, fruit_name: "manga", fruit_emoji: "🥭", baby_size_cm: "28,9 cm", baby_weight: "501 g", description: "A pele ainda é enrugada — está esperando ganhar gordurinha.", tip: "Faça o teste de tolerância à glicose se sua médica indicar." },
  { week: 24, fruit_name: "milho", fruit_emoji: "🌽", baby_size_cm: "30 cm", baby_weight: "600 g", description: "Marco da viabilidade fetal. O bebê tem chances reais de sobrevivência fora do útero.", tip: "Comece a planejar o quartinho e o enxoval com calma." },
  { week: 25, fruit_name: "couve-flor", fruit_emoji: "🥦", baby_size_cm: "34,6 cm", baby_weight: "660 g", description: "O bebê responde à sua voz e a do parceiro com movimentos.", tip: "Inscreva-se em curso para gestantes — preparação faz toda diferença." },
  { week: 26, fruit_name: "alface", fruit_emoji: "🥬", baby_size_cm: "35,6 cm", baby_weight: "760 g", description: "Os olhinhos começam a abrir. O bebê pode reagir a luzes brilhantes na barriga.", tip: "Pratique técnicas de respiração — vão ser úteis no parto." },
  { week: 27, fruit_name: "couve", fruit_emoji: "🥬", baby_size_cm: "36,6 cm", baby_weight: "875 g", description: "Bem-vinda ao terceiro trimestre! O bebê treina sugar e até soluçar.", tip: "Hora de pensar no plano de parto com sua doula." },
  { week: 28, fruit_name: "berinjela", fruit_emoji: "🍆", baby_size_cm: "37,6 cm", baby_weight: "1 kg", description: "O bebê pisca os olhos e tem cílios definidos.", tip: "Comece a contar movimentos diariamente — sinal importante de bem-estar." },
  { week: 29, fruit_name: "abóbora moranga", fruit_emoji: "🎃", baby_size_cm: "38,6 cm", baby_weight: "1,15 kg", description: "Músculos e pulmões continuam amadurecendo rapidamente.", tip: "Cuidado com inchaço — eleve as pernas várias vezes ao dia." },
  { week: 30, fruit_name: "repolho", fruit_emoji: "🥬", baby_size_cm: "39,9 cm", baby_weight: "1,32 kg", description: "O bebê já tem cabelo e ganha peso de forma acelerada.", tip: "Decida onde vai parir e visite o local com antecedência." },
  { week: 31, fruit_name: "coco", fruit_emoji: "🥥", baby_size_cm: "41,1 cm", baby_weight: "1,5 kg", description: "Os cinco sentidos estão funcionando. O bebê enxerga, ouve, sente, prova e cheira.", tip: "Comece os preparativos da mala da maternidade." },
  { week: 32, fruit_name: "abacaxi", fruit_emoji: "🍍", baby_size_cm: "42,4 cm", baby_weight: "1,7 kg", description: "Geralmente o bebê já está de cabeça para baixo, posicionando-se para o parto.", tip: "Faça aulas de yoga para gestantes — ajuda no parto e na conexão." },
  { week: 33, fruit_name: "mamão", fruit_emoji: "🥭", baby_size_cm: "43,7 cm", baby_weight: "1,92 kg", description: "Ossos estão endurecendo (exceto o crânio, que precisa flexionar para nascer).", tip: "Converse com sua doula sobre técnicas de alívio da dor." },
  { week: 34, fruit_name: "melão cantaloupe", fruit_emoji: "🍈", baby_size_cm: "45 cm", baby_weight: "2,15 kg", description: "Os pulmões estão quase prontos. O bebê treina respiração intensamente.", tip: "Garanta o acompanhamento da doula no pré-parto." },
  { week: 35, fruit_name: "melão honeydew", fruit_emoji: "🍈", baby_size_cm: "46,2 cm", baby_weight: "2,38 kg", description: "Pouco espaço dentro do útero — os movimentos ficam menores, porém mais fortes.", tip: "Massagem perineal pode ajudar a evitar laceração no parto." },
  { week: 36, fruit_name: "mamão papaia", fruit_emoji: "🥭", baby_size_cm: "47,4 cm", baby_weight: "2,62 kg", description: "Bebê é considerado quase a termo. Tudo pode acontecer a partir de agora!", tip: "Mala pronta? Documentos separados? Plano de parto definido?" },
  { week: 37, fruit_name: "acelga", fruit_emoji: "🥬", baby_size_cm: "48,6 cm", baby_weight: "2,86 kg", description: "Bebê a termo precoce! Já está pronto para nascer com segurança.", tip: "Mantenha contato direto com sua doula — pode ser a hora!" },
  { week: 38, fruit_name: "alho-poró", fruit_emoji: "🌿", baby_size_cm: "49,8 cm", baby_weight: "3,08 kg", description: "Os pulmões estão prontos. O bebê está terminando os últimos detalhes.", tip: "Caminhe bastante — ajuda o bebê a encaixar." },
  { week: 39, fruit_name: "melancia pequena", fruit_emoji: "🍉", baby_size_cm: "50,7 cm", baby_weight: "3,29 kg", description: "Bebê a termo completo! Pronto para chegar ao mundo a qualquer momento.", tip: "Confie no seu corpo. Você nasceu para isso." },
  { week: 40, fruit_name: "melancia", fruit_emoji: "🍉", baby_size_cm: "51,2 cm", baby_weight: "3,46 kg", description: "É chegada a hora! Seu bebê está prontinho para conhecer o mundo e os seus braços.", tip: "Respire, confie e se entregue. O encontro está pertinho! 💗" },
].map((w) => ({
  ...w,
  trimester: trimesterFor(w.week),
  full_description: fullDescriptionFor(w.week, w.description),
  development: DEVELOPMENT_BY_WEEK[w.week] ?? [],
  baby_image: imageFor(w.week),
}));

export function getWeekInfo(week: number): WeekInfo {
  const w = Math.max(1, Math.min(40, Math.round(week)));
  return PREGNANCY_WEEKS[w - 1];
}

export function getBabyImage(week: number): string {
  return imageFor(Math.max(1, Math.min(40, Math.round(week))));
}
