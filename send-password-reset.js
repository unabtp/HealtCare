// api/send-password-reset.js
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const { email, token } = req.body

    if (!email || !token) {
      return res.status(400).json({ error: 'Faltan parámetros: email y token son requeridos' })
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SERVICE_ROLE_KEY || ''
    )

    // Verificar que el email existe en perfiles
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .select('dni, nombre, apellido')
      .eq('email', email)
      .single()

    if (perfilError || !perfil) {
      // No revelar si el email existe o no (seguridad)
      return res.status(200).json({ 
        success: true, 
        message: 'Si el email existe en nuestro sistema, recibirás un enlace para cambiar tu contraseña.' 
      })
    }

    // Insertar token en password_resets
    const { error: insertError } = await supabaseAdmin
      .from('password_resets')
      .insert({
        email: email,
        token: token,
        dni: perfil.dni,
        used: false,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hora
      })

    if (insertError) {
      console.error('Error insertando token:', insertError)
      return res.status(500).json({ error: 'Error al generar el token de recuperación' })
    }

    // Construir URL de reset
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000'
    const resetUrl = `${siteUrl}/reset-password.html?token=${token}&email=${encodeURIComponent(email)}`

    // HTML del email
    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HealthCare - Recuperación de Contraseña</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: #1a7a5e; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-family: 'Georgia', serif; }
    .header span { color: rgba(255,255,255,0.6); }
    .body { padding: 32px 24px; color: #333; line-height: 1.6; }
    .body p { margin: 0 0 16px 0; font-size: 15px; color: #555; }
    .button-wrap { text-align: center; margin: 32px 0; }
    .button { display: inline-block; background: #1a7a5e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 15px; transition: background 0.3s; }
    .button:hover { background: #145c49; }
    .footer { padding: 20px 24px; background: #f8f9fa; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
    .warning { background: #fff8e1; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Health<span>Care</span></h1>
    </div>
    <div class="body">
      <p>Hola,</p>
      <p>Este E-mail es para confirmar el cambio de su contraseña haga click en <strong>"cambiar contraseña"</strong> para realizar el cambio.</p>
      <div class="button-wrap">
        <a href="${resetUrl}" class="button">cambiar contraseña</a>
      </div>
      <div class="warning">
        ⚠️ Este enlace expira en 1 hora y solo puede usarse una vez.
      </div>
      <p style="font-size: 13px; color: #888;">Si no solicitaste este cambio, podés ignorar este correo.</p>
    </div>
    <div class="footer">
      © 2025 HealthCare Pediatría · Soporte: soporte@healthcare.com
    </div>
  </div>
</body>
</html>
    `

    // Intentar enviar email (si hay SMTP configurado)
    try {
      const { error: emailError } = await supabaseAdmin.auth.admin.sendRawEmail({
        to: email,
        subject: 'HealthCare - Recuperación de Contraseña',
        html: emailHtml,
      })

      if (emailError) throw emailError

      return res.status(200).json({ 
        success: true, 
        message: 'Email enviado correctamente.' 
      })

    } catch (emailErr) {
      // Fallback: loguear URL para testing
      console.log('🔗 Reset URL (debug):', resetUrl)
      return res.status(200).json({ 
        success: true, 
        message: 'Token generado correctamente.',
        debug_url: resetUrl 
      })
    }

  } catch (err) {
    console.error('Error en serverless function:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}