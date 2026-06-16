const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { product_id, price, buyer_email, buyer_phone, payment_method } = req.body;

        // 1. Check Step: Find available account in Supabase
        const { data: accounts, error: accountError } = await supabase
            .from('accounts')
            .select('*')
            .eq('product_id', product_id)
            .eq('is_sold', false)
            .limit(1);

        if (accountError) {
            console.error('Database Error:', accountError);
            throw new Error('Database connection failed');
        }

        if (!accounts || accounts.length === 0) {
            return res.status(404).json({ error: 'Stok habis! Silakan coba lagi nanti.' });
        }

        const accountToSell = accounts[0];
        const merchantRef = 'KNINDO-' + Date.now(); // Unique Order ID

        // 2. Mayar API Call to Create Payment
        // Docs: https://mayar.id/hl/v1/payment/create

        const mayarPayload = {
            amount: parseInt(price),
            description: `Order ${merchantRef} - Canva Pro`,
            customer_name: buyer_email.split('@')[0], // Use email prefix as name if not provided
            customer_email: buyer_email,
            mobile: buyer_phone,
            redirect_url: "https://knindo.vercel.app/#success", // Redirect here after payment
            metadata: {
                merchantRef: merchantRef,
                product_id: product_id,
                account_id: accountToSell.id
            }
        };

        console.log("Sending to Mayar:", mayarPayload);

        const mayarResponse = await fetch('https://api.mayar.id/hl/v1/payment/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MAYAR_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mayarPayload)
        });

        const mayarResult = await mayarResponse.json();

        if (!mayarResponse.ok) {
            console.error("Mayar Error:", mayarResult);
            throw new Error(mayarResult.messages?.[0] || 'Gagal membuat pembayaran di Mayar');
        }

        // 3. Save "Pending" Order to Supabase
        const { error: orderError } = await supabase
            .from('orders')
            .insert([
                {
                    id: merchantRef,
                    user_email: buyer_email,
                    user_phone: buyer_phone,
                    product_id: product_id,
                    amount: price,
                    status: 'pending', // Waiting for Webhook
                    payment_method: 'mayar',
                    account_id: accountToSell.id,
                    payment_link: mayarResult.data.link // Save Mayar payment link
                }
            ]);

        if (orderError) {
            console.error('Order Save Error:', orderError);
            throw new Error('Gagal menyimpan pesanan');
        }

        // 4. Return Payment URL to Frontend
        res.status(200).json({
            success: true,
            data: {
                pay_url: mayarResult.data.link, // URL to Mayar Checkout Page
                order_id: merchantRef
            }
        });

    } catch (error) {
        console.error('Checkout Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
