# Projeto API — Loja de Vendas Online
> Trabalho prático da disciplina de **Sistemas Distribuídos**  
> API Monolítica e Microserviços com API Gateway, Round-Robin e Teste de Carga — desenvolvido em Node.js

---

## Estrutura do Projeto

```
Projeto-api/
├── Monolito/
│   ├── app.js                ← Servidor único com tudo junto (porta 4000)
│   └── package.json
│
└── Microservicos/
    ├── gateway/
    │   └── gateway.js        ← Ponto de entrada único (porta 5000)
    │                            Load balancer Round-Robin integrado
    ├── utilizadores/
    │   └── servico.js        ← Serviço independente (réplicas: 5001, 5011, 5021)
    ├── produtos/
    │   └── servico.js        ← Serviço independente (réplicas: 5002, 5012)
    ├── pedidos/
    │   └── servico.js        ← Serviço independente (porta 5003)
    ├── testeCargaMicro.js    ← Teste de carga com 5000 requisições
    └── package.json
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [Postman](https://www.postman.com/) para testar manualmente

Verificar instalação:
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

As dependências dos microserviços incluem:

| Pacote | Versão | Uso |
|--------|--------|-----|
| `express` | ^4.18.2 | Servidor HTTP de cada serviço e gateway |
| `axios` | ^1.16.1 | Comunicação HTTP entre o gateway e os serviços |
| `concurrently` | (dev) | Lançar todas as instâncias com um só comando |

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

### Microserviços — arranque completo

O projeto replica serviços para demonstrar escalabilidade horizontal. São necessárias **6 instâncias de serviços + 1 gateway**:

| Instância | Porta | Réplica de |
|-----------|-------|------------|
| utilizadores-1 | 5001 | utilizadores |
| utilizadores-2 | 5011 | utilizadores |
| utilizadores-3 | 5021 | utilizadores |
| produtos-1 | 5002 | produtos |
| produtos-2 | 5012 | produtos |
| pedidos-1 | 5003 | pedidos |
| gateway | 5000 | — |

#### Um só comando (recomendado)

```bash
cd Microservicos
npm run start:all
```

Lança todas as instâncias e o gateway em simultâneo. Os logs são prefixados com o nome de cada instância para fácil leitura.

---

## Load Balancer — Round-Robin

O gateway distribui automaticamente os pedidos entre as réplicas de cada serviço usando o algoritmo **Round-Robin**: os pedidos são encaminhados em rotação sequencial pelas instâncias disponíveis.

```
Pedido 1 → utilizadores-1 (porta 5001)
Pedido 2 → utilizadores-2 (porta 5011)
Pedido 3 → utilizadores-3 (porta 5021)
Pedido 4 → utilizadores-1 (porta 5001)  ← volta ao início
...
```

O estado atual do balanceador pode ser consultado em:
```
GET http://localhost:5000/health
```

Resposta:
```json
{
  "status": "ok",
  "algoritmo": "round-robin",
  "servicos": {
    "utilizadores": ["http://localhost:5001", "http://localhost:5011", "http://localhost:5021"],
    "produtos": ["http://localhost:5002", "http://localhost:5012"],
    "pedidos": ["http://localhost:5003"]
  },
  "contadores": {
    "utilizadores": 12,
    "produtos": 8,
    "pedidos": 4
  }
}
```

Cada resposta inclui o header `X-Instance-ID` que identifica qual instância processou o pedido.

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
| GET | `/health` | Estado do gateway e contadores Round-Robin |
| GET | `/pedidos/:id/detalhes` | Agrega dados dos 3 serviços numa só resposta |

Todos os pedidos passam pelo load balancer antes de chegarem ao serviço destino.

---

## Exemplos de Teste (Postman)

### Verificar estado do gateway
```
GET http://localhost:5000/health
```

### GET — Listar produtos (distribuído entre produtos-1 e produtos-2)
```
GET http://localhost:5000/produtos
```

Ver o header `X-Instance-ID` na resposta para confirmar qual instância respondeu.

### GET — Detalhes completos de um pedido (agregação dos 3 serviços)
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

## Teste de Carga

O ficheiro `testeCargaMicro.js` executa um teste de carga automático contra o gateway com:

- **5000 requisições** no total
- **50 requisições concorrentes** em simultâneo
- Distribuição ponderada por rotas (utilizadores e produtos têm mais peso)
- Semáforo para controlar concorrência
- Métricas detalhadas: latências (P50, P95, P99), taxa de sucesso, distribuição por instância

### Como correr o teste

Com todas as instâncias já a correr (`npm run start:all`), abrir um segundo terminal:

```bash
cd Microservicos
node testeCargaMicro.js
```

### O que verificar nos resultados

| Métrica | Valor esperado (saudável) |
|---------|--------------------------|
| Taxa de sucesso | > 95% |
| Rendimento | > 100 req/s |
| P99 | < 1000ms |
| Distribuição utilizadores | ~33% por instância |
| Distribuição produtos | ~50% por instância |

> Se a taxa de sucesso for baixa, confirmar que **todas as instâncias estão ativas** antes de correr o teste. O erro mais comum é ter apenas algumas portas ocupadas da sessão anterior — usar `pkill -f node` para limpar antes de reiniciar.

---

## Diferença entre Monolito e Microserviços

| Característica | Monolito | Microserviços + Gateway |
|----------------|----------|-------------------------|
| Processos | 1 só processo | 7 processos independentes |
| Porta de acesso | 4000 | 5000 (Gateway) |
| Comunicação | Interna | HTTP entre serviços |
| Falha | Afeta todo o sistema | Apenas o serviço afetado |
| Escalabilidade | Tudo junto | Por serviço individualmente |
| Balanceamento de carga | Não tem | Round-Robin automático no gateway |
| Réplicas | Não suporta | utilizadores ×3, produtos ×2, pedidos ×1 |
