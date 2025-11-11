// Integração real com Supabase para autenticação e dados
import { supabase } from '@/lib/supabaseClient';

// ============= AUTH =============
export const supabaseAuth = {
  // Registrar novo usuário
  register: async ({ email, full_name, password }) => {
    try {
      // 1. Criar registro na tabela users (SEM Supabase Auth)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{
          email,
          full_name,
          password: password,
          role: 'user'
        }])
        .select()
        .single();

      if (userError) {
        if (userError.code === '23505') {
          throw new Error('Email já cadastrado');
        }
        throw userError;
      }

      // 2. Criar perfil do usuário
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{
          created_by: email,
          credits: 0,
          level: 1,
          xp: 0,
          total_investigations: 0,
          investigation_history: []
        }]);

      if (profileError) throw profileError;

      // 3. Salvar usuário no localStorage para simular sessão
      localStorage.setItem('supabase_user', JSON.stringify({
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role
      }));

      return {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        created_at: userData.created_at
      };
    } catch (error) {
      console.error('Erro no registro:', error);
      throw new Error(error.message || 'Erro ao criar conta');
    }
  },

  // Fazer login
  login: async (email, password) => {
    try {
      // Buscar dados do usuário na tabela users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (userError || !userData) {
        throw new Error('Email ou senha incorretos');
      }

      // Salvar usuário no localStorage para simular sessão
      localStorage.setItem('supabase_user', JSON.stringify({
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role
      }));

      return {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        created_at: userData.created_at
      };
    } catch (error) {
      console.error('Erro no login:', error);
      throw new Error('Email ou senha incorretos');
    }
  },

  // Obter usuário atual
  me: async () => {
    try {
      const stored = localStorage.getItem('supabase_user');
      if (!stored) {
        throw new Error('Usuário não autenticado');
      }

      const user = JSON.parse(stored);
      
      // Buscar dados atualizados do banco
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .single();

      if (userError) throw userError;

      return {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        created_at: userData.created_at
      };
    } catch (error) {
      console.error('Erro ao obter usuário:', error);
      throw error;
    }
  },

  // Logout
  logout: async () => {
    localStorage.removeItem('supabase_user');
    return true;
  },

  // Admin: listar todos os usuários
  getAllUsers: async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return [];
    }
  }
};

// ============= ENTITIES =============

// Helper para criar entidades do Supabase
const createSupabaseEntity = (tableName, emailField = 'created_by') => ({
  // Listar todos
  list: async () => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Erro ao listar ${tableName}:`, error);
      return [];
    }
  },

  // Filtrar por condições
  filter: async (filters = {}) => {
    try {
      let query = supabase.from(tableName).select('*');

      Object.keys(filters).forEach(key => {
        query = query.eq(key, filters[key]);
      });

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Erro ao filtrar ${tableName}:`, error);
      return [];
    }
  },

  // Obter por ID
  get: async (id) => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao obter ${tableName}:`, error);
      return null;
    }
  },

  // Criar novo
  create: async (itemData) => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .insert([itemData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao criar ${tableName}:`, error);
      throw error;
    }
  },

  // Atualizar
  update: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao atualizar ${tableName}:`, error);
      throw error;
    }
  },

  // Deletar
  delete: async (id) => {
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Erro ao deletar ${tableName}:`, error);
      throw error;
    }
  }
});

// Exportar entidades
export const supabaseEntities = {
  UserProfile: createSupabaseEntity('user_profiles', 'created_by'),
  Investigation: createSupabaseEntity('investigations', 'created_by'),
  Service: createSupabaseEntity('services'),
  User: createSupabaseEntity('users', 'email')
};

