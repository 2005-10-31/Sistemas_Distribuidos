require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const INSTANCE_ID = process.env.INSTANCE_ID || `mono-${process.pid}`;
const PORT = process.env.PORT || 4000;

// Configuração de autenticação — vem do .env (fora do repositório)
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRACAO = process.env.JWT_EXPIRATION || "1h";

// Utilizadores com permissão para fazer login — definidos no .env
const utilizadoresAdmin = JSON.parse(process.env.ADMIN_USERS || "[]");

// Sem segredo definido o servidor não deve arrancar
if (!JWT_SECRET) {
  console.error(
    "ERRO: JWT_SECRET deve estar definido no .env (ver .env.example).",
  );
  process.exit(1);
}

// MIDDLEWARE DE LOGGING
app.use((req, res, next) => {
  console.log(`[${INSTANCE_ID}] ${req.method} ${req.url}`);
  res.setHeader("X-Instance-ID", INSTANCE_ID);
  next();
});

// MIDDLEWARE DE AUTENTICAÇÃO JWT
// Verifica se o pedido traz um token válido no header Authorization.
// Formato esperado: Authorization: Bearer <token>
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
    req.utilizador = payload; // disponibiliza dados do utilizador nas rotas
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

// DADOS EM MEMÓRIA
const utilizadores = [
  { id: 1, nome: "Kelly Fortes", email: "kelly@email.com" },
  { id: 2, nome: "Diogo Fortes", email: "diogo@email.com" },
  { id: 3, nome: "Carolina Andrade", email: "carolina@email.com" },
];

const produtos = [
  { id: 1, nome: "Camisola", preco: 25.0 },
  { id: 2, nome: "Calças", preco: 45.0 },
  { id: 3, nome: "Ténis", preco: 80.0 },
];

const pedidos = [
  { id: 1, utilizador_id: 1, produto_id: 3, quantidade: 1 },
  { id: 2, utilizador_id: 2, produto_id: 1, quantidade: 2 },
  { id: 3, utilizador_id: 3, produto_id: 2, quantidade: 1 },
];

// Rota de saúde — útil para verificar se a instância está viva
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    instance: INSTANCE_ID,
    porta: PORT,
    uptime: process.uptime(),
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

  console.log(`[${INSTANCE_ID}] Login bem-sucedido: ${username}`);
  res.json({
    mensagem: "Login bem-sucedido",
    token,
    expira_em: JWT_EXPIRACAO,
  });
});

// ROTAS PROTEGIDAS — requerem token JWT válido

// UTILIZADORES

app.get("/utilizadores", verificarToken, (_req, res) => {
  res.json({ instance: INSTANCE_ID, dados: utilizadores });
});

app.get("/utilizadores/:id", verificarToken, (req, res) => {
  const id = parseInt(req.params.id);
  const u = utilizadores.find((u) => u.id === id);
  if (u) return res.json({ instance: INSTANCE_ID, dados: u });
  res.status(404).json({ erro: "Utilizador não encontrado" });
});

app.post("/utilizadores", verificarToken, (req, res) => {
  const { nome, email } = req.body;
  if (!nome || !email) {
    return res
      .status(400)
      .json({ erro: "Os campos 'nome' e 'email' são obrigatórios" });
  }
  const novo = { id: utilizadores.length + 1, nome, email };
  utilizadores.push(novo);
  console.log(`[${INSTANCE_ID}] Novo utilizador criado: ${nome}`);
  res.status(201).json({ instance: INSTANCE_ID, dados: novo });
});

// PRODUTOS

app.get("/produtos", verificarToken, (_req, res) => {
  res.json({ instance: INSTANCE_ID, dados: produtos });
});

app.get("/produtos/:id", verificarToken, (req, res) => {
  const id = parseInt(req.params.id);
  const p = produtos.find((p) => p.id === id);
  if (p) return res.json({ instance: INSTANCE_ID, dados: p });
  res.status(404).json({ erro: "Produto não encontrado" });
});

app.post("/produtos", verificarToken, (req, res) => {
  const { nome, preco } = req.body;
  if (!nome || preco === undefined) {
    return res
      .status(400)
      .json({ erro: "Os campos 'nome' e 'preco' são obrigatórios" });
  }
  const novo = { id: produtos.length + 1, nome, preco: parseFloat(preco) };
  produtos.push(novo);
  console.log(`[${INSTANCE_ID}] Novo produto criado: ${nome}`);
  res.status(201).json({ instance: INSTANCE_ID, dados: novo });
});

// PEDIDOS

app.get("/pedidos", verificarToken, (req, res) => {
  res.json({ instance: INSTANCE_ID, dados: pedidos });
});

app.get("/pedidos/:id", verificarToken, (req, res) => {
  const id = parseInt(req.params.id);
  const p = pedidos.find((p) => p.id === id);
  if (p) return res.json({ instance: INSTANCE_ID, dados: p });
  res.status(404).json({ erro: "Pedido não encontrado" });
});

app.post("/pedidos", verificarToken, (req, res) => {
  const { utilizador_id, produto_id, quantidade } = req.body;
  if (!utilizador_id || !produto_id || !quantidade) {
    return res.status(400).json({
      erro: "Os campos 'utilizador_id', 'produto_id' e 'quantidade' são obrigatórios",
    });
  }
  const utilizadorExiste = utilizadores.find(
    (u) => u.id === parseInt(utilizador_id),
  );
  const produtoExiste = produtos.find((p) => p.id === parseInt(produto_id));
  if (!utilizadorExiste)
    return res.status(404).json({ erro: "Utilizador não encontrado" });
  if (!produtoExiste)
    return res.status(404).json({ erro: "Produto não encontrado" });

  const novo = {
    id: pedidos.length + 1,
    utilizador_id: parseInt(utilizador_id),
    produto_id: parseInt(produto_id),
    quantidade: parseInt(quantidade),
  };
  pedidos.push(novo);
  console.log(`[${INSTANCE_ID}] Novo pedido criado: #${novo.id}`);
  res.status(201).json({ instance: INSTANCE_ID, dados: novo });
});

// INICIAR SERVIDOR

app.listen(PORT, () => {
  console.log(
    `[${INSTANCE_ID}] Servidor monolítico a correr em http://localhost:${PORT}`,
  );
  console.log(
    `[${INSTANCE_ID}] Autenticação JWT activa — faça POST /login para obter token`,
  );
});
