'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Schema di validazione incorporato
const recoverySchema = {
  safeParse: (data: { email: string }) => {
    const email = data.email?.trim() ?? ''
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email) {
      return { success: false, error: { errors: [{ message: "L'indirizzo email è obbligatorio." }] } }
    }

    if (!emailRegex.test(email)) {
      return { success: false, error: { errors: [{ message: 'Inserisci un indirizzo email valido (es. nome@dominio.it).' }] } }
    }

    return { success: true, data: { email } }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StudentPortal() {
  const [step, setStep] = useState<'login' | 'change-password' | 'dashboard' | 'recovery'>('login')
  const [student, setStudent] = useState<any>(null)
  
  // Campi form login
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [number, setNumber] = useState('')
  const [password, setPassword] = useState('')

  // Campi nuova password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Campi recupero password
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySuccess, setRecoverySuccess] = useState('')

  // Stato per gestire l'apertura dei singoli eventi nella dashboard
  const [openEventId, setOpenEventId] = useState<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 1. Gestione Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .ilike('name', name.trim())
        .ilike('surname', surname.trim())
        .eq('number', number.trim())
        .eq('password', password.trim())
        .single()

      if (error || !data) {
        setError('Credenziali non valide. Controlla i dati inseriti.')
        setLoading(false)
        return
      }

      setStudent(data)
      setStep('change-password')
    } catch (err) {
      setError('Si è verificato un errore durante il login.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Salvataggio Nuova Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono.')
      return
    }
    if (newPassword.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('students')
        .update({ password: newPassword, has_changed_password: true })
        .eq('id', student.id)

      if (error) throw error

      setStudent({ ...student, password: newPassword })
      setStep('dashboard')
    } catch (err) {
      setError('Errore durante l\'aggiornamento della password.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Gestione Recupero Password con validazione
  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setRecoverySuccess('')

    const validationResult = recoverySchema.safeParse({ email: recoveryEmail })
    if (!validationResult.success) {
      const message = validationResult.error?.errors?.[0]?.message || 'Errore di validazione.'
      setError(message)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Errore durante la richiesta.')
      }

      setRecoverySuccess('Email inviata con successo! Controlla la tua casella di posta.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-2xl shadow-xl">
        
        {/* STEP 1: LOGIN */}
        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-2xl font-bold text-center mb-6">Accesso Allievo</h2>
            
            {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded text-sm">{error}</div>}
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cognome</label>
              <input type="text" value={surname} onChange={(e) => setSurname(e.target.value)} required className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Numero Identificativo</label>
              <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} required className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password Temporanea</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold py-2 rounded transition mt-4">
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>

            <div className="text-center mt-3">
              <button 
                type="button" 
                onClick={() => { setStep('recovery'); setError(''); }} 
                className="text-sm text-indigo-400 hover:underline"
              >
                Hai dimenticato la password?
              </button>
            </div>
          </form>
        )}

        {/* STEP 1.5: RECUPERO PASSWORD */}
        {step === 'recovery' && (
          <form onSubmit={handleRecovery} className="space-y-4">
            <h2 className="text-2xl font-bold text-center mb-2">Recupera Password</h2>
            <p className="text-sm text-gray-400 text-center mb-6">Inserisci la tua email registrata per ricevere una password provvisoria.</p>
            
            {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded text-sm">{error}</div>}
            {recoverySuccess && <div className="bg-green-500/20 border border-green-500 text-green-300 p-3 rounded text-sm">{recoverySuccess}</div>}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Indirizzo Email</label>
              <input 
                type="email" 
                value={recoveryEmail} 
                onChange={(e) => setRecoveryEmail(e.target.value)} 
                placeholder="nome@dominio.it"
                className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" 
              />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold py-2 rounded transition mt-4">
              {loading ? 'Invio in corso...' : 'Invia email di recupero'}
            </button>

            <div className="text-center mt-3">
              <button 
                type="button" 
                onClick={() => { setStep('login'); setError(''); setRecoverySuccess(''); }} 
                className="text-sm text-gray-400 hover:underline"
              >
                ← Torna al login
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: CAMBIO PASSWORD OBBLIGATORIO */}
        {step === 'change-password' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <h2 className="text-2xl font-bold text-center mb-2">Benvenuto, {student.name}!</h2>
            <p className="text-sm text-gray-400 text-center mb-6">Per la sicurezza del tuo account, imposta una nuova password personale.</p>
            
            {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded text-sm">{error}</div>}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Nuova Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Conferma Nuova Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 font-semibold py-2 rounded transition mt-4">
              {loading ? 'Salvataggio...' : 'Conferma e Vai alla Dashboard'}
            </button>
          </form>
        )}

        {/* STEP 3: LA DASHBOARD PERMANENTE CON TENDINE ACCORDION */}
        {step === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Area Personale</h2>
            <p className="text-indigo-400 font-medium mb-6">{student.name} {student.surname}</p>
            
            <h3 className="text-lg font-semibold mb-3">I tuoi Eventi e Corsi</h3>

            <div className="space-y-3 mb-6">
              {[
                { 
                  id: 1, 
                  title: "Saggio di Giugno", 
                  description: "Accedi alle foto, ai video e ai materiali esclusivi del saggio di fine anno.", 
                  content: "Qui trovi il link Google Drive / galleria con tutte le foto e le registrazioni audio/video delle esibizioni." 
                },
                { 
                  id: 2, 
                  title: "Evento di Settembre", 
                  description: "Preparazione e dettagli per il nuovo appuntamento musicale.", 
                  content: "Qui troverai le scalette, le assegnazioni dei brani e le basi di studio." 
                }
              ].map((event) => {
                const isOpen = openEventId === event.id;

                return (
                  <div key={event.id} className="bg-gray-700/50 rounded-xl border border-gray-700 overflow-hidden transition-all">
                    <button
                      type="button"
                      onClick={() => setOpenEventId(isOpen ? null : event.id)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-700/80 transition"
                    >
                      <div>
                        <h4 className="font-semibold text-white">{event.title}</h4>
                        <p className="text-xs text-gray-400 mt-1">{event.description}</p>
                      </div>

                      <svg 
                        className={`w-5 h-5 text-indigo-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="p-4 bg-gray-800/80 border-t border-gray-700 text-sm text-gray-300">
                        <p className="mb-3">{event.content}</p>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-xs font-semibold transition">
                          Accedi ai Materiali
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={() => setStep('login')} className="w-full bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded transition text-gray-300">
              Esci / Logout
            </button>
          </div>
        )}

      </div>
    </div>
  )
}