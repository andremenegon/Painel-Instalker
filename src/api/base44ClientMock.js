// Mock do Base44 Client para desenvolvimento local
// Este arquivo substitui o base44Client.js para funcionar sem autenticação

// Mock de storage usando localStorage
const storage = {
  getUser: () => {
    const stored = localStorage.getItem('mock_user');
    if (stored) return JSON.parse(stored);
    return {
      id: '1',
      email: 'usuario@local.com',
      full_name: 'Usuário Local',
      created_at: new Date().toISOString()
    };
  },
  
  saveUser: (user) => {
    localStorage.setItem('mock_user', JSON.stringify(user));
  },
  
  getStorage: (key) => {
    // Se for 'user', usar chave diferente para não conflitar com mock_user (usuário logado)
    const storageKey = key === 'user' ? 'mock_users_list' : `mock_${key}`;
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : [];
  },
  
  saveStorage: (key, data) => {
    // Se for 'user', usar chave diferente para não conflitar com mock_user (usuário logado)
    const storageKey = key === 'user' ? 'mock_users_list' : `mock_${key}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
  },
  
  getItem: (key, id) => {
    const items = storage.getStorage(key);
    return items.find(item => item.id === id);
  },
  
  addItem: (key, item) => {
    const items = storage.getStorage(key);
    const newItem = {
      ...item,
      id: item.id || `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_date: item.created_date || new Date().toISOString(),
      updated_date: new Date().toISOString()
    };
    items.push(newItem);
    storage.saveStorage(key, items);
    return newItem;
  },
  
  updateItem: (key, id, updates) => {
    const items = storage.getStorage(key);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = {
        ...items[index],
        ...updates,
        updated_date: new Date().toISOString()
      };
      storage.saveStorage(key, items);
      return items[index];
    }
    return null;
  },
  
  deleteItem: (key, id) => {
    const items = storage.getStorage(key);
    const filtered = items.filter(item => item.id !== id);
    storage.saveStorage(key, filtered);
    return true;
  },
  
  filterItems: (key, filterFn) => {
    const items = storage.getStorage(key);
    return items.filter(filterFn);
  }
};

// Mock Auth
const mockAuth = {
  me: async () => {
    return storage.getUser();
  },
  
  login: async (email, password) => {
    // Verificar se é admin
    if (email === 'andremenegonqtg@gmail.com' && password === 'Pr0j3t0*') {
      const adminUser = {
        id: 'admin',
        email: 'andremenegonqtg@gmail.com',
        full_name: 'André',
        role: 'admin',
        created_at: new Date().toISOString()
      };
      storage.saveUser(adminUser);
      return adminUser;
    }
    
    // Buscar usuário nos registros
    const users = storage.getStorage('user');
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
      const userData = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: 'user',
        created_at: user.created_at
      };
      storage.saveUser(userData);
      return userData;
    }
    
    throw new Error('Credenciais inválidas');
  },
  
  logout: async () => {
    localStorage.removeItem('mock_user');
    return true;
  },
  
  register: async (data) => {
    const users = storage.getStorage('user');
    const existingUser = users.find(u => u.email === data.email);
    
    if (existingUser) {
      throw new Error('Email já cadastrado');
    }
    
    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: data.email,
      full_name: data.full_name,
      password: data.password || '', // Armazenar senha (em produção seria hash)
      created_at: new Date().toISOString()
    };
    
    storage.addItem('user', user);
    storage.saveUser({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: 'user',
      created_at: user.created_at
    });
    
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: 'user',
      created_at: user.created_at
    };
  },
  
  // Método para admin listar todos os usuários
  getAllUsers: async () => {
    const users = storage.getStorage('user');
    // Garantir que sempre retorna um array
    return Array.isArray(users) ? users : [];
  }
};

// Mock Entity Manager
const createMockEntity = (entityName) => {
  const key = entityName.toLowerCase();
  
  return {
    list: async () => {
      return storage.getStorage(key);
    },
    
    filter: async (filters = {}) => {
      return storage.filterItems(key, (item) => {
        return Object.keys(filters).every(key => {
          return item[key] === filters[key];
        });
      });
    },
    
    get: async (id) => {
      return storage.getItem(key, id);
    },
    
    create: async (data) => {
      return storage.addItem(key, data);
    },
    
    update: async (id, data) => {
      return storage.updateItem(key, id, data);
    },
    
    delete: async (id) => {
      return storage.deleteItem(key, id);
    }
  };
};

// Inicializar dados mock se necessário
const initializeMockData = () => {
  const user = storage.getUser();
  
  // Inicializar UserProfile se não existir
  if (user && user.email) {
    const profiles = storage.getStorage('userprofile');
    const userProfile = profiles.find(p => p.created_by === user.email);
    if (!userProfile) {
      storage.addItem('userprofile', {
        created_by: user.email,
        credits: 200,
        level: 1,
        xp: 0,
        total_investigations: 0
      });
    }
  }
  
  // Inicializar ou atualizar Services
  const services = storage.getStorage('service');
  const defaultServices = [
      { 
        name: 'Instagram', 
        description: 'Veja stalkers, quem deixou de seguir, prints de stories e conversas...', 
        credits_cost: 0,
        color: '#E4405F' // Rosa/vermelho do Instagram
      },
      { 
        name: 'WhatsApp', 
        description: 'Acesse conversas completas, áudios, vídeos e grupos', 
        credits_cost: 40,
        color: '#25D366' // Verde do WhatsApp
      },
      { 
        name: 'Facebook', 
        description: 'Veja todas as interações e tenha acesso completo ao Messenger', 
        credits_cost: 45,
        color: '#1877F2' // Azul do Facebook
      },
      { 
        name: 'Localização', 
        description: 'Rastreie em tempo real e veja locais suspeitos visitados', 
        credits_cost: 60,
        color: '#FF6B4A' // Laranja
      },
      { 
        name: 'SMS', 
        description: 'Todas as mensagens de texto enviadas e recebidas', 
        credits_cost: 30,
        color: '#FFC107' // Amarelo
      },
      { 
        name: 'Chamadas', 
        description: 'Registro completo de ligações com duração e horários', 
        credits_cost: 25,
        color: '#4CAF50' // Verde claro
      },
      { 
        name: 'Câmera', 
        description: 'Acesse fotos e vídeos da galeria, incluindo arquivos deletados', 
        credits_cost: 55,
        color: '#9C27B0' // Roxo
      },
      { 
        name: 'Outras Redes', 
        description: 'Busca completa em todas as redes sociais (incluindo site porno)', 
        credits_cost: 70,
        color: '#F44336' // Vermelho
      },
      { 
        name: 'Detetive Particular', 
        description: 'Investigação profissional completa com relatório detalhado', 
        credits_cost: 1000,
        color: '#2D3748' // Cinza escuro
      }
    ];
    
    if (services.length === 0) {
      // Criar serviços se não existirem
      defaultServices.forEach(service => {
        storage.addItem('service', service);
      });
    } else {
      // Atualizar serviços existentes com novos dados (cores e custos)
      defaultServices.forEach(newService => {
        const existingService = services.find(s => s.name === newService.name);
        if (existingService) {
          // Atualizar custo e cor se existir
          storage.updateItem('service', existingService.id, {
            ...existingService,
            credits_cost: newService.credits_cost,
            color: newService.color,
            description: newService.description
          });
        } else {
          // Adicionar novo serviço se não existir
          storage.addItem('service', newService);
        }
      });
    }
};

// Executar inicialização
if (typeof window !== 'undefined') {
  initializeMockData();
}

// Exportar mock do base44
export const base44 = {
  auth: mockAuth,
  entities: {
    UserProfile: createMockEntity('UserProfile'),
    Investigation: createMockEntity('Investigation'),
    Service: createMockEntity('Service'),
    User: createMockEntity('User') // Adicionar entidade User
  }
};

