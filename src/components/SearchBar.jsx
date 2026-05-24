import { useState, useRef, useEffect } from 'react'

const MAX_SUGGESTIONS = 8

function padId(id) {
  return String(id).padStart(4, '0')
}

export default function SearchBar({ onSearch, loading, allNames = [] }) {
  const [value, setValue]               = useState('')
  const [open, setOpen]                 = useState(false)
  const [activeIndex, setActiveIndex]   = useState(-1)
  const wrapperRef = useRef(null)

  const q = value.trim().toLowerCase()

  const suggestions = q.length === 0 ? [] : allNames
    .filter(p =>
      p.name.includes(q) ||
      p.nameFr?.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const aMatch = a.nameFr?.toLowerCase().startsWith(q) || a.name.startsWith(q)
      const bMatch = b.nameFr?.toLowerCase().startsWith(q) || b.name.startsWith(q)
      if (aMatch && !bMatch) return -1
      if (!aMatch && bMatch) return 1
      return a.id - b.id
    })
    .slice(0, MAX_SUGGESTIONS)

  useEffect(() => {
    function onMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function selectSuggestion(englishName) {
    const entry = allNames.find(p => p.name === englishName)
    setValue(entry?.nameFr ?? englishName)
    setOpen(false)
    setActiveIndex(-1)
    onSearch(englishName)
  }

  function handleChange(e) {
    setValue(e.target.value)
    setOpen(true)
    setActiveIndex(-1)
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeIndex].name)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const input = value.trim()
    if (!input) return

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectSuggestion(suggestions[activeIndex].name)
      return
    }

    // Translate French name to English if needed
    const lower = input.toLowerCase()
    const frMatch = allNames.find(p => p.nameFr?.toLowerCase() === lower)
    const query = frMatch?.name ?? lower

    setOpen(false)
    onSearch(query)
  }

  const showDropdown = open && suggestions.length > 0

  return (
    <div className="search-wrapper" ref={wrapperRef}>
      <form className="search-bar" onSubmit={handleSubmit}>
        <input
          className="search-bar__input"
          type="text"
          placeholder="Nom FR ou EN, ou numéro (ex: Salameche, pika, 25)"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.trim() && setOpen(true)}
          disabled={loading}
          autoComplete="off"
          autoFocus
        />
        <button className="search-bar__btn" type="submit" disabled={loading || !value.trim()}>
          {loading ? '...' : 'Chercher'}
        </button>
      </form>

      {showDropdown && (
        <ul className="autocomplete-list" role="listbox">
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              className={`autocomplete-item${i === activeIndex ? ' autocomplete-item--active' : ''}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => selectSuggestion(p.name)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="autocomplete-item__id">#{padId(p.id)}</span>
              <span className="autocomplete-item__name">
                {p.nameFr ?? p.name}
              </span>
              {p.nameFr && (
                <span className="autocomplete-item__name-en">{p.name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
