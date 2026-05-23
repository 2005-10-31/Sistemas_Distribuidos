import pLimit from "p-limit";

const express = require("express");
const app = express();

app.use(express.json());

// lê o nome da instância e a porta do ambiente
const INSTANCE_ID = process.env.INSTANCE_ID || `mono-${process.pid}`;
const PORT = process.env.PORT || 4000;

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

//  middleware que corre antes de qualquer rota
// regista no terminal qual instância recebeu o pedido
// e adiciona o header X-Instance-ID à resposta
app.use((req, res, next) => {
  console.log(`[${INSTANCE_ID}] ${req.method} ${req.url}`);
  res.setHeader("X-Instance-ID", INSTANCE_ID);
  next();
});

// rota de saúde, útil para verificar se a instância está viva
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    instance: INSTANCE_ID,
    porta: PORT,
    uptime: process.uptime(),
  });
});

// ROTAS DE UTILIZADORES

app.get("/utilizadores", (req, res) => {
  // adiciona "instance" à resposta para ver qual instância respondeu
  res.json({ instance: INSTANCE_ID, dados: utilizadores });
});

app.get("/utilizadores/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const u = utilizadores.find((u) => u.id === id);
  if (u) return res.json({ instance: INSTANCE_ID, dados: u }); // ALTERADO
  res.status(404).json({ erro: "Utilizador não encontrado" });
});

app.post("/utilizadores", (req, res) => {
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

// ROTAS DE PRODUTOS

app.get("/produtos", (req, res) => {
  res.json({ instance: INSTANCE_ID, dados: produtos });
});

app.get("/produtos/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const p = produtos.find((p) => p.id === id);
  if (p) return res.json({ instance: INSTANCE_ID, dados: p });
  res.status(404).json({ erro: "Produto não encontrado" });
});

app.post("/produtos", (req, res) => {
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

// ROTAS DE PEDIDOS

app.get("/pedidos", (req, res) => {
  res.json({ instance: INSTANCE_ID, dados: pedidos });
});

app.get("/pedidos/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const p = pedidos.find((p) => p.id === id);
  if (p) return res.json({ instance: INSTANCE_ID, dados: p });
  res.status(404).json({ erro: "Pedido não encontrado" });
});

app.post("/pedidos", (req, res) => {
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

// INICIAR O SERVIDOR
// usa PORT em vez de 4000 fixo, e mostra o INSTANCE_ID no arranque
app.listen(PORT, () => {
  console.log(
    `[${INSTANCE_ID}] Servidor monolítico a correr em http://localhost:${PORT}`,
  );
});
