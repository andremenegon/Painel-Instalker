# Painel In'Stalker

Aplicação web desenvolvida com Vite + React para investigação digital.

## 🚀 Como executar o projeto localmente

### Passo a passo simples:

1. **Abra o Terminal** (no Mac: `Cmd + Espaço`, digite "Terminal" e pressione Enter)

2. **Navegue até a pasta do projeto:**
   ```bash
   cd "/Users/andremenegon/Downloads/Painel In'Stalker"
   ```

3. **Instale as dependências** (só precisa fazer uma vez, ou quando adicionar novos pacotes):
   ```bash
   npm install
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

5. **Abra no navegador:**
   - O navegador deve abrir automaticamente
   - Ou acesse manualmente: **http://localhost:5173**

### ⚠️ Se der algum erro:

- **Porta já em uso?** Execute primeiro:
  ```bash
  npm run clean:ports
  ```
  Depois execute `npm run dev` novamente


## 📦 Criar versão para produção

```bash
npm run build
```

Isso cria uma pasta `dist/` com os arquivos otimizados prontos para publicação.

## 📝 Scripts disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria a versão de produção
- `npm run preview` - Visualiza a versão de produção localmente
- `npm run clean:ports` - Limpa processos nas portas 5173, 5174 e 5175

## 💡 Dicas

- O servidor fica rodando até você pressionar `Ctrl + C` no terminal
- Qualquer alteração no código atualiza automaticamente no navegador
- Se o navegador não abrir automaticamente, acesse http://localhost:5173 manualmente

## 🔧 Modo de Desenvolvimento (Mock Local)

**Por padrão, o projeto funciona localmente SEM precisar do Base44!**

O projeto está configurado para usar um **mock local** que:
- ✅ Não precisa de login
- ✅ Não precisa de App ID do Base44
- ✅ Funciona completamente offline
- ✅ Salva dados no localStorage do navegador

### Para usar o Base44 real (opcional):

Se você quiser usar o Base44 real em vez do mock:

1. Crie um arquivo `.env` na raiz do projeto:
   ```
   VITE_USE_MOCK=false
   VITE_BASE44_APP_ID=seu_app_id_aqui
   ```

2. Reinicie o servidor (`Ctrl + C` e depois `npm run dev`)

**Nota:** Sem o arquivo `.env`, o projeto usa o mock automaticamente e funciona sem nenhuma configuração!