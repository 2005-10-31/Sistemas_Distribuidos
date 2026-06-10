const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// Chave secreta JWT
const JWT_SECRET = "Sdistribuidos2026";
const JWT_EXPIRACAO = "1h";

// Utilizadores com permissão para fazer login
const utilizadoresAdmin = [
  { id: 1, username: "admin", password: "1234" },
  { id: 2, username: "kelly", password: "kelly123" },
];

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
const rrContador = {
  utilizadores: 0,
  produtos: 0,
  pedidos: 0,
};

// função Round-Robin — devolve o próximo endereço da lista
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

// MIDDLEWARE DE LOGGING
app.use((req, _res, next) => {
  const hora = new Date().toLocaleTimeString("pt-PT");
  console.log(`[GATEWAY] ${hora} | ${req.method} ${req.path}`);
  next();
});

// MIDDLEWARE DE AUTENTICAÇÃO JWT
// Toda a verificação de segurança fica aqui no Gateway.
// Os serviços internos não precisam de verificar — confiam no Gateway.

function verificarToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }

  const partes = authHeader.split(" ");
  if (partes.length !== 2 || partes[0] !== "Bearer") {
    return res
      .status(401)
      .json({ erro: "Formato inválido. Use: Authorization: Bearer <token>" });
  }

  const token = partes[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.utilizador = payload;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ erro: "Token expirado. Faça login novamente." });
    }
    return res.status(401).json({ erro: "Token inválido." });
  }
}

// Rota de saúde do gateway — não precisa de autenticação
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    algoritmo: "round-robin",
    servicos: INSTANCIAS,
    contadores: rrContador,
  });
});

// POST /login → valida credenciais e devolve um JWT
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ erro: "Os campos 'username' e 'password' são obrigatórios" });
  }

  const admin = utilizadoresAdmin.find(
    (u) => u.username === username && u.password === password,
  );

  if (!admin) {
    return res.status(401).json({ erro: "Credenciais inválidas" });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRACAO },
  );

  console.log(`[GATEWAY] Login bem-sucedido: ${username}`);
  res.json({
    mensagem: "Login bem-sucedido",
    token,
    expira_em: JWT_EXPIRACAO,
  });
});

// ROTAS PROTEGIDAS — todas passam pelo verificarToken antes do proxy
// Rota de agregação — consulta os 3 serviços para um pedido completo
app.get("/pedidos/:id/detalhes", verificarToken, async (req, res) => {
  const { id } = req.params;
  console.log(
    `[GATEWAY] Agregação - a consultar os 3 serviços para pedido ${id}`,
  );

  try {
    const respostaPedido = await axios.get(
      `${proximaInstancia("pedidos")}/pedidos/${id}`,
    );
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

// PROXY GET — listar todos
app.get("/:servico", verificarToken, async (req, res) => {
  const { servico } = req.params;
  if (!INSTANCIAS[servico]) {
    return res.status(404).json({ erro: "Serviço não encontrado" });
  }

  try {
    const url = proximaInstancia(servico);
    console.log(`[GATEWAY] Reencaminhando → ${url}/${servico}`);
    const resposta = await axios.get(`${url}/${servico}`);
    const instanciaId = resposta.headers["x-instance-id"];
    if (instanciaId) res.setHeader("X-Instance-ID", instanciaId);
    res.json(resposta.data);
  } catch (erro) {
    res.status(503).json({ erro: `Serviço ${servico} indisponível` });
  }
});

// PROXY GET por id
app.get("/:servico/:id", verificarToken, async (req, res) => {
  const { servico, id } = req.params;
  if (!INSTANCIAS[servico]) {
    return res.status(404).json({ erro: "Serviço não encontrado" });
  }

  try {
    const url = proximaInstancia(servico);
    console.log(`[GATEWAY] Reencaminhando → ${url}/${servico}/${id}`);
    const resposta = await axios.get(`${url}/${servico}/${id}`);
    const instanciaId = resposta.headers["x-instance-id"];
    if (instanciaId) res.setHeader("X-Instance-ID", instanciaId);
    res.json(resposta.data);
  } catch (erro) {
    res.status(503).json({ erro: `Serviço ${servico} indisponível` });
  }
});

// PROXY POST
app.post("/:servico", verificarToken, async (req, res) => {
  const { servico } = req.params;
  if (!INSTANCIAS[servico]) {
    return res.status(404).json({ erro: "Serviço não encontrado" });
  }

  try {
    const url = proximaInstancia(servico);
    console.log(`[GATEWAY] POST reencaminhado → ${url}/${servico}`);
    const resposta = await axios.post(`${url}/${servico}`, req.body);
    const instanciaId = resposta.headers["x-instance-id"];
    if (instanciaId) res.setHeader("X-Instance-ID", instanciaId);
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
  console.log("Autenticação JWT activa — faça POST /login para obter token");
  console.log("Instâncias registadas:");
  Object.entries(INSTANCIAS).forEach(([servico, lista]) => {
    console.log(`  → ${servico}: ${lista.join(", ")}`);
  });
});
