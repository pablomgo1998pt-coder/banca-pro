import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "./lib/supabase";

type UserSession = { id: string; email: string };

type TelaInterna =
  | "inicio"
  | "bancas"
  | "financeiro"
  | "agenda"
  | "ferramentas"
  | "apostas"
  | "historico"
  | "config";

type BetStatus = "pendente" | "green" | "red" | "cash_out";
type BankrollStatus = "ativa" | "quebrada" | "meta_batida";
type ModoGestao = "conservador" | "normal" | "agressivo";
type TemaNome = "betano" | "bet365" | "escuro" | "claro" | "premium" | "amarelo";
type EmocaoEntrada = "calmo" | "confiante" | "ansioso" | "tilt" | "pressa";
type Moeda = "EUR" | "BRL" | "USD" | "GBP";
type MovimentoTipo = "deposito" | "saque" | "ajuste" | "bonus" | "correcao";
type AgendaStatus = "analisar" | "pre_live" | "apostado" | "ignorado" | "finalizado";

type MetodoGestao =
  | "stake_fixa"
  | "percentual_banca"
  | "escudo_30d"
  | "ciclos"
  | "soros"
  | "martingale"
  | "fibonacci"
  | "masaniello";

type Bankroll = {
  id: number;
  nome: string;
  depositado: number;
  atual: number;
  meta: number;
  dias: number;
  status: BankrollStatus;
};

type MovimentoFinanceiro = {
  id: number;
  bancaId: number;
  bancaNome: string;
  tipo: MovimentoTipo;
  valor: number;
  saldoAntes: number;
  saldoDepois: number;
  nota: string;
  createdAt: string;
};

type JogoAgenda = {
  id: number;
  liga: string;
  casa: string;
  fora: string;
  data: string;
  hora: string;
  mercadoPretendido: string;
  observacao: string;
  confianca: number;
  bancaId: string;
  status: AgendaStatus;
  createdAt: string;
};

type SelecaoSalva = {
  id: number;
  liga: string;
  casa: string;
  fora: string;
  mercado: string;
  odd: number;
  status: BetStatus;
  motivoRed?: string;
};

type BetMeta = {
  tipo: "simples" | "multipla";
  versao: 2;
  estrategia: string;
  confianca: number;
  analisePre: string;
  emocao: EmocaoEntrada;
  selecoes: SelecaoSalva[];
};

type Bet = {
  id: number;
  bancaId: number;
  bancaNome: string;
  liga: string;
  casa: string;
  fora: string;
  mercado: string;
  odd: number;
  valor: number;
  retornoEsperado: number;
  status: BetStatus;
  createdAt: string;
  createdAtRaw: string;
  valorCashOut?: number;
  isMultipla?: boolean;
  selecoesDetalhadas?: SelecaoSalva[];
  meta?: Partial<BetMeta>;
};

type SelecaoCartela = {
  id: number;
  mercado: string;
  odd: number;
  status: BetStatus;
  motivoRed?: string;
};

type JogoCartela = {
  id: number;
  liga: string;
  casa: string;
  fora: string;
  selecoes: SelecaoCartela[];
};

type Country = { id: number; nome: string };
type League = { id: number; country_id: number; nome: string; divisao: number };

type Team = {
  id: number;
  country_id: number;
  league_id: number;
  nome: string;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
};

type MercadoCategoria =
  | "Principais"
  | "Gols"
  | "Gols equipa"
  | "Cantos"
  | "Cartões"
  | "Resultado correto"
  | "Minutos"
  | "Combinações"
  | "Especiais";

const PREFIXO_APOSTA = "BANCAPRO_APOSTA_JSON:";
const PREFIXO_MULTIPLA_ANTIGO = "BANCAPRO_MULTIPLA_JSON:";

const gerarLinha = (prefixo: string, inicio: number, fim: number) => {
  const lista: string[] = [];
  for (let n = inicio; n <= fim; n++) lista.push(`${prefixo} ${n}.5`);
  return lista;
};

const mercadosPorCategoria: Record<MercadoCategoria, string[]> = {
  Principais: [
    "Vitória casa",
    "Vitória fora",
    "Empate",
    "Dupla hipótese casa/empate",
    "Dupla hipótese fora/empate",
    "Dupla hipótese casa/fora",
    "Empate anula casa",
    "Empate anula fora",
    "Casa marca",
    "Fora marca",
    "Ambas marcam",
    "Ambas não marcam",
  ],
  Gols: [
    ...gerarLinha("Over", 0, 8),
    ...gerarLinha("Under", 0, 8),
    "Ambas marcam",
    "Ambas não marcam",
    "Casa marca",
    "Fora marca",
    "Sem golos",
    "Exatamente 1 golo",
    "Exatamente 2 golos",
    "Exatamente 3 golos",
    "Exatamente 4 golos",
    "5+ golos",
    "Par de golos",
    "Ímpar de golos",
  ],
  "Gols equipa": [
    ...gerarLinha("Casa over", 0, 5),
    ...gerarLinha("Casa under", 0, 5),
    ...gerarLinha("Fora over", 0, 5),
    ...gerarLinha("Fora under", 0, 5),
    "Casa vence sem sofrer",
    "Fora vence sem sofrer",
    "Casa marca nas duas partes",
    "Fora marca nas duas partes",
    "Casa não marca",
    "Fora não marca",
  ],
  Cantos: [
    ...gerarLinha("Mais de", 3, 21).map((m) => `${m} cantos`),
    ...gerarLinha("Menos de", 3, 21).map((m) => `${m} cantos`),
    ...gerarLinha("Casa mais de", 1, 12).map((m) => `${m} cantos`),
    ...gerarLinha("Casa menos de", 1, 12).map((m) => `${m} cantos`),
    ...gerarLinha("Fora mais de", 1, 12).map((m) => `${m} cantos`),
    ...gerarLinha("Fora menos de", 1, 12).map((m) => `${m} cantos`),
    "Primeiro canto casa",
    "Primeiro canto fora",
    "Mais cantos casa",
    "Mais cantos fora",
  ],
  Cartões: [
    ...gerarLinha("Mais de", 0, 9).map((m) => `${m} cartões`),
    ...gerarLinha("Menos de", 0, 9).map((m) => `${m} cartões`),
    ...gerarLinha("Casa mais de", 0, 6).map((m) => `${m} cartões`),
    ...gerarLinha("Fora mais de", 0, 6).map((m) => `${m} cartões`),
    "Cartão vermelho no jogo",
    "Sem cartão vermelho",
    "Casa recebe cartão",
    "Fora recebe cartão",
    "Mais cartões casa",
    "Mais cartões fora",
  ],
  "Resultado correto": [
    "0-0",
    "1-0",
    "0-1",
    "1-1",
    "2-0",
    "0-2",
    "2-1",
    "1-2",
    "2-2",
    "3-0",
    "0-3",
    "3-1",
    "1-3",
    "3-2",
    "2-3",
    "3-3",
    "4-0",
    "0-4",
    "4-1",
    "1-4",
    "4-2",
    "2-4",
    "Outro resultado",
  ],
  Minutos: [
    "Golo até aos 10 minutos",
    "Golo até aos 15 minutos",
    "Golo até aos 20 minutos",
    "Golo até aos 30 minutos",
    "Sem golo até aos 15 minutos",
    "Sem golo até aos 30 minutos",
    "Casa marca primeiro",
    "Fora marca primeiro",
    "Primeiro golo casa 0-30",
    "Primeiro golo casa 31-60",
    "Primeiro golo casa 61-90",
    "Primeiro golo fora 0-30",
    "Primeiro golo fora 31-60",
    "Primeiro golo fora 61-90",
    "Golo depois dos 75 minutos",
    "Golo depois dos 80 minutos",
    "Golo depois dos 85 minutos",
  ],
  Combinações: [
    "Casa vence e over 1.5",
    "Casa vence e over 2.5",
    "Casa vence e over 3.5",
    "Casa vence e under 1.5",
    "Casa vence e under 2.5",
    "Casa vence e under 3.5",
    "Fora vence e over 1.5",
    "Fora vence e over 2.5",
    "Fora vence e over 3.5",
    "Fora vence e under 1.5",
    "Fora vence e under 2.5",
    "Fora vence e under 3.5",
    "Casa ou empate e over 1.5",
    "Casa ou empate e over 2.5",
    "Casa ou empate e over 3.5",
    "Fora ou empate e over 1.5",
    "Fora ou empate e over 2.5",
    "Fora ou empate e over 3.5",
    "Casa ou fora e over 1.5",
    "Casa ou fora e over 2.5",
    "Casa ou fora e over 3.5",
    "Casa ou empate e under 1.5",
    "Casa ou empate e under 2.5",
    "Casa ou empate e under 3.5",
    "Fora ou empate e under 1.5",
    "Fora ou empate e under 2.5",
    "Fora ou empate e under 3.5",
    "Casa ou fora e under 1.5",
    "Casa ou fora e under 2.5",
    "Casa ou fora e under 3.5",
    "Over 1.5 e ambas marcam",
    "Over 2.5 e ambas marcam",
    "Over 3.5 e ambas marcam",
    "Under 1.5 e ambas não marcam",
    "Under 2.5 e ambas não marcam",
    "Under 3.5 e ambas não marcam",
    "Empate e ambas marcam",
    "Empate e under 1.5",
    "Empate e under 2.5",
    "Empate e under 3.5",
    "Casa vence sem sofrer",
    "Fora vence sem sofrer",
  ],
  Especiais: [
    "Resultado ao intervalo casa",
    "Resultado ao intervalo empate",
    "Resultado ao intervalo fora",
    "Casa vence 1ª parte",
    "Fora vence 1ª parte",
    "Casa vence 2ª parte",
    "Fora vence 2ª parte",
    "Mais golos 1ª parte",
    "Mais golos 2ª parte",
    "Ambas marcam 1ª parte",
    "Ambas marcam 2ª parte",
    "Casa ganha qualquer parte",
    "Fora ganha qualquer parte",
  ],
};

const categoriasMercado = Object.keys(mercadosPorCategoria) as MercadoCategoria[];
const mercadosBase = Array.from(new Set(Object.values(mercadosPorCategoria).flat()));

const estrategiasBase = [
  "Escudo 30D",
  "Stake fixa",
  "Percentual da banca",
  "Ciclos",
  "Soros",
  "Martingale",
  "Fibonacci",
  "Masaniello",
  "Over 1.5",
  "Over 2.5",
  "BTTS",
  "Cantos",
  "Cartões",
  "Lay Correct Score",
  "Scalping",
  "Favorito + Over",
  "Pré-live seguro",
  "Cash out parcial",
  "Outra estratégia",
];

const motivosRedBase = [
  "Golo anulado",
  "Entrada emocional",
  "Odd mal escolhida",
  "Mercado errado",
  "Equipa abaixo do esperado",
  "Expulsão/cartão vermelho",
  "Jogo sem intensidade",
  "Over falhou",
  "Under falhou",
  "Cash out mal decidido",
  "Erro de leitura pré-live",
  "Entrada sem valor na odd",
  "Mercado repetido sem critério",
  "Má gestão de stake",
  "Jogo mudou após escalação",
  "Favorito sem intensidade",
  "Pressão baixa/ofensiva fraca",
  "Outro motivo",
];

const temas: Record<
  TemaNome,
  {
    bg: string;
    card: string;
    card2: string;
    border: string;
    input: string;
    accent: string;
    accent2: string;
    text: string;
    muted: string;
    good: string;
    bad: string;
    warn: string;
  }
> = {
  betano: {
    bg: "#07142b",
    card: "#0c1c39",
    card2: "#09172f",
    border: "#203a68",
    input: "#09172f",
    accent: "#f97316",
    accent2: "#102449",
    text: "#ffffff",
    muted: "#b9c7df",
    good: "#22c55e",
    bad: "#ef4444",
    warn: "#f59e0b",
  },
  bet365: {
    bg: "#06130b",
    card: "#0c2414",
    card2: "#071a0f",
    border: "#1d5530",
    input: "#071a0f",
    accent: "#facc15",
    accent2: "#14532d",
    text: "#ffffff",
    muted: "#c6f6d5",
    good: "#22c55e",
    bad: "#ef4444",
    warn: "#f59e0b",
  },
  escuro: {
    bg: "#030712",
    card: "#111827",
    card2: "#0b1220",
    border: "#334155",
    input: "#0f172a",
    accent: "#38bdf8",
    accent2: "#1e293b",
    text: "#ffffff",
    muted: "#cbd5e1",
    good: "#22c55e",
    bad: "#ef4444",
    warn: "#f59e0b",
  },
  claro: {
    bg: "#eef2ff",
    card: "#ffffff",
    card2: "#f8fafc",
    border: "#cbd5e1",
    input: "#ffffff",
    accent: "#f97316",
    accent2: "#e2e8f0",
    text: "#0f172a",
    muted: "#475569",
    good: "#16a34a",
    bad: "#dc2626",
    warn: "#d97706",
  },
  premium: {
    bg: "#05060a",
    card: "#151722",
    card2: "#0c0f19",
    border: "#2d3347",
    input: "#090c14",
    accent: "#8b5cf6",
    accent2: "#1b2133",
    text: "#f8fafc",
    muted: "#aeb7cb",
    good: "#20d36b",
    bad: "#ff4d5e",
    warn: "#f7a928",
  },
  amarelo: {
    bg: "#171100",
    card: "#281c00",
    card2: "#1f1600",
    border: "#713f12",
    input: "#1f1600",
    accent: "#eab308",
    accent2: "#422006",
    text: "#ffffff",
    muted: "#fde68a",
    good: "#22c55e",
    bad: "#ef4444",
    warn: "#f59e0b",
  },
};

const moedaConfig: Record<Moeda, { label: string; symbol: string; locale: string }> = {
  EUR: { label: "Euro", symbol: "€", locale: "pt-PT" },
  BRL: { label: "Real", symbol: "R$", locale: "pt-BR" },
  USD: { label: "Dólar", symbol: "$", locale: "en-US" },
  GBP: { label: "Libra", symbol: "£", locale: "en-GB" },
};

function App() {
  const [isCadastro, setIsCadastro] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [tela, setTela] = useState<TelaInterna>("inicio");

  const [temaNome, setTemaNome] = useState<TemaNome>(() => {
    return (localStorage.getItem("bancapro_tema") as TemaNome) || "premium";
  });

  const [modoCompacto, setModoCompacto] = useState(() => {
    return localStorage.getItem("bancapro_compacto") === "sim";
  });

  const [moeda, setMoeda] = useState<Moeda>(() => {
    return (localStorage.getItem("bancapro_moeda") as Moeda) || "EUR";
  });

  const [moedasPorBanca, setMoedasPorBanca] = useState<Record<string, Moeda>>(() => {
    try {
      return JSON.parse(localStorage.getItem("bancapro_moedas_por_banca") || "{}");
    } catch {
      return {};
    }
  });

  const [isRecovery, setIsRecovery] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [valorCashOut, setValorCashOut] = useState("");
  const [mensagemRecovery, setMensagemRecovery] = useState("");

  const [nomeBanca, setNomeBanca] = useState("");
  const [valorDepositado, setValorDepositado] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [metaBanca, setMetaBanca] = useState("");
  const [diasMeta, setDiasMeta] = useState("");
  const [bancas, setBancas] = useState<Bankroll[]>([]);

  const [editandoBancaId, setEditandoBancaId] = useState<number | null>(null);
  const [editNomeBanca, setEditNomeBanca] = useState("");
  const [editDepositado, setEditDepositado] = useState("");
  const [editAtual, setEditAtual] = useState("");
  const [editMeta, setEditMeta] = useState("");
  const [editDias, setEditDias] = useState("");

  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [movimentoBancaId, setMovimentoBancaId] = useState("");
  const [movimentoTipo, setMovimentoTipo] = useState<MovimentoTipo>("deposito");
  const [movimentoValor, setMovimentoValor] = useState("");
  const [movimentoNota, setMovimentoNota] = useState("");

  const [filtroFinanceiroBancaDraft, setFiltroFinanceiroBancaDraft] = useState("");
  const [filtroFinanceiroTipoDraft, setFiltroFinanceiroTipoDraft] = useState("");
  const [filtrosFinanceirosAplicados, setFiltrosFinanceirosAplicados] = useState({
    banca: "",
    tipo: "",
  });

  const [agenda, setAgenda] = useState<JogoAgenda[]>([]);
  const [agendaLiga, setAgendaLiga] = useState("");
  const [agendaCasa, setAgendaCasa] = useState("");
  const [agendaFora, setAgendaFora] = useState("");
  const [agendaData, setAgendaData] = useState("");
  const [agendaHora, setAgendaHora] = useState("");
  const [agendaMercado, setAgendaMercado] = useState("");
  const [agendaObs, setAgendaObs] = useState("");
  const [agendaConfianca, setAgendaConfianca] = useState(3);
  const [agendaBancaId, setAgendaBancaId] = useState("");
  const [agendaStatusFiltro, setAgendaStatusFiltro] = useState("");

  const [apostas, setApostas] = useState<Bet[]>([]);
  const [bancaSelecionadaId, setBancaSelecionadaId] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [countrySelecionadoId, setCountrySelecionadoId] = useState("");
  const [ligaSelecionadaId, setLigaSelecionadaId] = useState("");
  const [ligaManual, setLigaManual] = useState("");
  const [mercado, setMercado] = useState("");
  const [odd, setOdd] = useState("");
  const [valorApostado, setValorApostado] = useState("");
  const [cartela, setCartela] = useState<JogoCartela[]>([]);
  const [statusAposta, setStatusAposta] = useState<BetStatus>("pendente");
  const [estrategia, setEstrategia] = useState("Escudo 30D");
  const [confianca, setConfianca] = useState(3);
  const [analisePre, setAnalisePre] = useState("");
  const [emocaoEntrada, setEmocaoEntrada] = useState<EmocaoEntrada>("calmo");
  const [mercadoCategoriaAtiva, setMercadoCategoriaAtiva] =
    useState<MercadoCategoria>("Principais");
  const [buscaMercado, setBuscaMercado] = useState("");
  const [stakePercentual, setStakePercentual] = useState("2");
  const [modoGestao, setModoGestao] = useState<ModoGestao>("conservador");
  const [usarCasaManual, setUsarCasaManual] = useState(false);
  const [usarForaManual, setUsarForaManual] = useState(false);
  const [equipaCasa, setEquipaCasa] = useState("");
  const [equipaFora, setEquipaFora] = useState("");
  const [equipaCasaManual, setEquipaCasaManual] = useState("");
  const [equipaForaManual, setEquipaForaManual] = useState("");

  const [filtroBancaDraft, setFiltroBancaDraft] = useState("");
  const [filtroStatusDraft, setFiltroStatusDraft] = useState("");
  const [filtroLigaDraft, setFiltroLigaDraft] = useState("");
  const [filtroMercadoDraft, setFiltroMercadoDraft] = useState("");
  const [filtroEquipaDraft, setFiltroEquipaDraft] = useState("");
  const [filtroEstrategiaDraft, setFiltroEstrategiaDraft] = useState("");

  const [filtrosAplicados, setFiltrosAplicados] = useState({
    banca: "",
    status: "",
    liga: "",
    mercado: "",
    equipa: "",
    estrategia: "",
  });

  const [cashOutEditandoId, setCashOutEditandoId] = useState<number | null>(null);
  const [cashOutEditandoValor, setCashOutEditandoValor] = useState("");

  const [simInicial, setSimInicial] = useState("40");
  const [simDias, setSimDias] = useState("30");
  const [simOddMedia, setSimOddMedia] = useState("1.35");
  const [simStake, setSimStake] = useState("10");
  const [simAcerto, setSimAcerto] = useState("75");

  const [metodoGestao, setMetodoGestao] = useState<MetodoGestao>("percentual_banca");
  const [ferramentaStake, setFerramentaStake] = useState("2");
  const [ferramentaBanca, setFerramentaBanca] = useState("100");
  const [calcMultiplasOdds, setCalcMultiplasOdds] = useState("1.30,1.45,1.60");
  const [calcMultiplasStake, setCalcMultiplasStake] = useState("10");
  const [sureOdd1, setSureOdd1] = useState("2.10");
  const [sureOdd2, setSureOdd2] = useState("2.10");
  const [sureTotal, setSureTotal] = useState("100");
  const [hedgeStake, setHedgeStake] = useState("50");
  const [hedgeOddEntrada, setHedgeOddEntrada] = useState("2.00");
  const [hedgeOddCobertura, setHedgeOddCobertura] = useState("2.00");
  const [cofreValor, setCofreValor] = useState("0");
  const [cicloEntradas, setCicloEntradas] = useState("5");
  const [cicloOdd, setCicloOdd] = useState("1.30");
  const [cicloStakeInicial, setCicloStakeInicial] = useState("10");
  const [martingaleStake, setMartingaleStake] = useState("10");
  const [martingalePerdas, setMartingalePerdas] = useState("3");
  const [fibonacciBase, setFibonacciBase] = useState("10");
  const [masanielloBanca, setMasanielloBanca] = useState("100");
  const [masanielloEntradas, setMasanielloEntradas] = useState("10");
  const [masanielloAcertos, setMasanielloAcertos] = useState("7");

  const tema = temas[temaNome] || temas.betano;

  const inputStyle: CSSProperties = {
    padding: "13px 14px",
    borderRadius: "14px",
    border: `1px solid ${tema.border}`,
    background:
      temaNome === "claro"
        ? "rgba(255,255,255,0.96)"
        : `linear-gradient(180deg, ${tema.input}, rgba(6,8,14,0.96))`,
    color: tema.text,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    boxShadow:
      temaNome === "claro"
        ? "0 8px 20px rgba(15,23,42,0.06)"
        : "inset 0 1px 0 rgba(255,255,255,0.045), 0 10px 24px rgba(0,0,0,0.18)",
    fontWeight: 700,
    minHeight: "48px",
    fontSize: "14px",
  };

  const smallButtonStyle: CSSProperties = {
    padding: "10px 14px",
    borderRadius: "13px",
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer",
    color: "white",
    fontWeight: 900,
    transition: "transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease",
    boxShadow: "0 12px 26px rgba(0,0,0,0.24)",
    letterSpacing: "-0.01em",
  };

  const cardStyle: CSSProperties = {
    background:
      temaNome === "claro"
        ? "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))"
        : `linear-gradient(145deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)), linear-gradient(135deg, ${tema.card}, ${tema.card2})`,
    border: `1px solid ${tema.border}`,
    borderRadius: "24px",
    padding: modoCompacto ? "16px" : "22px",
    boxShadow:
      temaNome === "claro"
        ? "0 18px 40px rgba(15,23,42,0.10)"
        : "0 24px 70px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
    backdropFilter: "blur(14px)",
  };

  const chipStyle: CSSProperties = {
    padding: "9px 12px",
    borderRadius: "999px",
    border: `1px solid ${tema.border}`,
    background: tema.accent2,
    color: tema.text,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: "13px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  };

  const gridCards: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
  };

  const globalCss = `
    * { box-sizing: border-box; }
    html { background: ${tema.bg}; overflow-x: hidden; }
    body { margin: 0; background: ${tema.bg}; overflow-x: hidden; }
    button, input, select, textarea { font-family: inherit; }
    button:hover { transform: translateY(-1px); filter: brightness(1.08); }
    button:active { transform: translateY(0px) scale(0.99); }
    input::placeholder, textarea::placeholder { color: ${temaNome === "claro" ? "#64748b" : "#7d8798"}; }
    select { color-scheme: dark; appearance: auto; }
    select option { background: ${tema.card2}; color: ${tema.text}; font-weight: 700; padding: 12px; }
    ::selection { background: ${tema.accent}; color: white; }
    ::-webkit-scrollbar { width: 11px; height: 11px; }
    ::-webkit-scrollbar-track { background: ${tema.bg}; }
    ::-webkit-scrollbar-thumb { background: linear-gradient(${tema.accent}, ${tema.border}); border-radius: 999px; border: 2px solid ${tema.bg}; }
    @keyframes bpFadeUp {
      from { opacity: 0; transform: translateY(14px) scale(0.99); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes bpPulseGlow {
      0%, 100% { box-shadow: 0 18px 44px rgba(0,0,0,0.18); }
      50% { box-shadow: 0 22px 58px ${tema.accent}33; }
    }
    @keyframes bpSpin { to { transform: rotate(360deg); } }
    .bp-shell > div > div:not(.bp-nav) { animation: bpFadeUp 0.34s ease both; }
    .bp-brand-card { animation: bpPulseGlow 5s ease-in-out infinite; }
    button { will-change: transform, filter; }
    input:focus, select:focus, textarea:focus {
      border-color: ${tema.accent} !important;
      box-shadow: 0 0 0 3px ${tema.accent}22, 0 16px 34px rgba(0,0,0,0.16) !important;
    }

    @media (max-width: 780px) {
      html, body, #root { width: 100%; max-width: 100%; overflow-x: hidden !important; }
      body { -webkit-text-size-adjust: 100%; }

      .bp-login-grid {
        max-width: 100% !important;
        grid-template-columns: 1fr !important;
        gap: 14px !important;
      }
      .bp-login-grid > div {
        min-width: 0 !important;
        min-height: auto !important;
        padding: 18px !important;
        border-radius: 24px !important;
      }
      .bp-login-grid h1 { font-size: 42px !important; line-height: .92 !important; }
      .bp-login-grid h2 { font-size: 25px !important; }
      .bp-login-grid p { font-size: 14px !important; line-height: 1.35 !important; }

      .bp-shell {
        width: 100% !important;
        max-width: 100vw !important;
        padding: 10px 10px 92px !important;
        overflow-x: hidden !important;
      }
      .bp-shell > div { max-width: 100% !important; min-width: 0 !important; }

      .bp-brand-card {
        padding: 14px !important;
        border-radius: 24px !important;
        align-items: stretch !important;
        gap: 12px !important;
      }
      .bp-brand-card img {
        width: 64px !important;
        height: 64px !important;
        border-radius: 20px !important;
      }
      .bp-brand-title { font-size: 29px !important; line-height: 1 !important; }
      .bp-brand-card p { font-size: 12px !important; line-height: 1.25 !important; }
      .bp-brand-card button { width: 100% !important; min-height: 44px !important; padding: 10px 12px !important; }

      .bp-nav {
        position: fixed !important;
        left: 10px !important;
        right: 10px !important;
        bottom: calc(10px + env(safe-area-inset-bottom)) !important;
        top: auto !important;
        z-index: 999 !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 8px !important;
        padding: 8px !important;
        border-radius: 22px !important;
        max-height: 64px !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        -webkit-overflow-scrolling: touch;
        box-shadow: 0 18px 45px rgba(0,0,0,0.42) !important;
        scrollbar-width: none;
      }
      .bp-nav::-webkit-scrollbar { display: none; }
      .bp-nav button {
        flex: 0 0 auto !important;
        width: auto !important;
        min-width: 98px !important;
        max-width: 132px !important;
        min-height: 46px !important;
        padding: 8px 10px !important;
        font-size: 11px !important;
        border-radius: 15px !important;
        line-height: 1.05 !important;
        white-space: nowrap !important;
      }

      .bp-shell h1 { font-size: 30px !important; line-height: 1.05 !important; }
      .bp-shell h2 { font-size: 25px !important; line-height: 1.08 !important; text-align: left !important; }
      .bp-shell h3 { font-size: 20px !important; line-height: 1.12 !important; }
      .bp-shell p { line-height: 1.35 !important; }
      .bp-shell input, .bp-shell select, .bp-shell textarea,
      .bp-login-grid input, .bp-login-grid select, .bp-login-grid textarea {
        font-size: 16px !important;
        min-height: 50px !important;
      }

      .bp-form-grid { grid-template-columns: 1fr !important; }
      .bp-action-row { display: grid !important; grid-template-columns: 1fr 1fr !important; }
      .bp-action-row button { width: 100%; min-height: 46px; }
    }

    @media (max-width: 480px) {
      .bp-shell { padding: 8px 8px 86px !important; }
      .bp-shell > div:not(.bp-nav) { border-radius: 22px !important; }
      .bp-brand-card { padding: 12px !important; }
      .bp-brand-card img { width: 58px !important; height: 58px !important; }
      .bp-brand-title { font-size: 26px !important; }
      .bp-nav { left: 8px !important; right: 8px !important; max-height: 60px !important; }
      .bp-nav button { min-width: 92px !important; min-height: 42px !important; font-size: 10px !important; }
      .bp-shell [style*="grid-template-columns: repeat(3"],
      .bp-shell [style*="gridTemplateColumns: repeat(3"],
      .bp-shell [style*="grid-template-columns: repeat(auto-fit"] {
        grid-template-columns: 1fr !important;
      }
    }
  `;

  const sectionTitleStyle: CSSProperties = {
    margin: "0 0 16px",
    fontSize: "clamp(22px, 3vw, 30px)",
    letterSpacing: "-0.04em",
    lineHeight: 1.05,
  };

  const subtitleStyle: CSSProperties = {
    margin: "-6px 0 18px",
    color: tema.muted,
    fontWeight: 700,
    lineHeight: 1.45,
  };

  function moedaDaBanca(bancaId?: number | string) {
    if (!bancaId) return moeda;
    return moedasPorBanca[String(bancaId)] || moeda;
  }

  function formatCurrency(valor: number) {
    const cfg = moedaConfig[moeda] || moedaConfig.EUR;

    try {
      return new Intl.NumberFormat(cfg.locale, {
        style: "currency",
        currency: moeda,
      }).format(valor || 0);
    } catch {
      return `${cfg.symbol}${(valor || 0).toFixed(2)}`;
    }
  }

  function formatCurrencyBanca(valor: number, bancaId?: number | string) {
    const moedaBanca = moedaDaBanca(bancaId);
    const cfg = moedaConfig[moedaBanca] || moedaConfig.EUR;

    try {
      return new Intl.NumberFormat(cfg.locale, {
        style: "currency",
        currency: moedaBanca,
      }).format(valor || 0);
    } catch {
      return `${cfg.symbol}${(valor || 0).toFixed(2)}`;
    }
  }

  useEffect(() => {
    localStorage.setItem("bancapro_tema", temaNome);
  }, [temaNome]);

  useEffect(() => {
    localStorage.setItem("bancapro_compacto", modoCompacto ? "sim" : "nao");
  }, [modoCompacto]);

  useEffect(() => {
    localStorage.setItem("bancapro_moeda", moeda);
  }, [moeda]);

  useEffect(() => {
    localStorage.setItem("bancapro_moedas_por_banca", JSON.stringify(moedasPorBanca));
  }, [moedasPorBanca]);

  useEffect(() => {
    if (!user) return;

    const movRaw = localStorage.getItem(`bancapro_movimentos_${user.id}`);
    const agendaRaw = localStorage.getItem(`bancapro_agenda_${user.id}`);

    if (movRaw) {
      try {
        setMovimentos(JSON.parse(movRaw) as MovimentoFinanceiro[]);
      } catch {
        setMovimentos([]);
      }
    }

    if (agendaRaw) {
      try {
        setAgenda(JSON.parse(agendaRaw) as JogoAgenda[]);
      } catch {
        setAgenda([]);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`bancapro_movimentos_${user.id}`, JSON.stringify(movimentos));
  }, [movimentos, user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`bancapro_agenda_${user.id}`, JSON.stringify(agenda));
  }, [agenda, user]);

  useEffect(() => {
    async function verificarSessao() {
      if (window.location.hash.includes("access_token")) setIsRecovery(true);

      const { data } = await supabase.auth.getSession();

      if (data.session?.user?.email && data.session.user.id) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email,
        });
      }

      setLoading(false);
    }

    verificarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email && session.user.id) {
        setUser({
          id: session.user.id,
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void carregarCatalogo();
  }, []);

  useEffect(() => {
    if (user) {
      void carregarBancas();
      void carregarApostas();
      void carregarFinanceiroEAgendaCloud();
    }
  }, [user]);

  function interpretarMercadoSalvo(mercadoSalvo: string) {
    if (mercadoSalvo.startsWith(PREFIXO_APOSTA)) {
      try {
        const meta = JSON.parse(mercadoSalvo.replace(PREFIXO_APOSTA, "")) as BetMeta;
        const selecoes = meta.selecoes ?? [];

        return {
          isJson: true,
          isMultipla: meta.tipo === "multipla" || selecoes.length > 1,
          meta,
          selecoes,
          mercadoVisual:
            selecoes.map((s) => `${s.casa} x ${s.fora}: ${s.mercado}`).join(" | ") ||
            "Aposta",
        };
      } catch {}
    }

    if (mercadoSalvo.startsWith(PREFIXO_MULTIPLA_ANTIGO)) {
      try {
        const parsed = JSON.parse(
          mercadoSalvo.replace(PREFIXO_MULTIPLA_ANTIGO, "")
        ) as { selecoes?: SelecaoSalva[] };

        const selecoes = parsed.selecoes ?? [];

        return {
          isJson: false,
          isMultipla: true,
          meta: undefined,
          selecoes,
          mercadoVisual:
            selecoes.map((s) => `${s.casa} x ${s.fora}: ${s.mercado}`).join(" | ") ||
            "Múltipla",
        };
      } catch {}
    }

    return {
      isJson: false,
      isMultipla: false,
      meta: undefined,
      selecoes: [] as SelecaoSalva[],
      mercadoVisual: mercadoSalvo,
    };
  }

  function montarMercadoJson(selecoes: SelecaoSalva[], extra?: Partial<BetMeta>) {
    const meta: BetMeta = {
      tipo: selecoes.length > 1 ? "multipla" : "simples",
      versao: 2,
      estrategia: extra?.estrategia || estrategia || "Sem estratégia",
      confianca: Number(extra?.confianca || confianca || 3),
      analisePre: extra?.analisePre || analisePre || "",
      emocao: (extra?.emocao || emocaoEntrada || "calmo") as EmocaoEntrada,
      selecoes,
    };

    return `${PREFIXO_APOSTA}${JSON.stringify(meta)}`;
  }

  async function carregarCatalogo() {
    const { data: countriesData } = await supabase
      .from("countries")
      .select("*")
      .order("nome", { ascending: true });

    const { data: leaguesData } = await supabase
      .from("leagues")
      .select("*")
      .order("divisao", { ascending: true });

    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")
      .order("nome", { ascending: true });

    setCountries((countriesData ?? []) as Country[]);
    setLeagues((leaguesData ?? []) as League[]);
    setTeams((teamsData ?? []) as Team[]);
  }

  async function carregarBancas() {
    if (!user) return;

    const { data, error } = await supabase
      .from("bancas")
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: false });

    if (error) {
      setMensagem(`Erro ao carregar bancas: ${error.message}`);
      return;
    }

    setBancas(
      (data ?? []).map((item) => ({
        id: Number(item.id),
        nome: item.nome ?? "",
        depositado: Number(item.depositado ?? 0),
        atual: Number(item.atual ?? 0),
        meta: Number(item.meta ?? 0),
        dias: Number(item.dias ?? 0),
        status: (item.status ?? "ativa") as BankrollStatus,
      }))
    );
  }

  async function carregarApostas() {
    if (!user) return;

    const { data, error } = await supabase
      .from("apostas")
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: false });

    if (error) {
      setMensagem(`Erro ao carregar apostas: ${error.message}`);
      return;
    }

    setApostas(
      (data ?? []).map((item) => {
        const interpretado = interpretarMercadoSalvo(item.mercado ?? "");
        const raw = item.created_at ? String(item.created_at) : "";

        return {
          id: Number(item.id),
          bancaId: Number(item.banca_id),
          bancaNome: item.banca_nome ?? "",
          liga: item.liga ?? "",
          casa: item.casa ?? "",
          fora: item.fora ?? "",
          mercado: item.mercado ?? "",
          odd: Number(item.odd ?? 0),
          valor: Number(item.valor ?? 0),
          retornoEsperado: Number(item.retorno_esperado ?? 0),
          status: (item.status ?? "pendente") as BetStatus,
          createdAtRaw: raw,
          createdAt: raw ? new Date(raw).toLocaleString("pt-PT") : "",
          valorCashOut:
            item.valor_cash_out === null || item.valor_cash_out === undefined
              ? undefined
              : Number(item.valor_cash_out),
          isMultipla: interpretado.isMultipla,
          selecoesDetalhadas: interpretado.selecoes,
          meta: interpretado.meta,
        };
      })
    );
  }


  async function carregarFinanceiroEAgendaCloud() {
    if (!user) return;

    const movimentosLocaisRaw = localStorage.getItem(`bancapro_movimentos_${user.id}`);
    const agendaLocalRaw = localStorage.getItem(`bancapro_agenda_${user.id}`);

    const movimentosLocais = (() => {
      try {
        return JSON.parse(movimentosLocaisRaw || "[]") as MovimentoFinanceiro[];
      } catch {
        return [] as MovimentoFinanceiro[];
      }
    })();

    const agendaLocal = (() => {
      try {
        return JSON.parse(agendaLocalRaw || "[]") as JogoAgenda[];
      } catch {
        return [] as JogoAgenda[];
      }
    })();

    const { data: movCloud, error: movError } = await supabase
      .from("movimentos_financeiros")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!movError && movCloud && movCloud.length > 0) {
      setMovimentos(
        movCloud.map((item) => ({
          id: Number(item.id),
          bancaId: Number(item.banca_id),
          bancaNome: item.banca_nome ?? "",
          tipo: (item.tipo ?? "deposito") as MovimentoTipo,
          valor: Number(item.valor ?? 0),
          saldoAntes: Number(item.saldo_antes ?? 0),
          saldoDepois: Number(item.saldo_depois ?? 0),
          nota: item.nota ?? "",
          createdAt: item.created_at ? String(item.created_at) : new Date().toISOString(),
        }))
      );
    } else if (movimentosLocais.length > 0) {
      setMovimentos(movimentosLocais);
    }

    const { data: agendaCloud, error: agendaError } = await supabase
      .from("agenda_jogos")
      .select("*")
      .eq("user_id", user.id)
      .order("data", { ascending: true })
      .order("hora", { ascending: true });

    if (!agendaError && agendaCloud && agendaCloud.length > 0) {
      setAgenda(
        agendaCloud.map((item) => ({
          id: Number(item.id),
          liga: item.liga ?? "",
          casa: item.casa ?? "",
          fora: item.fora ?? "",
          data: item.data ?? "",
          hora: item.hora ?? "",
          mercadoPretendido: item.mercado_pretendido ?? "",
          observacao: item.observacao ?? "",
          confianca: Number(item.confianca ?? 3),
          bancaId: item.banca_id ? String(item.banca_id) : "",
          status: (item.status ?? "analisar") as AgendaStatus,
          createdAt: item.created_at ? String(item.created_at) : new Date().toISOString(),
        }))
      );
    } else if (agendaLocal.length > 0) {
      setAgenda(agendaLocal);
    }
  }

  async function guardarMovimentoCloud(novoMovimento: MovimentoFinanceiro) {
    if (!user) return false;

    const { error } = await supabase.from("movimentos_financeiros").insert({
      user_id: user.id,
      banca_id: novoMovimento.bancaId,
      banca_nome: novoMovimento.bancaNome,
      tipo: novoMovimento.tipo,
      valor: novoMovimento.valor,
      saldo_antes: novoMovimento.saldoAntes,
      saldo_depois: novoMovimento.saldoDepois,
      nota: novoMovimento.nota,
      created_at: novoMovimento.createdAt,
    });

    return !error;
  }

  async function guardarJogoAgendaCloud(novoJogo: JogoAgenda) {
    if (!user) return false;

    const { error } = await supabase.from("agenda_jogos").insert({
      user_id: user.id,
      liga: novoJogo.liga,
      casa: novoJogo.casa,
      fora: novoJogo.fora,
      data: novoJogo.data,
      hora: novoJogo.hora,
      mercado_pretendido: novoJogo.mercadoPretendido,
      observacao: novoJogo.observacao,
      confianca: novoJogo.confianca,
      banca_id: novoJogo.bancaId || null,
      status: novoJogo.status,
      created_at: novoJogo.createdAt,
    });

    return !error;
  }

  function limparEmail(valor: string) {
    return valor.trim().replace(/\s+/g, "").toLowerCase();
  }

  function emailValido(valor: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  }

  async function entrar() {
    const emailLimpo = limparEmail(email);
    const senhaLimpa = senha.trim();

    setEmail(emailLimpo);
    setMensagem("A entrar...");

    if (!emailValido(emailLimpo)) {
      setMensagem("Email inválido. Confere se está escrito sem espaços e no formato nome@email.com");
      return;
    }

    if (!senhaLimpa) {
      setMensagem("Digite a senha para entrar.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailLimpo,
      password: senhaLimpa,
    });

    setMensagem(error ? "Credenciais inválidas ou conta não confirmada." : "Login feito com sucesso.");
  }

  async function cadastrar() {
    const emailLimpo = limparEmail(email);
    const senhaLimpa = senha.trim();

    setEmail(emailLimpo);
    setMensagem("A criar conta...");

    if (!emailValido(emailLimpo)) {
      setMensagem("Email inválido. Confere se está escrito sem espaços e no formato nome@email.com");
      return;
    }

    if (senhaLimpa.length < 6) {
      setMensagem("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: emailLimpo,
      password: senhaLimpa,
      options: {
        data: {
          phone: telefone.trim(),
        },
      },
    });

    setMensagem(error ? error.message : "Conta criada. Verifica o teu email para confirmar.");
  }

  async function recuperarSenha() {
    const emailLimpo = limparEmail(email);
    setEmail(emailLimpo);

    if (!emailValido(emailLimpo)) {
      setMensagem("Digite um email válido para recuperar a senha.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(emailLimpo, {
      redirectTo: window.location.origin,
    });

    setMensagem(error ? error.message : "Email de recuperação enviado.");
  }

  async function atualizarNovaSenha() {
    if (!novaSenha.trim()) {
      setMensagemRecovery("Digite a nova senha.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: novaSenha,
    });

    if (error) {
      setMensagemRecovery(error.message);
      return;
    }

    setMensagemRecovery("Senha atualizada com sucesso. Agora faça login.");
    setNovaSenha("");
    setIsRecovery(false);
    window.location.hash = "";
  }

  async function sair() {
    await supabase.auth.signOut();
    setMensagem("Sessão terminada.");
    setTela("inicio");
  }
    function calcularLucroAposta(aposta: Bet) {
    if (aposta.status === "green") return aposta.retornoEsperado - aposta.valor;
    if (aposta.status === "red") return -aposta.valor;
    if (aposta.status === "cash_out") return (aposta.valorCashOut ?? 0) - aposta.valor;
    return 0;
  }

  function totalMovimentosBanca(bancaId: number) {
    return movimentos
      .filter((m) => m.bancaId === bancaId)
      .reduce((acc, mov) => {
        if (mov.tipo === "deposito" || mov.tipo === "bonus" || mov.tipo === "ajuste") {
          return acc + mov.valor;
        }

        if (mov.tipo === "saque" || mov.tipo === "correcao") {
          return acc - mov.valor;
        }

        return acc;
      }, 0);
  }

  function calcularAtualAutomatico(bancaId: number) {
    const banca = bancas.find((b) => b.id === bancaId);
    if (!banca) return 0;

    const lucroApostas = apostas
      .filter((a) => a.bancaId === bancaId)
      .reduce((acc, aposta) => acc + calcularLucroAposta(aposta), 0);

    return banca.depositado + lucroApostas + totalMovimentosBanca(bancaId);
  }

  function statusPorValor(atual: number, meta: number): BankrollStatus {
    if (atual <= 0) return "quebrada";
    if (meta > 0 && atual >= meta) return "meta_batida";
    return "ativa";
  }

  async function criarBanca() {
    if (!user) return;

    const depositado = Number(valorDepositado);
    const atual = Number(valorAtual || valorDepositado);
    const meta = Number(metaBanca);
    const dias = Number(diasMeta);

    if (bancas.filter((b) => b.status === "ativa").length >= 3) {
      setMensagem("Só podes ter até 3 bancas ativas.");
      return;
    }

    if (!nomeBanca.trim() || [depositado, atual, meta, dias].some((n) => isNaN(n))) {
      setMensagem("Preenche todos os campos da banca.");
      return;
    }

    const { error } = await supabase.from("bancas").insert({
      user_id: user.id,
      nome: nomeBanca.trim(),
      depositado,
      atual,
      meta,
      dias,
      status: statusPorValor(atual, meta),
    });

    if (error) {
      setMensagem(`Erro ao criar banca: ${error.message}`);
      return;
    }

    setNomeBanca("");
    setValorDepositado("");
    setValorAtual("");
    setMetaBanca("");
    setDiasMeta("");
    setMensagem("Banca criada com sucesso.");
    await carregarBancas();
  }

  function iniciarEdicaoBanca(banca: Bankroll) {
    setEditandoBancaId(banca.id);
    setEditNomeBanca(banca.nome);
    setEditDepositado(String(banca.depositado));
    setEditAtual(String(calcularAtualAutomatico(banca.id)));
    setEditMeta(String(banca.meta));
    setEditDias(String(banca.dias));
  }

  function cancelarEdicaoBanca() {
    setEditandoBancaId(null);
    setEditNomeBanca("");
    setEditDepositado("");
    setEditAtual("");
    setEditMeta("");
    setEditDias("");
  }

  async function guardarEdicaoBanca(id: number) {
    const depositado = Number(editDepositado);
    const atual = Number(editAtual);
    const meta = Number(editMeta);
    const dias = Number(editDias);

    if (!editNomeBanca.trim() || [depositado, atual, meta, dias].some((n) => isNaN(n))) {
      setMensagem("Preenche os dados da banca para editar.");
      return;
    }

    const { error } = await supabase
      .from("bancas")
      .update({
        nome: editNomeBanca.trim(),
        depositado,
        atual,
        meta,
        dias,
        status: statusPorValor(atual, meta),
      })
      .eq("id", id);

    if (error) {
      setMensagem(`Erro ao editar banca: ${error.message}`);
      return;
    }

    cancelarEdicaoBanca();
    setMensagem("Banca editada com sucesso.");
    await carregarBancas();
  }

  async function apagarBanca(id: number) {
    if (apostas.some((aposta) => aposta.bancaId === id)) {
      setMensagem("Não podes apagar esta banca porque já tem apostas ligadas.");
      return;
    }

    const { error } = await supabase.from("bancas").delete().eq("id", id);

    if (error) {
      setMensagem(`Erro ao apagar banca: ${error.message}`);
      return;
    }

    setMensagem("Banca apagada com sucesso.");
    await carregarBancas();
  }

  async function registrarMovimentoFinanceiro() {
    const banca = bancas.find((b) => b.id === Number(movimentoBancaId));
    const valor = Number(movimentoValor);

    if (!banca || isNaN(valor) || valor <= 0) {
      setMensagem("Escolhe a banca e um valor válido.");
      return;
    }

    const saldoAntes = calcularAtualAutomatico(banca.id);
    let saldoDepois = saldoAntes;

    if (movimentoTipo === "deposito" || movimentoTipo === "bonus" || movimentoTipo === "ajuste") {
      saldoDepois = saldoAntes + valor;
    }

    if (movimentoTipo === "saque" || movimentoTipo === "correcao") {
      saldoDepois = saldoAntes - valor;
    }

    const novoMovimento: MovimentoFinanceiro = {
      id: Date.now(),
      bancaId: banca.id,
      bancaNome: banca.nome,
      tipo: movimentoTipo,
      valor,
      saldoAntes,
      saldoDepois,
      nota: movimentoNota.trim(),
      createdAt: new Date().toISOString(),
    };

    const salvouCloud = await guardarMovimentoCloud(novoMovimento);

    setMovimentos((atual) => [novoMovimento, ...atual]);
    setMovimentoValor("");
    setMovimentoNota("");
    setMensagem(
      salvouCloud
        ? "Movimento financeiro registrado no extrato e sincronizado na cloud."
        : "Movimento financeiro registrado localmente. Para sincronizar online, cria a tabela movimentos_financeiros no Supabase."
    );
  }

  async function apagarMovimentoFinanceiro(id: number) {
    if (id < 0) {
      setMensagem("O depósito inicial vem da criação da banca. Para alterar, edita a banca.");
      return;
    }

    setMovimentos((atual) => atual.filter((m) => m.id !== id));

    if (user) {
      await supabase.from("movimentos_financeiros").delete().eq("id", id).eq("user_id", user.id);
    }

    setMensagem("Movimento removido do extrato.");
  }

  function aplicarFiltroFinanceiro() {
    setFiltrosFinanceirosAplicados({
      banca: filtroFinanceiroBancaDraft,
      tipo: filtroFinanceiroTipoDraft,
    });
    setMensagem("Filtro financeiro aplicado.");
  }

  function limparFiltroFinanceiro() {
    setFiltroFinanceiroBancaDraft("");
    setFiltroFinanceiroTipoDraft("");
    setFiltrosFinanceirosAplicados({
      banca: "",
      tipo: "",
    });
    setMensagem("Filtro financeiro limpo.");
  }

  async function criarJogoAgenda() {
    if (!agendaLiga.trim() || !agendaCasa.trim() || !agendaFora.trim() || !agendaData || !agendaHora) {
      setMensagem("Preenche liga, equipas, data e hora para criar o jogo na agenda.");
      return;
    }

    if (agendaCasa.trim().toLowerCase() === agendaFora.trim().toLowerCase()) {
      setMensagem("A equipa da casa não pode ser igual à equipa de fora.");
      return;
    }

    const novo: JogoAgenda = {
      id: Date.now(),
      liga: agendaLiga.trim(),
      casa: agendaCasa.trim(),
      fora: agendaFora.trim(),
      data: agendaData,
      hora: agendaHora,
      mercadoPretendido: agendaMercado.trim(),
      observacao: agendaObs.trim(),
      confianca: agendaConfianca,
      bancaId: agendaBancaId,
      status: "analisar",
      createdAt: new Date().toISOString(),
    };

    const salvouCloud = await guardarJogoAgendaCloud(novo);

    setAgenda((atual) => [novo, ...atual]);
    setAgendaLiga("");
    setAgendaCasa("");
    setAgendaFora("");
    setAgendaData("");
    setAgendaHora("");
    setAgendaMercado("");
    setAgendaObs("");
    setAgendaConfianca(3);
    setAgendaBancaId("");
    setMensagem(
      salvouCloud
        ? "Jogo adicionado à agenda e sincronizado na cloud."
        : "Jogo adicionado localmente. Para sincronizar online, cria a tabela agenda_jogos no Supabase."
    );
  }

  async function atualizarStatusAgenda(id: number, status: AgendaStatus) {
    setAgenda((atual) => atual.map((jogo) => (jogo.id === id ? { ...jogo, status } : jogo)));

    if (user && id > 0) {
      await supabase.from("agenda_jogos").update({ status }).eq("id", id).eq("user_id", user.id);
    }
  }

  async function apagarJogoAgenda(id: number) {
    setAgenda((atual) => atual.filter((jogo) => jogo.id !== id));

    if (user && id > 0) {
      await supabase.from("agenda_jogos").delete().eq("id", id).eq("user_id", user.id);
    }

    setMensagem("Jogo removido da agenda.");
  }

  function criarApostaDaAgenda(jogo: JogoAgenda) {
    setTela("apostas");
    setLigaManual(jogo.liga);
    setEquipaCasaManual(jogo.casa);
    setEquipaForaManual(jogo.fora);
    setUsarCasaManual(true);
    setUsarForaManual(true);
    setMercado(jogo.mercadoPretendido);
    setConfianca(jogo.confianca);
    setAnalisePre(jogo.observacao);
    setBancaSelecionadaId(jogo.bancaId || "");
    atualizarStatusAgenda(jogo.id, "pre_live");
    setMensagem("Dados do jogo enviados para o registro de aposta. Preenche odd e valor.");
  }

  const bancaSelecionada = useMemo(
    () => bancas.find((b) => b.id === Number(bancaSelecionadaId)) || null,
    [bancas, bancaSelecionadaId]
  );

  const bancaSelecionadaAtual = useMemo(
    () => (bancaSelecionada ? calcularAtualAutomatico(bancaSelecionada.id) : 0),
    [bancaSelecionada, apostas, bancas, movimentos]
  );

  const oddTotalCartela = useMemo(
    () =>
      cartela.reduce(
        (total, jogo) => total * jogo.selecoes.reduce((t, s) => t * s.odd, 1),
        1
      ),
    [cartela]
  );

  const retornoEsperado = useMemo(
    () =>
      Number(odd) > 0 && Number(valorApostado) > 0
        ? Number(odd) * Number(valorApostado)
        : 0,
    [odd, valorApostado]
  );

  const retornoEsperadoCartela = useMemo(
    () =>
      Number(valorApostado) > 0 && oddTotalCartela > 1
        ? Number(valorApostado) * oddTotalCartela
        : 0,
    [valorApostado, oddTotalCartela]
  );

  const stakeSugerida = useMemo(() => {
    const percentual = Number(stakePercentual);

    if (!bancaSelecionadaAtual || isNaN(percentual) || percentual <= 0) return 0;

    const ajuste =
      modoGestao === "conservador" ? 0.75 : modoGestao === "agressivo" ? 1.25 : 1;

    return bancaSelecionadaAtual * (percentual / 100) * ajuste;
  }, [bancaSelecionadaAtual, stakePercentual, modoGestao]);

  const ligasFiltradas = useMemo(() => {
    const mapa = new Map<string, League>();

    leagues
      .filter((l) => String(l.country_id) === countrySelecionadoId)
      .forEach((l) => mapa.set(`${l.country_id}-${l.nome.trim().toLowerCase()}`, l));

    return Array.from(mapa.values()).sort(
      (a, b) => a.divisao - b.divisao || a.nome.localeCompare(b.nome)
    );
  }, [leagues, countrySelecionadoId]);

  const equipasFiltradas = useMemo(() => {
    const mapa = new Map<string, Team>();

    teams
      .filter(
        (t) =>
          String(t.country_id) === countrySelecionadoId &&
          String(t.league_id) === ligaSelecionadaId
      )
      .forEach((t) =>
        mapa.set(`${t.country_id}-${t.league_id}-${t.nome.trim().toLowerCase()}`, {
          ...t,
          nome: t.nome.trim(),
        })
      );

    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [teams, countrySelecionadoId, ligaSelecionadaId]);

  const mercadosVisiveis = useMemo(() => {
    const termo = buscaMercado.trim().toLowerCase();
    return termo
      ? mercadosBase.filter((item) => item.toLowerCase().includes(termo))
      : mercadosPorCategoria[mercadoCategoriaAtiva];
  }, [mercadoCategoriaAtiva, buscaMercado]);

  function todasSelecoesDaCartela() {
    return cartela.flatMap((jogo) =>
      jogo.selecoes.map((s) => ({
        liga: jogo.liga,
        casa: jogo.casa,
        fora: jogo.fora,
        ...s,
      }))
    );
  }

  function dadosSelecaoAtual(): SelecaoSalva | null {
    const oddNumero = Number(odd);
    const ligaEscolhida = leagues.find((l) => String(l.id) === ligaSelecionadaId);
    const nomeLigaFinal = ligaEscolhida?.nome || ligaManual.trim();
    const nomeCasaFinal = usarCasaManual ? equipaCasaManual.trim() : equipaCasa.trim();
    const nomeForaFinal = usarForaManual ? equipaForaManual.trim() : equipaFora.trim();

    if (
      !nomeLigaFinal ||
      !nomeCasaFinal ||
      !nomeForaFinal ||
      !mercado.trim() ||
      isNaN(oddNumero) ||
      oddNumero <= 1
    ) {
      return null;
    }

    return {
      id: Date.now(),
      liga: nomeLigaFinal,
      casa: nomeCasaFinal,
      fora: nomeForaFinal,
      mercado: mercado.trim(),
      odd: oddNumero,
      status: statusAposta,
      motivoRed: statusAposta === "red" ? "Não informado" : "",
    };
  }

  function adicionarSelecaoCartela() {
    const selecao = dadosSelecaoAtual();

    if (!selecao) {
      setMensagem("Preenche liga, equipas, mercado e odd para adicionar à cartela.");
      return;
    }

    if (selecao.casa.toLowerCase() === selecao.fora.toLowerCase()) {
      setMensagem("A equipa da casa não pode ser igual à equipa de fora.");
      return;
    }

    setCartela((atual) => {
      const existente = atual.find(
        (j) =>
          j.liga === selecao.liga &&
          j.casa === selecao.casa &&
          j.fora === selecao.fora
      );

      const item = {
        id: Date.now() + Math.floor(Math.random() * 999),
        mercado: selecao.mercado,
        odd: selecao.odd,
        status: selecao.status,
        motivoRed: selecao.motivoRed,
      };

      if (existente) {
        return atual.map((j) =>
          j.id === existente.id ? { ...j, selecoes: [...j.selecoes, item] } : j
        );
      }

      return [
        ...atual,
        {
          id: Date.now() + 1,
          liga: selecao.liga,
          casa: selecao.casa,
          fora: selecao.fora,
          selecoes: [item],
        },
      ];
    });

    setMercado("");
    setOdd("");
    setMensagem("Seleção adicionada à cartela. Podes adicionar outro mercado no mesmo jogo.");
  }

  function atualizarSelecaoCartela(
    jogoId: number,
    selecaoId: number,
    novoStatus: BetStatus,
    motivoRed?: string
  ) {
    setCartela((atual) =>
      atual.map((jogo) =>
        jogo.id === jogoId
          ? {
              ...jogo,
              selecoes: jogo.selecoes.map((s) =>
                s.id === selecaoId
                  ? {
                      ...s,
                      status: novoStatus,
                      motivoRed: novoStatus === "red" ? motivoRed || "Não informado" : "",
                    }
                  : s
              ),
            }
          : jogo
      )
    );
  }

  function fecharCartela(statusFinal: BetStatus) {
    if (cartela.length === 0) {
      setMensagem("Ainda não há seleções na cartela.");
      return;
    }

    setCartela((atual) =>
      atual.map((jogo) => ({
        ...jogo,
        selecoes: jogo.selecoes.map((s) => ({
          ...s,
          status: statusFinal,
          motivoRed: statusFinal === "red" ? s.motivoRed || "Fechada como red" : "",
        })),
      }))
    );

    setStatusAposta(statusFinal);
    setMensagem(`Cartela marcada como ${statusFinal}. Agora podes guardar.`);
  }

  function removerSelecaoCartela(jogoId: number, selecaoId: number) {
    setCartela((atual) =>
      atual
        .map((jogo) =>
          jogo.id === jogoId
            ? { ...jogo, selecoes: jogo.selecoes.filter((s) => s.id !== selecaoId) }
            : jogo
        )
        .filter((j) => j.selecoes.length > 0)
    );
  }

  function limparFormularioAposta() {
    setBancaSelecionadaId("");
    setCountrySelecionadoId("");
    setLigaSelecionadaId("");
    setLigaManual("");
    setUsarCasaManual(false);
    setUsarForaManual(false);
    setEquipaCasa("");
    setEquipaFora("");
    setEquipaCasaManual("");
    setEquipaForaManual("");
    setMercado("");
    setOdd("");
    setValorApostado("");
    setValorCashOut("");
    setCartela([]);
    setStatusAposta("pendente");
    setAnalisePre("");
    setConfianca(3);
    setEmocaoEntrada("calmo");
  }

  async function registrarAposta() {
    if (!user) return;

    const banca = bancas.find((b) => b.id === Number(bancaSelecionadaId));
    const valorNumero = Number(valorApostado);
    const cashOutNumero = Number(valorCashOut);

    if (!banca) {
      setMensagem("Escolhe uma banca para registrar a aposta.");
      return;
    }

    if (isNaN(valorNumero) || valorNumero <= 0) {
      setMensagem("Preenche um valor apostado válido.");
      return;
    }

    if (statusAposta === "cash_out" && (isNaN(cashOutNumero) || cashOutNumero < 0)) {
      setMensagem("Preenche um valor válido para o cash out.");
      return;
    }

    let selecoes = todasSelecoesDaCartela();

    if (selecoes.length === 0) {
      const selecaoUnica = dadosSelecaoAtual();

      if (!selecaoUnica) {
        setMensagem("Preenche a aposta ou adiciona pelo menos uma seleção à cartela.");
        return;
      }

      selecoes = [selecaoUnica];
    }

    const oddTotal = selecoes.reduce((acc, s) => acc * s.odd, 1);
    const primeiro = selecoes[0];
    const ligasTexto = Array.from(new Set(selecoes.map((s) => s.liga))).join(" | ");
    const jogosTexto = Array.from(new Set(selecoes.map((s) => `${s.casa} x ${s.fora}`))).join(" | ");

    const selecoesComStatus = selecoes.map((s) => ({
      ...s,
      id: s.id || Date.now() + Math.floor(Math.random() * 999),
      status: statusAposta === "pendente" ? s.status : statusAposta,
      motivoRed: statusAposta === "red" ? s.motivoRed || "Não informado" : s.motivoRed,
    }));

    const statusFinalDaAposta =
      statusAposta === "pendente"
        ? calcularStatusGeralPorSelecoes(selecoesComStatus)
        : statusAposta;

    const { error } = await supabase.from("apostas").insert({
      user_id: user.id,
      banca_id: banca.id,
      banca_nome: banca.nome,
      liga: ligasTexto,
      casa: primeiro.casa,
      fora: selecoes.length > 1 ? jogosTexto : primeiro.fora,
      mercado: montarMercadoJson(selecoesComStatus),
      odd: oddTotal,
      valor: valorNumero,
      retorno_esperado: oddTotal * valorNumero,
      status: statusFinalDaAposta,
      valor_cash_out: statusFinalDaAposta === "cash_out" ? cashOutNumero : null,
    });

    if (error) {
      setMensagem(`Erro ao registrar aposta: ${error.message}`);
      return;
    }

    limparFormularioAposta();
    setMensagem(
      selecoes.length > 1
        ? "Aposta com múltiplos mercados/cartela registrada com sucesso."
        : "Aposta simples registrada com sucesso."
    );
    await carregarApostas();
  }

  function calcularStatusGeralPorSelecoes(selecoes: SelecaoSalva[]): BetStatus {
    if (!selecoes.length) return "pendente";
    if (selecoes.some((s) => s.status === "red")) return "red";
    if (selecoes.some((s) => s.status === "cash_out")) return "cash_out";
    if (selecoes.every((s) => s.status === "green")) return "green";
    return "pendente";
  }

  async function atualizarStatusAposta(aposta: Bet, novoStatus: BetStatus) {
    if (novoStatus === "cash_out") {
      setCashOutEditandoId(aposta.id);
      setCashOutEditandoValor("");
      setMensagem("Digite o valor recebido no cash out.");
      return;
    }

    const interpretado = interpretarMercadoSalvo(aposta.mercado);
    const update: Record<string, unknown> = {
      status: novoStatus,
      valor_cash_out: null,
    };

    if (interpretado.selecoes.length > 0) {
      update.mercado = montarMercadoJson(
        interpretado.selecoes.map((s) => ({
          ...s,
          status: novoStatus,
          motivoRed: novoStatus === "red" ? s.motivoRed || "Fechado como red" : "",
        })),
        interpretado.meta
      );
    }

    const { error } = await supabase.from("apostas").update(update).eq("id", aposta.id);

    if (error) {
      setMensagem(`Erro ao atualizar status: ${error.message}`);
      return;
    }

    setMensagem("Status da aposta atualizado.");
    await carregarApostas();
  }

  async function confirmarCashOut(aposta: Bet) {
    const valor = Number(cashOutEditandoValor);

    if (isNaN(valor) || valor < 0) {
      setMensagem("Digite um valor válido para o cash out.");
      return;
    }

    const interpretado = interpretarMercadoSalvo(aposta.mercado);

    const update: Record<string, unknown> = {
      status: "cash_out",
      valor_cash_out: valor,
    };

    if (interpretado.selecoes.length > 0) {
      update.mercado = montarMercadoJson(
        interpretado.selecoes.map((s) => ({ ...s, status: "cash_out" })),
        interpretado.meta
      );
    }

    const { error } = await supabase.from("apostas").update(update).eq("id", aposta.id);

    if (error) {
      setMensagem(`Erro ao confirmar cash out: ${error.message}`);
      return;
    }

    setCashOutEditandoId(null);
    setCashOutEditandoValor("");
    setMensagem("Cash out atualizado com sucesso.");
    await carregarApostas();
  }

  async function atualizarSelecaoSalva(
    aposta: Bet,
    selecaoId: number,
    novoStatus: BetStatus,
    motivoRed?: string
  ) {
    const interpretado = interpretarMercadoSalvo(aposta.mercado);

    if (!interpretado.selecoes.length) {
      setMensagem("Esta aposta não tem seleções detalhadas.");
      return;
    }

    const novas = interpretado.selecoes.map((s) =>
      s.id === selecaoId
        ? {
            ...s,
            status: novoStatus,
            motivoRed: novoStatus === "red" ? motivoRed || "Não informado" : "",
          }
        : s
    );

    const { error } = await supabase
      .from("apostas")
      .update({
        mercado: montarMercadoJson(novas, interpretado.meta),
        status: calcularStatusGeralPorSelecoes(novas),
      })
      .eq("id", aposta.id);

    if (error) {
      setMensagem(`Erro ao atualizar seleção: ${error.message}`);
      return;
    }

    setMensagem("Seleção atualizada com sucesso.");
    await carregarApostas();
  }

  async function apagarAposta(id: number) {
    const { error } = await supabase.from("apostas").delete().eq("id", id);

    if (error) {
      setMensagem(`Erro ao apagar aposta: ${error.message}`);
      return;
    }

    setMensagem("Aposta apagada com sucesso.");
    await carregarApostas();
  }

  function corStatus(status: BetStatus) {
    return status === "green"
      ? tema.good
      : status === "red"
      ? tema.bad
      : status === "cash_out"
      ? tema.warn
      : "#94a3b8";
  }

  function fundoStatusAposta(status: BetStatus): CSSProperties {
    if (status === "green") {
      return {
        background:
          temaNome === "claro"
            ? "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(255,255,255,0.96))"
            : `linear-gradient(135deg, rgba(34,197,94,0.14), ${tema.card2})`,
        border: `1px solid ${tema.good}`,
        boxShadow: "0 12px 30px rgba(34,197,94,0.10)",
      };
    }

    if (status === "red") {
      return {
        background:
          temaNome === "claro"
            ? "linear-gradient(135deg, rgba(239,68,68,0.16), rgba(255,255,255,0.96))"
            : `linear-gradient(135deg, rgba(239,68,68,0.14), ${tema.card2})`,
        border: `1px solid ${tema.bad}`,
        boxShadow: "0 12px 30px rgba(239,68,68,0.10)",
      };
    }

    if (status === "cash_out") {
      return {
        background:
          temaNome === "claro"
            ? "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(255,255,255,0.96))"
            : `linear-gradient(135deg, rgba(245,158,11,0.14), ${tema.card2})`,
        border: `1px solid ${tema.warn}`,
        boxShadow: "0 12px 30px rgba(245,158,11,0.10)",
      };
    }

    return {
      background: tema.card2,
      border: `1px solid ${tema.border}`,
      boxShadow: "0 10px 26px rgba(0,0,0,0.16)",
    };
  }

  function statusBadgeStyle(status: BetStatus): CSSProperties {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "5px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: "bold",
      color: "white",
      background: corStatus(status),
      textTransform: "uppercase",
      letterSpacing: "0.4px",
    };
  }

  function topTexto(lista: string[]) {
    const mapa = new Map<string, number>();
    lista.filter(Boolean).forEach((i) => mapa.set(i, (mapa.get(i) || 0) + 1));
    const arr = Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
    return arr[0] ? `${arr[0][0]} (${arr[0][1]})` : "Sem dados";
  }

  const todasSelecoesAnalise = useMemo(
    () =>
      apostas.flatMap((aposta) => {
        const i = interpretarMercadoSalvo(aposta.mercado);

        if (i.selecoes.length) return i.selecoes;

        return [
          {
            id: aposta.id,
            liga: aposta.liga,
            casa: aposta.casa,
            fora: aposta.fora,
            mercado: i.mercadoVisual,
            odd: aposta.odd,
            status: aposta.status,
            motivoRed: "",
          },
        ];
      }),
    [apostas]
  );

  function faixaHorario(raw: string) {
    const h = raw ? new Date(raw).getHours() : 0;
    if (h >= 6 && h < 12) return "Manhã";
    if (h >= 12 && h < 18) return "Tarde";
    if (h >= 18 && h < 23) return "Noite";
    return "Madrugada";
  }

  function rankingPorCampo(campo: "mercado" | "liga" | "estrategia" | "confianca" | "hora") {
    const mapa: Record<
      string,
      {
        nome: string;
        total: number;
        greens: number;
        reds: number;
        cashOut: number;
        lucro: number;
        valor: number;
      }
    > = {};

    apostas.forEach((aposta) => {
      const interpretado = interpretarMercadoSalvo(aposta.mercado);

      const selecoes =
        campo === "mercado" || campo === "liga"
          ? interpretado.selecoes.length
            ? interpretado.selecoes
            : ([{ mercado: interpretado.mercadoVisual, liga: aposta.liga }] as SelecaoSalva[])
          : [null];

      const nomes =
        campo === "estrategia"
          ? [aposta.meta?.estrategia || "Sem estratégia"]
          : campo === "confianca"
          ? [`${aposta.meta?.confianca || 3} estrela(s)`]
          : campo === "hora"
          ? [faixaHorario(aposta.createdAtRaw)]
          : selecoes.map((s) => (campo === "mercado" ? s?.mercado : s?.liga));

      nomes.filter(Boolean).forEach((nome) => {
        const chave = String(nome);

        if (!mapa[chave]) {
          mapa[chave] = {
            nome: chave,
            total: 0,
            greens: 0,
            reds: 0,
            cashOut: 0,
            lucro: 0,
            valor: 0,
          };
        }

        mapa[chave].total += 1;
        mapa[chave].valor += aposta.valor / Math.max(1, nomes.length);
        mapa[chave].lucro += calcularLucroAposta(aposta) / Math.max(1, nomes.length);

        if (aposta.status === "green") mapa[chave].greens += 1;
        if (aposta.status === "red") mapa[chave].reds += 1;
        if (aposta.status === "cash_out") mapa[chave].cashOut += 1;
      });
    });

    return Object.values(mapa)
      .map((x) => ({
        ...x,
        resolvidas: x.greens + x.reds + x.cashOut,
        taxa:
          x.greens + x.reds + x.cashOut
            ? (x.greens / (x.greens + x.reds + x.cashOut)) * 100
            : 0,
        roi: x.valor ? (x.lucro / x.valor) * 100 : 0,
      }))
      .sort((a, b) => b.roi - a.roi || b.taxa - a.taxa || b.total - a.total);
  }

  const totalApostas = apostas.length;
  const totalGreens = apostas.filter((a) => a.status === "green").length;
  const totalReds = apostas.filter((a) => a.status === "red").length;
  const totalPendentes = apostas.filter((a) => a.status === "pendente").length;
  const totalCashOut = apostas.filter((a) => a.status === "cash_out").length;
  const resolvidas = totalGreens + totalReds + totalCashOut;
  const taxaAcerto = resolvidas ? (totalGreens / resolvidas) * 100 : 0;
  const totalValorApostado = apostas.reduce((acc, a) => acc + a.valor, 0);
  const lucroTotalGeral = apostas.reduce((acc, a) => acc + calcularLucroAposta(a), 0);
  const totalDepositadoGeral = bancas.reduce((acc, b) => acc + b.depositado, 0);

  const totalMovimentosGeral = movimentos.reduce((acc, mov) => {
    if (mov.tipo === "deposito" || mov.tipo === "bonus" || mov.tipo === "ajuste") {
      return acc + mov.valor;
    }

    if (mov.tipo === "saque" || mov.tipo === "correcao") return acc - mov.valor;

    return acc;
  }, 0);

  const bancaAtualGeral = totalDepositadoGeral + lucroTotalGeral + totalMovimentosGeral;
  const roiGeral = totalValorApostado ? (lucroTotalGeral / totalValorApostado) * 100 : 0;
  const crescimentoGeral = totalDepositadoGeral
    ? (lucroTotalGeral / totalDepositadoGeral) * 100
    : 0;

  const rankingMercados = useMemo(() => rankingPorCampo("mercado"), [apostas]);
  const rankingLigas = useMemo(() => rankingPorCampo("liga"), [apostas]);
  const rankingEstrategias = useMemo(() => rankingPorCampo("estrategia"), [apostas]);
  const rankingConfianca = useMemo(() => rankingPorCampo("confianca"), [apostas]);
  const heatmapHorario = useMemo(() => rankingPorCampo("hora"), [apostas]);

  const evolucaoBancaGrafico = useMemo(() => {
    const dias = Array.from({ length: 14 }).map((_, index) => {
      const data = new Date();
      data.setDate(data.getDate() - (13 - index));
      const iso = data.toLocaleDateString("sv-SE");
      return {
        iso,
        label: data.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
        lucro: 0,
        valor: 0,
        greens: 0,
        reds: 0,
      };
    });

    apostas.forEach((aposta) => {
      const iso = aposta.createdAtRaw
        ? new Date(aposta.createdAtRaw).toLocaleDateString("sv-SE")
        : "";
      const dia = dias.find((d) => d.iso === iso);

      if (!dia) return;

      dia.lucro += calcularLucroAposta(aposta);
      dia.valor += aposta.valor;

      if (aposta.status === "green") dia.greens += 1;
      if (aposta.status === "red") dia.reds += 1;
    });

    let acumulado = totalDepositadoGeral + totalMovimentosGeral;

    return dias.map((dia) => {
      acumulado += dia.lucro;
      return {
        ...dia,
        saldo: acumulado,
        roi: dia.valor ? (dia.lucro / dia.valor) * 100 : 0,
      };
    });
  }, [apostas, totalDepositadoGeral, totalMovimentosGeral]);

  const lucroPorDiaGrafico = useMemo(
    () => evolucaoBancaGrafico.map((dia) => ({ label: dia.label, valor: dia.lucro })),
    [evolucaoBancaGrafico]
  );

  const roiPorDiaGrafico = useMemo(
    () => evolucaoBancaGrafico.map((dia) => ({ label: dia.label, valor: dia.roi })),
    [evolucaoBancaGrafico]
  );
  const dashboardInteligente = useMemo(() => {
    const agora = new Date();
    const inicioHoje = new Date(agora);
    inicioHoje.setHours(0, 0, 0, 0);

    const inicioSemana = new Date(inicioHoje);
    inicioSemana.setDate(inicioSemana.getDate() - 6);

    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const calcularPeriodo = (inicio: Date) => {
      const lista = apostas.filter((a) => a.createdAtRaw && new Date(a.createdAtRaw) >= inicio);
      const valor = lista.reduce((acc, a) => acc + a.valor, 0);
      const lucro = lista.reduce((acc, a) => acc + calcularLucroAposta(a), 0);
      const greens = lista.filter((a) => a.status === "green").length;
      const reds = lista.filter((a) => a.status === "red").length;
      const cash = lista.filter((a) => a.status === "cash_out").length;
      const resolvidasPeriodo = greens + reds + cash;

      return {
        total: lista.length,
        valor,
        lucro,
        roi: valor ? (lucro / valor) * 100 : 0,
        taxa: resolvidasPeriodo ? (greens / resolvidasPeriodo) * 100 : 0,
      };
    };

    const ultimos7Dias = Array.from({ length: 7 }).map((_, index) => {
      const dia = new Date(inicioHoje);
      dia.setDate(inicioHoje.getDate() - (6 - index));
      const chave = dia.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
      const lucroDia = apostas
        .filter((a) => {
          if (!a.createdAtRaw) return false;
          const d = new Date(a.createdAtRaw);
          return d.toDateString() === dia.toDateString();
        })
        .reduce((acc, a) => acc + calcularLucroAposta(a), 0);

      return { dia: chave, lucro: lucroDia };
    });

    const melhorMercado = rankingMercados.find((m) => m.total >= 2) || rankingMercados[0];
    const piorMercado = [...rankingMercados].filter((m) => m.total >= 2).sort((a, b) => a.roi - b.roi)[0];
    const melhorLiga = rankingLigas.find((l) => l.total >= 2) || rankingLigas[0];
    const melhorHorario = heatmapHorario.find((h) => h.total >= 2) || heatmapHorario[0];
    const progressoMetaGeral = bancas.length
      ? bancas.reduce((acc, b) => acc + Math.min(100, b.meta > 0 ? (calcularAtualAutomatico(b.id) / b.meta) * 100 : 0), 0) / bancas.length
      : 0;

    return {
      hoje: calcularPeriodo(inicioHoje),
      semana: calcularPeriodo(inicioSemana),
      mes: calcularPeriodo(inicioMes),
      ultimos7Dias,
      melhorMercado,
      piorMercado,
      melhorLiga,
      melhorHorario,
      progressoMetaGeral,
    };
  }, [apostas, bancas, movimentos, rankingMercados, rankingLigas, heatmapHorario]);


  const rankingEquipas = useMemo(() => {
    const mapa: Record<
      string,
      {
        nome: string;
        total: number;
        greens: number;
        reds: number;
        cashOut: number;
        pendentes: number;
        mercados: string[];
      }
    > = {};

    todasSelecoesAnalise.forEach((s) =>
      [s.casa, s.fora].filter(Boolean).forEach((nome) => {
        if (!mapa[nome]) {
          mapa[nome] = {
            nome,
            total: 0,
            greens: 0,
            reds: 0,
            cashOut: 0,
            pendentes: 0,
            mercados: [],
          };
        }

        mapa[nome].total++;
        mapa[nome].mercados.push(s.mercado);

        if (s.status === "green") mapa[nome].greens++;
        else if (s.status === "red") mapa[nome].reds++;
        else if (s.status === "cash_out") mapa[nome].cashOut++;
        else mapa[nome].pendentes++;
      })
    );

    return Object.values(mapa)
      .map((e) => {
        const r = e.greens + e.reds + e.cashOut;
        return {
          ...e,
          taxa: r ? (e.greens / r) * 100 : 0,
          mercadoMaisUsado: topTexto(e.mercados),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [todasSelecoesAnalise]);

  const streakAtual = useMemo(() => {
    const lista = apostas
      .filter((a) => a.status === "green" || a.status === "red")
      .sort((a, b) => new Date(b.createdAtRaw).getTime() - new Date(a.createdAtRaw).getTime());

    if (!lista.length) return { tipo: "Sem sequência", qtd: 0 };

    const tipo = lista[0].status;
    let qtd = 0;

    for (const a of lista) {
      if (a.status === tipo) qtd++;
      else break;
    }

    return { tipo, qtd };
  }, [apostas]);

  const nivelRiscoEntrada = useMemo(() => {
    const oddNum = cartela.length ? oddTotalCartela : Number(odd);
    const valorNum = Number(valorApostado);
    let pontos = 0;

    if ((cartela.length ? todasSelecoesDaCartela().length : 1) >= 3) pontos += 2;
    if (oddNum >= 3) pontos += 2;
    if (oddNum >= 6) pontos += 2;
    if (bancaSelecionadaAtual > 0 && valorNum > bancaSelecionadaAtual * 0.05) pontos += 2;
    if (bancaSelecionadaAtual > 0 && valorNum > bancaSelecionadaAtual * 0.1) pontos += 3;
    if (emocaoEntrada === "tilt" || emocaoEntrada === "pressa") pontos += 3;
    if (confianca <= 2) pontos += 2;

    if (pontos <= 2) return { nivel: "Baixo", cor: tema.good, pontos };
    if (pontos <= 5) return { nivel: "Médio", cor: tema.warn, pontos };
    return { nivel: "Alto", cor: tema.bad, pontos };
  }, [
    cartela,
    oddTotalCartela,
    odd,
    valorApostado,
    bancaSelecionadaAtual,
    emocaoEntrada,
    confianca,
    tema,
  ]);

  const alertasIA = useMemo(() => {
    const alertas: { tipo: "bom" | "medio" | "ruim"; texto: string }[] = [];

    if (streakAtual.tipo === "red" && streakAtual.qtd >= 2) {
      alertas.push({
        tipo: "ruim",
        texto: `Anti-tilt: tens ${streakAtual.qtd} reds seguidos. Reduz stake ou pausa.`,
      });
    }

    if (streakAtual.tipo === "green" && streakAtual.qtd >= 3) {
      alertas.push({
        tipo: "medio",
        texto: `Boa fase: ${streakAtual.qtd} greens seguidos. Não aumenta stake por euforia.`,
      });
    }

    if (rankingMercados[0]?.total >= 2) {
      alertas.push({
        tipo: rankingMercados[0].roi >= 0 ? "bom" : "ruim",
        texto: `Melhor mercado por ROI: ${rankingMercados[0].nome} (${rankingMercados[0].roi.toFixed(
          1
        )}%).`,
      });
    }

    const pior = [...rankingMercados].sort((a, b) => a.roi - b.roi)[0];

    if (pior?.total >= 2 && pior.roi < 0) {
      alertas.push({
        tipo: "ruim",
        texto: `Mercado perigoso: ${pior.nome} está com ROI ${pior.roi.toFixed(1)}%.`,
      });
    }

    const noite = heatmapHorario.find((h) => h.nome === "Noite" || h.nome === "Madrugada");

    if (noite && noite.total >= 2 && noite.roi < 0) {
      alertas.push({
        tipo: "medio",
        texto: `Horário de atenção: ${noite.nome} está negativo (${noite.roi.toFixed(1)}% ROI).`,
      });
    }

    if (Number(valorApostado) > 0 && bancaSelecionadaAtual > 0) {
      const p = (Number(valorApostado) / bancaSelecionadaAtual) * 100;

      if (p > 8) {
        alertas.push({
          tipo: "ruim",
          texto: `Stake alta: ${p.toFixed(1)}% da banca atual.`,
        });
      } else if (p <= 2) {
        alertas.push({
          tipo: "bom",
          texto: `Stake controlada: ${p.toFixed(1)}% da banca atual.`,
        });
      }
    }

    if (nivelRiscoEntrada.nivel === "Alto") {
      alertas.push({
        tipo: "ruim",
        texto: "Score de risco alto. Revê odd, stake, confiança e estado emocional antes de guardar.",
      });
    }

    if (!alertas.length) {
      alertas.push({
        tipo: "medio",
        texto: "Sistema aprendendo. Registra mais apostas para gerar diagnósticos melhores.",
      });
    }

    return alertas;
  }, [
    streakAtual,
    rankingMercados,
    heatmapHorario,
    valorApostado,
    bancaSelecionadaAtual,
    nivelRiscoEntrada,
  ]);

  const analiseAutomatica = useMemo(() => {
    const insights: {
      titulo: string;
      descricao: string;
      tipo: "bom" | "medio" | "ruim";
      metrica?: string;
    }[] = [];

    const resolvidasAuto = apostas.filter((a) => a.status === "green" || a.status === "red" || a.status === "cash_out");
    const multiplas = apostas.filter((a) => a.isMultipla || (a.selecoesDetalhadas?.length || 0) > 1);
    const simples = apostas.filter((a) => !a.isMultipla && (a.selecoesDetalhadas?.length || 0) <= 1);
    const lucroMultiplas = multiplas.reduce((acc, a) => acc + calcularLucroAposta(a), 0);
    const valorMultiplas = multiplas.reduce((acc, a) => acc + a.valor, 0);
    const lucroSimples = simples.reduce((acc, a) => acc + calcularLucroAposta(a), 0);
    const valorSimples = simples.reduce((acc, a) => acc + a.valor, 0);
    const roiMultiplas = valorMultiplas ? (lucroMultiplas / valorMultiplas) * 100 : 0;
    const roiSimples = valorSimples ? (lucroSimples / valorSimples) * 100 : 0;

    if (resolvidasAuto.length < 5) {
      insights.push({
        titulo: "Base de dados ainda pequena",
        descricao: "Registra pelo menos 5 a 10 apostas resolvidas para a IA ficar mais precisa e evitar conclusões falsas.",
        tipo: "medio",
        metrica: `${resolvidasAuto.length} resolvidas`,
      });
    }

    const mercadoForte = rankingMercados.find((m) => m.total >= 3 && m.roi > 0 && m.taxa >= 55);
    if (mercadoForte) {
      insights.push({
        titulo: "Mercado forte detectado",
        descricao: `${mercadoForte.nome} está acima da média. Pode ser um mercado principal para repetir com critério, sem aumentar stake por emoção.`,
        tipo: "bom",
        metrica: `ROI ${mercadoForte.roi.toFixed(1)}% · ${mercadoForte.taxa.toFixed(1)}%`,
      });
    }

    const mercadoFraco = [...rankingMercados].find((m) => m.total >= 3 && m.roi < -10);
    if (mercadoFraco) {
      insights.push({
        titulo: "Mercado para cortar ou reduzir",
        descricao: `${mercadoFraco.nome} está puxando a banca para baixo. Reduz stake, exige odd melhor ou pausa esse mercado.`,
        tipo: "ruim",
        metrica: `ROI ${mercadoFraco.roi.toFixed(1)}%`,
      });
    }

    const ligaForte = rankingLigas.find((l) => l.total >= 3 && l.roi > 0);
    if (ligaForte) {
      insights.push({
        titulo: "Liga com melhor leitura",
        descricao: `${ligaForte.nome} aparece como uma das tuas ligas mais lucrativas. Vale priorizar análises pré-live nessa competição.`,
        tipo: "bom",
        metrica: `ROI ${ligaForte.roi.toFixed(1)}%`,
      });
    }

    const equipaForte = rankingEquipas.find((e) => e.total >= 3 && e.taxa >= 60);
    if (equipaForte) {
      insights.push({
        titulo: "Equipa com bom padrão",
        descricao: `${equipaForte.nome} tem boa taxa nas tuas entradas. Mercado mais usado: ${equipaForte.mercadoMaisUsado}.`,
        tipo: "bom",
        metrica: `${equipaForte.taxa.toFixed(1)}% acerto`,
      });
    }

    if (multiplas.length >= 3 || simples.length >= 3) {
      const melhorFormato = roiSimples >= roiMultiplas ? "simples" : "múltiplas";
      insights.push({
        titulo: "Formato mais eficiente",
        descricao:
          melhorFormato === "simples"
            ? "As apostas simples estão rendendo melhor que múltiplas. Para proteger banca, mantém simples como base e usa múltiplas só com stake menor."
            : "As múltiplas estão rendendo melhor no histórico atual, mas continuam com risco maior. Usa stake reduzida e evita muitas seleções.",
        tipo: melhorFormato === "simples" ? "bom" : "medio",
        metrica: `ROI simples ${roiSimples.toFixed(1)}% · múltiplas ${roiMultiplas.toFixed(1)}%`,
      });
    }

    const pendentesAntigas = apostas.filter((a) => {
      if (a.status !== "pendente" || !a.createdAtRaw) return false;
      const diff = Date.now() - new Date(a.createdAtRaw).getTime();
      return diff > 1000 * 60 * 60 * 24 * 2;
    });

    if (pendentesAntigas.length > 0) {
      insights.push({
        titulo: "Pendentes antigas",
        descricao: "Há apostas pendentes há mais de 48h. Atualiza o resultado para a análise da banca ficar correta.",
        tipo: "medio",
        metrica: `${pendentesAntigas.length} pendente(s)`,
      });
    }

    if (roiGeral < -10 && totalApostas >= 5) {
      insights.push({
        titulo: "Modo proteção recomendado",
        descricao: "O ROI geral está negativo. Recomendo stake menor, evitar múltiplas e pausar mercados com ROI negativo até recuperar padrão.",
        tipo: "ruim",
        metrica: `ROI ${roiGeral.toFixed(1)}%`,
      });
    }

    if (taxaAcerto >= 60 && roiGeral > 0 && totalApostas >= 5) {
      insights.push({
        titulo: "Padrão positivo confirmado",
        descricao: "Taxa de acerto e ROI estão positivos. Mantém a mesma gestão sem aumentar stake agressivamente.",
        tipo: "bom",
        metrica: `${taxaAcerto.toFixed(1)}% acerto`,
      });
    }

    if (!insights.length) {
      insights.push({
        titulo: "IA em observação",
        descricao: "Ainda não há padrões fortes. Continua registrando mercado, liga, emoção e motivo do red para a análise evoluir.",
        tipo: "medio",
      });
    }

    return insights.slice(0, 8);
  }, [
    apostas,
    rankingMercados,
    rankingLigas,
    rankingEquipas,
    roiGeral,
    taxaAcerto,
    totalApostas,
  ]);

    const apostasFiltradas = useMemo(
    () =>
      apostas.filter((aposta) => {
        const i = interpretarMercadoSalvo(aposta.mercado);
        const equipaBusca = `${aposta.casa} ${aposta.fora} ${i.mercadoVisual}`.toLowerCase();

        return (
          (!filtrosAplicados.banca || aposta.bancaNome === filtrosAplicados.banca) &&
          (!filtrosAplicados.status || aposta.status === filtrosAplicados.status) &&
          (!filtrosAplicados.liga ||
            aposta.liga.toLowerCase().includes(filtrosAplicados.liga.toLowerCase())) &&
          (!filtrosAplicados.mercado ||
            i.mercadoVisual.toLowerCase().includes(filtrosAplicados.mercado.toLowerCase())) &&
          (!filtrosAplicados.equipa ||
            equipaBusca.includes(filtrosAplicados.equipa.toLowerCase())) &&
          (!filtrosAplicados.estrategia ||
            (aposta.meta?.estrategia || "Sem estratégia") === filtrosAplicados.estrategia)
        );
      }),
    [apostas, filtrosAplicados]
  );

  const movimentosComDepositosIniciais = useMemo(() => {
    const depositosIniciais: MovimentoFinanceiro[] = bancas.map((banca) => ({
      id: -banca.id,
      bancaId: banca.id,
      bancaNome: banca.nome,
      tipo: "deposito",
      valor: banca.depositado,
      saldoAntes: 0,
      saldoDepois: banca.depositado,
      nota: "Depósito inicial da banca",
      createdAt: new Date(0).toISOString(),
    }));

    return [...depositosIniciais, ...movimentos];
  }, [bancas, movimentos]);

  const movimentosFiltrados = useMemo(() => {
    return movimentosComDepositosIniciais.filter((mov) => {
      const bateBanca =
        !filtrosFinanceirosAplicados.banca ||
        String(mov.bancaId) === filtrosFinanceirosAplicados.banca;
      const bateTipo =
        !filtrosFinanceirosAplicados.tipo || mov.tipo === filtrosFinanceirosAplicados.tipo;

      return bateBanca && bateTipo;
    });
  }, [movimentosComDepositosIniciais, filtrosFinanceirosAplicados]);

  const agendaFiltrada = useMemo(() => {
    return agenda.filter((jogo) => {
      return !agendaStatusFiltro || jogo.status === agendaStatusFiltro;
    });
  }, [agenda, agendaStatusFiltro]);

  const hojeISO = new Date().toLocaleDateString("sv-SE");

  const jogosHoje = useMemo(() => {
    return agenda
      .filter((jogo) => jogo.data === hojeISO && jogo.status !== "finalizado" && jogo.status !== "ignorado")
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
  }, [agenda, hojeISO]);

  const proximosJogosAgenda = useMemo(() => {
    return agenda
      .filter(
        (jogo) =>
          jogo.data >= hojeISO &&
          jogo.status !== "finalizado" &&
          jogo.status !== "ignorado"
      )
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
      .slice(0, 6);
  }, [agenda, hojeISO]);

  const simulacao = useMemo(() => {
    const inicial = Number(simInicial);
    const dias = Number(simDias);
    const oddM = Number(simOddMedia);
    const stakeP = Number(simStake);
    const acertoP = Number(simAcerto);

    if ([inicial, dias, oddM, stakeP, acertoP].some((n) => isNaN(n)) || inicial <= 0 || dias <= 0) {
      return [] as { dia: number; banca: number }[];
    }

    let banca = inicial;
    const pontos = [] as { dia: number; banca: number }[];

    for (let d = 1; d <= Math.min(dias, 365); d++) {
      const stake = banca * (stakeP / 100);
      const ganhoMedio = stake * (oddM - 1) * (acertoP / 100);
      const perdaMedia = stake * (1 - acertoP / 100);
      banca += ganhoMedio - perdaMedia;
      pontos.push({ dia: d, banca });
    }

    return pontos;
  }, [simInicial, simDias, simOddMedia, simStake, simAcerto]);

  const oddsMultipla = calcMultiplasOdds
    .split(",")
    .map((x) => Number(x.trim().replace(",", ".")))
    .filter((n) => !isNaN(n) && n > 1);

  const oddMultiplaTotal = oddsMultipla.reduce((acc, n) => acc * n, 1);
  const retornoMultiplaCalc = oddMultiplaTotal * Number(calcMultiplasStake || 0);
  const lucroMultiplaCalc = retornoMultiplaCalc - Number(calcMultiplasStake || 0);

  const sureTotalNum = Number(sureTotal || 0);
  const sureO1 = Number(sureOdd1 || 0);
  const sureO2 = Number(sureOdd2 || 0);
  const sureProb = sureO1 > 0 && sureO2 > 0 ? 1 / sureO1 + 1 / sureO2 : 0;
  const sureStake1 = sureProb > 0 ? sureTotalNum * ((1 / sureO1) / sureProb) : 0;
  const sureStake2 = sureProb > 0 ? sureTotalNum * ((1 / sureO2) / sureProb) : 0;
  const sureLucro = sureO1 > 0 ? sureStake1 * sureO1 - sureTotalNum : 0;

  const hedgeRetornoEntrada = Number(hedgeStake || 0) * Number(hedgeOddEntrada || 0);
  const hedgeStakeCobertura =
    Number(hedgeOddCobertura || 0) > 0
      ? hedgeRetornoEntrada / Number(hedgeOddCobertura || 0)
      : 0;

  const stakePercentCalc = Number(ferramentaBanca || 0) * (Number(ferramentaStake || 0) / 100);
  const cofreLivre = Math.max(0, bancaAtualGeral - Number(cofreValor || 0));

  const cicloResultado = Array.from({
    length: Math.max(0, Number(cicloEntradas || 0)),
  }).reduce((acc) => Number(acc) * Number(cicloOdd || 1), Number(cicloStakeInicial || 0));

  const martingaleLista = Array.from({
    length: Math.max(0, Number(martingalePerdas || 0) + 1),
  }).map((_, i) => Number(martingaleStake || 0) * Math.pow(2, i));

  const fibonacciSeq = [1, 1, 2, 3, 5, 8, 13, 21].map((n) => n * Number(fibonacciBase || 0));

  const masanielloStakeMedia =
    Number(masanielloEntradas || 0) > 0
      ? Number(masanielloBanca || 0) / Number(masanielloEntradas || 1)
      : 0;

  const masanielloAlvo =
    Number(masanielloEntradas || 0) > 0
      ? (Number(masanielloAcertos || 0) / Number(masanielloEntradas || 1)) * 100
      : 0;

  function aplicarFiltros() {
    setFiltrosAplicados({
      banca: filtroBancaDraft,
      status: filtroStatusDraft,
      liga: filtroLigaDraft,
      mercado: filtroMercadoDraft,
      equipa: filtroEquipaDraft,
      estrategia: filtroEstrategiaDraft,
    });
    setMensagem("Filtros aplicados.");
  }

  function limparFiltros() {
    setFiltroBancaDraft("");
    setFiltroStatusDraft("");
    setFiltroLigaDraft("");
    setFiltroMercadoDraft("");
    setFiltroEquipaDraft("");
    setFiltroEstrategiaDraft("");
    setFiltrosAplicados({
      banca: "",
      status: "",
      liga: "",
      mercado: "",
      equipa: "",
      estrategia: "",
    });
  }

  function aplicarStakeSugerida() {
    if (stakeSugerida <= 0) {
      setMensagem("Escolhe uma banca para calcular stake sugerida.");
      return;
    }

    setValorApostado(stakeSugerida.toFixed(2));
    setMensagem(`Stake sugerida aplicada: ${formatCurrencyBanca(stakeSugerida, bancaSelecionadaId)}.`);
  }

  function exportarBackup() {
    const dados = {
      versao: "Banca Pro v1.0 Release",
      exportadoEm: new Date().toISOString(),
      moeda,
      moedasPorBanca,
      bancas,
      apostas,
      movimentos,
      agenda,
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "banca-pro-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const ligasHistorico = Array.from(
    new Set(apostas.flatMap((a) => a.liga.split("|").map((l) => l.trim()).filter(Boolean)))
  ).sort();

  const estrategiasHistorico = Array.from(
    new Set(apostas.map((a) => a.meta?.estrategia || "Sem estratégia"))
  ).sort();

  function StatCard({
    label,
    value,
    color,
  }: {
    label: string;
    value: string | number;
    color?: string;
  }) {
    return (
      <div
        style={{
          ...cardStyle,
          position: "relative",
          overflow: "hidden",
          minHeight: "118px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0 auto auto 0",
            width: "74px",
            height: "74px",
            background: color || tema.accent,
            opacity: 0.13,
            borderRadius: "0 0 999px 0",
          }}
        />
        <p style={{ margin: 0, color: tema.muted, fontWeight: 900, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <h2 style={{ margin: "14px 0 0", color: color || tema.text, fontSize: "clamp(23px, 3vw, 32px)", letterSpacing: "-0.04em" }}>{value}</h2>
      </div>
    );
  }

  function AlertaBox({
    tipo,
    texto,
  }: {
    tipo: "bom" | "medio" | "ruim";
    texto: string;
  }) {
    const cor = tipo === "bom" ? tema.good : tipo === "ruim" ? tema.bad : tema.warn;

    return (
      <div
        style={{
          background: tema.card2,
          border: `1px solid ${cor}`,
          borderRadius: "14px",
          padding: "12px",
          marginTop: "10px",
          color: tema.text,
          boxShadow: "0 8px 22px rgba(0,0,0,0.14)",
        }}
      >
        {texto}
      </div>
    );
  }


  function AnaliseAutomaticaBox() {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, color: tema.accent, fontSize: "12px", fontWeight: 1000, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              IA automática
            </p>
            <h3 style={{ margin: "6px 0 0", fontSize: "24px", letterSpacing: "-0.045em" }}>Diagnóstico da banca</h3>
          </div>
          <span style={{ ...statusBadgeStyle("pendente"), background: tema.accent }}>Análise viva</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "12px", marginTop: "16px" }}>
          {analiseAutomatica.map((item, index) => {
            const cor = item.tipo === "bom" ? tema.good : item.tipo === "ruim" ? tema.bad : tema.warn;
            return (
              <div
                key={`${item.titulo}-${index}`}
                style={{
                  background: `linear-gradient(135deg, ${cor}18, ${tema.card2})`,
                  border: `1px solid ${cor}`,
                  borderRadius: "18px",
                  padding: "15px",
                  boxShadow: "0 14px 30px rgba(0,0,0,0.16)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
                  <strong style={{ color: tema.text }}>{item.titulo}</strong>
                  <span style={{ color: cor, fontWeight: 1000 }}>{item.tipo === "bom" ? "↗" : item.tipo === "ruim" ? "⚠" : "•"}</span>
                </div>
                <p style={{ color: tema.muted, margin: "8px 0 0", lineHeight: 1.45, fontWeight: 700 }}>{item.descricao}</p>
                {item.metrica && (
                  <p style={{ margin: "10px 0 0", color: cor, fontWeight: 1000, fontSize: "13px" }}>{item.metrica}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function Barra({
    label,
    valor,
    max,
    cor,
  }: {
    label: string;
    valor: number;
    max: number;
    cor?: string;
  }) {
    const largura = max > 0 ? Math.min(100, Math.abs(valor / max) * 100) : 0;

    return (
      <div style={{ marginBottom: "10px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "8px",
            color: tema.muted,
            fontSize: "13px",
          }}
        >
          <span>{label}</span>
          <strong style={{ color: cor || tema.text }}>{valor.toFixed(1)}</strong>
        </div>

        <div
          style={{
            height: "10px",
            background: tema.accent2,
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${largura}%`,
              background: cor || tema.accent,
              borderRadius: "999px",
            }}
          />
        </div>
      </div>
    );
  }


  function corPorNome(nome: string) {
    const cores = [tema.accent, tema.good, tema.warn, "#38bdf8", "#8b5cf6", "#f43f5e", "#14b8a6"];
    const soma = nome
      .split("")
      .reduce((acc, letra) => acc + letra.charCodeAt(0), 0);
    return cores[Math.abs(soma) % cores.length];
  }

  function iniciaisEquipa(nome: string) {
    const limpo = nome
      .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
      .split(" ")
      .filter(Boolean);

    if (limpo.length >= 2) return `${limpo[0][0]}${limpo[1][0]}`.toUpperCase();
    return (nome || "BP").slice(0, 2).toUpperCase();
  }

  function TeamLogo({ nome, size = 42 }: { nome: string; size?: number }) {
    const cor = corPorNome(nome || "Equipa");

    return (
      <div
        title={nome}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.38), transparent 28%), linear-gradient(145deg, ${cor}, ${tema.card2})`,
          border: "1px solid rgba(255,255,255,0.22)",
          boxShadow: `0 12px 28px ${cor}33, inset 0 1px 0 rgba(255,255,255,0.22)`,
          display: "grid",
          placeItems: "center",
          color: "white",
          fontWeight: 1000,
          fontSize: `${Math.max(11, size * 0.34)}px`,
          letterSpacing: "-0.04em",
          textShadow: "0 5px 12px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        {iniciaisEquipa(nome)}
      </div>
    );
  }

  function MatchHeader({
    casa,
    fora,
    hora,
    compact = false,
  }: {
    casa: string;
    fora: string;
    hora?: string;
    compact?: boolean;
  }) {
    const tamanho = compact ? 34 : 48;

    return (
      <div style={{ display: "flex", alignItems: "center", gap: compact ? "8px" : "12px", minWidth: 0 }}>
        <TeamLogo nome={casa} size={tamanho} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <strong style={{ color: tema.text, fontSize: compact ? "14px" : "18px", overflowWrap: "anywhere" }}>{casa}</strong>
            <span style={{ color: tema.muted, fontWeight: 1000 }}>x</span>
            <strong style={{ color: tema.text, fontSize: compact ? "14px" : "18px", overflowWrap: "anywhere" }}>{fora}</strong>
            {hora && <span style={{ color: tema.warn, fontWeight: 1000 }}>· {hora}</span>}
          </div>
        </div>
        <TeamLogo nome={fora} size={tamanho} />
      </div>
    );
  }

  function MercadoSelector() {
    const gruposMercado: { titulo: string; itens: string[]; destaque?: string }[] = (() => {
      const termo = buscaMercado.trim();

      if (termo) {
        return [{ titulo: `🔎 Resultados para "${termo}"`, itens: mercadosVisiveis, destaque: tema.accent }];
      }

      if (mercadoCategoriaAtiva === "Gols") {
        return [
          { titulo: "🟢 Over gols", itens: mercadosVisiveis.filter((m) => m.startsWith("Over ")), destaque: tema.good },
          { titulo: "🔵 Under gols", itens: mercadosVisiveis.filter((m) => m.startsWith("Under ")), destaque: "#38bdf8" },
          { titulo: "⚽ Outros gols", itens: mercadosVisiveis.filter((m) => !m.startsWith("Over ") && !m.startsWith("Under ")), destaque: tema.accent },
        ].filter((grupo) => grupo.itens.length > 0);
      }

      if (mercadoCategoriaAtiva === "Gols equipa") {
        return [
          { titulo: "🏠 Casa over", itens: mercadosVisiveis.filter((m) => m.startsWith("Casa over")), destaque: tema.good },
          { titulo: "🏠 Casa under", itens: mercadosVisiveis.filter((m) => m.startsWith("Casa under")), destaque: "#38bdf8" },
          { titulo: "🚌 Fora over", itens: mercadosVisiveis.filter((m) => m.startsWith("Fora over")), destaque: tema.good },
          { titulo: "🚌 Fora under", itens: mercadosVisiveis.filter((m) => m.startsWith("Fora under")), destaque: "#38bdf8" },
          {
            titulo: "⚽ Outros mercados de equipa",
            itens: mercadosVisiveis.filter(
              (m) =>
                !m.startsWith("Casa over") &&
                !m.startsWith("Casa under") &&
                !m.startsWith("Fora over") &&
                !m.startsWith("Fora under")
            ),
            destaque: tema.accent,
          },
        ].filter((grupo) => grupo.itens.length > 0);
      }

      if (mercadoCategoriaAtiva === "Combinações") {
        return [
          {
            titulo: "🟢 Dupla hipótese + Over",
            itens: mercadosVisiveis.filter((m) => m.includes(" ou ") && m.includes("over")),
            destaque: tema.good,
          },
          {
            titulo: "🔵 Dupla hipótese + Under",
            itens: mercadosVisiveis.filter((m) => m.includes(" ou ") && m.includes("under")),
            destaque: "#38bdf8",
          },
          {
            titulo: "🏆 Vitória + Over",
            itens: mercadosVisiveis.filter((m) => m.includes("vence e over")),
            destaque: tema.good,
          },
          {
            titulo: "🛡️ Vitória + Under",
            itens: mercadosVisiveis.filter((m) => m.includes("vence e under")),
            destaque: "#38bdf8",
          },
          {
            titulo: "⚽ Ambas marcam / outros",
            itens: mercadosVisiveis.filter(
              (m) =>
                !m.includes(" ou ") &&
                !m.includes("vence e over") &&
                !m.includes("vence e under")
            ),
            destaque: tema.accent,
          },
        ].filter((grupo) => grupo.itens.length > 0);
      }

      if (mercadoCategoriaAtiva === "Cantos" || mercadoCategoriaAtiva === "Cartões") {
        return [
          { titulo: "🟢 Mais de", itens: mercadosVisiveis.filter((m) => m.startsWith("Mais de")), destaque: tema.good },
          { titulo: "🔵 Menos de", itens: mercadosVisiveis.filter((m) => m.startsWith("Menos de")), destaque: "#38bdf8" },
          { titulo: "🏠 Casa", itens: mercadosVisiveis.filter((m) => m.startsWith("Casa ")), destaque: tema.accent },
          { titulo: "🚌 Fora", itens: mercadosVisiveis.filter((m) => m.startsWith("Fora ")), destaque: tema.warn },
          {
            titulo: "📌 Outros",
            itens: mercadosVisiveis.filter(
              (m) =>
                !m.startsWith("Mais de") &&
                !m.startsWith("Menos de") &&
                !m.startsWith("Casa ") &&
                !m.startsWith("Fora ")
            ),
            destaque: tema.accent,
          },
        ].filter((grupo) => grupo.itens.length > 0);
      }

      return [{ titulo: mercadoCategoriaAtiva, itens: mercadosVisiveis, destaque: tema.accent }];
    })();

    return (
      <div
        style={{
          gridColumn: "1 / -1",
          background: `linear-gradient(145deg, ${tema.card2}, ${tema.input})`,
          border: `1px solid ${tema.border}`,
          borderRadius: "22px",
          padding: "18px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🎯 Mercado da seleção</h3>

        <input
          type="text"
          placeholder="Pesquisar mercado..."
          value={buscaMercado}
          onChange={(e) => setBuscaMercado(e.target.value)}
          style={{ ...inputStyle, marginBottom: "12px" }}
        />

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
          {categoriasMercado.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setMercadoCategoriaAtiva(cat);
                setBuscaMercado("");
              }}
              style={{
                ...chipStyle,
                background: mercadoCategoriaAtiva === cat ? tema.accent : tema.accent2,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          {gruposMercado.map((grupo) => (
            <div
              key={grupo.titulo}
              style={{
                background: temaNome === "claro" ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${tema.border}`,
                borderRadius: "18px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                <strong style={{ color: grupo.destaque || tema.accent, fontSize: "14px" }}>
                  {grupo.titulo}
                </strong>
                <span
                  style={{
                    fontSize: "12px",
                    color: tema.muted,
                    fontWeight: 900,
                    padding: "4px 8px",
                    borderRadius: "999px",
                    background: tema.accent2,
                    border: `1px solid ${tema.border}`,
                  }}
                >
                  {grupo.itens.length} opções
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: "8px",
                }}
              >
                {grupo.itens.map((item) => (
                  <button
                    key={item}
                    onClick={() => setMercado(item)}
                    style={{
                      padding: "13px",
                      borderRadius: "16px",
                      border: mercado === item ? `1px solid ${grupo.destaque || tema.accent}` : `1px solid ${tema.border}`,
                      background:
                        mercado === item
                          ? `linear-gradient(135deg, ${grupo.destaque || tema.accent}, #6d28d9)`
                          : `linear-gradient(180deg, ${tema.accent2}, ${tema.card2})`,
                      color: tema.text,
                      cursor: "pointer",
                      fontWeight: 900,
                      textAlign: "left",
                      minHeight: "48px",
                      boxShadow: mercado === item
                        ? `0 14px 30px ${(grupo.destaque || tema.accent)}44`
                        : "0 8px 18px rgba(0,0,0,0.16)",
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ marginBottom: 0, marginTop: "12px", color: tema.muted }}>
          Mercado escolhido: <strong style={{ color: tema.text }}>{mercado || "Nenhum"}</strong>
        </p>
      </div>
    );
  }


  function MiniGraficoLinha({
    titulo,
    dados,
    formato = "moeda",
  }: {
    titulo: string;
    dados: { label: string; valor: number }[];
    formato?: "moeda" | "percentual";
  }) {
    const largura = 640;
    const altura = 180;
    const padding = 22;
    const valores = dados.length ? dados.map((d) => d.valor) : [0];
    const min = Math.min(...valores, 0);
    const max = Math.max(...valores, 1);
    const range = max - min || 1;

    const pontos = dados.map((d, index) => {
      const x =
        padding +
        (dados.length <= 1 ? 0 : (index / (dados.length - 1)) * (largura - padding * 2));
      const y = altura - padding - ((d.valor - min) / range) * (altura - padding * 2);
      return { ...d, x, y };
    });

    const path = pontos.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const ultimo = pontos[pontos.length - 1];
    const cor = (ultimo?.valor ?? 0) >= 0 ? tema.good : tema.bad;

    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 6px" }}>{titulo}</h3>
            <p style={{ margin: 0, color: tema.muted, fontWeight: 800 }}>
              Último valor:{" "}
              <strong style={{ color: cor }}>
                {formato === "percentual"
                  ? `${(ultimo?.valor ?? 0).toFixed(1)}%`
                  : formatCurrency(ultimo?.valor ?? 0)}
              </strong>
            </p>
          </div>
          <span
            style={{
              padding: "8px 12px",
              borderRadius: "999px",
              background: cor,
              color: "white",
              fontWeight: 900,
              fontSize: "12px",
              textTransform: "uppercase",
            }}
          >
            {(ultimo?.valor ?? 0) >= 0 ? "positivo" : "atenção"}
          </span>
        </div>

        <div style={{ width: "100%", overflowX: "auto", marginTop: "14px" }}>
          <svg viewBox={`0 0 ${largura} ${altura}`} style={{ width: "100%", minWidth: "420px", display: "block" }}>
            <defs>
              <linearGradient id={`grad-${titulo.replace(/\s/g, "")}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor={tema.accent} />
                <stop offset="100%" stopColor={cor} />
              </linearGradient>
            </defs>

            {[0, 1, 2, 3].map((linha) => {
              const y = padding + linha * ((altura - padding * 2) / 3);
              return (
                <line
                  key={linha}
                  x1={padding}
                  y1={y}
                  x2={largura - padding}
                  y2={y}
                  stroke={tema.border}
                  strokeOpacity="0.45"
                  strokeDasharray="5 7"
                />
              );
            })}

            <line
              x1={padding}
              y1={altura - padding - ((0 - min) / range) * (altura - padding * 2)}
              x2={largura - padding}
              y2={altura - padding - ((0 - min) / range) * (altura - padding * 2)}
              stroke={tema.muted}
              strokeOpacity="0.32"
            />

            <path
              d={path}
              fill="none"
              stroke={`url(#grad-${titulo.replace(/\s/g, "")})`}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {pontos.map((p, index) => (
              <g key={`${p.label}-${index}`}>
                <circle cx={p.x} cy={p.y} r="5" fill={p.valor >= 0 ? tema.good : tema.bad} stroke={tema.card} strokeWidth="3" />
                {index % 2 === 0 && (
                  <text x={p.x} y={altura - 4} textAnchor="middle" fill={tema.muted} fontSize="11" fontWeight="800">
                    {p.label}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  }

  function GraficoBarrasResultado({
    titulo,
    dados,
  }: {
    titulo: string;
    dados: { label: string; valor: number }[];
  }) {
    const max = Math.max(1, ...dados.map((d) => Math.abs(d.valor)));

    return (
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>{titulo}</h3>
        <div style={{ display: "grid", gap: "12px" }}>
          {dados.map((item) => {
            const positivo = item.valor >= 0;
            return (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", color: tema.muted, fontWeight: 800, fontSize: "13px" }}>
                  <span>{item.label}</span>
                  <strong style={{ color: positivo ? tema.good : tema.bad }}>{formatCurrency(item.valor)}</strong>
                </div>
                <div style={{ height: "12px", background: tema.accent2, borderRadius: "999px", overflow: "hidden", border: `1px solid ${tema.border}`, marginTop: "6px" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (Math.abs(item.valor) / max) * 100)}%`,
                      background: positivo ? `linear-gradient(90deg, ${tema.good}, ${tema.accent})` : `linear-gradient(90deg, ${tema.bad}, ${tema.warn})`,
                      borderRadius: "999px",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function RankingBox({
    titulo,
    lista,
  }: {
    titulo: string;
    lista: ReturnType<typeof rankingPorCampo>;
  }) {
    const max = Math.max(1, ...lista.slice(0, 8).map((x) => Math.abs(x.roi)));

    return (
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>{titulo}</h3>

        {lista.length === 0 ? (
          <p style={{ color: tema.muted }}>Sem dados ainda.</p>
        ) : (
          lista.slice(0, 8).map((x) => (
            <div
              key={x.nome}
              style={{
                background: tema.card2,
                border: `1px solid ${tema.border}`,
                borderRadius: "14px",
                padding: "12px",
                marginBottom: "10px",
              }}
            >
              <strong>{x.nome}</strong>
              <p style={{ color: tema.muted, margin: "6px 0" }}>
                Usos: {x.total} · Green: {x.greens} · Red: {x.reds} · Taxa:{" "}
                {x.taxa.toFixed(1)}%
              </p>
              <Barra label="ROI" valor={x.roi} max={max} cor={x.roi >= 0 ? tema.good : tema.bad} />
            </div>
          ))
        )}
      </div>
    );
  }

  function ListaApostas({ somenteFiltradas = false }: { somenteFiltradas?: boolean }) {
    const lista = somenteFiltradas ? apostasFiltradas : apostas;

    return (
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>
          {somenteFiltradas ? `Apostas filtradas (${lista.length})` : "Apostas registradas"}
        </h3>

        {lista.length === 0 ? (
          <p style={{ color: tema.muted }}>Nenhuma aposta encontrada.</p>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {lista.map((aposta) => {
              const i = interpretarMercadoSalvo(aposta.mercado);

              return (
                <div
                  key={aposta.id}
                  style={{
                    ...fundoStatusAposta(aposta.status),
                    borderRadius: "22px",
                    padding: 0,
                    overflow: "hidden",
                    transition: "0.2s ease",
                    boxShadow: `0 20px 46px ${corStatus(aposta.status)}22`,
                  }}
                >
                  <div style={{ background: `linear-gradient(135deg, ${corStatus(aposta.status)}24, ${tema.card2})`, padding: modoCompacto ? "14px" : "18px", borderBottom: `1px solid ${tema.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                      {i.isMultipla ? (
                        <h4 style={{ margin: 0, fontSize: "20px", letterSpacing: "-0.04em" }}>🎟️ Múltiplos mercados / cartela</h4>
                      ) : (
                        <MatchHeader casa={aposta.casa} fora={aposta.fora} />
                      )}
                      <span style={statusBadgeStyle(aposta.status)}>{aposta.status}</span>
                    </div>
                    <p style={{ color: tema.muted, margin: "8px 0 0", fontWeight: 800 }}>
                      Banca: <strong style={{ color: tema.text }}>{aposta.bancaNome}</strong> · Liga: <strong style={{ color: tema.text }}>{aposta.liga}</strong>
                    </p>
                  </div>
                  <div style={{ padding: modoCompacto ? "14px" : "18px" }}>

                  <p>
                    Estratégia: <strong>{aposta.meta?.estrategia || "Sem estratégia"}</strong> ·
                    Confiança: {"⭐".repeat(Number(aposta.meta?.confianca || 3))} · Emoção:{" "}
                    {aposta.meta?.emocao || "calmo"}
                  </p>

                  {aposta.meta?.analisePre && (
                    <p style={{ color: tema.muted }}>Análise: {aposta.meta.analisePre}</p>
                  )}

                  {i.selecoes.length > 0 ? (
                    <div style={{ display: "grid", gap: "10px" }}>
                      {i.selecoes.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            ...fundoStatusAposta(s.status),
                            borderRadius: "14px",
                            padding: "12px",
                          }}
                        >
                          <MatchHeader casa={s.casa} fora={s.fora} compact />
                          <p style={{ color: tema.muted }}>{s.liga}</p>
                          <p>
                            Mercado: {s.mercado} · Odd {s.odd.toFixed(2)}
                          </p>
                          <p>
                            Status: <span style={statusBadgeStyle(s.status)}>{s.status}</span>
                          </p>

                          {s.status === "red" && (
                            <p style={{ color: "#fca5a5" }}>
                              Motivo red: {s.motivoRed || "Não informado"}
                            </p>
                          )}

                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            <button
                              onClick={() => atualizarSelecaoSalva(aposta, s.id, "pendente")}
                              style={{ ...smallButtonStyle, background: "#475569" }}
                            >
                              Pendente
                            </button>

                            <button
                              onClick={() => atualizarSelecaoSalva(aposta, s.id, "green")}
                              style={{ ...smallButtonStyle, background: tema.good }}
                            >
                              Green
                            </button>

                            <select
                              onChange={(e) =>
                                e.target.value &&
                                atualizarSelecaoSalva(aposta, s.id, "red", e.target.value)
                              }
                              value=""
                              style={{ ...inputStyle, width: "220px", padding: "8px 10px" }}
                            >
                              <option value="">Red com motivo</option>
                              {motivosRedBase.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Mercado: {i.mercadoVisual}</p>
                  )}

                  <p>
                    Odd total: {aposta.odd.toFixed(2)} · Valor:{" "}
                    {formatCurrencyBanca(aposta.valor, aposta.bancaId)} · Retorno:{" "}
                    {formatCurrencyBanca(aposta.retornoEsperado, aposta.bancaId)}
                  </p>

                  <p>
                    Lucro real:{" "}
                    <strong style={{ color: calcularLucroAposta(aposta) >= 0 ? tema.good : tema.bad }}>
                      {formatCurrencyBanca(calcularLucroAposta(aposta), aposta.bancaId)}
                    </strong>{" "}
                    · Data: {aposta.createdAt}
                  </p>

                  <p>
                    Status geral: <span style={statusBadgeStyle(aposta.status)}>{aposta.status}</span>
                    {aposta.status === "cash_out"
                      ? ` · Cash out: ${formatCurrencyBanca(aposta.valorCashOut ?? 0, aposta.bancaId)}`
                      : ""}
                  </p>

                  {cashOutEditandoId === aposta.id && (
                    <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Valor recebido no cash out"
                        value={cashOutEditandoValor}
                        onChange={(e) => setCashOutEditandoValor(e.target.value)}
                        style={inputStyle}
                      />

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => confirmarCashOut(aposta)}
                          style={{ ...smallButtonStyle, background: tema.warn }}
                        >
                          Confirmar cash out
                        </button>

                        <button
                          onClick={() => {
                            setCashOutEditandoId(null);
                            setCashOutEditandoValor("");
                          }}
                          style={{ ...smallButtonStyle, background: "#475569" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                    <button
                      onClick={() => atualizarStatusAposta(aposta, "pendente")}
                      style={{ ...smallButtonStyle, background: "#475569" }}
                    >
                      Pendente geral
                    </button>

                    <button
                      onClick={() => atualizarStatusAposta(aposta, "green")}
                      style={{ ...smallButtonStyle, background: tema.good }}
                    >
                      Fechar Green
                    </button>

                    <button
                      onClick={() => atualizarStatusAposta(aposta, "red")}
                      style={{ ...smallButtonStyle, background: tema.bad }}
                    >
                      Fechar Red
                    </button>

                    <button
                      onClick={() => atualizarStatusAposta(aposta, "cash_out")}
                      style={{ ...smallButtonStyle, background: tema.warn }}
                    >
                      Cash Out
                    </button>

                    <button
                      onClick={() => apagarAposta(aposta.id)}
                      style={{
                        ...smallButtonStyle,
                        background: tema.accent2,
                        border: `1px solid ${tema.border}`,
                      }}
                    >
                      Apagar
                    </button>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(circle at top, ${tema.accent}28, transparent 32%), ${tema.bg}`,
          color: tema.text,
          display: "grid",
          placeItems: "center",
          padding: "24px",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <style>{`
          @keyframes bpSpin { to { transform: rotate(360deg); } }
          @keyframes bpFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        <div
          style={{
            ...cardStyle,
            width: "100%",
            maxWidth: "390px",
            textAlign: "center",
            animation: "bpFadeUp 0.35s ease both",
          }}
        >
          <div
            style={{
              width: "76px",
              height: "76px",
              margin: "0 auto 18px",
              borderRadius: "24px",
              background: `conic-gradient(from 0deg, ${tema.accent}, ${tema.good}, ${tema.accent})`,
              display: "grid",
              placeItems: "center",
              animation: "bpSpin 1.2s linear infinite",
              boxShadow: `0 18px 45px ${tema.accent}44`,
            }}
          >
            <div
              style={{
                width: "58px",
                height: "58px",
                borderRadius: "19px",
                background: tema.card,
                display: "grid",
                placeItems: "center",
                fontWeight: 1000,
                color: tema.text,
              }}
            >
              BP
            </div>
          </div>
          <h2 style={{ margin: 0, letterSpacing: "-0.04em" }}>A preparar o Banca Pro</h2>
          <p style={{ color: tema.muted, fontWeight: 800 }}>A carregar sessão, bancas e apostas...</p>
        </div>
      </div>
    );
  }

  if (isRecovery) {
    return (
      <div style={{ minHeight: "100vh", background: tema.bg, display: "grid", placeItems: "center", padding: "20px" }}>
        <div style={{ ...cardStyle, width: "100%", maxWidth: "420px", color: tema.text }}>
          <h1>🔐 Nova senha</h1>
          <input type="password" placeholder="Nova senha" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} style={inputStyle} />
          <button onClick={atualizarNovaSenha} style={{ ...smallButtonStyle, width: "100%", marginTop: "12px", background: tema.accent }}>
            Guardar nova senha
          </button>
          {mensagemRecovery && <p style={{ color: tema.muted }}>{mensagemRecovery}</p>}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            temaNome === "claro"
              ? "radial-gradient(circle at 20% 10%, rgba(249,115,22,0.18), transparent 32%), radial-gradient(circle at 80% 20%, rgba(34,197,94,0.12), transparent 28%), #eef2ff"
              : `radial-gradient(circle at 18% 8%, ${tema.accent}33, transparent 34%), radial-gradient(circle at 86% 22%, ${tema.good}1f, transparent 28%), linear-gradient(180deg, ${tema.bg}, #02030a)`,
          display: "grid",
          placeItems: "center",
          padding: "20px",
          color: tema.text,
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <style>{globalCss}</style>
        <div
          className="bp-login-grid"
          style={{
            width: "100%",
            maxWidth: "980px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "18px",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              ...cardStyle,
              minHeight: "520px",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: "-120px",
                top: "-120px",
                width: "320px",
                height: "320px",
                borderRadius: "999px",
                background: `radial-gradient(circle, ${tema.accent}44, transparent 70%)`,
              }}
            />
            <div>
              <div
                style={{
                  width: "98px",
                  height: "98px",
                  borderRadius: "30px",
                  background: `linear-gradient(145deg, ${tema.good}, ${tema.accent})`,
                  boxShadow: `0 26px 60px ${tema.accent}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
                  display: "grid",
                  placeItems: "center",
                  position: "relative",
                  overflow: "hidden",
                  marginBottom: "24px",
                }}
              >
                <div style={{ position: "absolute", inset: "9px", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.30)" }} />
                <span style={{ color: "white", fontSize: "38px", fontWeight: 1000, letterSpacing: "-0.08em", textShadow: "0 12px 24px rgba(0,0,0,0.34)" }}>
                  BP
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "clamp(48px, 7vw, 72px)", lineHeight: 0.86, letterSpacing: "-0.085em", color: tema.text, fontWeight: 1000 }}>
                  Banca
                </h1>
                <h1 style={{ margin: 0, fontSize: "clamp(48px, 7vw, 72px)", lineHeight: 0.86, letterSpacing: "-0.085em", color: tema.accent, fontWeight: 1000, textShadow: `0 0 34px ${tema.accent}66` }}>
                  Pro
                </h1>
              </div>
              <p style={{ color: tema.muted, fontSize: "18px", fontWeight: 900, lineHeight: 1.45, marginTop: "18px" }}>
                Gestão premium de bancas, apostas, agenda, filtros, lucro real e leitura de risco.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
              {["🛡️ Controle de banca", "📊 ROI e lucro", "📅 Agenda de jogos", "🧠 Alertas inteligentes"].map((item) => (
                <div key={item} style={{ background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "18px", padding: "14px", fontWeight: 900 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...cardStyle, width: "100%", color: tema.text, alignSelf: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ textAlign: "center", marginBottom: "25px" }}>
              <p style={{ margin: 0, color: tema.accent, fontWeight: 1000, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "12px" }}>
                Acesso seguro
              </p>
              <h2 style={{ margin: "8px 0 0", fontSize: "32px", letterSpacing: "-0.05em" }}>
                {isCadastro ? "Criar conta" : "Entrar no Banca Pro"}
              </h2>
              <p style={{ color: tema.muted, marginTop: "10px", fontWeight: 800 }}>
                Continua a tua gestão com visual profissional.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px", padding: "6px", borderRadius: "18px", background: tema.card2, border: `1px solid ${tema.border}` }}>
              <button onClick={() => setIsCadastro(false)} style={{ ...smallButtonStyle, flex: 1, padding: "12px", background: !isCadastro ? `linear-gradient(135deg, ${tema.accent}, #6d28d9)` : "transparent", boxShadow: !isCadastro ? smallButtonStyle.boxShadow : "none" }}>
                Entrar
              </button>
              <button onClick={() => setIsCadastro(true)} style={{ ...smallButtonStyle, flex: 1, padding: "12px", background: isCadastro ? `linear-gradient(135deg, ${tema.accent}, #6d28d9)` : "transparent", boxShadow: isCadastro ? smallButtonStyle.boxShadow : "none" }}>
                Cadastrar
              </button>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} style={inputStyle} />

              {isCadastro && (
                <input type="text" placeholder="Telefone (opcional)" value={telefone} onChange={(e) => setTelefone(e.target.value)} style={inputStyle} />
              )}

              {!isCadastro ? (
                <>
                  <button onClick={entrar} style={{ ...smallButtonStyle, padding: "15px", background: `linear-gradient(135deg, ${tema.accent}, #6d28d9)`, fontSize: "15px" }}>Entrar agora</button>
                  <button onClick={recuperarSenha} style={{ ...smallButtonStyle, padding: "12px", background: tema.accent2, border: `1px solid ${tema.border}` }}>
                    Esqueci a senha
                  </button>
                </>
              ) : (
                <button onClick={cadastrar} style={{ ...smallButtonStyle, padding: "15px", background: `linear-gradient(135deg, ${tema.good}, ${tema.accent})`, fontSize: "15px" }}>
                  Criar conta
                </button>
              )}
            </div>

            {mensagem && <p style={{ marginTop: "18px", color: tema.muted, textAlign: "center", fontSize: "14px", fontWeight: 800 }}>{mensagem}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bp-shell"
      style={{
        minHeight: "100vh",
        background:
          temaNome === "claro"
            ? `radial-gradient(circle at top left, rgba(249,115,22,0.15), transparent 34%), ${tema.bg}`
            : `radial-gradient(circle at top left, ${tema.accent}28, transparent 30%), radial-gradient(circle at 88% 10%, ${tema.good}14, transparent 24%), linear-gradient(180deg, ${tema.bg}, #030409)`,
        color: tema.text,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        padding: "24px",
      }}
    >
      <style>{globalCss}</style>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div
          className="bp-brand-card"
          style={{
            ...cardStyle,
            borderRadius: "28px",
            padding: "24px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-90px",
              top: "-120px",
              width: "300px",
              height: "300px",
              borderRadius: "999px",
              background: `radial-gradient(circle, ${tema.accent}38, transparent 68%)`,
              pointerEvents: "none",
            }}
          />
          <div onClick={() => setTela("inicio")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "18px", minWidth: 0 }}>
            <div
              style={{
                width: "76px",
                height: "76px",
                borderRadius: "24px",
                background: `linear-gradient(145deg, ${tema.good}, ${tema.accent})`,
                boxShadow: `0 20px 46px ${tema.accent}55, inset 0 1px 0 rgba(255,255,255,0.32)`,
                display: "grid",
                placeItems: "center",
                position: "relative",
                overflow: "hidden",
                flex: "0 0 auto",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "7px",
                  borderRadius: "20px",
                  border: "1px solid rgba(255,255,255,0.28)",
                }}
              />
              <span
                style={{
                  position: "relative",
                  color: "#ffffff",
                  fontSize: "28px",
                  fontWeight: 1000,
                  letterSpacing: "-0.08em",
                  textShadow: "0 8px 18px rgba(0,0,0,0.35)",
                }}
              >
                BP
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                <h1
                  className="bp-brand-title"
                  style={{
                    margin: 0,
                    fontSize: "46px",
                    letterSpacing: "-0.075em",
                    lineHeight: 0.92,
                    color: tema.text,
                    fontWeight: 1000,
                    textShadow: temaNome === "claro" ? "none" : "0 12px 34px rgba(0,0,0,0.45)",
                  }}
                >
                  Banca
                </h1>
                <h1
                  className="bp-brand-title"
                  style={{
                    margin: 0,
                    fontSize: "46px",
                    letterSpacing: "-0.075em",
                    lineHeight: 0.92,
                    color: tema.accent,
                    fontWeight: 1000,
                    textShadow: `0 0 28px ${tema.accent}55`,
                  }}
                >
                  Pro
                </h1>
              </div>
              <p style={{ margin: "9px 0 0", color: tema.muted, fontWeight: 900, overflowWrap: "anywhere" }}>
                Gestão premium de banca · {user.email}
              </p>
            </div>
          </div>

          <button onClick={sair} style={{ ...smallButtonStyle, padding: "13px 20px", background: `linear-gradient(135deg, ${tema.accent}, #6d28d9)` }}>
            Sair
          </button>
        </div>

        <div className="bp-nav" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px", position: "sticky", top: "10px", zIndex: 20, padding: "8px", borderRadius: "18px", background: temaNome === "claro" ? "rgba(255,255,255,0.80)" : "rgba(3,4,9,0.70)", backdropFilter: "blur(18px)", border: `1px solid ${tema.border}` }}>
          {[
            ["inicio", "Início"],
            ["bancas", "Gestão de Bancas"],
            ["financeiro", "Financeiro"],
            ["agenda", "Agenda"],
            ["ferramentas", "Ferramentas"],
            ["apostas", "Registro de Apostas"],
            ["historico", "Histórico/IA"],
            ["config", "Configurações"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTela(v as TelaInterna)}
              style={{
                padding: "11px 15px",
                borderRadius: "14px",
                border: tela === v ? `1px solid ${tema.accent}` : `1px solid ${tema.border}`,
                background: tela === v ? `linear-gradient(135deg, ${tema.accent}, #6d28d9)` : `linear-gradient(180deg, ${tema.accent2}, ${tema.card2})`,
                color: tema.text,
                cursor: "pointer",
                fontWeight: 900,
                boxShadow: tela === v ? `0 14px 30px ${tema.accent}42` : "0 10px 20px rgba(0,0,0,0.16)",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {mensagem && (
          <div style={{ background: `linear-gradient(135deg, ${tema.accent2}, ${tema.card2})`, border: `1px solid ${tema.border}`, borderRadius: "18px", padding: "13px 16px", marginBottom: "18px", color: tema.text, fontWeight: 800, boxShadow: "0 14px 30px rgba(0,0,0,0.18)" }}>
            {mensagem}
          </div>
        )}

        {tela === "inicio" && (
          <div style={{ display: "grid", gap: "20px" }}>
            {jogosHoje.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>🔔 Jogos marcados para hoje</h2>
                <div style={{ display: "grid", gap: "10px" }}>
                  {jogosHoje.map((jogo) => (
                    <div key={jogo.id} style={{ background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "14px", padding: "12px" }}>
                      <MatchHeader casa={jogo.casa} fora={jogo.fora} hora={jogo.hora} compact />
                      <p style={{ color: tema.muted, marginBottom: 0 }}>
                        {jogo.liga} · {jogo.mercadoPretendido || "Sem mercado definido"} · {"⭐".repeat(jogo.confianca)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {proximosJogosAgenda.length > 0 && (
              <div style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>📅 Próximos jogos da agenda</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "12px" }}>
                  {proximosJogosAgenda.map((jogo) => (
                    <div key={jogo.id} style={{ background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "16px", padding: "14px" }}>
                      <MatchHeader casa={jogo.casa} fora={jogo.fora} compact />
                      <p style={{ color: tema.muted, margin: "8px 0 0" }}>
                        {jogo.liga} · {new Date(`${jogo.data}T${jogo.hora || "00:00"}`).toLocaleDateString("pt-PT")} às {jogo.hora}
                      </p>
                      <p style={{ color: tema.muted, marginBottom: 0 }}>
                        {jogo.mercadoPretendido || "Sem mercado definido"} · {"⭐".repeat(jogo.confianca)} · {jogo.status}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                ...cardStyle,
                padding: modoCompacto ? "18px" : "26px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: "-80px",
                  top: "-90px",
                  width: "260px",
                  height: "260px",
                  borderRadius: "999px",
                  background: `radial-gradient(circle, ${tema.accent}30, transparent 70%)`,
                  pointerEvents: "none",
                }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "flex-start", position: "relative" }}>
                <div>
                  <p style={{ margin: 0, color: tema.accent, fontWeight: 1000, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "12px" }}>
                    Dashboard inteligente
                  </p>
                  <h2 style={{ margin: "8px 0 8px", fontSize: "clamp(26px, 4vw, 44px)", letterSpacing: "-0.065em", lineHeight: 0.95 }}>
                    Centro de comando da banca
                  </h2>
                  <p style={{ margin: 0, color: tema.muted, fontWeight: 800 }}>
                    Lucro, ROI, acerto, tendências e alertas resumidos num painel rápido.
                  </p>
                </div>

                <div
                  style={{
                    minWidth: "190px",
                    padding: "14px 16px",
                    borderRadius: "18px",
                    background: lucroTotalGeral >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    border: `1px solid ${lucroTotalGeral >= 0 ? tema.good : tema.bad}`,
                    textAlign: "right",
                  }}
                >
                  <p style={{ margin: 0, color: tema.muted, fontWeight: 900, fontSize: "12px", textTransform: "uppercase" }}>Resultado total</p>
                  <strong style={{ color: lucroTotalGeral >= 0 ? tema.good : tema.bad, fontSize: "28px", letterSpacing: "-0.05em" }}>
                    {formatCurrency(lucroTotalGeral)}
                  </strong>
                  <p style={{ margin: "4px 0 0", color: tema.muted, fontWeight: 800 }}>ROI {roiGeral.toFixed(1)}%</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginTop: "18px", position: "relative" }}>
                {[
                  ["Hoje", dashboardInteligente.hoje],
                  ["7 dias", dashboardInteligente.semana],
                  ["Este mês", dashboardInteligente.mes],
                ].map(([label, dados]) => {
                  const d = dados as { total: number; valor: number; lucro: number; roi: number; taxa: number };
                  return (
                    <div key={String(label)} style={{ background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "18px", padding: "16px" }}>
                      <p style={{ margin: 0, color: tema.muted, fontWeight: 900, fontSize: "12px", textTransform: "uppercase" }}>{String(label)}</p>
                      <h3 style={{ margin: "8px 0", color: d.lucro >= 0 ? tema.good : tema.bad, fontSize: "25px", letterSpacing: "-0.04em" }}>
                        {formatCurrency(d.lucro)}
                      </h3>
                      <p style={{ margin: 0, color: tema.muted, fontWeight: 800 }}>
                        {d.total} aposta(s) · ROI {d.roi.toFixed(1)}% · Acerto {d.taxa.toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "12px", position: "relative" }}>
                <div style={{ background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "18px", padding: "16px" }}>
                  <p style={{ margin: 0, color: tema.muted, fontWeight: 900, fontSize: "12px", textTransform: "uppercase" }}>Melhor mercado</p>
                  <h3 style={{ margin: "8px 0", color: tema.good }}>{dashboardInteligente.melhorMercado?.nome || "Sem dados"}</h3>
                  <p style={{ margin: 0, color: tema.muted }}>
                    {dashboardInteligente.melhorMercado ? `${dashboardInteligente.melhorMercado.total} usos · ROI ${dashboardInteligente.melhorMercado.roi.toFixed(1)}% · Taxa ${dashboardInteligente.melhorMercado.taxa.toFixed(1)}%` : "Registra mais apostas para analisar."}
                  </p>
                </div>

                <div style={{ background: tema.card2, border: `1px solid ${dashboardInteligente.piorMercado ? tema.bad : tema.border}`, borderRadius: "18px", padding: "16px" }}>
                  <p style={{ margin: 0, color: tema.muted, fontWeight: 900, fontSize: "12px", textTransform: "uppercase" }}>Mercado de atenção</p>
                  <h3 style={{ margin: "8px 0", color: dashboardInteligente.piorMercado ? tema.bad : tema.text }}>{dashboardInteligente.piorMercado?.nome || "Sem risco claro"}</h3>
                  <p style={{ margin: 0, color: tema.muted }}>
                    {dashboardInteligente.piorMercado ? `${dashboardInteligente.piorMercado.total} usos · ROI ${dashboardInteligente.piorMercado.roi.toFixed(1)}%` : "Ainda não há padrão negativo suficiente."}
                  </p>
                </div>

                <div style={{ background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "18px", padding: "16px" }}>
                  <p style={{ margin: 0, color: tema.muted, fontWeight: 900, fontSize: "12px", textTransform: "uppercase" }}>Melhor liga/horário</p>
                  <h3 style={{ margin: "8px 0" }}>{dashboardInteligente.melhorLiga?.nome || "Sem dados"}</h3>
                  <p style={{ margin: 0, color: tema.muted }}>
                    Horário forte: <strong style={{ color: tema.text }}>{dashboardInteligente.melhorHorario?.nome || "Sem dados"}</strong>
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "16px", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", color: tema.muted, fontWeight: 900, fontSize: "13px" }}>
                  <span>Progresso médio das metas</span>
                  <span style={{ color: tema.text }}>{dashboardInteligente.progressoMetaGeral.toFixed(1)}%</span>
                </div>
                <div style={{ height: "12px", marginTop: "8px", borderRadius: "999px", background: tema.accent2, border: `1px solid ${tema.border}`, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, dashboardInteligente.progressoMetaGeral)}%`, borderRadius: "999px", background: `linear-gradient(90deg, ${tema.accent}, ${tema.good})` }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(28px, 1fr))", gap: "8px", alignItems: "end", marginTop: "18px", minHeight: "96px", position: "relative" }}>
                {dashboardInteligente.ultimos7Dias.map((item) => {
                  const maxLucro = Math.max(1, ...dashboardInteligente.ultimos7Dias.map((d) => Math.abs(d.lucro)));
                  const altura = Math.max(8, Math.min(86, (Math.abs(item.lucro) / maxLucro) * 86));
                  return (
                    <div key={item.dia} style={{ display: "grid", gap: "6px", alignItems: "end" }}>
                      <div title={`${item.dia}: ${formatCurrency(item.lucro)}`} style={{ height: `${altura}px`, borderRadius: "999px 999px 8px 8px", background: item.lucro >= 0 ? tema.good : tema.bad, opacity: item.lucro === 0 ? 0.32 : 0.9 }} />
                      <span style={{ color: tema.muted, fontSize: "11px", textAlign: "center", fontWeight: 800 }}>{item.dia}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <AnaliseAutomaticaBox />

            <div style={gridCards}>
              <StatCard label="Bancas ativas" value={bancas.filter((b) => b.status === "ativa").length} />
              <StatCard label="Total apostas" value={totalApostas} />
              <StatCard label="Greens" value={totalGreens} color={tema.good} />
              <StatCard label="Reds" value={totalReds} color={tema.bad} />
              <StatCard label="Pendentes" value={totalPendentes} />
              <StatCard label="Cash Out" value={totalCashOut} color={tema.warn} />
              <StatCard label="Taxa de acerto" value={`${taxaAcerto.toFixed(1)}%`} />
              <StatCard label="ROI geral" value={`${roiGeral.toFixed(1)}%`} color={roiGeral >= 0 ? tema.good : tema.bad} />
              <StatCard label="Lucro real" value={formatCurrency(lucroTotalGeral)} color={lucroTotalGeral >= 0 ? tema.good : tema.bad} />
              <StatCard label="Banca total" value={formatCurrency(bancaAtualGeral)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
              <MiniGraficoLinha titulo="📈 Evolução da banca — 14 dias" dados={evolucaoBancaGrafico.map((d) => ({ label: d.label, valor: d.saldo }))} />
              <MiniGraficoLinha titulo="💸 Lucro diário — 14 dias" dados={lucroPorDiaGrafico} />
              <MiniGraficoLinha titulo="🎯 ROI diário — 14 dias" dados={roiPorDiaGrafico} formato="percentual" />
              <GraficoBarrasResultado titulo="📊 Resultado por dia" dados={lucroPorDiaGrafico.slice(-7)} />
            </div>

            <div style={gridCards}>
              <div style={cardStyle}>
                <h3>📊 Raio-X da banca</h3>
                <p style={{ color: tema.muted }}>Depositado/base: <strong style={{ color: tema.text }}>{formatCurrency(totalDepositadoGeral)}</strong></p>
                <p style={{ color: tema.muted }}>Movimentos financeiros: <strong style={{ color: totalMovimentosGeral >= 0 ? tema.good : tema.bad }}>{formatCurrency(totalMovimentosGeral)}</strong></p>
                <p style={{ color: tema.muted }}>Valor apostado: <strong style={{ color: tema.text }}>{formatCurrency(totalValorApostado)}</strong></p>
                <p style={{ color: tema.muted }}>Crescimento apostas: <strong style={{ color: crescimentoGeral >= 0 ? tema.good : tema.bad }}>{crescimentoGeral.toFixed(1)}%</strong></p>
                <p style={{ color: tema.muted }}>Streak atual: <strong style={{ color: streakAtual.tipo === "green" ? tema.good : streakAtual.tipo === "red" ? tema.bad : tema.text }}>{streakAtual.tipo} {streakAtual.qtd ? `(${streakAtual.qtd})` : ""}</strong></p>
              </div>

              <div style={cardStyle}>
                <h3>🧠 IA da banca</h3>
                {alertasIA.map((a, i) => <AlertaBox key={i} tipo={a.tipo} texto={a.texto} />)}
              </div>

              <RankingBox titulo="🎯 Top mercados" lista={rankingMercados} />
            </div>
          </div>
        )}

        {tela === "bancas" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>📊 Gestão de Bancas</h2><p style={subtitleStyle}>Cria até 3 bancas ativas, acompanha lucro real, crescimento, meta e saldo automático.</p>
              <div className="bp-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "20px" }}>
                <input placeholder="Nome da banca" value={nomeBanca} onChange={(e) => setNomeBanca(e.target.value)} style={inputStyle} />
                <input type="number" placeholder="Valor depositado/base" value={valorDepositado} onChange={(e) => setValorDepositado(e.target.value)} style={inputStyle} />
                <input type="number" placeholder="Valor atual inicial" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} style={inputStyle} />
                <input type="number" placeholder="Meta" value={metaBanca} onChange={(e) => setMetaBanca(e.target.value)} style={inputStyle} />
                <input type="number" placeholder="Dias para meta" value={diasMeta} onChange={(e) => setDiasMeta(e.target.value)} style={inputStyle} />
              </div>

              <button onClick={criarBanca} style={{ ...smallButtonStyle, marginTop: "16px", padding: "12px 16px", background: tema.accent }}>
                Criar banca
              </button>
            </div>

            {bancas.length === 0 ? (
              <div style={cardStyle}>Ainda não há bancas criadas.</div>
            ) : (
              bancas.map((banca) => {
                const atual = calcularAtualAutomatico(banca.id);
                const lucro = atual - banca.depositado;
                const percentagem = banca.depositado ? (lucro / banca.depositado) * 100 : 0;
                const apostasDaBanca = apostas.filter((a) => a.bancaId === banca.id);
                const editando = editandoBancaId === banca.id;

                return (
                  <div key={banca.id} style={cardStyle}>
                    {!editando ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                          <h3 style={{ marginTop: 0 }}>{banca.nome}</h3>
                          <select value={moedaDaBanca(banca.id)} onChange={(e) => setMoedasPorBanca((atual) => ({ ...atual, [String(banca.id)]: e.target.value as Moeda }))} style={{ ...inputStyle, width: "180px", padding: "8px" }}>
                            <option value="EUR">Euro (€)</option>
                            <option value="BRL">Real (R$)</option>
                            <option value="USD">Dólar ($)</option>
                            <option value="GBP">Libra (£)</option>
                          </select>
                        </div>

                        <div style={gridCards}>
                          <StatCard label="Depositado/base" value={formatCurrencyBanca(banca.depositado, banca.id)} />
                          <StatCard label="Atual automático" value={formatCurrencyBanca(atual, banca.id)} />
                          <StatCard label="Lucro total" value={formatCurrencyBanca(lucro, banca.id)} color={lucro >= 0 ? tema.good : tema.bad} />
                          <StatCard label="Crescimento" value={`${percentagem.toFixed(1)}%`} color={percentagem >= 0 ? tema.good : tema.bad} />
                          <StatCard label="Meta" value={formatCurrencyBanca(banca.meta, banca.id)} />
                          <StatCard label="Apostas" value={apostasDaBanca.length} />
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            flexWrap: "wrap",
                            margin: "18px 0 14px",
                            padding: "14px 16px",
                            borderRadius: "18px",
                            background:
                              statusPorValor(atual, banca.meta) === "meta_batida"
                                ? "linear-gradient(135deg, rgba(34,197,94,0.16), rgba(34,197,94,0.04))"
                                : statusPorValor(atual, banca.meta) === "quebrada"
                                ? "linear-gradient(135deg, rgba(239,68,68,0.16), rgba(239,68,68,0.04))"
                                : temaNome === "claro"
                                ? "linear-gradient(135deg, rgba(249,115,22,0.10), rgba(255,255,255,0.76))"
                                : `linear-gradient(135deg, ${tema.accent2}, ${tema.card2})`,
                            border:
                              statusPorValor(atual, banca.meta) === "meta_batida"
                                ? `1px solid ${tema.good}`
                                : statusPorValor(atual, banca.meta) === "quebrada"
                                ? `1px solid ${tema.bad}`
                                : `1px solid ${tema.border}`,
                            boxShadow: "0 14px 30px rgba(0,0,0,0.10)",
                          }}
                        >
                          <div>
                            <p style={{ margin: 0, color: tema.muted, fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              Estado da banca
                            </p>
                            <strong style={{ color: tema.text, fontSize: "16px" }}>
                              {statusPorValor(atual, banca.meta) === "meta_batida"
                                ? "Meta batida"
                                : statusPorValor(atual, banca.meta) === "quebrada"
                                ? "Banca quebrada"
                                : "Ativa e operacional"}
                            </strong>
                          </div>

                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "9px 13px",
                              borderRadius: "999px",
                              color: "white",
                              fontWeight: 900,
                              textTransform: "uppercase",
                              fontSize: "12px",
                              letterSpacing: "0.05em",
                              background:
                                statusPorValor(atual, banca.meta) === "meta_batida"
                                  ? tema.good
                                  : statusPorValor(atual, banca.meta) === "quebrada"
                                  ? tema.bad
                                  : tema.accent,
                              boxShadow: "0 12px 26px rgba(0,0,0,0.18)",
                            }}
                          >
                            {statusPorValor(atual, banca.meta) === "meta_batida"
                              ? "🏆 Meta"
                              : statusPorValor(atual, banca.meta) === "quebrada"
                              ? "🔴 Quebrada"
                              : "🟢 Ativa"}
                          </span>
                        </div>

                        <div
                          style={{
                            height: "10px",
                            borderRadius: "999px",
                            background: temaNome === "claro" ? "#e2e8f0" : tema.accent2,
                            overflow: "hidden",
                            margin: "0 0 18px",
                            border: `1px solid ${tema.border}`,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, banca.meta > 0 ? (atual / banca.meta) * 100 : 0)}%`,
                              borderRadius: "999px",
                              background:
                                statusPorValor(atual, banca.meta) === "quebrada"
                                  ? tema.bad
                                  : statusPorValor(atual, banca.meta) === "meta_batida"
                                  ? tema.good
                                  : `linear-gradient(90deg, ${tema.accent}, ${tema.good})`,
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button onClick={() => iniciarEdicaoBanca(banca)} style={{ ...smallButtonStyle, background: tema.accent }}>Editar banca</button>
                          <button onClick={() => apagarBanca(banca.id)} style={{ ...smallButtonStyle, background: tema.accent2, border: `1px solid ${tema.border}` }}>Apagar banca</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3>Editar banca</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                          <input value={editNomeBanca} onChange={(e) => setEditNomeBanca(e.target.value)} style={inputStyle} />
                          <input type="number" value={editDepositado} onChange={(e) => setEditDepositado(e.target.value)} style={inputStyle} />
                          <input type="number" value={editAtual} onChange={(e) => setEditAtual(e.target.value)} style={inputStyle} />
                          <input type="number" value={editMeta} onChange={(e) => setEditMeta(e.target.value)} style={inputStyle} />
                          <input type="number" value={editDias} onChange={(e) => setEditDias(e.target.value)} style={inputStyle} />
                        </div>

                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                          <button onClick={() => guardarEdicaoBanca(banca.id)} style={{ ...smallButtonStyle, background: tema.good }}>Guardar edição</button>
                          <button onClick={cancelarEdicaoBanca} style={{ ...smallButtonStyle, background: "#475569" }}>Cancelar</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tela === "financeiro" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>💰 Financeiro</h2><p style={subtitleStyle}>Controla depósitos, saques, ajustes, bônus e extrato por banca.</p>
              <div className="bp-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <select value={moeda} onChange={(e) => setMoeda(e.target.value as Moeda)} style={inputStyle}>
                  <option value="EUR">🇪🇺 Euro (€)</option>
                  <option value="BRL">🇧🇷 Real (R$)</option>
                  <option value="USD">🇺🇸 Dólar ($)</option>
                  <option value="GBP">🇬🇧 Libra (£)</option>
                </select>
                <select value={movimentoBancaId} onChange={(e) => setMovimentoBancaId(e.target.value)} style={inputStyle}>
                  <option value="">Escolher banca</option>
                  {bancas.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
                <select value={movimentoTipo} onChange={(e) => setMovimentoTipo(e.target.value as MovimentoTipo)} style={inputStyle}>
                  <option value="deposito">Depósito</option>
                  <option value="saque">Saque</option>
                  <option value="ajuste">Ajuste manual</option>
                  <option value="bonus">Bônus</option>
                  <option value="correcao">Correção negativa</option>
                </select>
                <input type="number" placeholder="Valor" value={movimentoValor} onChange={(e) => setMovimentoValor(e.target.value)} style={inputStyle} />
                <input placeholder="Nota/motivo" value={movimentoNota} onChange={(e) => setMovimentoNota(e.target.value)} style={inputStyle} />
                <button onClick={registrarMovimentoFinanceiro} style={{ ...smallButtonStyle, background: tema.accent }}>Registrar movimento</button>
              </div>
            </div>

            <div style={gridCards}>
              <StatCard label="Base depositada" value={formatCurrency(totalDepositadoGeral)} />
              <StatCard label="Lucro de apostas" value={formatCurrency(lucroTotalGeral)} color={lucroTotalGeral >= 0 ? tema.good : tema.bad} />
              <StatCard label="Movimentos financeiros" value={formatCurrency(totalMovimentosGeral)} color={totalMovimentosGeral >= 0 ? tema.good : tema.bad} />
              <StatCard label="Saldo líquido total" value={formatCurrency(bancaAtualGeral)} />
            </div>

            <div style={cardStyle}>
              <h3>🔎 Filtro financeiro</h3>
              <div className="bp-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <select value={filtroFinanceiroBancaDraft} onChange={(e) => setFiltroFinanceiroBancaDraft(e.target.value)} style={inputStyle}>
                  <option value="">Todas as bancas</option>
                  {bancas.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
                <select value={filtroFinanceiroTipoDraft} onChange={(e) => setFiltroFinanceiroTipoDraft(e.target.value)} style={inputStyle}>
                  <option value="">Todos os tipos</option>
                  <option value="deposito">Depósito</option>
                  <option value="saque">Saque</option>
                  <option value="ajuste">Ajuste</option>
                  <option value="bonus">Bônus</option>
                  <option value="correcao">Correção</option>
                </select>
                <button onClick={aplicarFiltroFinanceiro} style={{ ...smallButtonStyle, background: tema.accent }}>Filtrar</button>
                <button onClick={limparFiltroFinanceiro} style={{ ...smallButtonStyle, background: "#475569" }}>Limpar filtro</button>
              </div>
            </div>

            <div style={cardStyle}>
              <h3>📒 Extrato financeiro ({movimentosFiltrados.length})</h3>
              {movimentosFiltrados.length === 0 ? <p style={{ color: tema.muted }}>Nenhum movimento encontrado.</p> : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {movimentosFiltrados.map((mov) => {
                    const corMov = mov.tipo === "deposito" || mov.tipo === "bonus" || mov.tipo === "ajuste" ? tema.good : tema.bad;
                    const iconeMov = mov.tipo === "deposito" ? "💵" : mov.tipo === "saque" ? "🏧" : mov.tipo === "bonus" ? "🎁" : mov.tipo === "ajuste" ? "🛠️" : "↘️";
                    return (
                      <div
                        key={mov.id}
                        style={{
                          background:
                            temaNome === "claro"
                              ? `linear-gradient(135deg, ${corMov}18, rgba(255,255,255,0.96))`
                              : `linear-gradient(135deg, ${corMov}18, ${tema.card2})`,
                          border: `1px solid ${corMov}`,
                          borderRadius: "20px",
                          padding: "16px",
                          boxShadow: `0 16px 36px ${corMov}18`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                          <div>
                            <strong style={{ fontSize: "16px" }}>{iconeMov} {mov.tipo.toUpperCase()} — {mov.bancaNome}</strong>
                            <p style={{ color: tema.muted, margin: "6px 0 0", fontWeight: 800 }}>{mov.nota || "Movimento financeiro"}</p>
                          </div>
                          <strong style={{ color: corMov, fontSize: "24px", letterSpacing: "-0.04em" }}>{formatCurrencyBanca(mov.valor, mov.bancaId)}</strong>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginTop: "14px" }}>
                          <div style={{ background: tema.card, border: `1px solid ${tema.border}`, borderRadius: "14px", padding: "10px" }}>
                            <p style={{ margin: 0, color: tema.muted, fontSize: "12px", fontWeight: 900 }}>Antes</p>
                            <strong>{formatCurrencyBanca(mov.saldoAntes, mov.bancaId)}</strong>
                          </div>
                          <div style={{ background: tema.card, border: `1px solid ${tema.border}`, borderRadius: "14px", padding: "10px" }}>
                            <p style={{ margin: 0, color: tema.muted, fontSize: "12px", fontWeight: 900 }}>Depois</p>
                            <strong>{formatCurrencyBanca(mov.saldoDepois, mov.bancaId)}</strong>
                          </div>
                          <div style={{ background: tema.card, border: `1px solid ${tema.border}`, borderRadius: "14px", padding: "10px" }}>
                            <p style={{ margin: 0, color: tema.muted, fontSize: "12px", fontWeight: 900 }}>Data</p>
                            <strong>{mov.id < 0 ? "Inicial" : new Date(mov.createdAt).toLocaleString("pt-PT")}</strong>
                          </div>
                        </div>

                        {mov.id > 0 && (
                          <button onClick={() => apagarMovimentoFinanceiro(mov.id)} style={{ ...smallButtonStyle, background: tema.bad, marginTop: "12px" }}>Apagar movimento</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tela === "apostas" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>🧾 Registro de Apostas</h2><p style={subtitleStyle}>Registra simples, múltiplas e cartelas com leitura de risco, stake sugerida e histórico automático.</p>

              <div className="bp-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginTop: "20px" }}>
                <select value={bancaSelecionadaId} onChange={(e) => setBancaSelecionadaId(e.target.value)} style={inputStyle}>
                  <option value="">Escolher banca</option>
                  {bancas.filter((b) => b.status === "ativa" || b.status === "meta_batida").map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>

                <select value={countrySelecionadoId} onChange={(e) => { setCountrySelecionadoId(e.target.value); setLigaSelecionadaId(""); setLigaManual(""); setEquipaCasa(""); setEquipaFora(""); }} style={inputStyle}>
                  <option value="">Escolher país</option>
                  {countries.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>

                <select value={ligaSelecionadaId} onChange={(e) => { setLigaSelecionadaId(e.target.value); setLigaManual(""); setEquipaCasa(""); setEquipaFora(""); }} style={inputStyle}>
                  <option value="">Escolher liga</option>
                  {ligasFiltradas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>

                <input placeholder="Ou digitar liga manualmente" value={ligaManual} onChange={(e) => { setLigaManual(e.target.value); if (e.target.value.trim()) setLigaSelecionadaId(""); }} style={inputStyle} />

                {!usarCasaManual ? (
                  <select value={equipaCasa} onChange={(e) => setEquipaCasa(e.target.value)} style={inputStyle}>
                    <option value="">Equipa da casa</option>
                    {equipasFiltradas.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                  </select>
                ) : (
                  <input placeholder="Digitar equipa da casa" value={equipaCasaManual} onChange={(e) => setEquipaCasaManual(e.target.value)} style={inputStyle} />
                )}

                {!usarForaManual ? (
                  <select value={equipaFora} onChange={(e) => setEquipaFora(e.target.value)} style={inputStyle}>
                    <option value="">Equipa de fora</option>
                    {equipasFiltradas.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                  </select>
                ) : (
                  <input placeholder="Digitar equipa de fora" value={equipaForaManual} onChange={(e) => setEquipaForaManual(e.target.value)} style={inputStyle} />
                )}

                <button onClick={() => { setUsarCasaManual((p) => !p); setEquipaCasa(""); setEquipaCasaManual(""); }} style={{ ...smallButtonStyle, background: tema.accent2, border: `1px solid ${tema.border}` }}>
                  {usarCasaManual ? "Usar lista casa" : "Digitar casa"}
                </button>

                <button onClick={() => { setUsarForaManual((p) => !p); setEquipaFora(""); setEquipaForaManual(""); }} style={{ ...smallButtonStyle, background: tema.accent2, border: `1px solid ${tema.border}` }}>
                  {usarForaManual ? "Usar lista fora" : "Digitar fora"}
                </button>

                <MercadoSelector />

                <input type="number" step="0.01" placeholder="Odd da seleção" value={odd} onChange={(e) => setOdd(e.target.value)} style={inputStyle} />
                <input type="number" step="0.01" placeholder="Valor apostado" value={valorApostado} onChange={(e) => setValorApostado(e.target.value)} style={inputStyle} />

                <select value={statusAposta} onChange={(e) => setStatusAposta(e.target.value as BetStatus)} style={inputStyle}>
                  <option value="pendente">Pendente</option>
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="cash_out">Cash Out</option>
                </select>

                {statusAposta === "cash_out" && <input type="number" step="0.01" placeholder="Valor do cash out" value={valorCashOut} onChange={(e) => setValorCashOut(e.target.value)} style={inputStyle} />}

                <select value={estrategia} onChange={(e) => setEstrategia(e.target.value)} style={inputStyle}>
                  {estrategiasBase.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>

                <select value={emocaoEntrada} onChange={(e) => setEmocaoEntrada(e.target.value as EmocaoEntrada)} style={inputStyle}>
                  <option value="calmo">Calmo</option>
                  <option value="confiante">Confiante</option>
                  <option value="ansioso">Ansioso</option>
                  <option value="tilt">Tilt</option>
                  <option value="pressa">Pressa</option>
                </select>

                <select value={confianca} onChange={(e) => setConfianca(Number(e.target.value))} style={inputStyle}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"⭐".repeat(n)} confiança</option>)}
                </select>

                <textarea placeholder="Análise pré-jogo / motivo da entrada" value={analisePre} onChange={(e) => setAnalisePre(e.target.value)} style={{ ...inputStyle, minHeight: "90px", gridColumn: "1 / -1" }} />
              </div>

              <div style={{ marginTop: "16px", padding: "14px", borderRadius: "14px", background: tema.accent2, border: `1px solid ${tema.border}` }}>
                Retorno seleção simples: <strong>{formatCurrencyBanca(retornoEsperado, bancaSelecionadaId)}</strong><br />
                Odd total da cartela: <strong>{oddTotalCartela.toFixed(2)}</strong><br />
                Retorno esperado da cartela: <strong>{formatCurrencyBanca(retornoEsperadoCartela, bancaSelecionadaId)}</strong><br />
                Risco da entrada: <strong style={{ color: nivelRiscoEntrada.cor }}>{nivelRiscoEntrada.nivel}</strong>
              </div>

              <div style={{ marginTop: "16px", background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "14px", padding: "16px" }}>
                <h3>🛡️ Stake inteligente</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <input type="number" step="0.1" placeholder="% da banca" value={stakePercentual} onChange={(e) => setStakePercentual(e.target.value)} style={inputStyle} />
                  <select value={modoGestao} onChange={(e) => setModoGestao(e.target.value as ModoGestao)} style={inputStyle}>
                    <option value="conservador">Conservador</option>
                    <option value="normal">Normal</option>
                    <option value="agressivo">Agressivo</option>
                  </select>
                  <button onClick={aplicarStakeSugerida} style={{ ...smallButtonStyle, background: tema.accent }}>Aplicar stake sugerida</button>
                </div>
                <p style={{ color: tema.muted }}>
                  Banca atual: <strong style={{ color: tema.text }}>{formatCurrencyBanca(bancaSelecionadaAtual, bancaSelecionadaId)}</strong> ·
                  Stake sugerida: <strong style={{ color: tema.good }}>{formatCurrencyBanca(stakeSugerida, bancaSelecionadaId)}</strong>
                </p>
              </div>

              <div style={{ marginTop: "16px", ...cardStyle }}>
                <h3>🧠 Alertas inteligentes</h3>
                {alertasIA.map((a, i) => <AlertaBox key={i} tipo={a.tipo} texto={a.texto} />)}
              </div>

              <div className="bp-action-row" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
                <button onClick={adicionarSelecaoCartela} style={{ ...smallButtonStyle, background: tema.good }}>➕ Adicionar mercado ao jogo/cartela</button>
                <button onClick={() => fecharCartela("green")} style={{ ...smallButtonStyle, background: tema.good }}>Fechar cartela Green</button>
                <button onClick={() => fecharCartela("red")} style={{ ...smallButtonStyle, background: tema.bad }}>Fechar cartela Red</button>
                <button onClick={() => { setCartela([]); setMensagem("Cartela limpa."); }} style={{ ...smallButtonStyle, background: "#475569" }}>Limpar cartela</button>
                <button onClick={registrarAposta} style={{ ...smallButtonStyle, background: tema.accent, padding: "10px 18px" }}>💾 Guardar aposta</button>
              </div>

              <div style={{ marginTop: "16px", background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "14px", padding: "16px" }}>
                <h3>🧾 Cartela atual</h3>
                {cartela.length === 0 ? (
                  <p style={{ color: tema.muted }}>Sem seleções. Podes guardar aposta simples direto pelo formulário ou adicionar vários mercados no mesmo jogo.</p>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {cartela.map((jogo) => (
                      <div key={jogo.id} style={{ background: tema.card, border: `1px solid ${tema.border}`, borderRadius: "14px", padding: "14px", boxShadow: "0 10px 28px rgba(0,0,0,0.18)" }}>
                        <MatchHeader casa={jogo.casa} fora={jogo.fora} compact />
                        <p style={{ color: tema.muted }}>Liga: {jogo.liga}</p>
                        {jogo.selecoes.map((s) => (
                          <div key={s.id} style={{ ...fundoStatusAposta(s.status), borderRadius: "12px", padding: "10px", marginTop: "8px" }}>
                            <p>{s.mercado} — Odd {s.odd.toFixed(2)}</p>
                            <p>Status: <span style={statusBadgeStyle(s.status)}>{s.status}</span></p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              <button onClick={() => atualizarSelecaoCartela(jogo.id, s.id, "pendente")} style={{ ...smallButtonStyle, background: "#475569" }}>Pendente</button>
                              <button onClick={() => atualizarSelecaoCartela(jogo.id, s.id, "green")} style={{ ...smallButtonStyle, background: tema.good }}>Green</button>
                              <select onChange={(e) => e.target.value && atualizarSelecaoCartela(jogo.id, s.id, "red", e.target.value)} value="" style={{ ...inputStyle, width: "220px", padding: "8px 10px" }}>
                                <option value="">Red com motivo</option>
                                {motivosRedBase.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                              <button onClick={() => removerSelecaoCartela(jogo.id, s.id)} style={{ ...smallButtonStyle, background: tema.bad }}>Remover</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <ListaApostas />
          </div>
        )}

        {tela === "agenda" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>📅 Agenda de jogos</h2>
              <p style={subtitleStyle}>
                Planeia jogos para analisar, separa por status e envia direto para o registro de apostas.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px", marginTop: "18px" }}>
                <input placeholder="Liga" value={agendaLiga} onChange={(e) => setAgendaLiga(e.target.value)} style={inputStyle} />
                <input placeholder="Equipa da casa" value={agendaCasa} onChange={(e) => setAgendaCasa(e.target.value)} style={inputStyle} />
                <input placeholder="Equipa de fora" value={agendaFora} onChange={(e) => setAgendaFora(e.target.value)} style={inputStyle} />
                <input type="date" value={agendaData} onChange={(e) => setAgendaData(e.target.value)} style={inputStyle} />
                <input type="time" value={agendaHora} onChange={(e) => setAgendaHora(e.target.value)} style={inputStyle} />
                <input placeholder="Mercado pretendido" value={agendaMercado} onChange={(e) => setAgendaMercado(e.target.value)} style={inputStyle} />

                <select value={agendaConfianca} onChange={(e) => setAgendaConfianca(Number(e.target.value))} style={inputStyle}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{"⭐".repeat(n)} confiança</option>
                  ))}
                </select>

                <select value={agendaBancaId} onChange={(e) => setAgendaBancaId(e.target.value)} style={inputStyle}>
                  <option value="">Banca opcional</option>
                  {bancas.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>

                <textarea
                  placeholder="Observação / leitura pré-live"
                  value={agendaObs}
                  onChange={(e) => setAgendaObs(e.target.value)}
                  style={{ ...inputStyle, minHeight: "82px", gridColumn: "1 / -1" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                <button onClick={criarJogoAgenda} style={{ ...smallButtonStyle, background: tema.accent, padding: "12px 18px" }}>
                  ➕ Adicionar jogo
                </button>
                <select value={agendaStatusFiltro} onChange={(e) => setAgendaStatusFiltro(e.target.value)} style={{ ...inputStyle, width: "220px" }}>
                  <option value="">Todos os status</option>
                  <option value="analisar">Analisar</option>
                  <option value="pre_live">Pré-live</option>
                  <option value="apostado">Apostado</option>
                  <option value="ignorado">Ignorado</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
            </div>

            <div style={gridCards}>
              <StatCard label="Jogos na agenda" value={agenda.length} />
              <StatCard label="Jogos hoje" value={jogosHoje.length} color={jogosHoje.length ? tema.warn : tema.text} />
              <StatCard label="Para analisar" value={agenda.filter((j) => j.status === "analisar").length} />
              <StatCard label="Pré-live" value={agenda.filter((j) => j.status === "pre_live").length} color={tema.accent} />
            </div>

            <div style={cardStyle}>
              <h3 style={{ marginTop: 0 }}>🗓️ Lista da agenda ({agendaFiltrada.length})</h3>
              {agendaFiltrada.length === 0 ? (
                <p style={{ color: tema.muted }}>Nenhum jogo encontrado na agenda.</p>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {agendaFiltrada
                    .slice()
                    .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
                    .map((jogo) => {
                      const bancaAgenda = bancas.find((b) => String(b.id) === jogo.bancaId);
                      const statusColor =
                        jogo.status === "apostado" || jogo.status === "finalizado"
                          ? tema.good
                          : jogo.status === "ignorado"
                          ? tema.bad
                          : jogo.status === "pre_live"
                          ? tema.warn
                          : tema.accent;

                      return (
                        <div key={jogo.id} style={{ background: `linear-gradient(135deg, ${statusColor}18, ${tema.card2})`, border: `1px solid ${statusColor}`, borderRadius: "20px", padding: "18px", boxShadow: `0 18px 40px ${statusColor}18` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
                            <div>
                              <MatchHeader casa={jogo.casa} fora={jogo.fora} />
                              <p style={{ margin: 0, color: tema.muted }}>
                                {jogo.liga} · {new Date(`${jogo.data}T${jogo.hora || "00:00"}`).toLocaleDateString("pt-PT")} às {jogo.hora}
                              </p>
                            </div>
                            <span style={{ ...statusBadgeStyle("pendente"), background: statusColor }}>{jogo.status}</span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginTop: "12px" }}>
                            <div style={{ color: tema.muted }}>Mercado: <strong style={{ color: tema.text }}>{jogo.mercadoPretendido || "Sem mercado"}</strong></div>
                            <div style={{ color: tema.muted }}>Confiança: <strong style={{ color: tema.text }}>{"⭐".repeat(jogo.confianca)}</strong></div>
                            <div style={{ color: tema.muted }}>Banca: <strong style={{ color: tema.text }}>{bancaAgenda?.nome || "Não definida"}</strong></div>
                          </div>

                          {jogo.observacao && <p style={{ color: tema.muted, marginTop: "12px" }}>Análise: {jogo.observacao}</p>}

                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                            <button onClick={() => atualizarStatusAgenda(jogo.id, "analisar")} style={{ ...smallButtonStyle, background: tema.accent2, border: `1px solid ${tema.border}` }}>Analisar</button>
                            <button onClick={() => atualizarStatusAgenda(jogo.id, "pre_live")} style={{ ...smallButtonStyle, background: tema.warn }}>Pré-live</button>
                            <button onClick={() => atualizarStatusAgenda(jogo.id, "apostado")} style={{ ...smallButtonStyle, background: tema.good }}>Apostado</button>
                            <button onClick={() => atualizarStatusAgenda(jogo.id, "ignorado")} style={{ ...smallButtonStyle, background: "#64748b" }}>Ignorar</button>
                            <button onClick={() => atualizarStatusAgenda(jogo.id, "finalizado")} style={{ ...smallButtonStyle, background: tema.good }}>Finalizar</button>
                            <button onClick={() => criarApostaDaAgenda(jogo)} style={{ ...smallButtonStyle, background: tema.accent }}>Enviar para aposta</button>
                            <button onClick={() => apagarJogoAgenda(jogo.id)} style={{ ...smallButtonStyle, background: tema.bad }}>Apagar</button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {tela === "ferramentas" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={cardStyle}><h2 style={sectionTitleStyle}>🧰 Ferramentas</h2><p style={subtitleStyle}>Calculadoras para stake, múltiplas, surebet, cobertura, métodos de gestão e simulação.</p></div>
            <div style={gridCards}>
              <div style={cardStyle}><h3>🛡️ Stake por % da banca</h3><input type="number" placeholder="Banca" value={ferramentaBanca} onChange={(e) => setFerramentaBanca(e.target.value)} style={{ ...inputStyle, marginBottom: "8px" }} /><input type="number" placeholder="% stake" value={ferramentaStake} onChange={(e) => setFerramentaStake(e.target.value)} style={inputStyle} /><h3>{formatCurrency(stakePercentCalc)}</h3></div>
              <div style={cardStyle}><h3>🎯 Calculadora de múltiplas</h3><input placeholder="Odds separadas por vírgula" value={calcMultiplasOdds} onChange={(e) => setCalcMultiplasOdds(e.target.value)} style={{ ...inputStyle, marginBottom: "8px" }} /><input type="number" placeholder="Stake" value={calcMultiplasStake} onChange={(e) => setCalcMultiplasStake(e.target.value)} style={inputStyle} /><p>Odd total: <strong>{oddMultiplaTotal.toFixed(2)}</strong></p><p>Retorno: <strong>{formatCurrency(retornoMultiplaCalc)}</strong></p><p>Lucro: <strong style={{ color: tema.good }}>{formatCurrency(lucroMultiplaCalc)}</strong></p></div>
              <div style={cardStyle}><h3>⚖️ Surebet 2 lados</h3><input type="number" placeholder="Odd lado 1" value={sureOdd1} onChange={(e) => setSureOdd1(e.target.value)} style={{ ...inputStyle, marginBottom: "8px" }} /><input type="number" placeholder="Odd lado 2" value={sureOdd2} onChange={(e) => setSureOdd2(e.target.value)} style={{ ...inputStyle, marginBottom: "8px" }} /><input type="number" placeholder="Total investir" value={sureTotal} onChange={(e) => setSureTotal(e.target.value)} style={inputStyle} /><p>Probabilidade implícita: {(sureProb * 100).toFixed(2)}%</p><p>Lado 1: {formatCurrency(sureStake1)}</p><p>Lado 2: {formatCurrency(sureStake2)}</p><p><strong style={{ color: sureProb < 1 ? tema.good : tema.bad }}>{sureProb < 1 ? `Surebet: lucro ${formatCurrency(sureLucro)}` : "Não é surebet"}</strong></p></div>
              <div style={cardStyle}><h3>🔁 Hedge / Cobertura</h3><input type="number" placeholder="Stake entrada" value={hedgeStake} onChange={(e) => setHedgeStake(e.target.value)} style={{ ...inputStyle, marginBottom: "8px" }} /><input type="number" placeholder="Odd entrada" value={hedgeOddEntrada} onChange={(e) => setHedgeOddEntrada(e.target.value)} style={{ ...inputStyle, marginBottom: "8px" }} /><input type="number" placeholder="Odd cobertura" value={hedgeOddCobertura} onChange={(e) => setHedgeOddCobertura(e.target.value)} style={inputStyle} /><p>Retorno alvo: {formatCurrency(hedgeRetornoEntrada)}</p><p>Stake de cobertura aproximada: <strong>{formatCurrency(hedgeStakeCobertura)}</strong></p></div>
            </div>
          </div>
        )}

        {tela === "historico" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>📈 Histórico, filtros e IA</h2><p style={subtitleStyle}>Filtra apostas e identifica mercados, ligas, estratégias, horários e equipas mais fortes.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                <select value={filtroBancaDraft} onChange={(e) => setFiltroBancaDraft(e.target.value)} style={inputStyle}>
                  <option value="">Todas as bancas</option>
                  {bancas.map((b) => <option key={b.id} value={b.nome}>{b.nome}</option>)}
                </select>
                <select value={filtroStatusDraft} onChange={(e) => setFiltroStatusDraft(e.target.value)} style={inputStyle}>
                  <option value="">Todos os status</option>
                  <option value="pendente">Pendente</option>
                  <option value="green">Green</option>
                  <option value="red">Red</option>
                  <option value="cash_out">Cash Out</option>
                </select>
                <select value={filtroLigaDraft} onChange={(e) => setFiltroLigaDraft(e.target.value)} style={inputStyle}>
                  <option value="">Todas as ligas</option>
                  {ligasHistorico.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={filtroMercadoDraft} onChange={(e) => setFiltroMercadoDraft(e.target.value)} style={inputStyle}>
                  <option value="">Todos os mercados</option>
                  {mercadosBase.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filtroEstrategiaDraft} onChange={(e) => setFiltroEstrategiaDraft(e.target.value)} style={inputStyle}>
                  <option value="">Todas estratégias</option>
                  {estrategiasHistorico.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
                <input placeholder="Filtrar por equipa" value={filtroEquipaDraft} onChange={(e) => setFiltroEquipaDraft(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                <button onClick={aplicarFiltros} style={{ ...smallButtonStyle, background: tema.accent }}>Filtrar</button>
                <button onClick={limparFiltros} style={{ ...smallButtonStyle, background: "#475569" }}>Limpar filtros</button>
              </div>
            </div>

            <AnaliseAutomaticaBox />

            <ListaApostas somenteFiltradas />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              <RankingBox titulo="🎯 Ranking por mercado" lista={rankingMercados} />
              <RankingBox titulo="🏆 Ranking por estratégia" lista={rankingEstrategias} />
              <RankingBox titulo="🏟️ Ranking por liga" lista={rankingLigas} />
              <RankingBox titulo="⏰ Heatmap de horários" lista={heatmapHorario} />
              <RankingBox titulo="⭐ Confiança x resultado" lista={rankingConfianca} />
            </div>

            <div style={cardStyle}>
              <h3>🏟️ Top equipas</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
                {rankingEquipas.slice(0, 12).map((e) => (
                  <div key={e.nome} style={{ background: tema.card2, border: `1px solid ${tema.border}`, borderRadius: "16px", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}><TeamLogo nome={e.nome} size={42} /><h4 style={{ margin: 0 }}>{e.nome}</h4></div>
                    <p>Aparições: {e.total}</p>
                    <p style={{ color: tema.good }}>Greens: {e.greens}</p>
                    <p style={{ color: tema.bad }}>Reds: {e.reds}</p>
                    <p>Taxa: <strong style={{ color: e.taxa >= 50 ? tema.good : tema.bad }}>{e.taxa.toFixed(1)}%</strong></p>
                    <p style={{ color: tema.muted }}>Mercado mais usado: {e.mercadoMaisUsado}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tela === "config" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>⚙️ Configurações</h2><p style={subtitleStyle}>Ajusta tema, moeda, modo compacto e exporta backup do teu trabalho.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                <select value={temaNome} onChange={(e) => setTemaNome(e.target.value as TemaNome)} style={inputStyle}>
                  <option value="betano">Tema Betano</option>
                  <option value="bet365">Tema Bet365</option>
                  <option value="escuro">Tema Escuro</option>
                  <option value="claro">Tema Claro</option>
                  <option value="premium">Tema Premium</option>
                  <option value="amarelo">Tema Amarelo</option>
                </select>
                <select value={moeda} onChange={(e) => setMoeda(e.target.value as Moeda)} style={inputStyle}>
                  <option value="EUR">Euro (€)</option>
                  <option value="BRL">Real (R$)</option>
                  <option value="USD">Dólar ($)</option>
                  <option value="GBP">Libra (£)</option>
                </select>
                <button onClick={() => setModoCompacto((p) => !p)} style={{ ...smallButtonStyle, background: tema.accent2, border: `1px solid ${tema.border}` }}>
                  {modoCompacto ? "Desativar modo compacto" : "Ativar modo compacto"}
                </button>
                <button onClick={exportarBackup} style={{ ...smallButtonStyle, background: tema.accent }}>
                  Exportar backup JSON
                </button>
              </div>
              <p style={{ color: tema.muted }}>
                Versão com Gráficos Reais: evolução da banca, lucro diário, ROI diário, barras dos últimos 7 dias, cloud ready, mobile premium e visual Apple Level.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

// Agenda Premium patch applied.


// Versão Mobile Premium: navegação inferior, inputs mobile-friendly e cards mais confortáveis no telemóvel.


// Versão Apple Level: animações premium, loading cinematográfico, foco visual e microinterações.


// Versão Cloud Ready: Financeiro e Agenda tentam sincronizar com Supabase e continuam funcionando localmente se as tabelas ainda não existirem.


// Versão Gráficos Reais: dashboard com gráficos SVG sem dependências externas.
