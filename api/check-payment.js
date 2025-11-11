// API Serverless do Vercel para verificar status do pagamento PIX

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { chargeId } = req.query;

    if (!chargeId) {
      return res.status(400).json({ error: 'chargeId é obrigatório' });
    }

    // Chamar API da Mangofy para verificar status
    const response = await fetch(
      `${process.env.VITE_MANGOFY_API_URL}/payment/${chargeId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_MANGOFY_API_KEY}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro ao verificar pagamento:', errorData);
      return res.status(response.status).json({ 
        error: 'Erro ao verificar pagamento',
        details: errorData 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return res.status(500).json({ 
      error: 'Erro interno ao verificar pagamento',
      message: error.message 
    });
  }
}

