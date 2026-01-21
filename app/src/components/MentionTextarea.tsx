import { useState, useRef, useEffect } from 'react'
import { useProfiles } from '../hooks/useData'
import type { Profile } from '../lib/supabase'

type MentionTextareaProps = {
  value: string
  onChange: (value: string) => void
  onMention?: (userId: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function MentionTextarea({
  value,
  onChange,
  onMention,
  placeholder = "Escribe un comentario...",
  className = "",
  disabled = false
}: MentionTextareaProps) {
  const { data: profiles } = useProfiles()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionFilter, setSuggestionFilter] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Filter profiles based on current search
  const filteredProfiles = profiles?.filter(p => 
    p.full_name?.toLowerCase().includes(suggestionFilter.toLowerCase()) ||
    p.email?.toLowerCase().includes(suggestionFilter.toLowerCase())
  ).slice(0, 5) || []

  // Handle text changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursor = e.target.selectionStart
    onChange(newValue)
    setCursorPosition(cursor)

    // Check if we're typing a @mention
    const textBeforeCursor = newValue.slice(0, cursor)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
    
    if (mentionMatch) {
      setSuggestionFilter(mentionMatch[1])
      setShowSuggestions(true)
      setSelectedIndex(0)
    } else {
      setShowSuggestions(false)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredProfiles.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredProfiles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showSuggestions) {
        e.preventDefault()
        selectMention(filteredProfiles[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // Select a mention
  const selectMention = (profile: Profile) => {
    const textBeforeCursor = value.slice(0, cursorPosition)
    const textAfterCursor = value.slice(cursorPosition)
    
    // Find and replace the @mention trigger
    const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${profile.full_name || profile.email} `)
    const newValue = newTextBefore + textAfterCursor
    
    onChange(newValue)
    onMention?.(profile.id)
    setShowSuggestions(false)
    
    // Focus and set cursor position
    setTimeout(() => {
      textareaRef.current?.focus()
      const newPosition = newTextBefore.length
      textareaRef.current?.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Mention Suggestions Dropdown */}
      {showSuggestions && filteredProfiles.length > 0 && (
        <div 
          className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-[#E0E0E1] rounded-xl shadow-lg overflow-hidden z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            {filteredProfiles.map((profile, index) => (
              <button
                key={profile.id}
                onClick={() => selectMention(profile)}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                  index === selectedIndex 
                    ? 'bg-[#6353FF] text-white' 
                    : 'hover:bg-[#F7F7F8] text-[#3F4444]'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                  index === selectedIndex 
                    ? 'bg-white text-[#6353FF]' 
                    : 'bg-[#6353FF] text-white'
                }`}>
                  {profile.full_name?.[0] || profile.email?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{profile.full_name || 'Usuario'}</p>
                  <p className={`text-xs truncate ${
                    index === selectedIndex ? 'text-white/70' : 'text-[#8A8F8F]'
                  }`}>{profile.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Hint */}
      {!showSuggestions && value === '' && (
        <p className="absolute bottom-2 right-3 text-[10px] text-[#B0B5B5] pointer-events-none">
          Escribe @ para mencionar
        </p>
      )}
    </div>
  )
}

// Helper to extract mentioned user IDs from text
export function extractMentions(text: string, profiles: Profile[]): string[] {
  const mentionedIds: string[] = []
  
  profiles.forEach(profile => {
    const name = profile.full_name || profile.email
    if (name && text.includes(`@${name}`)) {
      mentionedIds.push(profile.id)
    }
  })
  
  return mentionedIds
}
