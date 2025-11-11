// API Serverless do Vercel para criar cobrança PIX via Mangofy
// Isso resolve o problema de CORS ao chamar Mangofy do backend

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, description, customerName, customerEmail } = req.body;

    // Validar dados
    if (!amount || !description || !customerEmail) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // Chamar API da Mangofy
    const response = await fetch(`${process.env.VITE_MANGOFY_API_URL}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_MANGOFY_API_KEY}`
      },
      body: JSON.stringify({
        amount: amount,
        description: description,
        payment_method: 'pix',
        customer: {
          name: customerName || 'Cliente',
          email: customerEmail
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro Mangofy:', errorData);
      return res.status(response.status).json({ 
        error: 'Erro ao criar cobrança',
        details: errorData 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Erro ao criar PIX:', error);
    return res.status(500).json({ 
      error: 'Erro interno ao processar pagamento',
      message: error.message 
    });
  }
}

