# Projeto API — Loja de Vendas Online
> Trabalho prático da disciplina de **Sistemas Distribuídos**  
> API Monolítica e Microserviços com API Gateway — desenvolvido em Node.js

---

## Estrutura do Projeto

```
Projeto-api/
├── Monolito/
│   ├── app.js            ← Servidor único com tudo junto (porta 4000)
│   └── package.json
│
└── Microservicos/
    ├── gateway/
    │   └── gateway.js    ← Ponto de entrada único (porta 5000)
    ├── utilizadores/
    │   └── servico.js    ← Serviço independente (porta 5001)
    ├── produtos/
    │   └── servico.js    ← Serviço independente (porta 5002)
    └── pedidos/
        └── servico.js    ← Serviço independente (porta 5003)

```

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [Postman](https://www.postman.com/) para testar

Verificar se o Node está instalado:
```bash
node -v
npm -v
```

---

## Instalação

```bash
# Monolito
cd Monolito
npm install

# Microserviços
cd Microservicos
npm install
```

---

## Como Correr

### Monolito
Abrir **1 terminal**:
```bash
cd Monolito
npm start
```
Servidor disponível em: `http://localhost:4000`

---

### Microserviços
Abrir **4 terminais separados**, todos dentro da pasta `Microservicos/`:

```bash
# Terminal 1
npm run utilizadores     # http://localhost:5001

# Terminal 2
npm run produtos         # http://localhost:5002

# Terminal 3
npm run pedidos          # http://localhost:5003

# Terminal 4 — iniciar sempre por último
npm run gateway          # http://localhost:5000
```

> O Gateway deve ser sempre o **último** a iniciar, pois depende dos outros serviços estarem ativos.

---

## Rotas Disponíveis

### Monolito — `http://localhost:4000`

| Método | URL | Descrição |
|--------|-----|-----------|
| GET | `/utilizadores` | Lista todos os utilizadores |
| GET | `/utilizadores/:id` | Devolve utilizador pelo ID |
| POST | `/utilizadores` | Cria novo utilizador |
| GET | `/produtos` | Lista todos os produtos |
| GET | `/produtos/:id` | Devolve produto pelo ID |
| POST | `/produtos` | Cria novo produto |
| GET | `/pedidos` | Lista todos os pedidos |
| GET | `/pedidos/:id` | Devolve pedido pelo ID |
| POST | `/pedidos` | Cria novo pedido |

### Gateway — `http://localhost:5000`

As mesmas rotas acima, mais:

| Método | URL | Descrição |
|--------|-----|-----------|
| GET | `/pedidos/:id/detalhes` | Agrega dados dos 3 serviços numa só resposta |

---

## Exemplos de Teste (Postman)

### GET — Listar produtos
```
GET http://localhost:5000/produtos
```

### GET — Detalhes completos de um pedido (agregação)
```
GET http://localhost:5000/pedidos/1/detalhes
```
Resposta:
```json
{
  "pedido_id": 1,
  "quantidade": 1,
  "utilizador": { "id": 1, "nome": "Ana Silva", "email": "ana@email.com" },
  "produto": { "id": 3, "nome": "Ténis", "preco": 80 },
  "total": "80.00 €"
}
```

### POST — Criar utilizador
```
POST http://localhost:5000/utilizadores
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@email.com"
}
```

### POST — Criar pedido
```
POST http://localhost:5000/pedidos
Content-Type: application/json

{
  "utilizador_id": 1,
  "produto_id": 2,
  "quantidade": 3
}
```

---

## Diferença entre Monolito e Microserviços

| Característica | Monolito | Microserviços + Gateway |
|----------------|----------|-------------------------|
| Processos | 1 só processo | 4 processos independentes |
| Porta de acesso | 4000 | 5000 (Gateway) |
| Comunicação | Interna | HTTP entre serviços |
| Falha | Afeta todo o sistema | Apenas o serviço afetado |
| Escalabilidade | Tudo junto | Por serviço individualmente |
