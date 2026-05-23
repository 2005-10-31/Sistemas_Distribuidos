const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

// em vez de 1 endereço por serviço, temos uma LISTA de instâncias
// O utilizadores tem 3 réplicas, produtos tem 2, pedidos tem 1
const INSTANCIAS = {
  utilizadores: [
    "http://localhost:5001", // utilizadores-1
    "http://localhost:5011", // utilizadores-2
    "http://localhost:5021", // utilizadores-3
  ],
  produtos: [
    "http://localhost:5002", // produtos-1
    "http://localhost:5012", // produtos-2
  ],
  pedidos: [
    "http://localhost:5003", // pedidos-1 (só 1 instância)
  ],
};

// contador Round-Robin por serviço
// Começa em 0 e vai avançando a cada pedido
const rrContador = {
  utilizadores: 0,
  produtos: 0,
  pedidos: 0,
};

// função Round-Robin
// Devolve o próximo endereço da lista, voltando ao início quando chega ao fim
function proximaInstancia(servico) {
  const lista = INSTANCIAS[servico];
  const indice = rrContador[servico] % lista.length;
  rrContador[servico]++;
  const escolhida = lista[indice];
  console.log(
    `[GATEWAY] Round-Robin → ${servico} → ${escolhida} (pedido #${rrContador[servico]})`,
  );
  return escolhida;
}

// MIDDLEWARE DE LOGGING — já existia, só adicionamos o GATEWAY no log
app.use((req, res, next) => {
  const hora = new Date().toLocaleTimeString("pt-PT");
  console.log(`[GATEWAY] ${hora} | ${req.method} ${req.path}`);
  next();
});

// rota de saúde do gateway, mostra o estado de todas as instâncias
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    algoritmo: "round-robin",
    servicos: INSTANCIAS,
    contadores: rrContador,
  });
});

// ROTA DE AGREGAÇÃO — já existia, só usa agora proximaInstancia()
app.get("/pedidos/:id/detalhes", async (req, res) => {
  const { id } = req.params;
  console.log(
    `[GATEWAY] Agregação - a consultar os 3 serviços para pedido ${id}`,
  );

  try {
    const respostaPedido = await axios.get(
      `${proximaInstancia("pedidos")}/pedidos/${id}`,
    );
    //  — agora os dados vêm em .dados porque os serviços foram alterados
    const pedido = respostaPedido.data.dados;

    const [respostaUtilizador, respostaProduto] = await Promise.all([
      axios.get(
        `${proximaInstancia("utilizadores")}/utilizadores/${pedido.utilizador_id}`,
      ),
      axios.get(
        `${proximaInstancia("produtos")}/produtos/${pedido.produto_id}`,
      ),
    ]);

    const utilizador = respostaUtilizador.data.dados;
    const produto = respostaProduto.data.dados;

    res.json({
      pedido_id: pedido.id,
      quantidade: pedido.quantidade,
      utilizador,
      produto,
      total: (produto.preco * pedido.quantidade).toFixed(2) + " €",
    });
  } catch (erro) {
    if (erro.response && erro.response.status === 404) {
      return res.status(404).json({ erro: "Pedido não encontrado" });
    }
    res.status(503).json({ erro: "Um ou mais serviços estão indisponíveis" });
  }
});

// PROXY GET — listar todos —  para usar proximaInstancia()
app.get("/:servico", async (req, res) => {
  const { servico } = req.params;
  if (!INSTANCIAS[servico]) {
    return res.status(404).json({ erro: "Serviço não encontrado" });
  }

  try {
    const url = proximaInstancia(servico);
    console.log(`[GATEWAY] Reencaminhando → ${url}/${servico}`);
    const resposta = await axios.get(`${url}/${servico}`);
    res.json(resposta.data);
  } catch (erro) {
    res.status(503).json({ erro: `Serviço ${servico} indisponível` });
  }
});

// PROXY GET por id —
app.get("/:servico/:id", async (req, res) => {
  const { servico, id } = req.params;
  if (!INSTANCIAS[servico]) {
    return res.status(404).json({ erro: "Serviço não encontrado" });
  }

  try {
    const url = proximaInstancia(servico);
    console.log(`[GATEWAY] Reencaminhando → ${url}/${servico}/${id}`);
    const resposta = await axios.get(`${url}/${servico}/${id}`);
    res.json(resposta.data);
  } catch (erro) {
    res.status(503).json({ erro: `Serviço ${servico} indisponível` });
  }
});

// PROXY POST —  usar proximaInstancia()
app.post("/:servico", async (req, res) => {
  const { servico } = req.params;
  if (!INSTANCIAS[servico]) {
    return res.status(404).json({ erro: "Serviço não encontrado" });
  }

  try {
    const url = proximaInstancia(servico);
    console.log(`[GATEWAY] POST reencaminhado → ${url}/${servico}`);
    const resposta = await axios.post(`${url}/${servico}`, req.body);
    res.status(201).json(resposta.data);
  } catch (erro) {
    if (erro.response) {
      return res.status(erro.response.status).json(erro.response.data);
    }
    res.status(503).json({ erro: `Serviço ${servico} indisponível` });
  }
});

// INICIAR O GATEWAY
app.listen(5000, () => {
  console.log("API Gateway com Round-Robin a correr em http://localhost:5000");
  console.log("Instâncias registadas:");
  Object.entries(INSTANCIAS).forEach(([servico, lista]) => {
    console.log(`  → ${servico}: ${lista.join(", ")}`);
  });
});
