import TypeBadge from './TypeBadge'

export default function WeaknessGrid({ weaknesses, resistances, immunities }) {
  const hasWeaknesses  = Object.keys(weaknesses).length > 0
  const hasResistances = Object.keys(resistances).length > 0
  const hasImmunities  = Object.keys(immunities).length > 0

  return (
    <div className="weakness-grid">
      {hasWeaknesses && (
        <section className="weakness-grid__section">
          <h3 className="weakness-grid__title weakness-grid__title--weak">Faiblesses</h3>
          <div className="weakness-grid__badges">
            {Object.entries(weaknesses)
              .sort((a, b) => b[1] - a[1])
              .map(([type, mult]) => (
                <TypeBadge key={type} type={type} multiplier={mult} />
              ))}
          </div>
        </section>
      )}

      {hasResistances && (
        <section className="weakness-grid__section">
          <h3 className="weakness-grid__title weakness-grid__title--resist">Résistances</h3>
          <div className="weakness-grid__badges">
            {Object.entries(resistances)
              .sort((a, b) => a[1] - b[1])
              .map(([type, mult]) => (
                <TypeBadge key={type} type={type} multiplier={mult} />
              ))}
          </div>
        </section>
      )}

      {hasImmunities && (
        <section className="weakness-grid__section">
          <h3 className="weakness-grid__title weakness-grid__title--immune">Immunités</h3>
          <div className="weakness-grid__badges">
            {Object.keys(immunities).map(type => (
              <TypeBadge key={type} type={type} multiplier={0} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
