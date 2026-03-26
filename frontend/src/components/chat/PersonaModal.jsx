import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import client from '../../api/client'
import toast from 'react-hot-toast'

const PRESETS = [
  { name: 'Document Reader', tone: 'neutral', custom_instructions: '' },
  { name: 'Legal Advisor', tone: 'formal', custom_instructions: 'Focus on legal terms, clauses, obligations, and compliance. Cite specific sections precisely.' },
  { name: 'Technical Expert', tone: 'technical', custom_instructions: 'Use technical terminology. Focus on specifications, architecture, and implementation details.' },
  { name: 'Customer Support', tone: 'friendly', custom_instructions: 'Be helpful and empathetic. Simplify complex information. Suggest actionable next steps.' },
  { name: 'Educator', tone: 'friendly', custom_instructions: 'Explain concepts clearly as if teaching. Break down complex topics into digestible parts.' },
]

const TONES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'technical', label: 'Technical' },
  { value: 'casual', label: 'Casual' },
]

export default function PersonaModal({ documentId, currentPersona, onClose, onSaved }) {
  const [name, setName] = useState(currentPersona?.name || 'Document Reader')
  const [tone, setTone] = useState(currentPersona?.tone || 'neutral')
  const [instructions, setInstructions] = useState(currentPersona?.custom_instructions || '')
  const [saving, setSaving] = useState(false)

  const applyPreset = (preset) => {
    setName(preset.name)
    setTone(preset.tone)
    setInstructions(preset.custom_instructions)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await client.put(`/api/documents/${documentId}/persona`, {
        name, tone, custom_instructions: instructions,
      })
      toast.success('Persona updated!')
      onSaved?.(res.data.persona)
      onClose()
    } catch {
      toast.error('Failed to save persona')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <button type="button" className="modal-backdrop" onClick={onClose} />
      <div className="premium-card modal-content w-full max-w-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl" style={{ color: 'var(--text)' }}>AI Persona</h2>
          <button onClick={onClose} className="btn-ghost !rounded-full !p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--muted-soft)' }}>Quick presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  name === preset.name
                    ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]'
                    : 'border-[var(--border)] hover:border-[var(--teal-soft)]'
                }`}
                style={{ color: name === preset.name ? undefined : 'var(--muted)' }}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] mb-1 block" style={{ color: 'var(--muted-soft)' }}>Persona Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
            maxLength={100}
            placeholder="e.g. Legal Advisor"
          />
        </div>

        {/* Tone */}
        <div className="mb-4">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] mb-1 block" style={{ color: 'var(--muted-soft)' }}>Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTone(t.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  tone === t.value
                    ? 'border-[var(--teal)] bg-[var(--teal-soft)] text-[var(--teal)]'
                    : 'border-[var(--border)] hover:border-[var(--teal-soft)]'
                }`}
                style={{ color: tone === t.value ? undefined : 'var(--muted)' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Instructions */}
        <div className="mb-6">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] mb-1 block" style={{ color: 'var(--muted-soft)' }}>Custom Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="field-input min-h-[80px] resize-y"
            maxLength={500}
            placeholder="e.g. Focus on legal terms and cite specific sections..."
            rows={3}
          />
          <p className="text-[10px] mt-1" style={{ color: 'var(--muted-soft)' }}>{instructions.length}/500</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary px-5 py-2 text-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Persona'}
          </button>
        </div>
      </div>
    </div>
  )
}
