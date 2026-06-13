// ═══════════════════════════════════════════════
//  authService.js · Servicio de autenticación
//  Single Responsibility: solo maneja login/logout/sesión
//  Dependency Inversion: depende de supabaseClient, no lo crea
//  ═══════════════════════════════════════════════

import { supabase } from '../supabaseClient.js'

class AuthService {
  constructor() {
    this._session = null
  }

  // ── LOGIN ──
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw new Error(this._translateError(error.message))
    this._session = data.session
    return data
  }

  // ── REGISTRO ──
  async register(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    })
    if (error) throw new Error(this._translateError(error.message))
    return data
  }

  // ── LOGOUT ──
  async logout() {
    await supabase.auth.signOut()
    this._session = null
  }

  // ── SESIÓN ACTUAL ──
  async getSession() {
    const { data } = await supabase.auth.getSession()
    this._session = data.session
    return data.session
  }

  // ── USUARIO ACTUAL ──
  getCurrentUser() {
    return this._session?.user || null
  }

  // ── VERIFICAR INACTIVIDAD (365 días) ──
  async checkInactivity(maxDays = 365) {
    const session = await this.getSession()
    if (!session) return { active: false, reason: 'no_session' }

    const lastSignIn = new Date(session.user.last_sign_in_at)
    const now = new Date()
    const diffDays = (now - lastSignIn) / (1000 * 60 * 60 * 24)

    if (diffDays > maxDays) {
      await this.logout()
      return { active: false, reason: 'inactive', days: Math.floor(diffDays) }
    }

    return { active: true }
  }

  // ── REACTIVAR CUENTA (desde email de inactividad) ──
  async reactivateAccount(token) {
    // Validar el token contra Supabase
    // En producción, el token sería un JWT firmado o un hash de recuperación
    // Aquí usamos el flujo de recuperación de contraseña de Supabase como validación
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery'
    })

    if (error) {
      throw new Error('El link de reactivación expiró o no es válido. Solicitá uno nuevo.')
    }

    // Reactivar en la tabla perfiles
    const { error: updateError } = await supabase
      .from('perfiles')
      .update({ activo: true, last_sign_in_at: new Date().toISOString() })
      .eq('id', data.user.id)

    if (updateError) {
      throw new Error('No se pudo reactivar la cuenta. Contactá al administrador.')
    }

    return { success: true, user: data.user }
  }

  // ── TRADUCCIÓN DE ERRORES ──
  _translateError(msg) {
    const errors = {
      'Invalid login credentials': 'Email o contraseña incorrectos.',
      'Email not confirmed': 'Confirmá tu email antes de ingresar.',
      'User already registered': 'Ya existe una cuenta con ese email.',
      'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
      'Unable to validate email address': 'El email ingresado no es válido.',
    }
    return errors[msg] || msg
  }
}

// Singleton
export const authService = new AuthService()
