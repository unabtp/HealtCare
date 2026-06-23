import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
      },
    });
  }

  // Solo POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  try {
    const { email, newPassword, token } = await req.json();

    if (!email || !newPassword || !token) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 8 caracteres" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // 1. Verificar que el token sea válido, no usado y no expirado
    const { data: resetData, error: resetError } = await supabaseAdmin
      .from("password_resets")
      .select("*")
      .eq("token", token)
      .eq("email", email)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (resetError || !resetData) {
      return new Response(
        JSON.stringify({ error: "Token inválido, expirado o ya utilizado" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 2. Verificar que el DNI exista en perfiles y coincida con el email
    const { data: perfilData, error: perfilError } = await supabaseAdmin
      .from("perfiles")
      .select("id, email, dni")
      .eq("dni", resetData.dni)
      .eq("email", email)
      .single();

    if (perfilError || !perfilData) {
      return new Response(
        JSON.stringify({ error: "No se encontró una cuenta con ese DNI y email" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 3. Buscar el usuario en auth.users por email
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      return new Response(
        JSON.stringify({ error: "Error buscando usuario" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const user = users.users.find((u) => u.email === email);

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 4. Actualizar contraseña
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // 5. Marcar token como usado
    await supabaseAdmin
      .from("password_resets")
      .update({ used: true })
      .eq("token", token);

    return new Response(
      JSON.stringify({ success: true, message: "Contraseña actualizada correctamente" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});