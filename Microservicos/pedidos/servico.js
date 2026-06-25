require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.json());

const INSTANCE_ID = process.env.INSTANCE_ID || `pedidos-${process.pid}`;
const PORT = process.env.PORT || 5003;

const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN;

if (!INTERNAL_TOKEN) {
  console.error("ERRO: INTERNAL_TOKEN deve estar definido no .env");
  process.exit(1);
}

const pedidos = [
  { id: 1, utilizador_id: 1, produto_id: 3, quantidade: 1 },
  { id: 2, utilizador_id: 2, produto_id: 1, quantidade: 2 },
  { id: 3, utilizador_id: 3, produto_id: 2, quantidade: 1 },
];

app.use((req, res, next) => {
  console.log(`[${INSTANCE_ID}] ${req.method} ${req.url}`);
  res.setHeader("X-Instance-ID", INSTANCE_ID);
  next();
});

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.headers["x-internal-token"] !== INTERNAL_TOKEN) {
    return res
      .status(403)
      .json({ erro: "Acesso direto não autorizado. Use o Gateway" });
  }
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", instance: INSTANCE_ID, porta: PORT });
});

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

app.listen(PORT, () => {
  console.log(
    `[${INSTANCE_ID}] Serviço de Pedidos a correr em http://localhost:${PORT}`,
  );
});
