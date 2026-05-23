const express = require("express");
const app = express();

app.use(express.json());


const INSTANCE_ID = process.env.INSTANCE_ID || `utilizadores-${process.pid}`;
const PORT = process.env.PORT || 5001;

const utilizadores = [
  { id: 1, nome: "Ana Silva", email: "ana@email.com" },
  { id: 2, nome: "Bruno Costa", email: "bruno@email.com" },
  { id: 3, nome: "Carla Mendes", email: "carla@email.com" },
];


app.use((req, res, next) => {
  console.log(`[${INSTANCE_ID}] ${req.method} ${req.url}`);
  res.setHeader("X-Instance-ID", INSTANCE_ID);
  next();
});


app.get("/health", (req, res) => {
  res.json({ status: "ok", instance: INSTANCE_ID, porta: PORT });
});

app.get("/utilizadores", (req, res) => {
  res.json({ instance: INSTANCE_ID, dados: utilizadores }); 
});

app.get("/utilizadores/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const u = utilizadores.find((u) => u.id === id);
  if (u) return res.json({ instance: INSTANCE_ID, dados: u }); 
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


app.listen(PORT, () => {
  console.log(`[${INSTANCE_ID}] Serviço de Utilizadores a correr em http://localhost:${PORT}`);
});