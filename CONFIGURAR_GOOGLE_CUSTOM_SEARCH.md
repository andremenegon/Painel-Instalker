# 🔍 Como Configurar Google Custom Search (para fotos dos motéis)

## ⭐ NOVA FUNCIONALIDADE
Agora as fotos dos motéis são buscadas diretamente no **Google Images** (primeira foto que aparece na busca)!

---

## 🔑 PASSO A PASSO

### 1️⃣ Ativar a Custom Search API

**Acesse:** https://console.cloud.google.com/apis/library/customsearch.googleapis.com

- Clique em **"ENABLE"** (ou "ATIVAR")

---

### 2️⃣ Criar um Custom Search Engine (CSE)

**Acesse:** https://programmablesearchengine.google.com/controlpanel/create

1. **Nome do mecanismo de pesquisa:**
   - Digite: `Painel InStalker - Fotos de Motéis`

2. **O que pesquisar:**
   - Escolha: **"Pesquisar em toda a web"**

3. **Configurações de pesquisa:**
   - ✅ Marque: **"Pesquisa de imagens"**
   - ✅ Marque: **"SafeSearch desativado"** (para não filtrar resultados)

4. Clique em **"Criar"**

---

### 3️⃣ Copiar o Search Engine ID

Após criar:

1. Você será redirecionado para a página de configuração
2. Procure por **"Search engine ID"** (ou "ID do mecanismo de pesquisa")
3. **Copie o ID** (vai ser algo como `a1b2c3d4e5f6g7h8i`)

Ou acesse: https://programmablesearchengine.google.com/controlpanel/all

- Clique no seu mecanismo de pesquisa
- Na aba **"Overview"**, copie o **"Search engine ID"**

---

### 4️⃣ Adicionar no arquivo `.env`

Abra o arquivo `.env` e adicione:

```env
# Google Maps API (você já deve ter essa)
VITE_GOOGLE_MAPS_KEY=AIzaSyDaTUSC06HzzZotxxojwT8ck6MhIVQmL54

# Google Custom Search Engine ID (ADICIONE ESTA LINHA)
VITE_GOOGLE_SEARCH_ENGINE_ID=a1b2c3d4e5f6g7h8i
```

**⚠️ Substitua `a1b2c3d4e5f6g7h8i` pelo ID que você copiou!**

---

### 5️⃣ Reiniciar o servidor

```bash
Ctrl+C (parar)
npm run dev (reiniciar)
```

---

## 🎯 COMO FUNCIONA AGORA

### **COM Custom Search configurado:**

1. **Busca no Google Images**: `"Tunis Motel Cambé motel fachada"`
2. **Pega a PRIMEIRA foto** que aparece na busca
3. ✅ Foto correta da fachada/entrada

### **SEM Custom Search:**

1. ⚠️ Tenta Places API (pode não ter foto)
2. ⚠️ Tenta Street View (foto de rua)
3. ⚠️ Usa pool de fotos do Unsplash (genéricas)

---

## 💰 Custo

**Google Custom Search API:**
- ✅ **100 buscas GRÁTIS por dia**
- ❌ Depois: $5 por 1.000 buscas extras

**Para o seu app:**
- Motéis por investigação: ~3-6
- Investigações por dia: ~10-50
- **Total:** 30-300 buscas/dia
- **Custo:** $0 (dentro do limite grátis)

---

## 🔍 Como verificar se está funcionando

Após configurar:

1. Inicie uma nova investigação de **Localização**
2. Quando aparecerem os motéis, veja as fotos
3. Abra o console do navegador (F12) e procure:
   - `🔍 Buscando foto no Google Images: "Nome do Motel ..."`
   - `✅ Foto encontrada via Custom Search` ← **SUCESSO!**
   - `🔄 Custom Search não disponível, tentando Places API...` ← Não configurado

---

## ❓ Problemas?

**"Request failed with status code 403"**
- Você esqueceu de ativar a Custom Search API
- Ou a API Key está restrita

**"Foto encontrada via Places API" (em vez de Custom Search)**
- O `VITE_GOOGLE_SEARCH_ENGINE_ID` não está configurado no `.env`
- Ou você não reiniciou o servidor

**Ainda usando fotos do Unsplash?**
- Verifique se adicionou as duas variáveis no `.env`:
  - `VITE_GOOGLE_MAPS_KEY=...`
  - `VITE_GOOGLE_SEARCH_ENGINE_ID=...`
- Reiniciou o servidor?

---

## 🆚 DIFERENÇA VISUAL

**ANTES (Places API):**
- ⚠️ Às vezes sem foto
- ⚠️ Foto de rua (Street View)
- ⚠️ Foto genérica (Unsplash)

**AGORA (Custom Search):**
- ✅ **SEMPRE** a primeira foto da busca do Google
- ✅ Foto da fachada/entrada
- ✅ Foto que aparece quando você busca no Google

---

**Data:** 10/11/2025  
**Arquivo:** `src/pages/LocationSpy.jsx` (linha 197-243)  
**Status:** ✅ Implementado!

