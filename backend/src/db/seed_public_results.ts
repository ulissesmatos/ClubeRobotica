/**
 * Seed dos resultados públicos do Clube de Robótica 2026.
 * Importado a partir dos PDFs oficiais da SEMECTI.
 * Só insere se a tabela estiver vazia.
 */
import { getDb } from "./database";

type Resultado = "aprovado" | "cadastro_reserva";

interface Entry {
  nome_completo: string;
  escola: string;
  resultado: Resultado;
}

function normalizeNome(str: string): string {
  return str
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// ─── Dados extraídos dos PDFs oficiais ───────────────────────────────────────

const ENTRIES: Entry[] = [
  // ── Escola Modelo Remy Archer – APROVADOS ──────────────────────────────────
  { nome_completo: "MARCELO KAYKY NASCIMENTO TEIXEIRA",      escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "FRANCISCA WESLANNY OLIVEIRA DA SILVA",   escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "SEBASTIÃO ALVES DA LUZ",                  escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "JOÃO MIGUEL LOPES DA SILVA",              escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "MARIA ALICE SILVA GUIMARÃES",             escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "SILVIA MELISSA SILVA GUIMARÃES",          escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "NIKOLAS GABRIEL CARVALHO NASCIMENTO",     escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "VINÍCIUS BASTOS PEREIRA",                 escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "LAYS EMANUELLY ARAÚJO FONTES",            escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "WELISON ARTHUR CUNHA MENEZES",            escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "NATANAEL DE SOUZA DUS SANTOS",            escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "ALLINY EVILLY BRANDÃO DA CUNHA",          escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "SARA SOFIA SOUSA CONCEIÇÃO",              escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "PEDRO PHELIPE SOUSA CONCEIÇÃO",           escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "FRANCISCO HENRIQUE DE SOUSA SILVA",       escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "GEOVANA VITÓRIA SILVA CANTANHEDE",        escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "JOÃO MIGUEL MORAIS DOS SANTOS",           escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "FRANCISCO RICKELMY DOS SANTOS RIBEIRO",   escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "PEDRO HENRIQUE SOARES DA COSTA",          escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "EVERTON SILVA OLIVEIRA",                  escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "ZAIRA ELLOA OLIVEIRA RODRIGUES",          escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "LUCAS VINÍCIUS PEREIRA FREITAS",          escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "KETALAR CICILIA BRITO DA SILVA",          escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "LUIZ DANIEL SOUZA SALAZAR",               escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "MAURÍCIO RAVI DA CONCEIÇÃO",              escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "MATEUS PEREIRA FREITAS",                  escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "PEDRO HENRIQUE DE ALMEIDA CARDOSO",       escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "LUIZ GUSTAVO GOMES PRADO",                escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "LUCAS DAVI DA CONCEIÇÃO DA CRUZ",         escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "JOSÉ CAIO MENDES DE SOUSA",               escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "PEDRO LUCAS BARBOSA OLIVEIRA",            escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "VANESSA LIMA OLIVEIRA",                   escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "LÍVIA MARIA TEIXEIRA DA SILVA",           escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "AMANDA VITÓRIA SOUSA",                    escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "CARLOS DANIEL DA SILVA SOUZA",            escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "ARTUR SENA SILVA",                        escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "RAILAN DA SILVA REIS",                    escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "DAVI LUCAS TRAJANO ARAUJO",               escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "ANA JHÚLIA DE SOUSA PRATA",               escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "DAVI LUCAS SOUSA ROCHA",                  escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "RENAN SOARES FERREIRA",                   escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "SELICIANE LEITE DE OLIVEIRA",             escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "TARCILA DE SOUSA SILVA",                  escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "VITÓRIA RAFAELLY SOARES CARDOSO",         escola: "Escola Modelo Remy Archer", resultado: "aprovado" },
  { nome_completo: "WILLIAN LEVY NASCIMENTO DE SOUSA",        escola: "Escola Modelo Remy Archer", resultado: "aprovado" },

  // ── Escola Modelo Remy Archer – CADASTRO DE RESERVA ───────────────────────
  { nome_completo: "JOSÉ ELIAS ALMERINDO CONCEIÇÃO",          escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "THAYNÁ DOS SANTOS GUIMARÃES",             escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "ANA CLARA DOS SANTOS GUIMARÃES",          escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "DAVI LUCAS SOUSA ROCHA",                  escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "LUIZ GUSTAVO GOMES PRADO",                escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "JOÃO MIGUEL SOUZA GOMES",                 escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "ERICK NOAH BASTOS MESQUITA",              escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "HEITOR SANTOS BARROS",                    escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "MOISÉS BRANDÃO ZANELLA",                  escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "ANNA KELLY MOREIRA DO NASCIMENTO",        escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "MARIA VALENTINA MOREIRA DO NASCIMENTO",   escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "NATHAN VINÍCIUS AZEVEDO FRASÃO",          escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },
  { nome_completo: "LUAN CARLOS SOUSA GONÇALVES",             escola: "Escola Modelo Remy Archer", resultado: "cadastro_reserva" },

  // ── U.I.M.E Estevam Ângelo de Sousa – APROVADOS ───────────────────────────
  { nome_completo: "ARIADNE SOPHIA COSTA",                        escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "NATHANAEL DA SILVA BOTELHO",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIA NICOLLY GUILHON DA SILVA",              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIA HELENA SOUSA DE ABREU",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIA CECÍLIA SILVA SOUSA",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JOSÉ MIGUEL ABREU DE LIMA",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JOÃO LUCAS SOARES SALES REGO",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "IAN PABLO DE OLIVEIRA ANASTÁCIO",             escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "EMANUELLE DOS SANTOS DE OLIVEIRA",            escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "EMANUEL LEVY SILVA DOS SANTOS",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ELY EMANUEL BRANDÃO",                         escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ELOISY LOHANNE BATISTA DE OLIVEIRA",          escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "EDUARDO GOIS DE SOUSA",                       escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "DAVI RODRIGUES",                              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ARTHUR NOGUEIRA CRUZ",                        escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RAMON CAETANO DE QUEIROZ",                    escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RUAN GABRIEL PEREIRA DA CONCEIÇÃO",           escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "TAILSON SOUSA CONCEIÇÃO",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "TALYSSON DOS SANTOS COSTA",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "TICIANY MARIA DA CRUZ SILVA",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "VICTOR EMANUEL DA SILVA MORAIS",              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "VINICIUS KAUAN GALVÃO SOUSA",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "VITOR DE CASTRO FERREIRA",                    escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "WELLERSON RAVI SILVA RODRIGUES PORTO",        escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ENZO GABRIEL GOMES DA SILVA",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ELIAS LIMA SOUZA",                            escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARY MANUELY DA SILVA LIMA",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "SARAH WELLEN DOS SANTOS DA COSTA NOGUEIRA",   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "IGOR RAFAEL SILVA DA CUNHA",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "HEDUARDA VITÓRIA DA SILVA OLIVEIRA",          escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "CRISLANE DIAS PACHECO",                       escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "PEDRO LUCAS DA COSTA PEREIRA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "DIEGO DE CARVALHO ANDRADE",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RUAN MENDES CHAVES",                          escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "YSMAEL CARLOS DA CONCEICAO FARIAS",           escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "PEDRO LUAN CONCEICAO GUILHON",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "PEDRO HENRIQUE SILVA MENDES",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RAYELLY DA SILVA MACHADO",                    escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LORRANE DA SILVA XAVIER",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LUCAS GABRIEL MOREIRA",                       escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "NAYRA LORRANE SANTOS",                        escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RUBENS GABRIEL DA SILVA",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "FRANCISCO RIKELME BARROSO ALVES",             escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "FABRICIO KENNEDY SOUZA BAIMA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "HELOYSA VITORIA CORREIA DA SILVA",            escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ESTER ALINE SILVA DA ROCHA",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "EMERSON RENAN ALVES BARROS",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ANA ALYCE DA SILVA SOARES",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RONALDO MOREIRA DE MELO",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "HADASSA MELISSA MORAES COSTA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "KEMILLE SABRINA CONCEICAO SILVA",             escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIA DA PIEDADE DA SILVA CONCEICAO",         escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "SAMIRA KELLY CABRAL DE SOUSA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "DAVID SILVA DE OLIVEIRA",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MAICON DA SILVA DA SILVA RODRIGUES",          escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "SANDRIELE DE MIRANDA BORBA",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIA CLARA COUTINHO DA SILVA",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "FRANCISCA SAMILLY FEITOSA LEAL",              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JOSÉ ELIAS ALMERINDO CONCEIÇÃO",              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "THAYNÁ DOS SANTOS GUIMARÃES",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JHENYFER NICOLE DIAS DOS SANTOS",             escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "FELIPE DOS SANTOS SILVA",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "HÉFRAN LEVI NEVES GUIMARÃES",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ALAN DA SIVLA OLIVEIRA",                      escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ADRIANA QUEIROZ GUIMARÃES",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ENZO GABRIEL RIOS COSTA",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JESUS LUCAS LIMA DE OLIVEIRA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "HAMILSON GABRIEL ALVES SOARES",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ENZO MARCEL DE OLIVEIRA SANTOS",              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ANTONIO VICTOR VAZ XIMENES",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ANTONIO VINICIUS CAETANO FIGUEIREDO",         escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "HEMILLY LAYS DA SILVA ALMEIDA",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ELIABE ARAÚJO FEITOZA",                       escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ANTONIO FRANCISCO DA COSTA MESQUITA",         escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "AYLLA MARCELA DA SILVA SILVA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JOÃO GABRIEL DUARTE DE SOUSA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JOÃO LUCAS ZAIDAN SILVA",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JOSE UBIRAJARA BARBOSA BRASIL",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JOSUE ROCHA LIMA",                            escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JULIO EDUARDO DOS SANTOS ALVES",              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "KAIO EDUARDO DA SILVA E SILVA",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "KAIO GABRIEL COSTA XIMENES",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "KAMILLY VITÓRIA DA SILVA E SILVA",            escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "KAYRON SAMUEL DE VASCONCELOS VIANA",          escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "KÉMERSON EMANUEL GOMES PACHECO",              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LIANNA PAULA QUEIROZ FONTES",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LUCAS EMANOEL BARROS LIMA",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LUIZA RIHANNA LIMA MESQUITA",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIA DE JESUS CRUZ DE SOUZA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIA EDUARDA ZAIDAN SILVA",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIANE CRISTINNY DA CRUZ SILVA",             escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RIANA SOARES FERREIRA",                       escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MELQUI BIAS COSTA",                           escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "SEBASTIAN GARCIA SERNA",                      escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "AMANDA VITÓRIA SOUSA",                        escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ANNA SOPHIA DA SILVA ALMEIDA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ÂNGELO GABRIEL SALES SANTOS",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ARTHUR DA CRUZ RAMOS SOUZA",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RIAN DA SILVA LUZ",                           escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "WELLINGTON MAGNO NASCIMENTO",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ABIMAEL ALBERT MOTA NUNES",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ARTHUR LEVY DO CARMO SILVA",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ADRIELLY BRANDÃO DE MOURA",                   escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ANA LUÍZA PIRES LIMA",                        escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "RICHERLY KASSIA E SOUSA SILVA",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "AUGUSTO PEREIRA DA SILVA NETO",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "PETTRICKY RUAM OLIVEIRA",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "HEITOR GABRIEL DA SILVA",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "FRANCISCO LEVY VAZ SOUSA",                    escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "JOSÉ FÁBIO DA COSTA MESQUITA",                escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LUÍS OTÁVIO DA COSTA LUZ",                    escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "KÉSSYA MARIA GOMES PACHECO",                  escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LIARA HELOÍSE DA SILVA CAMPÊLO",              escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ISAAC VIEIRA DE MORAIS",                      escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "MARIA VALENTINA MOREIRA DO NASCIMENTO",       escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ENZO EMANUELL LIRA DA SILVA",                 escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LEANDRO CUTRIM DE SOUSA",                     escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "KETHELY VALENTINA DE ARAÚJO PEREIRA",         escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "LUCAS PIETRO FERNANDES DA SILVA",             escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },
  { nome_completo: "ELOAH DUAILIBE DA PAZ ALMEIDA",               escola: "U.I.M.E Estevam Ângelo de Sousa", resultado: "aprovado" },

  // ── CMCB 02 de julho Unidade L – APROVADOS ────────────────────────────────
  { nome_completo: "TERESA DAVILLA MOREIRA BORGES",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "REBECA GUILHON LIMA",                         escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ÁGHATA SOFIER SOUSA RIBEIRO",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ISSAC DANIEL DA CONCEIÇÃO ARAÚJO",            escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARCOS GABRIEL PEREIRA ROCHA",                escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "FRANCISCO ARTHUR MENDONCA",                   escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "KLEBERSON LOPES DE SOUSA",                    escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA GABRIELE SALAZAR DE SOUSA",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ENNZO GABRIEL COSTA LIMA",                    escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ENZO RAFAEL DA SILVA COSTA",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "GUILHERME KAIRO OLIVEIRA DE SOUZA",           escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "FABRICIO ASSUNÇÃO DA CONCEIÇÃO",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ISAC AMIEL SILVA BARBOSA",                    escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "AYANNA HADASSA MACHADO RIBEIRO",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "VICTOR EMANUEL PEREIRA LOPES",                escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "KEVISSON RYAN SILVA XAVIER",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA CECÍLIA SOUSA ALMEIDA",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "VITOR MOISÉS ROCHA SILVA",                    escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ENZO GABRIEL DA SILVA MENDES",                escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ENZO RAPHAEL DOS SANTOS PESSOA",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA HELOISE DA SILVA JANUÁRIO",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "JHENIFER GABRIELLA FERREIRA OLIVEIRA",        escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MAURO VINICIUS SILVA DE MELO",                escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "GABRIEL DA COSTA JUNIOR",                     escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "OTAVIO FERREIRA SANTOS",                      escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA HELLOYSA DA SILVA",                     escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LUANA SOFIA CONCEIÇÃO ALVES",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DAVI LUIS DA SILVA",                          escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "JOÃO LUCAS SOUSA LIMA",                       escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "PAULO RICARDO DA SILVA FERREIRA",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "NOHAM MÁRIO RIBEIRO DOS SANTOS",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARCOS VINICIUS DA SILVA GUIMARÃES JÚNIOR",   escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "RENATO AUGUSTO FREIRE DE SOUZA",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ALINE COSTA FONTES",                          escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LARA LAVYNNE TRINDADE DA SILVA",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "EMANUEL DAVI MONTEIRO COIMBRA",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "CARLOS DANIEL LIMA",                          escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA EDUARDA SANTOS COSTA",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA BIANCA SILVA SOUSA",                    escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "YASMIN FARIAS QUEIROZ",                       escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LEVI GABRIEL MORAES DOS PRAZERES",            escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LARISSA DA VIANA DA CONCEIÇÃO",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "THAYNAN MARIELLY SILVA CABRAL",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ADRIAN DA SILVA ESILVA",                      escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ELOÁ SANTOS CRUZ",                            escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "IARLLE DA SILVA BAYMA",                       escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "SANTIAGO PEREIRA DA SILVA",                   escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LEILTON CONCEIÇÃO VIEIRA",                    escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "JANAILSON VIEIRA DE SOUZA",                   escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "WEMILLY SOFIA REIS MORAES",                   escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA DE LOURDES BRITO DE SOUSA",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ÂNGELO DAVI DA SILVA CANTANHEDE",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MATHEUS MARCIEL SILVA DE MORAES",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "JOÃO VICTOR ARRUDA FERREIRA",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "YURI FELIPE BORGES DOS SANTOS",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "JOÃO LUCAS BORGES DOS SANTOS",                escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "TAYLLA WILLYANE OLIVEIRA BRANDÃO",            escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA HELOÍSA DAR SILVA DOS SANTOS",          escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DAVYD LUIZ NASCIMENTO MOURÃO",                escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "RAILANDER DA SILVA REIS",                     escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DAVIH SAMUEL FERREIRA SILVA",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "RYAN KENNEDY DA SILVA FERREIRA",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "PEDRO WILLIAN DOS SANTOS DE ARAÚJO",          escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "AYLA PIETRA DE LIMA MACEDO",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LUCAS EMANUELL COSTA PINTO",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ISAAC DA SILVA QUEIROZ",                      escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ANTÔNIO LEVÍ DA SILVA CAMPÊLO",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DAVI LUIZ DA SILVA MASCAREM",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ANNA HÉVELLYN SOUZA DA CONCEIÇÃO",            escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "PEDRO FILIPE LIMA DA CUNHA",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "WALISSON SOUSA DA SILVA",                     escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "RYAN LEONARDO CASTTELLI ACOSTA",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "JOSÉ MIGUEL MOTA",                            escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ISABELA SANTOS SILVA",                        escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ISADORA CALINE LIMA BARROS",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "KEMILLY IASMIM BRITO COSTA",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DAVI SANTOS TRINDADE",                        escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "GUSTAVO DO CARMO SOUSA",                      escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "TÁCIO SILVA TAVARES",                         escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "RUAN KALEBE CAVALCANTE SOUSA",                escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DAVI LUCAS DE SOUSA SANTOS",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "NOHARA MARIA RIBEIRO DOS SANTOS",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "NALYNE SOFIA DE ARAÚJO ARRUDA",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "SARA LIMA NASCIMENTO",                        escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "RHANDERSON JULIANO ARAÚJO GOMES",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "SOPHIA DE SOUSA ARRUDA",                      escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LUIZ DAVI DA SILVA E SILVA",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "HENRIQUE MATHIAS FERREIRA DE JESUS",          escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "BENJAMIM RYAN PEREIRA DOS SANTOS",            escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LUIZ DAVY DA SILVA NASCIMENTO",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "HELOYSA MACIELLI NASCIMENTO",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DAVI LUCCA DA CONCEIÇÃO COSTA",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "PEDRO HENRIQUE MACHADO BARBOSA",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ANA CECÍLIA DE SOUZA BELCHIOR",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "KALEBE SAMUEL RODRIGUES DELGADO",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "JOSUÉ RODRIGUES SOARES",                      escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MARIA CECÍLIA PAIVA SANTOS",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "CHRISTOPHER DE SOUSA SILVA",                  escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "NALYSON VINICIUS DE ARAÚJO ARRUDA",           escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "BRUNO RICARDO TRINDADE FREITAS",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "CRISTAL HERNANDIELY SILVA CUNHA",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "KETALAR CICILIA BRITO DA SILVA",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LUIZ DANIEL SOUZA SALAZAR",                   escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DHEMILLY MANUELLY SANTOS ROSA",               escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ARTUR LUIZ MOREIRA DA SILVA",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "FRANCISCA GABRIELA SILVA MENDES",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "RAFAEL FRANCO CARIMAN",                       escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "PIETRO HENRIQUE DE SOUZA SILVA",              escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "EMANUEL VENÂNCIO CORDEIRO DA SILVA",          escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "MURILO FEITOSA VIEIRA",                       escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LAYZA EMANUELLE SILVA GUIMARÃES",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "LUIS FELIPE SILVA SANTOS",                    escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "HENRICK KEVEN DA SILVA SOUZA",                escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ANDRESSON DA SILVA BARROS",                   escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ENZO ARISTÓTELES ANDRADE VIEIRA",             escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "GUILHERME EDUARDO DA SILVA BRITO",            escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ALANA BARROS ROCHA",                          escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DHÁVYLA GEOVANA CARVALHO DE SOUSA",           escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "ELIÚDE LIMA FERREIRA",                        escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },
  { nome_completo: "DAVI LUCCA DAMASCENO XAVIER",                 escola: "CMCB 02 de julho Unidade L", resultado: "aprovado" },

  // ── CMCB 02 de julho Unidade L – CADASTRO DE RESERVA ─────────────────────
  { nome_completo: "ISAAC NICOLAS ALVES DE SOUSA",                escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "VITOR EMANUEL ALVES CUNHA",                   escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "LUÍS LEVI SIMPLÍCIO DA CRUZ",                 escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "LEVI HENRIQUE DA SILVA COSTA",                escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "PEDRO DE CARVALHO SILVA",                     escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "PYÊTRO RYQUELME FALCAO DA COSTA",             escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "CARLOS EDUARDO ALMEIDA SANTOS",               escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "BRUNO LUCCAS FERREIRA SILVA",                 escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "ANDREY BRITO SOUSA",                          escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "LEANDRO BEZERRA DE SOUSA JUNIOR",             escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "JÉSSICA BRANDÃO OLIVEIRA",                    escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "KAIO SOARES TEIXEIRA",                        escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "SAMUEL BARROS FREIRE",                        escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "TALISSOM LIMA SILVA",                         escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "JHONATAN GUSTAVO COSTA DA CRUZ",              escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "CAROL HERNANIELY SILVA CUNHA",                escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "PAULO ARTHU FERREIRA",                        escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "JOÃO EDUARDO JORGE BORGES",                   escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "JOÃO ARTHUR MACHADO DE LIMA",                 escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "ERIK WALDEMILSON SILVA MUNIZ",                escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "PEDRO LUCAS LIMA DA SILVA",                   escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
  { nome_completo: "FRANCIELY DA CRUZ LIMA",                      escola: "CMCB 02 de julho Unidade L", resultado: "cadastro_reserva" },
];

// ─── Seed function ────────────────────────────────────────────────────────────

export function seedPublicResults(): void {
  const db = getDb();

  const count = (db.prepare("SELECT COUNT(*) as c FROM public_results").get() as { c: number }).c;
  if (count >= ENTRIES.length) return; // já totalmente populado

  const checkExists = db.prepare(`
    SELECT id FROM public_results
    WHERE UPPER(nome_completo) = UPPER(?) AND escola = ? AND resultado = ?
    LIMIT 1
  `);

  const insert = db.prepare(`
    INSERT INTO public_results (nome_completo, escola, resultado, submission_id, nome_normalizado)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Try to find a matching submission for each student by normalized name
  const findSubmission = db.prepare(`
    SELECT s.id
    FROM submissions s
    JOIN submission_data sd
      ON sd.submission_id = s.id
      AND (sd.field_name LIKE '%nome%' OR sd.field_name LIKE '%name%')
    WHERE UPPER(REPLACE(REPLACE(TRIM(sd.value_text), '  ', ' '), '  ', ' '))
          = UPPER(REPLACE(REPLACE(TRIM(?), '  ', ' '), '  ', ' '))
    LIMIT 1
  `);

  db.exec("BEGIN");
  let inserted = 0;
  let matched = 0;

  try {
    for (const entry of ENTRIES) {
      // Skip if already exists (preserves submission_id links)
      const existing = checkExists.get(entry.nome_completo, entry.escola, entry.resultado) as { id: number } | undefined;
      if (existing) continue;

      const sub = findSubmission.get(entry.nome_completo) as { id: number } | undefined;
      const submissionId = sub?.id ?? null;
      if (submissionId) matched++;
      insert.run(entry.nome_completo, entry.escola, entry.resultado, submissionId, normalizeNome(entry.nome_completo));
      inserted++;
    }
    db.exec("COMMIT");
    if (inserted > 0) {
      console.log(`✅ Resultados públicos: ${inserted} novos registros inseridos, ${matched} vinculados a inscrições.`);
    }
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("❌ Erro ao semear resultados públicos:", err);
  }
}
