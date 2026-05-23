const axios = require("axios");

const GATEWAY = "http://localhost:5000";

// Rotas a testar — inclui a rota de agregação exclusiva dos microserviços
const ROTAS = [
  { url: `${GATEWAY}/utilizadores`, peso: 3, descricao: "listar utilizadores" },
  { url: `${GATEWAY}/produtos`, peso: 3, descricao: "listar produtos" },
  { url: `${GATEWAY}/pedidos`, peso: 2, descricao: "listar pedidos" },
  {
    url: `${GATEWAY}/pedidos/1/detalhes`,
    peso: 2,
    descricao: "agregação pedidos #1",
  },
  {
    url: `${GATEWAY}/pedidos/2/detalhes`,
    peso: 1,
    descricao: "agregação pedidos #2",
  },
  {
    url: `${GATEWAY}/pedidos/3/detalhes`,
    peso: 1,
    descricao: "agregação pedidos #3",
  },
];

const NUM_REQUESTS = 5000;
const CONCURRENT_REQUESTS = 50;

let sucessos = 0;
let falhas = 0;
const tempos = [];

// métricas por rota
const metricasPorRota = {};
ROTAS.forEach((r) => {
  metricasPorRota[r.descricao] = { sucessos: 0, falhas: 0, tempos: [] };
});

// métricas por instância (lidas do header X-Instance-ID)
const instanciaContador = {};

// Semáforo
function criarSemaforo(limite) {
  let activos = 0;
  const fila = [];

  return function executar(fn) {
    return new Promise((resolve, reject) => {
      const tentar = () => {
        if (activos < limite) {
          activos++;
          fn()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              activos--;
              if (fila.length > 0) fila.shift()();
            });
        } else {
          fila.push(tentar);
        }
      };
      tentar();
    });
  };
}

// Selecção de rota por peso
// Simula tráfego realista: rotas com peso maior são chamadas com mais frequência

function escolherRota() {
  const total = ROTAS.reduce((acc, r) => acc + r.peso, 0);
  let n = Math.random() * total;
  for (const rota of ROTAS) {
    n -= rota.peso;
    if (n <= 0) return rota;
  }
  return ROTAS[0];
}

// Execução de cada request

async function fazerRequisicao(id) {
  const rota = escolherRota();
  const inicio = Date.now();

  try {
    const res = await axios.get(rota.url, { timeout: 5000 });
    const tempo = Date.now() - inicio;

    tempos.push(tempo);
    sucessos++;
    metricasPorRota[rota.descricao].sucessos++;
    metricasPorRota[rota.descricao].tempos.push(tempo);

    // rastrear qual instância respondeu (via header do gateway/serviço)
    const instancia = res.headers["x-instance-id"] || "gateway";
    instanciaContador[instancia] = (instanciaContador[instancia] || 0) + 1;

    console.log(
      `[${String(id).padStart(4)}] ✓ ${res.status} | ${String(tempo).padStart(4)}ms | ${rota.descricao}`,
    );
  } catch (err) {
    const tempo = Date.now() - inicio;
    falhas++;
    metricasPorRota[rota.descricao].falhas++;

    const status = err.response?.status ?? "TIMEOUT/ERRO";
    console.log(
      `[${String(id).padStart(4)}] ✗ ${status} | ${String(tempo).padStart(4)}ms | ${rota.descricao} — ${err.message}`,
    );
  }
}

// Cálculo de percentis
function percentil(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

// Verificação de saúde do gateway antes de começar
async function verificarGateway() {
  try {
    const res = await axios.get(`${GATEWAY}/health`, { timeout: 3000 });
    const { servicos, contadores } = res.data;
    console.log("  Gateway OK. Instâncias registadas:");
    Object.entries(servicos).forEach(([srv, lista]) => {
      console.log(
        `    ${srv}: ${lista.length} instância(s) — ${lista.join(", ")}`,
      );
    });
    return true;
  } catch {
    console.error("  ERRO: Gateway não está acessível em", GATEWAY);
    console.error(
      "  Certifica-te que o gateway.js está a correr (node gateway.js)",
    );
    return false;
  }
}

// Impressão dos resultados
function imprimirResultados(tempoRealMs) {
  const tempoReal = (tempoRealMs / 1000).toFixed(2);
  const rendimento = (sucessos / (tempoRealMs / 1000)).toFixed(2);
  const taxaSucesso = ((sucessos / NUM_REQUESTS) * 100).toFixed(2);
  const taxaFalha = ((falhas / NUM_REQUESTS) * 100).toFixed(2);

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║         RESULTADOS — MICROSERVIÇOS           ║");
  console.log("╚══════════════════════════════════════════════╝");

  console.log("\n── Geral ──────────────────────────────────────");
  console.log(`  Total de requisições : ${NUM_REQUESTS}`);
  console.log(`  Concorrência         : ${CONCURRENT_REQUESTS} em simultâneo`);
  console.log(`  Sucessos             : ${sucessos} (${taxaSucesso}%)`);
  console.log(`  Falhas               : ${falhas}   (${taxaFalha}%)`);
  console.log(`  Tempo total (relógio): ${tempoReal}s`);
  console.log(`  Rendimento           : ${rendimento} req/s`);

  if (tempos.length > 0) {
    console.log("\n── Latências (todos os requests) ───────────────");
    console.log(`  Mínimo : ${Math.min(...tempos)}ms`);
    console.log(
      `  Médio  : ${(tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(2)}ms`,
    );
    console.log(`  P50    : ${percentil(tempos, 0.5)}ms`);
    console.log(`  P95    : ${percentil(tempos, 0.95)}ms`);
    console.log(`  P99    : ${percentil(tempos, 0.99)}ms`);
    console.log(`  Máximo : ${Math.max(...tempos)}ms`);
  }

  console.log("\n── Por rota ─────────────────────────────────────");
  Object.entries(metricasPorRota).forEach(([descricao, m]) => {
    const total = m.sucessos + m.falhas;
    if (total === 0) return;
    const med =
      m.tempos.length > 0
        ? (m.tempos.reduce((a, b) => a + b, 0) / m.tempos.length).toFixed(0)
        : "—";
    const p95r = m.tempos.length > 0 ? percentil(m.tempos, 0.95) : "—";
    console.log(
      `  ${descricao.padEnd(22)} | ${String(total).padStart(4)} req | médio ${String(med).padStart(4)}ms | P95 ${String(p95r).padStart(4)}ms | falhas ${m.falhas}`,
    );
  });

  if (Object.keys(instanciaContador).length > 0) {
    console.log("\n── Distribuição por instância (Round-Robin) ────");
    const totalInst = Object.values(instanciaContador).reduce(
      (a, b) => a + b,
      0,
    );
    Object.entries(instanciaContador)
      .sort((a, b) => b[1] - a[1])
      .forEach(([inst, count]) => {
        const pct = ((count / totalInst) * 100).toFixed(1);
        const barra = "█".repeat(Math.round(pct / 5));
        console.log(
          `  ${inst.padEnd(20)} | ${String(count).padStart(5)} req (${String(pct).padStart(5)}%) ${barra}`,
        );
      });
    console.log("\n  Distribuição uniforme esperada: cada instância ~igual.");
    console.log(
      "  Desvios grandes indicam round-robin com falhas ou instâncias lentas.",
    );
  }

  console.log("\n── Avaliação ─────────────────────────────────────");
  if (parseFloat(taxaFalha) > 5)
    console.log(
      "  ⚠ Taxa de falha alta — verifica se todas as instâncias estão activas.",
    );
  if (percentil(tempos, 0.99) > 1000)
    console.log(
      "  ⚠ P99 acima de 1s — algumas instâncias podem estar sobrecarregadas.",
    );
  if (parseFloat(taxaSucesso) === 100)
    console.log("  ✓ Sem falhas detectadas.");
  if (parseFloat(rendimento) > 100)
    console.log(
      `  ✓ Rendimento sólido (${rendimento} req/s) — o gateway está a distribuir bem a carga.`,
    );
}

// ─── Ponto de entrada ─────────────────────────────────────────────────────────

async function executarTeste() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║      TESTE DE CARGA — MICROSERVIÇOS          ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`\n  Gateway    : ${GATEWAY}`);
  console.log(`  Requests   : ${NUM_REQUESTS}`);
  console.log(`  Concorrência: ${CONCURRENT_REQUESTS}\n`);

  console.log("── A verificar gateway ──────────────────────────");
  const ok = await verificarGateway();
  if (!ok) process.exit(1);

  console.log("\n── A iniciar teste ──────────────────────────────");
  const limit = criarSemaforo(CONCURRENT_REQUESTS);
  const inicio = Date.now();

  const promises = Array.from({ length: NUM_REQUESTS }, (_, i) =>
    limit(() => fazerRequisicao(i + 1)),
  );
  await Promise.all(promises);

  const tempoRealMs = Date.now() - inicio;
  imprimirResultados(tempoRealMs);
}

executarTeste();
