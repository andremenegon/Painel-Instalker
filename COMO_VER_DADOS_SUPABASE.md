# 👀 Como Ver Seus Dados no Supabase

## 🎯 O sistema agora salva TUDO no Supabase!

Acabei de configurar para que **todos os seus dados** sejam salvos **NA NUVEM** no Supabase! 🌐

---

## 📋 PASSO A PASSO para ver seus dados:

### **1. Acesse o Supabase:**
```
https://supabase.com/dashboard/project/lsdfnydihwyfugvpunsb
```

### **2. Faça login** (se necessário)

### **3. No menu lateral, clique em:**
- **"Table Editor"** (ícone de tabela) 📊

### **4. Você verá 4 tabelas:**

#### 📌 **users** - Usuários registrados
- Aqui aparecem **todos os usuários** que se registraram
- Campos: `id`, `email`, `full_name`, `role`, `created_at`

#### 📌 **user_profiles** - Perfis dos usuários
- Aqui aparecem **créditos, XP, nível** de cada usuário
- Campos: `id`, `created_by` (email), `credits`, `level`, `xp`, `total_investigations`

#### 📌 **investigations** - Investigações
- Aqui aparecem **todas as investigações** criadas
- Campos: `id`, `service_name`, `target_username`, `status`, `progress`, `created_by`

#### 📌 **services** - Serviços disponíveis
- Lista de **serviços** que você pode contratar
- Campos: `name`, `description`, `credits_cost`, `xp_reward`

---

## 🔍 Como pesquisar seu usuário:

### **Opção 1: Buscar por email**
1. Clique na tabela **"users"**
2. Use o campo de busca no topo
3. Digite seu email

### **Opção 2: Ver o último usuário criado**
1. Clique na tabela **"users"**
2. Os dados já vêm ordenados por data (mais recente primeiro)
3. Seu usuário estará **no topo**!

---

## 🔍 COMO SABER SE ESTÁ CONECTADO AO SUPABASE:

### **OLHE NO CANTO INFERIOR DIREITO DA TELA!**

Agora você verá um **indicador visual**:

✅ **Verde com "☁️ Supabase - Nuvem"** → Está salvando no Supabase! 🎉
⚠️ **Laranja com "💾 Local - Navegador"** → Está salvando só no navegador

---

## ⚠️ IMPORTANTE - FAÇA ISSO AGORA:

### **Você precisa RECRIAR sua conta** porque:
- Os dados anteriores estavam no **navegador** (localStorage)
- Agora os dados vão para o **Supabase** (nuvem)
- São sistemas diferentes!

### **O que fazer:**

1. **Recarregue a página** do sistema: http://localhost:5173
2. **Olhe o indicador no canto inferior direito** - deve estar VERDE
3. **Clique em "Criar Conta"** novamente
4. **Registre-se** com email e senha
5. **Volte ao Supabase** e veja seu usuário aparecer! ✨

---

## 🎊 Vantagens do Supabase:

✅ **Dados na nuvem** - não perdem quando você fecha o navegador
✅ **Sincronizados** - funcionam em qualquer computador
✅ **Seguros** - com backup automático
✅ **Escaláveis** - suporta milhões de usuários

---

## 🆘 Se não aparecer nada:

1. Certifique-se de que o console do navegador mostra:
   ```
   🌐 Usando SUPABASE REAL - Dados salvos na nuvem!
   ```

2. Pressione `F12` para abrir o console
3. Veja se tem algum erro em vermelho
4. Me mande a mensagem de erro se houver

---

**Agora seus dados estão na nuvem!** ☁️🎉

