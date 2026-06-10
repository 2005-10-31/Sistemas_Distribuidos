# Projeto API — Loja de Vendas Online

> Trabalho prático da disciplina de **Sistemas Distribuídos** — Trabalhos 01, 02 e 03  
> API Monolítica e Microserviços com API Gateway, Load Balancing Round-Robin e Autenticação JWT  
> Desenvolvido em Node.js | Universidade do Mindelo — 3.º Ano EISC

---

## Estrutura do Projeto

```
Sistemas_Distribuidos/
├── README.md
│
├── Monolito/
│   ├── app.js                     ← Servidor único (porta 4000) + JWT
│   ├── testeCargaMono.js          ← Script de teste de carga
│   └── package.json
│
└── Microservicos/
    ├── gateway/
    │   └── gateway.js             ← Gateway com Round-Robin + JWT (porta 5000)
    ├── utilizadores/
    │   └── servico.js             ← Serviço independente (portas 5001, 5011, 5021)
    ├── produtos/
    │   └── servico.js             ← Serviço independente (portas 5002, 5012)
    ├── pedidos/
    │   └── servico.js             ← Serviço independente (porta 5003)
    ├── testeCargaMicro.js         ← Script de teste de carga com tracking Round-Robin
    └── package.json
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [Postman](https://www.postman.com/) para testar a API

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

O projeto usa **6 instâncias de serviços + 1 Gateway**, distribuídas assim:

| Serviço      | Instâncias  | Portas           |
| ------------ | ----------- | ---------------- |
| utilizadores | 3 réplicas  | 5001, 5011, 5021 |
| produtos     | 2 réplicas  | 5002, 5012       |
| pedidos      | 1 instância | 5003             |
| gateway      | 1           | 5000             |

**Opção 1 — Iniciar tudo com um único comando** (recomendado):

```bash
cd Microservicos
npm run start:all
```

Este comando usa `concurrently` para arrancar as 6 instâncias de serviços e o Gateway em simultâneo num único terminal.

**Opção 2 — Terminais separados** (para ver os logs de cada serviço individualmente):

```bash
# Terminal 1 — 3 instâncias de utilizadores
PORT=5001 INSTANCE_ID=utilizadores-1 node utilizadores/servico.js
PORT=5011 INSTANCE_ID=utilizadores-2 node utilizadores/servico.js
PORT=5021 INSTANCE_ID=utilizadores-3 node utilizadores/servico.js

# Terminal 2 — 2 instâncias de produtos
PORT=5002 INSTANCE_ID=produtos-1 node produtos/servico.js
PORT=5012 INSTANCE_ID=produtos-2 node produtos/servico.js

# Terminal 3 — pedidos
PORT=5003 INSTANCE_ID=pedidos-1 node pedidos/servico.js

# Terminal 4 — Gateway (iniciar sempre por último)
npm run gateway
```

> O Gateway deve ser sempre o **último** a iniciar, pois verifica os serviços ao arrancar.

Gateway disponível em: `http://localhost:5000`

---

## Load Balancing — Round-Robin

O Gateway distribui os pedidos pelas instâncias de cada serviço usando o algoritmo **Round-Robin**: cada novo pedido vai para a próxima instância da lista, em rotação.

```
Pedido 1 → utilizadores-1 (5001)
Pedido 2 → utilizadores-2 (5011)
Pedido 3 → utilizadores-3 (5021)
Pedido 4 → utilizadores-1 (5001)  ← volta ao início
```

O Gateway inclui o header `X-Instance-ID` nas respostas, permitindo identificar qual instância respondeu a cada pedido. O `/health` mostra os contadores Round-Robin em tempo real:

```
GET http://localhost:5000/health
```

---

## Mecanismo de Segurança — Autenticação JWT

O projeto usa **JWT (JSON Web Token)** para autenticação stateless. O servidor não guarda sessões — o token contém toda a informação necessária para ser verificado por qualquer instância.

### Fluxo de autenticação

1. Cliente faz `POST /login` com username e password
2. Servidor valida as credenciais e devolve um token JWT (válido 1 hora)
3. Cliente inclui o token em todos os pedidos seguintes:
   ```
   Authorization: Bearer <token>
   ```
4. Servidor verifica o token — devolve `401` se ausente, expirado ou inválido

### Onde é verificado o JWT

|                   | Monolito                       | Microserviços                              |
| ----------------- | ------------------------------ | ------------------------------------------ |
| Onde verifica     | No próprio servidor (`app.js`) | Só no Gateway (`gateway.js`)               |
| Serviços internos | N/A                            | Não precisam de verificar JWT              |
| Porquê?           | Um único processo              | Gateway é o único ponto de entrada externo |

Em Microserviços, a verificação fica centralizada no Gateway porque os serviços internos (utilizadores, produtos, pedidos) nunca são acessíveis diretamente do exterior.

### Credenciais de teste

| Username | Password |
| -------- | -------- |
| admin    | 1234     |
| kelly    | kelly123 |

---

## Rotas Disponíveis

> Todas as rotas, exceto `/health` e `/login`, requerem o header `Authorization: Bearer <token>`.

### Monolito — `http://localhost:4000`

| Método | URL                 | Auth | Descrição                    |
| ------ | ------------------- | :--: | ---------------------------- |
| POST   | `/login`            | Não  | Autenticar e obter token JWT |
| GET    | `/health`           | Não  | Estado do servidor           |
| GET    | `/utilizadores`     | Sim  | Lista todos os utilizadores  |
| GET    | `/utilizadores/:id` | Sim  | Devolve utilizador pelo ID   |
| POST   | `/utilizadores`     | Sim  | Cria novo utilizador         |
| GET    | `/produtos`         | Sim  | Lista todos os produtos      |
| GET    | `/produtos/:id`     | Sim  | Devolve produto pelo ID      |
| POST   | `/produtos`         | Sim  | Cria novo produto            |
| GET    | `/pedidos`          | Sim  | Lista todos os pedidos       |
| GET    | `/pedidos/:id`      | Sim  | Devolve pedido pelo ID       |
| POST   | `/pedidos`          | Sim  | Cria novo pedido             |

### Gateway — `http://localhost:5000`

As mesmas rotas acima, mais:

| Método | URL                     | Auth | Descrição                                    |
| ------ | ----------------------- | :--: | -------------------------------------------- |
| POST   | `/login`                | Não  | Autenticar e obter token JWT                 |
| GET    | `/health`               | Não  | Estado do Gateway + contadores Round-Robin   |
| GET    | `/pedidos/:id/detalhes` | Sim  | Agrega dados dos 3 serviços numa só resposta |

---

## Testes de Carga

Dois scripts medem o comportamento sob carga (**5000 requisições, 50 em simultâneo**), usando um semáforo manual sem dependências externas.

### Monolito

```bash
cd Monolito
node testeCargaMono.js
```

- 3 rotas testadas aleatoriamente (utilizadores, produtos, pedidos)
- Métricas: Mín · Médio · P50 · P95 · P99 · req/s · por rota

### Microserviços

```bash
cd Microservicos
node testeCargaMicro.js
```

- 6 rotas com pesos diferentes para simular tráfego real
- 3 rotas de agregação (`/pedidos/:id/detalhes`) incluídas
- Tracking do header `X-Instance-ID` — mostra distribuição Round-Robin por instância
- Avaliação automática do equilíbrio entre instâncias

### O que cada script mede a mais

| Capacidade                         | Monolito | Microserviços |
| ---------------------------------- | :------: | :-----------: |
| Rotas de listagem (GET)            |   Sim    |      Sim      |
| Rotas de agregação (3 serviços)    |   Não    |    **Sim**    |
| Tracking Round-Robin por instância |   Não    |    **Sim**    |
| Gráfico de distribuição (barras)   |   Não    |    **Sim**    |
| Avaliação de equilíbrio automática |   Não    |    **Sim**    |

---

## Exemplos de Pedidos

### Login — obter token

```
POST http://localhost:4000/login
Content-Type: application/json

{
  "username": "admin",
  "password": "1234"
}
```

Resposta:

```json
{
  "mensagem": "Login bem-sucedido",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expira_em": "1h"
}
```

### Listar produtos (com token)

```
GET http://localhost:5000/produtos
Authorization: Bearer <token>
```

### Detalhes completos de um pedido (agregação — exclusivo Gateway)

```
GET http://localhost:5000/pedidos/1/detalhes
Authorization: Bearer <token>
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

### Criar utilizador

```
POST http://localhost:5000/utilizadores
Authorization: Bearer <token>
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@email.com"
}
```

### Erro sem token

```
GET http://localhost:4000/utilizadores
(sem header Authorization)
```

```json
{ "erro": "Token não fornecido" }
```

---

## Diferença entre Monolito e Microserviços

| Característica         | Monolito               | Microserviços + Gateway               |
| ---------------------- | ---------------------- | ------------------------------------- |
| Processos em execução  | 1                      | 7 (6 serviços + 1 gateway)            |
| Porta de acesso        | 4000                   | 5000 (Gateway)                        |
| Comunicação interna    | Direta (memória)       | HTTP entre serviços                   |
| Instâncias por serviço | 1                      | 3 utilizadores, 2 produtos, 1 pedidos |
| Load Balancing         | Não tem                | Round-Robin automático                |
| Falha de um serviço    | Afeta todo o sistema   | Apenas o serviço afetado              |
| Escalabilidade         | Tudo junto ou nada     | Por serviço individualmente           |
| Autenticação JWT       | No servidor (`app.js`) | No Gateway (`gateway.js`)             |
| Rotas de agregação     | Não tem                | `/pedidos/:id/detalhes`               |
