// ═══════════════════════════════════════════════
//  supabase/functions/send-reactivation-email/index.ts
//  Edge Function: Envía email de reactivación usando Resend
//  ═══════════════════════════════════════════════

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@healthcare-pediatria.com'

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const { email, firstName, lastName, token, siteUrl } = await req.json()

    if (!email || !token || !siteUrl) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos' }), { status: 400 })
    }

    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Usuario'
    const reactivationLink = `${siteUrl}/login.html?reactivar=true&token=${token}`

    // Template HTML del email
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HealthCare Pediatría - Confirmar sesión</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f5; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08); }
    .header { background: #1a7a5e; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; font-family: 'DM Serif Display', Georgia, serif; font-size: 24px; margin: 0; letter-spacing: -0.5px; }
    .header span { color: #f0a500; }
    .header p { color: rgba(255,255,255,0.75); font-size: 13px; margin: 8px 0 0; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 16px; color: #1c2b25; margin-bottom: 16px; line-height: 1.6; }
    .greeting strong { color: #1a7a5e; }
    .message { font-size: 15px; color: #4a6358; line-height: 1.7; margin-bottom: 28px; }
    .message .highlight { background: #e8f5f0; padding: 2px 8px; border-radius: 6px; font-weight: 500; color: #1a7a5e; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: #1a7a5e; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 16px rgba(26,122,94,0.3); transition: all 0.2s; }
    .btn:hover { background: #2fa37d; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,122,94,0.4); }
    .footer { background: #faf8f3; padding: 24px; text-align: center; border-top: 1px solid #d4e8e0; }
    .footer p { font-size: 12px; color: #4a6358; margin: 4px 0; }
    .footer .brand { font-family: 'DM Serif Display', Georgia, serif; color: #1a7a5e; font-size: 14px; }
    .footer .brand span { color: #f0a500; }
    .divider { width: 40px; height: 3px; background: #1a7a5e; border-radius: 2px; margin: 0 auto 20px; }
    @media (max-width: 480px) { .container { border-radius: 0; } .content { padding: 24px 20px; } .header { padding: 24px 20px; } .btn { padding: 14px 32px; font-size: 15px; } }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding: 40px 16px;">
      <div class="container">
        <div class="header">
          <h1>Health<span>Care</span></h1>
          <p>🏥 Clínica Pediátrica</p>
        </div>
        <div class="content">
          <div class="divider"></div>
          <p class="greeting">Hola <strong>${fullName}</strong>,</p>
          <p class="message">
            Ha pasado <span class="highlight">más de un año</span> desde la última vez que iniciaste sesión en la clínica pediátrica <strong>HealthCare</strong>.
          </p>
          <p class="message">
            Para mantener tu cuenta activa y seguir accediendo a todos nuestros servicios, por favor confirmá tu sesión haciendo clic en el siguiente botón:
          </p>
          <div class="btn-container">
            <a href="${reactivationLink}" class="btn">Iniciar sesión</a>
          </div>
          <p class="message" style="font-size: 13px; color: #9ca3af; text-align: center; margin-top: 24px;">
            Si no reconocés esta actividad, podés ignorar este email. Tu cuenta permanecerá segura.
          </p>
        </div>
        <div class="footer">
          <p class="brand">Health<span>Care</span> Pediatría</p>
          <p>Av. Corrientes 1234, Buenos Aires</p>
          <p>© 2026 HealthCare Pediatría. Todos los derechos reservados.</p>
        </div>
      </div>
    </td></tr>
  </table>
</body>
</html>
    `

    // Enviar email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: `HealthCare Pediatría <${FROM_EMAIL}>`,
        to: [email],
        subject: 'desea iniciar de sesion',
        html: html
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Error Resend:', data)
      return new Response(JSON.stringify({ error: data.message || 'Error enviando email' }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200 })

  } catch (err) {
    console.error('Error inesperado:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
