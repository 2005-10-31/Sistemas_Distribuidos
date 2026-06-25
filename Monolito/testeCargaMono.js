const axios = require("axios");

const BASE = "http://localhost:4000";

const ROTAS = [
  { url: `${BASE}/utilizadores`, descricao: "listar utilizadores" },
  { url: `${BASE}/produtos`, descricao: "listar produtos" },
  { url: `${BASE}/pedidos`, descricao: "listar pedidos" },
];

const NUM_REQUESTS = 5000;
const CONCURRENT_REQUESTS = 50;

let sucessos = 0;
let falhas = 0;
const tempos = [];

const metricasPorRota = {};
ROTAS.forEach((r) => {
  metricasPorRota[r.descricao] = { sucessos: 0, falhas: 0, tempos: [] };
});

// Semáforo simples sem dependências externas
// Limita quantas tarefas assíncronas correm ao mesmo tempo (no máximo "limiteMaximo").
function criarSemaforo(limiteMaximo) {
  let emExecucao = 0; // quantas tarefas estão a correr neste momento
  const aEsperar = []; // tarefas em fila, à espera de vaga

  // chamada sempre que uma tarefa acaba: liberta a vaga e dá lugar ao próximo da fila
  function libertarVaga() {
    emExecucao--;
    const proximo = aEsperar.shift();
    if (proximo) proximo();
  }

  return function executar(tarefa) {
    return new Promise((resolve, reject) => {
      // o que fazer quando houver vaga para esta tarefa
      const arrancar = () => {
        emExecucao++;
        tarefa()
          .then(resolve, reject) // reencaminha sucesso E erro para quem chamou
          .finally(libertarVaga);
      };

      // havendo vaga, arranca já; senão, fica à espera na fila
      if (emExecucao < limiteMaximo) {
        arrancar();
      } else {
        aEsperar.push(arrancar);
      }
    });
  };
}

function percentil(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

// Passo 1 — login para obter token JWT antes de iniciar o teste
async function obterToken() {
  const res = await axios.post(`${BASE}/login`, {
    username: "admin",
    password: "1234",
  });
  return res.data.token;
}

// Verificação de saúde antes de começar
async function verificarServidor() {
  try {
    const res = await axios.get(`${BASE}/health`, { timeout: 3000 });
    console.log(`  Servidor OK — instância: ${res.data.instance}`);
    return true;
  } catch {
    console.error("  ERRO: Servidor não está acessível em", BASE);
    console.error("  Certifica-te que o app.js está a correr (npm start)");
    return false;
  }
}

async function fazerRequisicao(id, token) {
  const rota = ROTAS[Math.floor(Math.random() * ROTAS.length)];
  const inicio = Date.now();

  try {
    const res = await axios.get(rota.url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    const tempo = Date.now() - inicio;

    tempos.push(tempo);
    sucessos++;
    metricasPorRota[rota.descricao].sucessos++;
    metricasPorRota[rota.descricao].tempos.push(tempo);

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

function imprimirResultados(tempoRealMs) {
  const tempoReal = (tempoRealMs / 1000).toFixed(2);
  const rendimento = (sucessos / (tempoRealMs / 1000)).toFixed(2);
  const taxaSucesso = ((sucessos / NUM_REQUESTS) * 100).toFixed(2);
  const taxaFalha = ((falhas / NUM_REQUESTS) * 100).toFixed(2);

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║         RESULTADOS — MONOLITO                ║");
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

  console.log("\n── Avaliação ─────────────────────────────────────");
  if (parseFloat(taxaFalha) > 5)
    console.log(
      "  ⚠ Taxa de falha alta — o servidor pode estar sobrecarregado.",
    );
  if (percentil(tempos, 0.99) > 1000)
    console.log("  ⚠ P99 acima de 1s — o processo único está a criar gargalo.");
  if (parseFloat(taxaSucesso) === 100)
    console.log("  ✓ Sem falhas detectadas.");
  if (parseFloat(rendimento) > 100)
    console.log(`  ✓ Rendimento sólido (${rendimento} req/s).`);
}

async function executarTeste() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       TESTE DE CARGA — MONOLITO              ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`\n  Servidor    : ${BASE}`);
  console.log(`  Requests    : ${NUM_REQUESTS}`);
  console.log(`  Concorrência: ${CONCURRENT_REQUESTS}\n`);

  console.log("── A verificar servidor ─────────────────────────");
  const ok = await verificarServidor();
  if (!ok) process.exit(1);

  console.log("\n── A fazer login (JWT) ───────────────────────────");
  const token = await obterToken();
  console.log("  Token obtido com sucesso.\n");

  console.log("── A iniciar teste ──────────────────────────────");
  const limit = criarSemaforo(CONCURRENT_REQUESTS);
  const inicio = Date.now();

  const promises = Array.from({ length: NUM_REQUESTS }, (_, i) =>
    limit(() => fazerRequisicao(i + 1, token)),
  );
  await Promise.all(promises);

  const tempoRealMs = Date.now() - inicio;
  imprimirResultados(tempoRealMs);
}

executarTeste();
