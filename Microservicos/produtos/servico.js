const express = require("express");
const app = express();

app.use(express.json());


const INSTANCE_ID = process.env.INSTANCE_ID || `produtos-${process.pid}`;
const PORT = process.env.PORT || 5002;

const produtos = [
  { id: 1, nome: "Camisola", preco: 25.0 },
  { id: 2, nome: "Calças", preco: 45.0 },
  { id: 3, nome: "Ténis", preco: 80.0 },
];


app.use((req, res, next) => {
  console.log(`[${INSTANCE_ID}] ${req.method} ${req.url}`);
  res.setHeader("X-Instance-ID", INSTANCE_ID);
  next();
});


app.get("/health", (req, res) => {
  res.json({ status: "ok", instance: INSTANCE_ID, porta: PORT });
});

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


app.listen(PORT, () => {
  console.log(`[${INSTANCE_ID}] Serviço de Produtos a correr em http://localhost:${PORT}`);
});