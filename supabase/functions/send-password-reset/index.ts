import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { email, token } = await req.json();

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros: email y token son requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Verificar que el email existe en perfiles
    const { data: perfil, error: perfilError } = await supabaseAdmin
      .from("perfiles")
      .select("dni, nombre, apellido")
      .eq("email", email)
      .single();

    if (perfilError || !perfil) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Si el email existe en nuestro sistema, recibirás un enlace para cambiar tu contraseña.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insertar token en password_resets
    const { error: insertError } = await supabaseAdmin
      .from("password_resets")
      .insert({
        email: email,
        token: token,
        dni: perfil.dni,
        used: false,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

    if (insertError) {
      console.error("Error insertando token:", insertError);
      return new Response(
        JSON.stringify({ error: "Error al generar el token de recuperación" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Construir URL de reset
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:3000";
    const resetUrl = `${siteUrl}/reset-password.html?token=${token}&email=${encodeURIComponent(email)}`;

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
    `;

    // Intentar enviar email con Resend
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const FROM_EMAIL = Deno.env.get("FROM_EMAIL");

      if (!RESEND_API_KEY || !FROM_EMAIL) {
        throw new Error("Faltan variables de entorno para envío de email");
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: "HealthCare - Recuperación de Contraseña",
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        throw new Error(`Resend error: ${errorText}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Email enviado correctamente." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    } catch (emailErr) {
      console.log("🔗 Reset URL (debug):", resetUrl);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Token generado correctamente.",
          debug_url: resetUrl,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("Error en Edge Function:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});