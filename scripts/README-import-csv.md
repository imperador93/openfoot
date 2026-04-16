# Importação de Jogadores via CSV

Script para importar jogadores de um CSV de estatísticas para o `players.json` do Openfoot.

## 📋 Requisitos

- Node.js instalado
- CSV com as seguintes colunas (mesmas do exemplo fornecido):
  - `Jogador`, `Time`, `Nação`, `Pos.`, `Idade`, `Min.` (minutos jogados)
  - Estatísticas: `Gols`, `Assis.`, `TC`, `CaG`, `Cmp`, `Att`, `PrgP`, etc.

## 🚀 Como usar

### 1. Coloque o CSV na pasta do projeto

```bash
# Exemplo: copiar para a raiz do projeto
cp /caminho/do/seu/arquivo.csv ./players-stats.csv
```

### 2. Execute o script

```bash
node scripts/import-players-csv.js players-stats.csv
```

## ⚙️ Configurações

Você pode ajustar as configurações no início do arquivo `import-players-csv.js`:

```javascript
const MIN_MINUTES = 90; // Filtrar jogadores com menos de 90 minutos jogados
```

## 🎯 O que o script faz

1. ✅ Lê o `players.json` atual
2. ✅ Cria um índice dos jogadores existentes (nome + time)
3. ✅ Lê cada linha do CSV
4. ✅ **Filtra jogadores duplicados** (não adiciona se já existir)
5. ✅ **Filtra por minutos jogados** (padrão: ≥ 90 minutos)
6. ✅ **Filtra por time** (só adiciona se o time existir no `teams.json`)
7. ✅ **Deriva atributos** das estatísticas do CSV:
   - **Speed**: Idade + conduções
   - **Shooting**: Gols + xG + chutes a gol
   - **Passing**: % passes completos + assistências + xAG
   - **Dribbling**: % dribles + conduções progressivas
   - **Defense**: Divididas + interceptações + bloqueios
   - **Stamina**: Minutos jogados + idade
8. ✅ **Ajusta por posição** (goleiros têm shooting baixo, atacantes têm defense baixo, etc)
9. ✅ Salva o `players.json` atualizado

## 📊 Exemplo de saída

```
📂 Carregando dados existentes...
✅ Jogadores existentes: 1247
📊 Lendo CSV: players-stats.csv
📊 Total de linhas no CSV: 12000
⏳ Processados: 100 novos jogadores...
⏳ Processados: 200 novos jogadores...
...

📊 Resumo da importação:
✅ Jogadores adicionados: 3421
⏭️  Jogadores já existentes (pulados): 847
🚫 Jogadores filtrados (poucos minutos/time não cadastrado): 7732
📦 Total final no banco: 4668

💾 Salvando players.json...
✅ Arquivo salvo com sucesso!
```

## 🔍 Detecção de duplicatas

O script normaliza nomes removendo acentos e convertendo para minúsculas:

- `Cristiano Ronaldo` = `cristiano ronaldo`  
- `Éder` = `eder`  
- `João Silva` = `joao silva`

Compara: **nome normalizado + time** para evitar duplicatas.

## ⚠️ Limitações

- **Times não cadastrados**: Jogadores de times não presentes no `teams.json` serão filtrados
- **Posições**: Converte posições do CSV para o formato do jogo (GK→GOL, ST→ATA, etc)
- **Atributos**: Derivados de estatísticas, não são valores "reais" do FIFA/FM

## 🛠️ Personalização

### Adicionar mais campos

Se o CSV tiver mais campos (nacionalidade, data de nascimento, etc), você pode adicionar na linha ~243:

```javascript
const newPlayer = {
  Id: generatePlayerId(nextId++),
  Name: name,
  Position: position,
  // ... atributos existentes ...
  Nationality: row['Nação'], // ← Adicionar aqui
  Age: stats.age,            // ← Adicionar aqui
};
```

**Importante**: Também precisa atualizar o modelo Rust (`src-tauri/src/models/player.rs`)!

## 🐛 Problemas comuns

**"Nenhum jogador novo foi adicionado"**
- Verifique se os times do CSV existem no `teams.json`
- Reduza `MIN_MINUTES` para incluir mais jogadores

**"Arquivo não encontrado"**
- Certifique-se que o caminho do CSV está correto
- Use caminhos relativos à raiz do projeto

**Encoding do CSV**
- Se houver caracteres estranhos, salve o CSV em UTF-8
