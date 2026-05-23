const axios = require("axios");

const URLS = [
  "http://localhost:4000/utilizadores",
  "http://localhost:4000/produtos",
  "http://localhost:4000/pedidos",
];

const NUM_REQUESTS = 5000;
const CONCURRENT_REQUESTS = 50;

let sucessos = 0;
let falhas = 0;
let tempos = [];

// Semáforo simples sem dependências
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

async function fazerRequisicao(id) {
  const url = URLS[Math.floor(Math.random() * URLS.length)];
  const inicio = Date.now();
  try {
    const res = await axios.get(url);
    const tempo = Date.now() - inicio;
    tempos.push(tempo);
    sucessos++;
    console.log(`Request ${id} -> ${res.status} | ${tempo}ms | ${url}`);
  } catch (err) {
    falhas++;
    console.log(`Request ${id} -> Erro: ${err.message}`);
  }
}

async function executarTeste() {
  console.log("\n==== TESTE DE CARGA NO MONOLITO =====\n");

  const limit = criarSemaforo(CONCURRENT_REQUESTS);
  const inicio = Date.now();

  const promises = Array.from({ length: NUM_REQUESTS }, (_, i) =>
    limit(() => fazerRequisicao(i + 1)),
  );
  await Promise.all(promises);

  const tempoRealMs = Date.now() - inicio;

  const tempoMedio =
    tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

  const rendimento = (sucessos / (tempoRealMs / 1000)).toFixed(2);

  console.log("\n==== RESULTADOS ====");
  console.log(`Total de requisições: ${NUM_REQUESTS}`);
  console.log(
    `Sucessos: ${sucessos} (${((sucessos / NUM_REQUESTS) * 100).toFixed(2)}%)`,
  );
  console.log(
    `Falhas:   ${falhas}   (${((falhas / NUM_REQUESTS) * 100).toFixed(2)}%)`,
  );
  console.log(`Tempo médio: ${tempoMedio.toFixed(2)}ms`);
  console.log(`Tempo total: ${(tempoRealMs / 1000).toFixed(2)}s`);
  console.log(`Rendimento:  ${rendimento} req/s`);
}

executarTeste();
