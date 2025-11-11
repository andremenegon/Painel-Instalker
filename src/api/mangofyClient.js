/**
 * Cliente para integração com a API da Mangofy
 * Sistema de pagamentos PIX
 */

const MANGOFY_API_URL = import.meta.env.VITE_MANGOFY_API_URL || 'https://api.mangofy.com.br/v1';
const MANGOFY_API_KEY = import.meta.env.VITE_MANGOFY_API_KEY || '';
const MANGOFY_WEBHOOK_SECRET = import.meta.env.VITE_MANGOFY_WEBHOOK_SECRET || '';

class MangofyClient {
  constructor() {
    this.apiUrl = MANGOFY_API_URL;
    this.apiKey = MANGOFY_API_KEY;
    this.webhookSecret = MANGOFY_WEBHOOK_SECRET;
  }

  /**
   * Faz uma requisição para a API da Mangofy
   */
  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Erro na API: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro na requisição Mangofy:', error);
      throw error;
    }
  }

  /**
   * Cria uma cobrança PIX
   * @param {Object} data - Dados da cobrança
   * @param {number} data.amount - Valor em centavos (ex: 1000 = R$ 10,00)
   * @param {string} data.description - Descrição da cobrança
   * @param {string} data.customer_id - ID do cliente
   * @param {Object} data.metadata - Metadados adicionais
   */
  async createPixCharge(data) {
    const chargeData = {
      amount: data.amount,
      description: data.description || 'Compra de créditos In\'Stalker',
      payment_method: 'pix',
      customer: {
        id: data.customer_id,
        email: data.customer_email,
        name: data.customer_name,
      },
      metadata: {
        user_id: data.customer_id,
        credits: data.credits,
        ...data.metadata,
      },
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
    };

    return await this.request('/charges', {
      method: 'POST',
      body: JSON.stringify(chargeData),
    });
  }

  /**
   * Consulta o status de uma cobrança
   * @param {string} chargeId - ID da cobrança
   */
  async getCharge(chargeId) {
    return await this.request(`/charges/${chargeId}`, {
      method: 'GET',
    });
  }

  /**
   * Lista todas as cobranças de um cliente
   * @param {string} customerId - ID do cliente
   */
  async listCharges(customerId) {
    return await this.request(`/charges?customer_id=${customerId}`, {
      method: 'GET',
    });
  }

  /**
   * Cancela uma cobrança
   * @param {string} chargeId - ID da cobrança
   */
  async cancelCharge(chargeId) {
    return await this.request(`/charges/${chargeId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Verifica a assinatura de um webhook
   * @param {string} signature - Assinatura enviada no header
   * @param {string} payload - Payload do webhook
   */
  verifyWebhookSignature(signature, payload) {
    // Implementar verificação de assinatura conforme documentação da Mangofy
    // Exemplo com HMAC SHA256:
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  /**
   * Processa o payload de um webhook
   * @param {Object} payload - Dados do webhook
   */
  processWebhook(payload) {
    const { event, data } = payload;
    
    return {
      event,
      chargeId: data.id,
      status: data.status,
      amount: data.amount,
      customerId: data.customer?.id,
      metadata: data.metadata,
      paidAt: data.paid_at,
    };
  }
}

export const mangofyClient = new MangofyClient();

