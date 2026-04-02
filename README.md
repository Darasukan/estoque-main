# Estoque App

Sistema de controle de estoque industrial com catálogo estilo McMaster-Carr, filtros facetados, hierarquia de itens e gestão de variações.

## Tecnologias

- **Vue.js 3** (Composition API, `<script setup>`)
- **Vite** (build tool + proxy de desenvolvimento)
- **Tailwind CSS v4** (estilização)
- **Express 5** (API REST)
- **better-sqlite3** (banco de dados SQLite)
- **bcryptjs** (hash de senhas)

## Funcionalidades

- **Catálogo** — Navegação por grupos com filtros facetados na sidebar, busca por nome/categoria/subcategoria, visualização de variações e estoque
- **Cadastro** — Criação de itens com hierarquia (Grupo → Categoria → Subcategoria), atributos dinâmicos e variações
- **Editar Hierarquia** — Renomear/excluir grupos, categorias e subcategorias, editar atributos dos itens
- **Inventário** — Tabela com filtros laterais, status de estoque (OK/Alerta/Crítico/Zero), ajuste de estoque inline, paginação e exportação CSV
- **Movimentações** — Registro de entradas e saídas com histórico completo
- **Autenticação** — Login com PIN, controle de sessão, roles (admin/operador)
- **Acesso público** — Catálogo, inventário e histórico visíveis sem login; operações de escrita requerem autenticação
- **Tema** — Claro/escuro com toggle
- **Dados de teste** — Gerador de ~100 itens e ~400 variações para testes

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [Git](https://git-scm.com/)

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/Darasukan/estoque-main.git

# Entrar na pasta
cd estoque-main

# Instalar dependências
npm install
```

## Como rodar (desenvolvimento)

São necessários **dois terminais**:

```bash
# Terminal 1 — Servidor backend (porta 3000)
npm run server

# Terminal 2 — Vite dev server (porta 5173)
npm run dev
```

Acesse `http://localhost:5173` no navegador. O Vite faz proxy automático de `/api` para o backend.

## Build para produção

```bash
# Build + iniciar servidor
npm start
```

Isso executa `vite build` e depois inicia o Express servindo o frontend e a API na porta 3000.

## Estrutura do projeto

```
server/
├── index.js                    # Express app + rotas
├── db.js                       # Inicialização SQLite
├── middleware/
│   └── auth.js                 # Middleware de autenticação e roles
└── routes/
    ├── auth.js                 # Login, logout, sessão, usuários
    ├── items.js                # CRUD de itens e variações
    ├── movements.js            # Movimentações de estoque
    ├── locations.js            # Locais de armazenamento
    ├── destinations.js         # Destinos de saída
    ├── people.js               # Pessoas/solicitantes
    ├── roles.js                # Cargos/funções
    └── seed.js                 # Seed de dados e ordem de exibição
src/
├── App.vue                     # Layout principal com abas e sidebar
├── main.js                     # Entry point
├── style.css                   # Tema Tailwind e variáveis
├── composables/
│   ├── useAuth.js              # Autenticação e sessão
│   ├── useItems.js             # Estado central (itens, variações, filtros)
│   ├── useMovements.js         # Movimentações
│   ├── useLocations.js         # Locais
│   ├── useDestinations.js      # Destinos
│   ├── usePeople.js            # Pessoas
│   ├── useRoles.js             # Cargos
│   ├── useUsers.js             # Gestão de usuários
│   ├── useTheme.js             # Tema claro/escuro
│   └── useToast.js             # Notificações toast
├── services/
│   └── api.js                  # Cliente HTTP para a API
├── data/
│   └── seedData.js             # Gerador de dados de teste
├── utils/
│   ├── id.js                   # Gerador de IDs únicos
│   └── units.js                # Unidades de medida
├── views/
│   ├── CatalogView.vue         # Catálogo com cards e tabela
│   ├── CadastroView.vue        # Formulário de cadastro
│   ├── CadastrosView.vue       # Gestão de cadastros auxiliares
│   ├── EditHierarchyView.vue   # Editor de hierarquia e atributos
│   ├── InventarioView.vue      # Inventário com paginação
│   ├── ManageView.vue          # Tabela de itens com filtros
│   └── MovimentacoesView.vue   # Entradas, saídas e histórico
└── components/
    ├── ui/
    │   ├── AppModal.vue        # Modal genérico
    │   ├── AppSidebar.vue      # Sidebar de navegação/filtros
    │   ├── HistorySidebar.vue  # Sidebar de histórico
    │   ├── LoginModal.vue      # Modal de login
    │   └── ToastContainer.vue  # Container de notificações
    └── catalog/
        ├── CategorySection.vue
        ├── ItemCard.vue
        └── SubcategorySection.vue
```
